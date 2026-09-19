import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import PatientTrackerPage from './pages/PatientTrackerPage';
import DeskStaffPage from './pages/DeskStaffPage';
import DoctorConsolePage from './pages/DoctorConsolePage';
import DisplayBoardPage from './pages/DisplayBoardPage';
import MedicalRecordsPage from './pages/MedicalRecordsPage';
import OnlineBookingPage from './pages/OnlineBookingPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

function Navigation() {
  const { user, logout } = useAuth();
  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center text-sm font-sans">
      <div className="flex items-center gap-6">
        <Link to="/" className="font-black text-sky-600 tracking-tight text-lg">AAROGYA</Link>
        <Link to="/book" className="text-slate-600 hover:text-sky-600 font-medium text-xs">Book OPD</Link>
        <Link to="/desk" className="text-slate-600 hover:text-sky-600 font-medium text-xs">Desk Staff</Link>
        <Link to="/doctor" className="text-slate-600 hover:text-sky-600 font-medium text-xs">Doctor Console</Link>
        <Link to="/records" className="text-slate-600 hover:text-sky-600 font-medium text-xs">Medical Records</Link>
        <Link to="/admin" className="text-slate-600 hover:text-sky-600 font-medium text-xs">Admin</Link>
      </div>
      <div className="flex gap-4 items-center">
        {user ? (
          <>
            <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded text-slate-600">{user.role}</span>
            <button onClick={logout} className="text-xs text-red-600 font-semibold hover:underline">Logout</button>
          </>
        ) : (
          <Link to="/login" className="text-sky-600 font-semibold text-xs">Sign In</Link>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navigation />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/book" element={<OnlineBookingPage />} />
          <Route path="/track/:tokenId" element={<PatientTrackerPage />} />
          <Route path="/display/:hospitalId" element={<DisplayBoardPage />} />
          
          <Route path="/desk" element={
            <ProtectedRoute allowedRoles={['STAFF', 'ADMIN']}>
              <DeskStaffPage />
            </ProtectedRoute>
          } />
          <Route path="/doctor" element={
            <ProtectedRoute allowedRoles={['DOCTOR', 'ADMIN']}>
              <DoctorConsolePage />
            </ProtectedRoute>
          } />
          <Route path="/records" element={
            <ProtectedRoute allowedRoles={['PATIENT', 'DOCTOR', 'ADMIN']}>
              <MedicalRecordsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminDashboardPage />
            </ProtectedRoute>
          } />
          
          <Route path="/" element={
            <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-4 font-sans">
              <h1 className="text-2xl font-bold text-slate-800">Aarogya OPD System Active</h1>
              <p className="text-sm text-slate-500">Unified queue, walk-in desk, and doctor console are synchronized.</p>
              <div className="flex justify-center gap-3 pt-2">
                <Link to="/login" className="px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-bold">Sign In</Link>
                <Link to="/book" className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold">Book Token</Link>
              </div>
            </div>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
