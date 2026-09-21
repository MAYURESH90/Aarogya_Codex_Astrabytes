import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { KeyRound, Smartphone, ShieldCheck, Stethoscope } from 'lucide-react';

export default function LoginPage() {
  const [tab, setTab] = useState('STAFF'); // 'STAFF' or 'PATIENT'
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState(null);
  const [error, setError] = useState(null);
  const { loginWithPassword, verifyOtp } = useAuth();
  const navigate = useNavigate();

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const data = await loginWithPassword(phone, password);
      if (data.user.role === 'DOCTOR') navigate('/doctor');
      else if (data.user.role === 'STAFF') navigate('/desk');
      else if (data.user.role === 'ADMIN') navigate('/admin');
      else navigate('/');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Login failed');
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.post('/auth/patient/send-otp', { phone });
      setOtpSent(true);
      if (res.data.devOtp) setDevOtp(res.data.devOtp);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to send OTP');
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await verifyOtp(phone, otp);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Invalid OTP');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-2">
            <Stethoscope className="w-7 h-7 text-sky-600" /> Aarogya OPD
          </h1>
          <p className="text-sm text-slate-500 mt-1">Adaptive OPD Queue & Continuity Portal</p>
        </div>

        <div className="flex border-b border-slate-200 mb-6">
          <button
            onClick={() => { setTab('STAFF'); setError(null); }}
            className={`flex-1 pb-3 text-sm font-semibold border-b-2 ${tab === 'STAFF' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-400'}`}
          >
            Hospital Staff / Doctor
          </button>
          <button
            onClick={() => { setTab('PATIENT'); setError(null); }}
            className={`flex-1 pb-3 text-sm font-semibold border-b-2 ${tab === 'PATIENT' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-400'}`}
          >
            Patient (OTP)
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-lg font-medium">{error}</div>}

        {tab === 'STAFF' ? (
          <form onSubmit={handleStaffLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600">Registered Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+919000000002"
                required
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" /> Sign In
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            {!otpSent ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Mobile Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+919876543210"
                    required
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-4 h-4" /> Send Verification OTP
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                {devOtp && (
                  <div className="p-2 bg-amber-50 text-amber-800 text-xs rounded border border-amber-200">
                    Dev Mode OTP: <strong>{devOtp}</strong>
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-slate-600">Enter 6-Digit OTP</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    required
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-500 text-center tracking-widest font-mono text-lg"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" /> Verify & Continue
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
