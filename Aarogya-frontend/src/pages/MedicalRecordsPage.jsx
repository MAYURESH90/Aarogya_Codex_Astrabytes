import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { FileText, Upload, ShieldCheck, Activity } from 'lucide-react';

export default function MedicalRecordsPage() {
  const [timeline, setTimeline] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [consentError, setConsentError] = useState(false);

  const fetchTimeline = async () => {
    try {
      const res = await api.get('/medical/timeline');
      setTimeline(res.data.data);
      setConsentError(false);
    } catch (err) {
      if (err.response?.status === 403) setConsentError(true);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    const formData = new FormData();
    formData.append('document', file);
    setUploading(true);
    try {
      await api.post('/medical/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Document processed with OCR');
      setFile(null);
      fetchTimeline();
    } catch (err) {
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const grantConsent = async () => {
    await api.post('/medical/consents', { purpose: 'OPD_CONSULTATION', durationDays: 30 });
    fetchTimeline();
  };

  if (consentError) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-2xl shadow text-center space-y-4">
        <ShieldCheck className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold">Active Patient Consent Required</h2>
        <p className="text-xs text-slate-500">In compliance with medical data regulations, explicit consent must be active to access clinical history.</p>
        <button onClick={grantConsent} className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold">
          Grant 30-Day Consent
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 font-sans space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Activity className="w-6 h-6 text-sky-600" /> Patient Clinical Timeline
        </h1>
        {/* OCR Upload */}
        <form onSubmit={handleUpload} className="flex items-center gap-2">
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
            className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-slate-100"
          />
          <button
            type="submit"
            disabled={uploading}
            className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded flex items-center gap-1"
          >
            <Upload className="w-3.5 h-3.5" /> {uploading ? 'Processing OCR...' : 'Upload Doc'}
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {timeline.map((entry, idx) => (
          <div key={idx} className="p-4 bg-white border border-slate-200 rounded-xl flex gap-4">
            <FileText className="w-5 h-5 text-sky-600 flex-shrink-0 mt-1" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-700">{entry.type}</span>
                <span className="text-xs text-slate-400">{new Date(entry.date).toLocaleDateString()}</span>
              </div>
              <p className="text-sm font-semibold text-slate-800">{entry.details.diagnosis || entry.details.opdName || entry.details.title}</p>
              {entry.details.clinicalNotes && <p className="text-xs text-slate-600">{entry.details.clinicalNotes}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
