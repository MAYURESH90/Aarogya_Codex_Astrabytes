# Aarogya — Frontend Integration Guide

**Target Client:** React.js / React Native (Team AstraBytes)  
**Backend Origin:** `http://localhost:5000`  
**WebSocket Protocol:** Socket.IO v4

---

## 1. Unified Response Structure

All REST endpoints return predictable, frontend-friendly JSON payloads:

### Success Response Contract
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully."
}
```

### Error Response Contract
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable explanation of error.",
    "details": { ... }
  }
}
```

---

## 2. Role-by-Role Feature Blueprint

### 2.1 Patient Web Application
1. **Login & OTP:**
   - Call `POST /api/auth/request-otp` -> `POST /api/auth/verify-otp`.
   - Store returned JWT in `localStorage` or secure session cookie.
2. **Find & Book OPD:**
   - `GET /api/hospitals`, `GET /api/opds`, `GET /api/doctors`.
   - Check specialist availability: `GET /api/specialists/availability?doctorId=...&date=...`.
   - If unavailable, render suggested `alternatives` (Alternate day button / General OPD button).
3. **Payment & Token Generation:**
   - If `paymentRequired === true`, call `POST /api/payments/orders` -> Razorpay checkout -> `POST /api/payments/verify`.
   - Register token: `POST /api/tokens/online`.
4. **Live Waiting Room (Socket.IO):**
   - Connect to backend: `const socket = io('http://localhost:5000')`.
   - Subscribe to private token room: `socket.emit('join_token', tokenId)`.
   - Listen to real-time events: `socket.on('token_eta_update', (data) => updateUI(data))`.
5. **Medical Timeline:**
   - Call `GET /api/medical/timeline` to display past doctor visits, diagnoses, prescriptions, and lab tests.

---

### 2.2 Desk Staff Portal (Reception & Registration)
1. **Unified Queue Dashboard:**
   - Call `GET /api/queue/:sessionId/live` to render the single unified table containing both Online (`O-`) and Paper (`P-`) tokens.
   - Join session room: `socket.emit('join_session', sessionId)`.
   - Listen to `socket.on('queue_update', (data) => refreshQueue(data))`.
2. **Add Walk-in Paper Token Modal:**
   - Form fields: Token Number (e.g. `P106`), Patient Name, Phone (optional), Gender.
   - Submit to `POST /api/tokens/paper`.
   - **Immediately display returned modal:**
     > *"Token P106 Registered. Queue Position: #6. Expected Consultation: 2:18 PM (Wait ~48 mins)."*
3. **Queue Controls:**
   - Add Emergency: `POST /api/queue/:sessionId/emergency`.
   - Patient No-Show: `POST /api/queue/:sessionId/no-show`.
   - Smart Re-entry: `POST /api/queue/:sessionId/re-entry`.
   - Manual Override (with reason modal): `POST /api/queue/:sessionId/override`.

---

### 2.3 Doctor Clinical Dashboard
1. **Active OPD Session:**
   - Display currently serving patient (`currentConsultation`).
   - Call next waiting patient: `POST /api/queue/:sessionId/call-next`.
   - Start consultation: `POST /api/queue/:sessionId/consultation-start`.
2. **Clinical Notes & Prescription:**
   - Record diagnosis & symptoms: `POST /api/medical/consultations`.
   - Generate prescription: `POST /api/medical/prescriptions`.
   - View patient past clinical timeline: `GET /api/medical/timeline/:patientId`.
3. **Complete Consultation:**
   - Click "Finish Consultation": `POST /api/queue/:sessionId/consultation-complete`.
   - Remaining queue automatically re-forecasts in real time.
4. **Report Delays:**
   - Report delay (e.g. 15 mins): `POST /api/queue/:sessionId/doctor-delay`.
   - Report early finish: `POST /api/queue/:sessionId/doctor-early-finish`.

---

### 2.4 Public Hospital Display TV Board
1. Open URL `/display/:hospitalId`.
2. Initial fetch: `GET /api/display/:hospitalId`.
3. Join display room: `socket.emit('join_display', hospitalId)`.
4. Listen to `socket.on('display_board_update', (data) => updateScreen(data))`.
5. Renders active serving token (e.g. `O101` in Room 101) and next 3 upcoming tokens (`P102`, `O103`, `P104`).
