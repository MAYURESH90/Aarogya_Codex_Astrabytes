import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { socket, joinTokenRoom } from '../services/socket';
import { Clock, Users, Sparkles, Building2, User } from 'lucide-react';

export default function PatientTrackerPage() {
  const { tokenId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await api.get(`/tokens/${tokenId}/status`);
      setData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    joinTokenRoom(tokenId);

    const handleETA = (payload) => {
      setData((prev) => ({ ...prev, ...payload }));
    };

    socket.on('token_eta_update', handleETA);
    return () => socket.off('token_eta_update', handleETA);
  }, [tokenId]);

  if (loading) return <div className="p-8 text-center text-slate-500">Connecting to Aarogya Live Queue...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Active token session not found.</div>;

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 text-center">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Your OPD Token</span>
        <h1 className="text-5xl font-black text-slate-900 my-2">{data.tokenNumber}</h1>
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
          data.tokenType === 'EMERGENCY' ? 'bg-red-100 text-red-700 animate-pulse' :
          data.tokenType === 'PAPER' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {data.tokenType} Token
        </span>

        <div className="grid grid-cols-2 gap-3 mt-6 pt-6 border-t border-slate-100 text-left">
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-xs text-slate-500 flex items-center gap-1 font-medium"><Users className="w-3.5 h-3.5" /> Ahead of You</span>
            <p className="text-2xl font-black text-slate-800 mt-1">{data.peopleAhead ?? 0}</p>
          </div>
          <div className="p-3 bg-sky-50 rounded-xl">
            <span className="text-xs text-sky-600 flex items-center gap-1 font-medium"><Clock className="w-3.5 h-3.5" /> Est. Wait</span>
            <p className="text-2xl font-black text-sky-900 mt-1">{data.predictedWaitMinutes} <span className="text-sm font-normal">mins</span></p>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-xl bg-slate-900 text-white text-left space-y-1">
          <p className="text-xs text-slate-400">Estimated Consultation Time</p>
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
    </div>
  );
}
