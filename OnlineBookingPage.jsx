import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import LiveSmsInbox from "../components/LiveSmsInbox";
import { socket, joinTokenRoom, joinSessionRoom } from "../services/socket";
import { Clock, Users, Building2, User, Activity, CheckCircle, Phone, Smartphone, AlertCircle, FileText } from 'lucide-react';

export default function OnlineBookingPage() {
  const { user } = useAuth();
  
  const [pinCodeSearch, setPinCodeSearch] = useState("421301");
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
    phone: "+91 ",
    age: "30",
    gender: "MALE",
  });

  const [tokenResult, setTokenResult] = useState(null);
  const [queueData, setQueueData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  // Prefill user data if logged in
  useEffect(() => {
    if (user && user.role === 'PATIENT') {
      setFormData(prev => ({
        ...prev,
        patientName: user.name || prev.patientName,
        phone: user.phone || prev.phone
      }));
      const fetchPatient = async () => {
        try {
          const res = await axios.get(`${apiUrl}/patients/me`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('aarogya_jwt')}` }
          });
          const patient = res.data.data;
          setFormData(prev => ({
            ...prev,
            gender: patient.gender || prev.gender,
            phone: patient.phone || prev.phone,
            patientName: patient.name || prev.patientName
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
      setError("Failed to fetch hospitals. Please check server connection.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-search on mount
  useEffect(() => {
    searchHospitals();
  }, []);

  // Fetch OPDs & Specialists whenever hospital changes
  useEffect(() => {
    if (!formData.hospitalId) {
      setOpds([]);
      setSpecialists([]);
      return;
    }

    const fetchDepartmentsAndSpecialists = async () => {
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

  // Live Queue Fetch & Real-time Socket Subscription when Token is generated
  useEffect(() => {
    if (!tokenResult?.token?.sessionId) return;
    const sessionId = tokenResult.token.sessionId;
    const tokenId = tokenResult.token.id;

    joinSessionRoom(sessionId);
    joinTokenRoom(tokenId);

    const fetchLiveQueue = async () => {
      try {
        const res = await axios.get(`${apiUrl}/queue/${sessionId}/live`);
        setQueueData(res.data?.data || res.data);
      } catch (e) {
        console.error("Failed to fetch live queue:", e);
      }
    };

    fetchLiveQueue();

    const handleQueueUpdate = () => {
      fetchLiveQueue();
    };

    socket.on('queue_update', handleQueueUpdate);
    socket.on('token_eta_update', handleQueueUpdate);

    return () => {
      socket.off('queue_update', handleQueueUpdate);
      socket.off('token_eta_update', handleQueueUpdate);
    };
  }, [tokenResult, apiUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setTokenResult(null);
    setQueueData(null);
    
    // Format custom phone number cleanly
    let rawPhone = formData.phone ? formData.phone.trim() : "";
    if (rawPhone && !rawPhone.startsWith("+")) {
      rawPhone = `+91${rawPhone.replace(/^0+/, '')}`;
    }

    if (!rawPhone || rawPhone.length < 10) {
      setError("Please provide a valid recipient phone number for SMS notifications.");
      setLoading(false);
      return;
    }

    const token = localStorage.getItem('aarogya_jwt');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

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
      setError("No active OPD sessions found for the selected department/doctor. Please select another OPD.");
      setLoading(false);
      return;
    }

    let doctorIdToUse = formData.specialistId;
    if (consultationType === "GENERAL") {
      try {
        const dres = await axios.get(`${apiUrl}/doctors`, { params: { opdId: formData.opdId }});
        if (dres.data?.data?.length > 0) {
          doctorIdToUse = dres.data.data[0]._id;
        }
      } catch (err) {}
    }

    const payload = {
      hospitalId: formData.hospitalId,
      opdId: consultationType === "GENERAL" ? formData.opdId : undefined,
      specialistId: consultationType === "SPECIALIST" ? formData.specialistId : undefined,
      doctorId: doctorIdToUse,
      consultationType,
      patientName: formData.patientName || "Patient",
      patientPhone: rawPhone,
      sessionId: sessionIdToUse
    };

    try {
      const res = await axios.post(`${apiUrl}/tokens/online`, payload, { headers });
      const data = res.data?.data || res.data;
      
      // Ensure digitalTokenId fallback if missing
      if (data.token && !data.token.digitalTokenId && data.token.id) {
        data.token.digitalTokenId = `#TKN-${data.token.id.slice(-4).toUpperCase()}`;
      }
      setTokenResult(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || "Failed to book token. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto my-8 p-4 sm:p-6 space-y-6 font-sans">
      <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Hospital Appointment Booking & Digital Token Generation</h1>
        <p className="text-sm text-slate-500 mt-1">
          Select your hospital department, enter your target mobile number for live SMS updates, and track your queue in real-time.
        </p>
      </div>

      {error && (
        <div className="p-4 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Booking Form / Token Result View */}
      {tokenResult ? (
        <div className="space-y-6">
          {/* Post-Booking Token Confirmation Card */}
          <div className="p-6 bg-gradient-to-br from-emerald-50 via-white to-sky-50 border border-emerald-200 rounded-2xl shadow-md text-left space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-emerald-100 pb-4 gap-2">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Booking Confirmed & Token Generated
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-2">
                  Token ID: <span className="text-emerald-700 font-mono text-2xl tracking-tight">{tokenResult.token?.digitalTokenId || `#TKN-${tokenResult.token?.id?.slice(-4).toUpperCase()}`}</span>
                </h2>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 uppercase font-bold block">Token Number</span>
                <span className="text-3xl font-black text-slate-900">{tokenResult.token?.tokenNumber || "O101"}</span>
              </div>
            </div>

            {/* Comprehensive Token Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block">Patient Details</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{tokenResult.token?.patientName || formData.patientName || "Patient"}</p>
                <p className="text-slate-600 font-mono mt-0.5 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-sky-600" /> Recipient: <strong>{tokenResult.token?.patientPhone || formData.phone}</strong>
                </p>
              </div>

              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block">Doctor & OPD Department</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{tokenResult.token?.doctorName || "Assigned Specialist"}</p>
                <p className="text-slate-600 mt-0.5">
                  {tokenResult.token?.opdName || "General OPD"} — Room <strong>{tokenResult.token?.roomNumber || "101"}</strong>
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-500 font-bold uppercase text-[10px] block">Current Queue Position</span>
                <p className="text-xl font-black text-slate-900 mt-0.5">
                  #{tokenResult.token?.queuePosition ?? "1"}
                </p>
              </div>

              <div className="p-3 bg-sky-50 rounded-lg">
                <span className="text-sky-700 font-bold uppercase text-[10px] block">Estimated Wait Time</span>
                <p className="text-xl font-black text-sky-900 mt-0.5">
                  {tokenResult.prediction?.predictedWaitMinutes ?? "10"} <span className="text-xs font-normal text-sky-700">mins</span>
                </p>
                {tokenResult.prediction?.estimatedConsultationTime && (
                  <span className="text-[11px] text-sky-700 font-semibold block mt-0.5">
                    Expected: {new Date(tokenResult.prediction.estimatedConsultationTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>

            {/* Automated SMS Notice */}
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center gap-2.5 text-xs text-sky-800">
              <Phone className="w-4 h-4 text-sky-600 shrink-0" />
              <span>
                Automated confirmation SMS & live status alerts dispatched to <strong>{tokenResult.token?.patientPhone || formData.phone}</strong>.
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2 justify-end">
              <button
                type="button"
                onClick={() => setTokenResult(null)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors"
              >
                + Book Another Appointment
              </button>
            </div>
          </div>

          {/* Integrated Live OPD Queue Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-sky-600" />
                Live OPD Queue Status
              </h2>
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Real-time Sync Active
              </span>
            </div>

            {queueData ? (
              <div className="space-y-4">
                {/* Currently Consulting */}
                <div>
                  <div className="text-xs font-bold uppercase text-slate-400 mb-2 tracking-wider">Currently Consulting</div>
                  {queueData.currentConsultation ? (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-black text-emerald-900">{queueData.currentConsultation.tokenNumber}</span>
                        <span className="px-2.5 py-1 bg-emerald-200 text-emerald-800 text-xs font-bold rounded-md">IN ROOM {tokenResult.token?.roomNumber || "101"}</span>
                      </div>
                      <span className="text-xs font-medium text-emerald-700">{queueData.currentConsultation.elapsedMinutes || 2} mins elapsed</span>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-500 italic">
                      No patient currently inside consultation room.
                    </div>
                  )}
                </div>

                {/* Waiting List */}
                <div>
                  <div className="text-xs font-bold uppercase text-slate-400 mb-2 tracking-wider">
                    Waiting List ({queueData.unifiedQueue?.length || 0} Patients)
                  </div>
                  {queueData.unifiedQueue && queueData.unifiedQueue.length > 0 ? (
                    <div className="space-y-2">
                      {queueData.unifiedQueue.map((qToken) => {
                        const isMyToken = qToken.tokenNumber === tokenResult.token?.tokenNumber || qToken.id === tokenResult.token?.id;
                        return (
                          <div 
                            key={qToken.id || qToken.tokenNumber} 
                            className={`p-3 rounded-xl border flex justify-between items-center transition-all ${
                              isMyToken ? 'bg-sky-50 border-sky-300 ring-2 ring-sky-400/20' : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${isMyToken ? 'bg-sky-200 text-sky-900' : 'bg-slate-100 text-slate-600'}`}>
                                #{qToken.queuePosition}
                              </span>
                              <span className={`text-sm font-black ${isMyToken ? 'text-sky-900' : 'text-slate-800'}`}>
                                {qToken.tokenNumber}
                              </span>
                              {isMyToken && (
                                <span className="px-2 py-0.5 bg-sky-600 text-white text-[10px] font-bold rounded-md">YOUR TOKEN</span>
                              )}
                            </div>
                            <span className="text-xs font-medium text-slate-500">
                              Est. Wait ~{qToken.predictedWaitMinutes} mins
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-500 italic">
                      Queue is currently empty.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-400">Loading live queue state...</div>
            )}
          </div>

          {/* Real-time SMS Inbox Simulator Widget */}
          <LiveSmsInbox targetPhone={tokenResult.token?.patientPhone || formData.phone} tokenId={tokenResult.token?.id} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-6">
          {/* Step 1: Pincode Search */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              1. Search Nearby Hospitals
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Pincode (e.g. 421301)"
                value={pinCodeSearch}
                onChange={(e) => setPinCodeSearch(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={searchHospitals}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 whitespace-nowrap"
              >
                Search
              </button>
            </div>
          </div>

          {searched && hospitals.length === 0 && (
            <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
              No hospitals found for this pincode. Showing default government hospitals.
            </div>
          )}

          {hospitals.length > 0 && (
            <>
              {/* Step 2: Hospital Selection */}
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

              {/* Step 3: Consultation Category */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  3. Consultation Category
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setConsultationType("GENERAL")}
                    className={`py-2.5 text-xs font-bold rounded-lg transition-all ${
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
                    className={`py-2.5 text-xs font-bold rounded-lg transition-all ${
                      consultationType === "SPECIALIST"
                        ? "bg-white text-sky-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Specialist Clinic
                  </button>
                </div>
              </div>

              {/* Step 4: Department / Specialist Selection */}
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

              {/* Step 5: Patient Details & CUSTOM PHONE INPUT */}
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  4. Patient Information & Custom Contact Phone
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-600 font-medium mb-1">Patient Full Name</label>
                    <input
                      type="text"
                      required
                      value={formData.patientName}
                      onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                      placeholder="e.g. Ramesh Patil"
                      className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-700 font-bold mb-1 flex items-center justify-between">
                      <span>Target Mobile Number (for Live SMS)</span>
                      <span className="text-[10px] text-sky-600 font-normal">Custom Recipient</span>
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+91 9876543210"
                        className="w-full p-3 pl-9 border border-sky-400 bg-sky-50/30 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                      <Phone className="w-4 h-4 text-sky-600 absolute left-3 top-3.5" />
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      All live SMS notifications & queue alerts will be sent to this number.
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-600 font-medium mb-1">Age</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="120"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-medium mb-1">Gender</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full p-3 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                className="w-full py-4 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm transition-colors shadow-md flex justify-center items-center gap-2"
              >
                {loading ? "Processing Booking..." : "Confirm & Book Token"}
              </button>
            </>
          )}

          {/* Live SMS Inbox Preview always visible for testing */}
          <LiveSmsInbox targetPhone={formData.phone} />
        </form>
      )}
    </div>
  );
}
