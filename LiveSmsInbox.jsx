import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { socket } from '../services/socket';
import { MessageSquare, Bell, CheckCircle2, Phone, Sparkles } from 'lucide-react';

export default function LiveSmsInbox({ targetPhone, tokenId }) {
  const [messages, setMessages] = useState([]);
  const [isOpen, setIsOpen] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  // Initial fetch of SMS history for this phone or token
  useEffect(() => {
    const fetchSmsHistory = async () => {
      try {
        const res = await axios.get(`${apiUrl}/notifications`, {
          params: { phone: targetPhone, tokenId, limit: 15 }
        });
        if (res.data?.success && Array.isArray(res.data.data)) {
          setMessages(res.data.data);
        }
      } catch (err) {
        console.error("Could not fetch SMS notifications history:", err);
      }
    };

    fetchSmsHistory();

    // Subscribe to socket rooms for this phone & token
    if (targetPhone) {
      socket.emit('join_phone', targetPhone);
    }
    if (tokenId) {
      socket.emit('join_token', tokenId);
    }

    const handleSmsNotification = (newMsg) => {
      // Check if message belongs to current phone/token or is relevant
      const cleanTarget = targetPhone ? targetPhone.replace(/[^0-9]/g, '') : '';
      const cleanRecipient = newMsg.recipientPhone ? newMsg.recipientPhone.replace(/[^0-9]/g, '') : '';

      if (!cleanTarget || !cleanRecipient || cleanRecipient.includes(cleanTarget) || cleanTarget.includes(cleanRecipient) || newMsg.tokenId === tokenId) {
        setMessages((prev) => [newMsg, ...prev.filter(m => m.notificationId !== newMsg.notificationId)]);
        setUnreadCount((count) => count + 1);
      }
    };

    const handleGlobalSms = (newMsg) => {
      if (targetPhone) {
        const cleanTarget = targetPhone.replace(/[^0-9]/g, '');
        const cleanRecipient = newMsg.recipientPhone ? newMsg.recipientPhone.replace(/[^0-9]/g, '') : '';
        if (cleanRecipient && (cleanRecipient.includes(cleanTarget) || cleanTarget.includes(cleanRecipient))) {
          setMessages((prev) => [newMsg, ...prev.filter(m => m.notificationId !== newMsg.notificationId)]);
        }
      }
    };

    socket.on('sms_notification', handleSmsNotification);
    socket.on('global_sms_notification', handleGlobalSms);

    return () => {
      socket.off('sms_notification', handleSmsNotification);
      socket.off('global_sms_notification', handleGlobalSms);
    };
  }, [targetPhone, tokenId, apiUrl]);

  return (
    <div className="w-full max-w-2xl mx-auto my-6 font-sans">
      <div className="bg-slate-900 text-white rounded-2xl shadow-xl overflow-hidden border border-slate-800">
        {/* Header */}
        <div 
          onClick={() => { setIsOpen(!isOpen); setUnreadCount(0); }}
          className="p-4 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 flex justify-between items-center cursor-pointer border-b border-slate-800 select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-lg">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-wider uppercase text-sky-400">Live SMS Alert Inbox</span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Real-time Simulation
                </span>
              </div>
              {targetPhone ? (
                <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3 text-sky-400" /> Target Phone: <strong className="text-white">{targetPhone}</strong>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400">Monitoring all incoming appointment SMS alerts</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-sky-500 text-white text-xs font-bold rounded-full animate-bounce">
                {unreadCount} new
              </span>
            )}
            <button className="text-xs text-slate-400 hover:text-white font-semibold">
              {isOpen ? "Collapse ▲" : "Expand ▼"}
            </button>
          </div>
        </div>

        {/* Content Body */}
        {isOpen && (
          <div className="p-4 space-y-3 max-h-80 overflow-y-auto bg-slate-950">
            {messages.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs italic bg-slate-900/50 rounded-xl border border-slate-800">
                No SMS alerts sent yet. Complete a booking or update appointment status to preview live notifications.
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div 
                  key={msg.notificationId || idx}
                  className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2 hover:border-sky-500/30 transition-colors"
                >
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sky-400 flex items-center gap-1">
                        <Bell className="w-3 h-3 text-sky-400" /> AAROGYA-SMS
                      </span>
                      {msg.type && (
                        <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-medium rounded">
                          {msg.type}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed font-sans bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                    {msg.message}
                  </p>

                  <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
                    <span className="flex items-center gap-1 text-slate-400">
                      To: <strong className="text-slate-300">{msg.recipientPhone || targetPhone || 'Recipient'}</strong>
                    </span>
                    <span className="flex items-center gap-1 text-emerald-400 font-bold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Delivered to handset
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
