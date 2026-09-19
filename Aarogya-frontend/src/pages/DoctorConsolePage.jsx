import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { socket, joinSessionRoom } from '../services/socket';
import { Bell, Play, CheckCircle2, UserX, AlertOctagon, Clock } from 'lucide-react';

export default function DoctorConsolePage() {
  const [sessionId, setSessionId] = useState('');
  const [queueData, setQueueData] = useState(null);

  const fetchQueue = async () => {
    if (!sessionId) return;
    try {
      const res = await api.get(`/queue/${sessionId}/live`);
      setQueueData(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchQueue();
      joinSessionRoom(sessionId);
      socket.on('queue_update', fetchQueue);
      return () => socket.off('queue_update', fetchQueue);
    }
  }, [sessionId]);

  const triggerCallNext = () => api.post(`/queue/${sessionId}/call-next`);
  const triggerStart = (tokenId) => api.post(`/queue/${sessionId}/consultation-start`, { tokenId });
  const triggerComplete = (tokenId) => api.post(`/queue/${sessionId}/consultation-complete`, { tokenId });
  const triggerNoShow = (tokenId) => api.post(`/queue/${sessionId}/no-show`, { tokenId });

  const triggerEmergency = async () => {
    const reason = prompt('Emergency diagnosis/reason:');
    if (!reason) return;
    await api.post(`/queue/${sessionId}/emergency`, {
      hospitalId: queueData.session.hospital._id,
      opdId: queueData.session.opd._id,
      doctorId: queueData.session.doctor._id,
      patientName: 'Emergency Priority',
      emergencyReason: reason
    });
  };

  const triggerDelay = async () => {
    const mins = prompt('Delay in minutes:');
    if (!mins) return;
    await api.post(`/queue/${sessionId}/doctor-delay`, {
      delayMinutes: parseInt(mins, 10),
      reason: 'Urgent ward call'
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 font-sans space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Active OPD Session ID"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm w-72"
          />
          <button onClick={fetchQueue} className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold">
            Load Queue
          </button>
        </div>
        {queueData && (
          <div className="flex gap-2">
            <button onClick={triggerDelay} className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Report Delay
            </button>
            <button onClick={triggerEmergency} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold flex items-center gap-1">
              <AlertOctagon className="w-3.5 h-3.5" /> Push Emergency Case
            </button>
          </div>
        )}
      </div>

      {queueData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Active Serving Box */}
          <div className="p-6 bg-sky-50 rounded-2xl border border-sky-100 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-600">Currently Serving</span>
            {queueData.currentConsultation ? (
              <div>
                <h2 className="text-4xl font-black text-sky-950">{queueData.currentConsultation.tokenNumber}</h2>
                <p className="text-sm text-sky-800 font-semibold mt-1">{queueData.currentConsultation.patientName}</p>
                <p className="text-xs text-sky-600">Elapsed: ~{queueData.currentConsultation.elapsedMinutes} mins</p>
                <button
                  onClick={() => triggerComplete(queueData.currentConsultation.id)}
                  className="mt-6 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> Finish Consultation
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-400 py-6">Doctor chamber is ready for next patient.</p>
                <button
                  onClick={triggerCallNext}
                  className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-1.5"
                >
                  <Bell className="w-4 h-4" /> Call Next Patient
                </button>
              </div>
            )}
          </div>

          {/* Waiting Unified Queue List */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-800 mb-4">Unified Patient Queue ({queueData.unifiedQueue.length} Waiting)</h3>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {queueData.unifiedQueue.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-400">#{item.queuePosition}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-800">{item.tokenNumber}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          item.priority >= 2 ? 'bg-red-100 text-red-700' :
                          item.tokenType === 'PAPER' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {item.tokenType}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{item.patientName} • Wait: ~{item.predictedWaitMinutes}m</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {item.status === 'CALLED' ? (
                      <button
                        onClick={() => triggerStart(item.id)}
                        className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" /> Start
                      </button>
                    ) : (
                      <button
                        onClick={() => triggerNoShow(item.id)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded flex items-center gap-1"
                      >
                        <UserX className="w-3 h-3" /> Absent
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
