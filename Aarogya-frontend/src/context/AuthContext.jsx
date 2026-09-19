import * as React from 'react';
import api from '../services/api';

const AuthContext = React.createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    try {
      const storedUser = localStorage.getItem('aarogya_user');
      const token = localStorage.getItem('aarogya_jwt');
      if (storedUser && token && storedUser !== 'undefined') {
        setUser(JSON.parse(storedUser));
      }
    } catch (err) {
      console.warn('Failed to parse cached session:', err);
      localStorage.removeItem('aarogya_user');
      localStorage.removeItem('aarogya_jwt');
    } finally {
      setLoading(false);
    }
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

  const value = {
    user,
    loading,
    loginWithPassword,
    verifyOtp,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
