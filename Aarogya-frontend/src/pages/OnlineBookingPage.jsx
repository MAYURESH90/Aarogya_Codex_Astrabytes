import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function OnlineBookingPage() {
  const { user } = useAuth();
  
  const [pinCodeSearch, setPinCodeSearch] = useState("");
  const [searched, setSearched] = useState(false);
  
  const [hospitals, setHospitals] = useState([]);
  const [opds, setOpds] = useState([]);
  const [specialists, setSpecialists] = useState([]);
  
  // Categorization: 'GENERAL' or 'SPECIALIST'
  const [consultationType, setConsultationType] = useState("GENERAL");

  const [formData, setFormData] = useState({
    hospitalId: "",
    opdId: "",
    specialistId: "",
    patientName: "",
    phone: "",
    age: "",
    gender: "MALE",
  });

  const [tokenResult, setTokenResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  // Prefill user data if logged in
  useEffect(() => {
    if (user && user.role === 'PATIENT') {
      setFormData(prev => ({
        ...prev,
        patientName: user.name || "",
        phone: user.phone || ""
      }));
      // Fetch more details from /patients/me
      const fetchPatient = async () => {
        try {
          const res = await axios.get(`${apiUrl}/patients/me`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('aarogya_jwt')}` }
          });
          const patient = res.data.data;
          setFormData(prev => ({
            ...prev,
            gender: patient.gender || "MALE",
            age: patient.dateOfBirth ? Math.floor((new Date() - new Date(patient.dateOfBirth).getTime()) / 3.15576e+10) : prev.age
          }));
        } catch (e) {
          console.error("Failed to load patient profile:", e);
        }
      };
      fetchPatient();
    }
  }, [user, apiUrl]);

  const searchHospitals = async () => {
    try {
      setLoading(true);
      setError("");
      setSearched(true);
      
      const res = await axios.get(`${apiUrl}/hospitals`, {
        params: { pinCode: pinCodeSearch, isGovernment: true }
      });
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setHospitals(list);
      if (list.length > 0) {
        setFormData((prev) => ({ ...prev, hospitalId: list[0]._id }));
      } else {
        setFormData((prev) => ({ ...prev, hospitalId: "" }));
      }
    } catch (err) {
      console.error("Failed to fetch hospitals:", err);
      setError("Failed to fetch hospitals");
    } finally {
      setLoading(false);
    }
  };

  // Fetch OPDs & Specialists whenever hospital changes
  useEffect(() => {
    if (!formData.hospitalId) {
      setOpds([]);
      setSpecialists([]);
      return;
    }

    const fetchDepartmentsAndSpecialists = async () => {
      // Fetch General OPDs
      try {
        let res;
        try {
          res = await axios.get(`${apiUrl}/opds`, { params: { hospitalId: formData.hospitalId } });
        } catch {
          res = await axios.get(`${apiUrl}/opd`, { params: { hospitalId: formData.hospitalId } });
        }
        let list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        
        const filtered = list.filter(
          (o) => !o.hospital || o.hospital === formData.hospitalId || o.hospital._id === formData.hospitalId
        );
        const finalOpds = filtered.length > 0 ? filtered : list;
        setOpds(finalOpds);

        if (finalOpds.length > 0) {
          setFormData((prev) => ({ ...prev, opdId: finalOpds[0]._id }));
        }
      } catch (err) {
        console.error("Failed to load OPDs:", err);
      }

      // Fetch Specialists
      try {
        const res = await axios.get(`${apiUrl}/specialists`, { params: { hospitalId: formData.hospitalId } });
        const specList = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setSpecialists(specList);
        if (specList.length > 0) {
          setFormData((prev) => ({ ...prev, specialistId: specList[0]._id }));
        }
      } catch (err) {
        try {
          const resDoc = await axios.get(`${apiUrl}/doctors`, { params: { hospitalId: formData.hospitalId } });
          const docList = Array.isArray(resDoc.data) ? resDoc.data : resDoc.data?.data || [];
          setSpecialists(docList);
          if (docList.length > 0) {
            setFormData((prev) => ({ ...prev, specialistId: docList[0]._id }));
          }
        } catch (e) {
          console.error("Failed to load specialists/doctors:", e);
        }
      }
    };

    fetchDepartmentsAndSpecialists();
  }, [apiUrl, formData.hospitalId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setTokenResult(null);
    
    const token = localStorage.getItem('aarogya_jwt');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // 1. Update patient profile first if logged in
    if (user && user.role === 'PATIENT') {
      try {
        // approximate DOB from age for simplicity
        const dateOfBirth = new Date();
        dateOfBirth.setFullYear(dateOfBirth.getFullYear() - Number(formData.age));
        
        await axios.put(`${apiUrl}/patients/me`, {
          name: formData.patientName,
          gender: formData.gender,
          dateOfBirth: dateOfBirth.toISOString()
        }, { headers });
      } catch (err) {
        console.error("Failed to update patient profile:", err);
      }
    }

    const payload = {
      hospitalId: formData.hospitalId,
      opdId: consultationType === "GENERAL" ? formData.opdId : undefined,
      specialistId: consultationType === "SPECIALIST" ? formData.specialistId : undefined,
      consultationType,
      patientName: formData.patientName,
      patientPhone: formData.phone.startsWith("+91") ? formData.phone : `+91${formData.phone.trim()}`,
      // Assume first session for simplicity if not selectable in UI yet
      sessionId: "auto" 
    };
    
    // We must pass sessionId according to backend requirements, but backend usually handles "auto" or we need to fetch sessions.
    // For now, if we don't have sessionId, we will fetch the first active session for this doctor/OPD to inject it.
    let sessionIdToUse = "";
    try {
      const docId = consultationType === "GENERAL" ? undefined : formData.specialistId;
      const sessionRes = await axios.get(`${apiUrl}/sessions`, {
        params: { opdId: formData.opdId, doctorId: docId }
      });
      const sessions = sessionRes.data?.data || [];
      if (sessions.length > 0) {
        sessionIdToUse = sessions[0]._id;
      }
    } catch(err) {
      console.error("Could not fetch sessions", err);
    }
    
    if (!sessionIdToUse) {
      setError("No active sessions found for this OPD/Doctor.");
      setLoading(false);
      return;
    }
    
    payload.sessionId = sessionIdToUse;
    // We also need doctorId if general
    if (consultationType === "GENERAL") {
      try {
        const dres = await axios.get(`${apiUrl}/doctors`, { params: { opdId: formData.opdId }});
        if (dres.data?.data?.length > 0) {
          payload.doctorId = dres.data.data[0]._id;
        }
      } catch (err) {}
    } else {
      payload.doctorId = formData.specialistId;
    }

    try {
      const res = await axios.post(`${apiUrl}/tokens/online`, payload, { headers });
      setTokenResult(res.data?.data || res.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || "Failed to book token. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto my-10 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm font-sans">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Online OPD & Specialist Booking</h1>
        <p className="text-sm text-slate-500 mt-1">Select your hospital, pick a department or specialist, and generate your queue token.</p>
      </div>

      {error && (
        <div className="p-3 mb-5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {tokenResult ? (
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">Booking Confirmed</div>
          <div className="text-4xl font-extrabold text-slate-900">{tokenResult.tokenNumber || "Token Generated"}</div>
          <p className="text-sm text-slate-600">Please present this token at the registration desk upon arrival.</p>
          {tokenResult.predictedWaitMinutes !== undefined && (
            <p className="text-sm font-medium text-slate-800">Predicted Wait: {tokenResult.predictedWaitMinutes} mins</p>
          )}
          <button
            onClick={() => setTokenResult(null)}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
          >
            Book Another Token
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Pincode Search */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              1. Search Nearby Government Hospitals
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter 6-digit Pincode (e.g. 421301)"
                value={pinCodeSearch}
                onChange={(e) => setPinCodeSearch(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={searchHospitals}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-900 whitespace-nowrap"
              >
                Search
              </button>
            </div>
          </div>

          {searched && hospitals.length === 0 && (
            <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
              No government hospitals found for this pincode. Please try another one (e.g. 421301).
            </div>
          )}

          {hospitals.length > 0 && (
            <>
              {/* Hospital Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  2. Select Hospital
                </label>
                <select
                  value={formData.hospitalId}
                  onChange={(e) => setFormData({ ...formData, hospitalId: e.target.value })}
                  className="w-full p-3 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                >
                  {hospitals.map((h) => (
                    <option key={h._id} value={h._id}>
                      {h.name} {h.address?.city ? `— ${h.address.city}` : ""} ({h.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Categorization Tabs: General OPD vs Specialist */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  3. Consultation Category
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setConsultationType("GENERAL")}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                      consultationType === "GENERAL"
                        ? "bg-white text-sky-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    General OPD
                  </button>
                  <button
                    type="button"
                    onClick={() => setConsultationType("SPECIALIST")}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                      consultationType === "SPECIALIST"
                        ? "bg-white text-sky-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Specialist Clinic
                  </button>
                </div>
              </div>

              {/* Conditional Dropdown: General OPD vs Specialist Doctor */}
              {consultationType === "GENERAL" ? (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Select OPD Department
                  </label>
                  <select
                    value={formData.opdId}
                    onChange={(e) => setFormData({ ...formData, opdId: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    required
                  >
                    {opds.length > 0 ? (
                      opds.map((opd) => (
                        <option key={opd._id} value={opd._id}>
                          {opd.name} {opd.department ? `(${opd.department})` : ""}
                        </option>
                      ))
                    ) : (
                      <option value="">No General OPDs found for this hospital</option>
                    )}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Select Specialist / Doctor
                  </label>
                  <select
                    value={formData.specialistId}
                    onChange={(e) => setFormData({ ...formData, specialistId: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    required
                  >
                    {specialists.length > 0 ? (
                      specialists.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name} {s.specialization ? `— ${s.specialization}` : s.department ? `(${s.department})` : ""}
                        </option>
                      ))
                    ) : (
                      <option value="">No specialists listed for this hospital</option>
                    )}
                  </select>
                </div>
              )}

              {/* Patient Personal Details */}
              <div className="pt-2 border-t border-slate-200">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                  4. Patient Information & Confirmation
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Patient Full Name</label>
                    <input
                      type="text"
                      required
                      value={formData.patientName}
                      onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                      placeholder="e.g. Ramesh Patil"
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="10-digit number"
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Age</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="120"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Gender</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
              >
                {loading ? "Processing..." : "Confirm & Book Token"}
              </button>
            </>
          )}
        </form>
      )}
    </div>
  );
}
