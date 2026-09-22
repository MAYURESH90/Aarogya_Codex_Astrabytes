import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { socket, joinTokenRoom } from '../services/socket';
import { Clock, Users, Sparkles, Building2, User, Activity } from 'lucide-react';

export default function PatientTrackerPage() {
  const { tokenId } = useParams();
  const [data, setData] = useState(null);
  const [queueData, setQueueData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatusAndQueue = async () => {
    try {
      const res = await api.get(`/tokens/${tokenId}/status`);
      const tokenStatus = res.data.data;
      setData(tokenStatus);

      if (tokenStatus.sessionId) {
        const queueRes = await api.get(`/queue/${tokenStatus.sessionId}/live`);
        setQueueData(queueRes.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndQueue();
    joinTokenRoom(tokenId);

    const handleETA = (payload) => {
      setData((prev) => ({ ...prev, ...payload }));
      // Optionally refetch queue on ETA update
      if (data?.sessionId) {
        api.get(`/queue/${data.sessionId}/live`).then((res) => setQueueData(res.data.data));
      }
    };

    socket.on('token_eta_update', handleETA);
    return () => socket.off('token_eta_update', handleETA);
  }, [tokenId, data?.sessionId]);

  const fetchQueueRefresh = async () => {
    if (data?.sessionId) {
      const queueRes = await api.get(`/queue/${data.sessionId}/live`);
      setQueueData(queueRes.data.data);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Connecting to Aarogya Live Queue...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Active token session not found.</div>;

  return (
    <div className="max-w-xl mx-auto p-4 space-y-6">
      {/* Patient's Own Token Display */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 text-center">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">My Token</span>
        <h1 className="text-5xl font-black text-slate-900 my-2">{data.tokenNumber}</h1>
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
          data.tokenType === 'EMERGENCY' ? 'bg-red-100 text-red-700 animate-pulse' :
          data.tokenType === 'PAPER' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {data.tokenType} Token
        </span>

        <div className="grid grid-cols-2 gap-3 mt-6 pt-6 border-t border-slate-100 text-left">
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-xs text-slate-500 flex items-center gap-1 font-medium"><Users className="w-3.5 h-3.5" /> Queue Position</span>
            <p className="text-2xl font-black text-slate-800 mt-1">{data.queuePosition ?? 'N/A'}</p>
          </div>
          <div className="p-3 bg-sky-50 rounded-xl">
            <span className="text-xs text-sky-600 flex items-center gap-1 font-medium"><Clock className="w-3.5 h-3.5" /> Est. Wait</span>
            <p className="text-2xl font-black text-sky-900 mt-1">{data.predictedWaitMinutes} <span className="text-sm font-normal">mins</span></p>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-xl bg-slate-900 text-white text-left space-y-1">
          <p className="text-xs text-slate-400">Expected Consultation</p>
          <p className="text-xl font-bold">
            {data.estimatedConsultationTime ? new Date(data.estimatedConsultationTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Calculating...'}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Model: <strong>{data.predictionSource}</strong>
          </span>
          <span>Confidence: <strong>{Math.round((data.confidence || 0.85) * 100)}%</strong></span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-2 text-sm text-slate-600">
        <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-slate-400" /> <span>{data.hospitalName} — Room {data.roomNumber}</span></div>
        <div className="flex items-center gap-2"><User className="w-4 h-4 text-slate-400" /> <span>{data.doctorName} ({data.opdName})</span></div>
      </div>

      {/* Live OPD Queue Section */}
      {queueData && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Activity className="w-5 h-5 text-sky-600" />
              Live OPD Queue
            </h2>
            <button onClick={fetchQueueRefresh} className="text-xs font-semibold text-sky-600 hover:underline">
              Refresh
            </button>
          </div>
          
          <div className="space-y-4">
            {/* Currently Consulting */}
            <div>
              <div className="text-xs font-bold uppercase text-slate-400 mb-2">Currently Consulting</div>
              {queueData.currentConsultation ? (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-emerald-800">{queueData.currentConsultation.tokenNumber}</span>
                    <span className="px-2 py-0.5 bg-emerald-200 text-emerald-800 text-xs font-bold rounded-md">IN ROOM</span>
                  </div>
                  <span className="text-xs font-medium text-emerald-700">{queueData.currentConsultation.elapsedMinutes} mins elapsed</span>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-500 italic">
                  No patient currently in consultation
                </div>
              )}
            </div>

            {/* Waiting List */}
            <div>
              <div className="text-xs font-bold uppercase text-slate-400 mb-2">Waiting ({queueData.unifiedQueue?.length || 0})</div>
              {queueData.unifiedQueue && queueData.unifiedQueue.length > 0 ? (
                <div className="space-y-2">
                  {queueData.unifiedQueue.map((qToken) => {
                    const isMyToken = qToken.tokenNumber === data.tokenNumber;
                    return (
                      <div key={qToken.id} className={`p-3 rounded-xl border flex justify-between items-center ${isMyToken ? 'bg-sky-50 border-sky-200' : 'bg-white border-slate-100'}`}>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-black ${isMyToken ? 'text-sky-800' : 'text-slate-700'}`}>
                            #{qToken.queuePosition}
                          </span>
                          <span className={`text-base font-bold ${isMyToken ? 'text-sky-900' : 'text-slate-900'}`}>
                            {qToken.tokenNumber}
                          </span>
                          {isMyToken && (
                            <span className="px-2 py-0.5 bg-sky-200 text-sky-800 text-[10px] font-bold rounded-md">YOU</span>
                          )}
                          {qToken.priority >= 2 && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-md">EMERGENCY</span>
                          )}
                        </div>
                        <span className="text-xs font-medium text-slate-500">
                          {qToken.predictedWaitMinutes} mins
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-500 italic">
                  Queue is empty
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
