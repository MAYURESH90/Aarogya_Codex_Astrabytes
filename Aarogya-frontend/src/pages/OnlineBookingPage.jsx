import React, { useState, useEffect } from "react";
import axios from "axios";

export default function OnlineBookingPage() {
  const [hospitals, setHospitals] = useState([]);
  const [opds, setOpds] = useState([]);
  const [formData, setFormData] = useState({
    hospitalId: "",
    opdId: "",
    patientName: "",
    phone: "",
    age: "",
    gender: "MALE",
  });
  const [tokenResult, setTokenResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  // 1. Fetch available hospitals on initial render
  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const res = await axios.get(`${apiUrl}/hospitals`);
        const hospitalList = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setHospitals(hospitalList);
        if (hospitalList.length > 0) {
          setFormData((prev) => ({ ...prev, hospitalId: hospitalList[0]._id }));
        }
      } catch (err) {
        console.error("Failed to load hospitals", err);
      }
    };
    fetchHospitals();
  }, [apiUrl]);

  // 2. Fetch OPD departments whenever selected hospital changes
  useEffect(() => {
    const fetchOPDs = async () => {
      try {
        let res;
        try {
          res = await axios.get(`${apiUrl}/opds`, {
            params: formData.hospitalId ? { hospitalId: formData.hospitalId } : {},
          });
        } catch (e) {
          res = await axios.get(`${apiUrl}/opd`, {
            params: formData.hospitalId ? { hospitalId: formData.hospitalId } : {},
          });
        }
        let opdList = Array.isArray(res.data) ? res.data : res.data?.data || [];

        // Filter OPDs belonging to the chosen hospital if backend sends all
        if (formData.hospitalId) {
          const filtered = opdList.filter(
            (o) =>
              !o.hospital ||
              o.hospital === formData.hospitalId ||
              o.hospital._id === formData.hospitalId
          );
          if (filtered.length > 0) {
            opdList = filtered;
          }
        }

        setOpds(opdList);
        if (opdList.length > 0) {
          setFormData((prev) => ({ ...prev, opdId: opdList[0]._id }));
        } else {
          setFormData((prev) => ({ ...prev, opdId: "" }));
        }
      } catch (err) {
        console.error("Failed to load OPDs", err);
      }
    };

    if (formData.hospitalId) {
      fetchOPDs();
    }
  }, [apiUrl, formData.hospitalId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setTokenResult(null);

    try {
      const res = await axios.post(`${apiUrl}/tokens/online`, formData);
      setTokenResult(res.data?.data || res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to book appointment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto my-10 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm font-sans">
      <h1 className="text-2xl font-bold text-slate-800">Online OPD Booking</h1>
      <p className="text-sm text-slate-500 mb-6">
        Select your nearby hospital and department to book your consultation token.
      </p>

      {error && (
        <div className="p-3 mb-4 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {tokenResult ? (
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">Booking Confirmed</div>
          <div className="text-4xl font-extrabold text-slate-900">
            {tokenResult.tokenNumber || "Token Generated"}
          </div>
          <p className="text-sm text-slate-600">
            Please present this token number upon arrival at the hospital reception.
          </p>
          <button
            onClick={() => setTokenResult(null)}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
          >
            Book Another Token
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Hospital Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Nearby Hospital
            </label>
            <select
              value={formData.hospitalId}
              onChange={(e) => setFormData({ ...formData, hospitalId: e.target.value })}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-sky-500"
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

          {/* OPD Department Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Department (OPD)
            </label>
            <select
              value={formData.opdId}
              onChange={(e) => setFormData({ ...formData, opdId: e.target.value })}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-sky-500"
              required
            >
              {opds.length > 0 ? (
                opds.map((opd) => (
                  <option key={opd._id} value={opd._id}>
                    {opd.name} {opd.department ? `(${opd.department})` : ""}
                  </option>
                ))
              ) : (
                <option value="">No active OPDs found for this hospital</option>
              )}
            </select>
          </div>

          {/* Patient Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Patient Full Name</label>
              <input
                type="text"
                required
                value={formData.patientName}
                onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                placeholder="e.g. Ramesh Patil"
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="10-digit mobile number"
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Age</label>
              <input
                type="number"
                required
                min="1"
                max="120"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-sky-500"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !formData.opdId}
            className="w-full py-3 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-bold rounded-lg text-sm transition-colors"
          >
            {loading ? "Generating Token..." : "Confirm & Book Token"}
          </button>
        </form>
      )}
    </div>
  );
}
