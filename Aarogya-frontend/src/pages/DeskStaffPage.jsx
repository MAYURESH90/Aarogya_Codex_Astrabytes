import React, { useState } from 'react';
import api from '../services/api';
import { Printer, UserCheck, RefreshCw } from 'lucide-react';

export default function DeskStaffPage() {
  const [form, setForm] = useState({
    tokenNumber: '',
    patientName: '',
    patientPhone: '',
    hospitalId: '',
    opdId: '',
    doctorId: '',
    sessionId: ''
  });
  const [latestToken, setLatestToken] = useState(null);
  const [reentryTokenId, setReentryTokenId] = useState('');
  const [reentryReason, setReentryReason] = useState('Patient returned from diagnostic lab');

  const handleRegisterPaper = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/tokens/paper', {
        tokenNumber: form.tokenNumber,
        patient: { name: form.patientName, phone: form.patientPhone || null },
        hospitalId: form.hospitalId,
        opdId: form.opdId,
        doctorId: form.doctorId,
        sessionId: form.sessionId
      });
      setLatestToken(res.data);
      setForm({ ...form, tokenNumber: '', patientName: '', patientPhone: '' });
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Registration failed');
    }
  };

  const handleReentry = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/queue/${form.sessionId}/re-entry`, {
        tokenId: reentryTokenId,
        reason: reentryReason
      });
      alert(res.data.message);
      setReentryTokenId('');
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Re-entry failed');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 font-sans">
      <h1 className="text-2xl font-bold text-slate-800">OPD Desk Staff Registration Console</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Walk-in Slip Generator */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Register Walk-in (Paper Slip)</h2>
          <form onSubmit={handleRegisterPaper} className="space-y-3">
            <input
              type="text"
              placeholder="Session ID"
              value={form.sessionId}
              onChange={(e) => setForm({ ...form, sessionId: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Hospital ID"
                value={form.hospitalId}
                onChange={(e) => setForm({ ...form, hospitalId: e.target.value })}
                required
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="OPD ID"
                value={form.opdId}
                onChange={(e) => setForm({ ...form, opdId: e.target.value })}
                required
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="Doctor ID"
                value={form.doctorId}
                onChange={(e) => setForm({ ...form, doctorId: e.target.value })}
                required
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <input
              type="text"
              placeholder="Paper Slip Token # (e.g. P105)"
              value={form.tokenNumber}
              onChange={(e) => setForm({ ...form, tokenNumber: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded-lg text-sm uppercase font-mono"
            />
            <input
              type="text"
              placeholder="Patient Name"
              value={form.patientName}
              onChange={(e) => setForm({ ...form, patientName: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
            <input
              type="tel"
              placeholder="Phone (Optional for SMS)"
              value={form.patientPhone}
              onChange={(e) => setForm({ ...form, patientPhone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg text-sm transition-colors"
            >
              Generate Paper Token
            </button>
          </form>
        </div>

        {/* Smart Re-entry Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-amber-600" /> Smart Re-entry for Absentee
          </h2>
          <form onSubmit={handleReentry} className="space-y-3">
            <input
              type="text"
              placeholder="Token ID (to restore from skip/no-show)"
              value={reentryTokenId}
              onChange={(e) => setReentryTokenId(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
            />
            <input
              type="text"
              placeholder="Reason for Return"
              value={reentryReason}
              onChange={(e) => setReentryReason(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-sm transition-colors"
            >
              Restore into Active Queue
            </button>
          </form>
        </div>
      </div>

      {/* Printable Thermal Slip Output */}
      {latestToken && (
        <div id="printable-slip" className="p-4 border-2 border-dashed border-slate-400 rounded-lg max-w-xs bg-amber-50">
          <div className="text-center border-b pb-2 mb-2">
            <h3 className="font-bold text-lg">AAROGYA OPD</h3>
            <p className="text-xs text-slate-500">Walk-in Consultation Slip</p>
          </div>
          <div className="text-center my-3">
            <span className="text-4xl font-black">{latestToken.token.tokenNumber}</span>
            <p className="text-xs font-semibold mt-1">Queue Position: #{latestToken.token.queuePosition}</p>
          </div>
          <div className="text-xs space-y-1 border-t pt-2">
            <p>Wait: ~{latestToken.prediction.predictedWaitMinutes} mins</p>
            <p>Est. Time: {new Date(latestToken.prediction.estimatedConsultationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-slate-400">Prediction: {latestToken.prediction.predictionSource}</p>
          </div>
          <button
            onClick={() => window.print()}
            className="mt-4 w-full py-1.5 bg-slate-900 text-white text-xs font-bold rounded flex items-center justify-center gap-1"
          >
            <Printer className="w-3.5 h-3.5" /> Print Thermal Slip
          </button>
        </div>
      )}
    </div>
  );
}
