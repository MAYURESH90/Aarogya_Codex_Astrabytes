import React, { useState, useEffect } from "react";
import axios from "axios";

export default function OnlineBookingPage() {
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

  // 1. Fetch Hospitals on Mount
  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const res = await axios.get(`${apiUrl}/hospitals`);
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setHospitals(list);
        if (list.length > 0) {
          setFormData((prev) => ({ ...prev, hospitalId: list[0]._id }));
        }
      } catch (err) {
        console.error("Failed to fetch hospitals:", err);
      }
    };
    fetchHospitals();
  }, [apiUrl]);

  // 2. Fetch OPDs & Specialists whenever hospital changes
  useEffect(() => {
    if (!formData.hospitalId) return;

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
        
        // Filter by chosen hospital if backend sends all
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
        // If /specialists is not a standalone route, doctors from /doctors are used
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

    const payload = {
      hospitalId: formData.hospitalId,
      opdId: consultationType === "GENERAL" ? formData.opdId : undefined,
      specialistId: consultationType === "SPECIALIST" ? formData.specialistId : undefined,
      consultationType,
      patientName: formData.patientName,
      phone: formData.phone.startsWith("+91") ? formData.phone : `+91${formData.phone.trim()}`,
      age: Number(formData.age),
      gender: formData.gender,
    };

    try {
      const res = await axios.post(`${apiUrl}/tokens/online`, payload);
      setTokenResult(res.data?.data || res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to book token. Please try again.");
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
          <button
            onClick={() => setTokenResult(null)}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
          >
            Book Another Token
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Hospital Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              1. Select Hospital
            </label>
            <select
              value={formData.hospitalId}
              onChange={(e) => setFormData({ ...formData, hospitalId: e.target.value })}
              className="w-full p-3 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            >
              {hospitals.length > 0 ? (
                hospitals.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.name} {h.address?.city ? `— ${h.address.city}` : ""} ({h.code})
                  </option>
                ))
              ) : (
                <option value="">Loading hospitals...</option>
              )}
            </select>
          </div>

          {/* Categorization Tabs: General OPD vs Specialist */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              2. Consultation Category
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
              3. Patient Information
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
            {loading ? "Generating Digital Token..." : "Confirm & Book Token"}
          </button>
        </form>
      )}
    </div>
  );
}
