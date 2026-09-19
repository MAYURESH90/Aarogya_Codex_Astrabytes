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

function Navigation() {
  const { user, logout } = useAuth();
  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center text-sm">
      <Link to="/" className="font-black text-sky-600 tracking-tight text-lg">AAROGYA</Link>
      <div className="flex gap-4 items-center">
        {user ? (
          <>
            <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded text-slate-600">{user.role}</span>
            <button onClick={logout} className="text-xs text-red-600 font-semibold">Logout</button>
          </>
        ) : (
          <Link to="/login" className="text-sky-600 font-semibold">Sign In</Link>
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
          <Route path="/track/:tokenId" element={<PatientTrackerPage />} />
          <Route path="/display/:hospitalId" element={<DisplayBoardPage />} />
          
          {/* Role-Guarded Portals */}
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
          
          <Route path="/" element={<div className="p-8 text-center text-slate-600">Welcome to Aarogya OPD System. Please select your portal.</div>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
