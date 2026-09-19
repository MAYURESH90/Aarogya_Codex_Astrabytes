import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Sliders, ShieldAlert, Save } from 'lucide-react';

export default function AdminDashboardPage() {
  const [config, setConfig] = useState({
    averageConsultationDurationMinutes: 8,
    emergencyPriorityPolicy: 'IMMEDIATE_AFTER_CURRENT',
    noShowGracePeriodMinutes: 10,
    etaNotificationThresholdMinutes: 5,
    reentryPolicy: 'AFTER_CURRENT',
  });
  const [auditLogs, setAuditLogs] = useState([]);
  const [savedMessage, setSavedMessage] = useState(null);

  useEffect(() => {
    api.get('/admin/config').then((res) => {
      if (res.data.data) setConfig(res.data.data);
    });
    api.get('/admin/audit').then((res) => {
      setAuditLogs(res.data.data || []);
    });
  }, []);

  const handleConfigUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.put('/admin/config', config);
      setSavedMessage('Configuration updated successfully');
      setTimeout(() => setSavedMessage(null), 3000);
    } catch (err) {
      alert('Failed to update system configuration');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 font-sans space-y-8">
      <h1 className="text-2xl font-bold text-slate-800">Hospital Administration & System Policy</h1>

      {savedMessage && (
        <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold">
          {savedMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* System Settings */}
        <form onSubmit={handleConfigUpdate} className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-sky-600" /> Operational Thresholds
          </h2>
          <div>
            <label className="text-xs font-semibold text-slate-600">Base Avg Consultation (Minutes)</label>
            <input
              type="number"
              value={config.averageConsultationDurationMinutes}
              onChange={(e) => setConfig({ ...config, averageConsultationDurationMinutes: Number(e.target.value) })}
              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">No-Show Grace Period (Minutes)</label>
            <input
              type="number"
              value={config.noShowGracePeriodMinutes}
              onChange={(e) => setConfig({ ...config, noShowGracePeriodMinutes: Number(e.target.value) })}
              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">SMS Suppress Delta Threshold (Minutes)</label>
            <input
              type="number"
              value={config.etaNotificationThresholdMinutes}
              onChange={(e) => setConfig({ ...config, etaNotificationThresholdMinutes: Number(e.target.value) })}
              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-slate-900 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> Save Policies
          </button>
        </form>

        {/* Audit Log Monitor */}
        <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-600" /> Compliance Audit Trail
          </h2>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto font-mono text-xs">
            {auditLogs.map((log) => (
              <div key={log._id} className="py-2.5 flex justify-between items-center">
                <div>
                  <span className="font-bold text-slate-800">{log.action}</span>
                  <span className="text-slate-400 ml-2">[{log.entity}]</span>
                  <p className="text-[11px] text-slate-500 font-sans mt-0.5">Role: {log.actorRole} • ID: {log.entityId}</p>
                </div>
                <span className="text-slate-400 text-[10px]">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
