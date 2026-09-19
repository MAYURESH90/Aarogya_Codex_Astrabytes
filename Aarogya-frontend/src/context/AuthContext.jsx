import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('aarogya_user');
    const token = localStorage.getItem('aarogya_jwt');
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const loginWithPassword = async (phone, password) => {
    const res = await api.post('/auth/login', { phone, password });
    localStorage.setItem('aarogya_jwt', res.data.token);
    localStorage.setItem('aarogya_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const verifyOtp = async (phone, otp) => {
    const res = await api.post('/auth/verify-otp', { phone, otp });
    localStorage.setItem('aarogya_jwt', res.data.token);
    localStorage.setItem('aarogya_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('aarogya_jwt');
    localStorage.removeItem('aarogya_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithPassword, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
