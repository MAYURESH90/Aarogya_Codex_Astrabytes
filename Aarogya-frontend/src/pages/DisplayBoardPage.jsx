import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { socket, joinDisplayRoom } from '../services/socket';

export default function DisplayBoardPage() {
  const { hospitalId } = useParams();
  const [boardData, setBoardData] = useState([]);

  const fetchBoard = async () => {
    try {
      const res = await api.get(`/display/${hospitalId}`);
      setBoardData(res.data.boards || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBoard();
    joinDisplayRoom(hospitalId);
    socket.on('display_board_update', fetchBoard);
    return () => socket.off('display_board_update', fetchBoard);
  }, [hospitalId]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 font-sans">
      <header className="border-b border-slate-800 pb-4 mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black tracking-wider text-sky-400">AAROGYA OPD LIVE STATUS</h1>
          <p className="text-sm text-slate-400">Unified Dynamic Waiting Hall Display</p>
        </div>
        <div className="text-2xl font-mono text-slate-300">
          {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {boardData.map((board) => (
          <div key={board.sessionId} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="border-b border-slate-800 pb-2 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-white">{board.opdName}</h2>
                <p className="text-xs text-sky-400 font-semibold">{board.doctorName}</p>
              </div>
              <span className="px-2 py-1 bg-slate-800 text-slate-300 rounded text-xs font-bold">
                Room {board.roomNumber}
              </span>
            </div>

            {/* Serving */}
            <div className="p-4 bg-sky-950/60 border border-sky-600/40 rounded-xl text-center">
              <span className="text-xs uppercase tracking-widest text-sky-400 font-bold">Now Serving</span>
              <p className="text-5xl font-black text-white mt-1">
                {board.servingToken?.tokenNumber || '---'}
              </p>
            </div>

            {/* Next in Line */}
            <div>
              <span className="text-xs uppercase text-slate-400 font-semibold">Upcoming in Queue</span>
              <div className="mt-2 space-y-2">
                {board.upcomingTokens.slice(0, 4).map((t) => (
                  <div key={t.tokenNumber} className="flex justify-between items-center p-2 bg-slate-800/60 rounded-lg text-sm">
                    <span className="font-bold font-mono">{t.tokenNumber}</span>
                    <span className="text-xs text-slate-400">
                      ~{t.estimatedConsultationTime ? new Date(t.estimatedConsultationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
