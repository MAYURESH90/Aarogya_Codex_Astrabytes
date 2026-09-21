import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FileText, Upload, ShieldCheck, Activity, Search } from 'lucide-react';

export default function MedicalRecordsPage() {
  const { user } = useAuth();
  const [timeline, setTimeline] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Default patient ID (seeded patient Aakash Verma or current user)
  const [patientId, setPatientId] = useState(user?.patientId || user?.id || '');

  const fetchTimeline = async (idToFetch) => {
    const targetId = idToFetch || patientId;
    setErrorMessage('');
    try {
      // Pass patientId parameter if present, otherwise call /medical/timeline
      const endpoint = targetId ? `/medical/timeline/${targetId}` : '/medical/timeline';
      const res = await api.get(endpoint);
      const data = res.data?.data || res.data || [];
      setTimeline(Array.isArray(data) ? data : []);
      setConsentError(false);
    } catch (err) {
      if (err.response?.status === 403) {
        setConsentError(true);
      } else {
        setErrorMessage(err.response?.data?.message || 'Failed to load timeline. Please check Patient ID.');
      }
    }
  };

  useEffect(() => {
    // If logged in as patient or default ID is ready, fetch immediately
    if (patientId) {
      fetchTimeline(patientId);
    }
  }, [patientId]);

  const handlePatientSelect = (e) => {
    const newId = e.target.value;
    setPatientId(newId);
    if (newId) fetchTimeline(newId);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    const formData = new FormData();
    formData.append('document', file);
    if (patientId) formData.append('patientId', patientId);
    
    setUploading(true);
    try {
      await api.post('/medical/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Document processed with OCR');
      setFile(null);
      fetchTimeline(patientId);
    } catch (err) {
      alert(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const grantConsent = async () => {
    try {
      await api.post('/medical/consents', {
        patientId,
        purpose: 'OPD_CONSULTATION',
        durationDays: 30
      });
      fetchTimeline(patientId);
    } catch (err) {
      alert('Failed to grant consent');
    }
  };

  if (consentError) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-2xl shadow text-center space-y-4">
        <ShieldCheck className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold">Active Patient Consent Required</h2>
        <p className="text-xs text-slate-500">
          In compliance with medical data regulations, explicit consent must be active to access clinical history.
        </p>
        <button onClick={grantConsent} className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700">
          Grant 30-Day Consent
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 font-sans space-y-6">
      {/* Header & Patient Lookup Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="w-6 h-6 text-sky-600" /> Patient Clinical Timeline
          </h1>
          <p className="text-xs text-slate-500 mt-1">View consultations, verified prescriptions, and OCR medical records.</p>
        </div>

        {/* Patient Selection for Staff/Doctor/Admin */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Enter Patient ID or Phone..."
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-sky-500 w-56"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
          <button
            onClick={() => fetchTimeline(patientId)}
            className="px-3 py-1.5 bg-sky-600 text-white text-xs font-semibold rounded-lg hover:bg-sky-700"
          >
            Load
          </button>
        </div>
      </div>

      {/* Upload OCR Doc */}
      <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs font-bold text-slate-700">Upload Clinical Document (OCR)</div>
          <div className="text-[11px] text-slate-500">Attach lab reports or paper slips to automatically extract clinical details.</div>
        </div>
        <form onSubmit={handleUpload} className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files[0])}
            className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-white file:text-slate-700 file:border-slate-300 file:shadow-sm"
          />
          <button
            type="submit"
            disabled={uploading}
            className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> {uploading ? 'Processing OCR...' : 'Upload Doc'}
          </button>
        </form>
      </div>

      {errorMessage && (
        <div className="p-3 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
          {errorMessage}
        </div>
      )}

      {/* Timeline Entries */}
      <div className="space-y-3">
        {timeline.length === 0 ? (
          <div className="p-8 text-center bg-white border border-slate-200 rounded-xl">
            <p className="text-sm font-semibold text-slate-600">No medical records found for this patient.</p>
            <p className="text-xs text-slate-400 mt-1">Consultation history, prescriptions, and uploaded OCR documents will appear here.</p>
          </div>
        ) : (
          timeline.map((entry, idx) => (
            <div key={idx} className="p-4 bg-white border border-slate-200 rounded-xl flex gap-4 hover:border-slate-300 transition-colors shadow-sm">
              <FileText className="w-5 h-5 text-sky-600 flex-shrink-0 mt-1" />
              <div className="space-y-1 w-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-700 uppercase tracking-wide">
                      {entry.type || 'CLINICAL_NOTE'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {entry.date ? new Date(entry.date).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>
                  {entry.details?.doctorName && (
                    <span className="text-xs font-medium text-slate-500">Dr. {entry.details.doctorName}</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {entry.details?.diagnosis || entry.details?.opdName || entry.details?.title || 'Clinical Entry'}
                </p>
                {entry.details?.clinicalNotes && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded mt-1 border border-slate-100">
                    {entry.details.clinicalNotes}
                  </p>
                )}
                {entry.details?.medicines && entry.details.medicines.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">Prescribed Medicines</div>
                    <ul className="text-xs text-slate-700 list-disc list-inside mt-1">
                      {entry.details.medicines.map((m, i) => (
                        <li key={i}>{typeof m === 'string' ? m : `${m.name} - ${m.dosage || ''}`}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
