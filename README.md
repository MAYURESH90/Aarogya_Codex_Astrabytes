# Aarogya — Adaptive OPD Queue & Patient Continuity System

**Team:** AstraBytes  
**Problem Statement:** CX0308 — The Waitlist Nobody Sees  
**Domain:** Healthcare & MedTech

---

## Overview

Aarogya is a complete, production-structured backend designed to eliminate OPD waitlist chaos, uncertainty, and overcrowding in public hospitals.

### Core Innovations:
1. **ONE Unified OPD Queue:** Both online digital tokens (`O101`) and desk staff walk-in paper slips (`P102`) belong to the exact same queue.
2. **Immediate Paper Token ETA:** When staff registers a walk-in paper token, the API immediately returns the dynamically calculated queue position, predicted wait minutes, and estimated consultation time.
3. **Emergency Re-Forecasting:** Immediate priority insertion without disrupting active consultations, recalculating downstream ETAs automatically.
4. **Smart No-Show Lifecycle:** Approaching alerts -> SMS reminder -> Twilio IVR voice call -> 10-minute grace period -> temporary skip -> smart re-entry.
5. **Universal Accessibility:** Seamless access for smartphone users (Web/QR), basic-phone users (Twilio SMS/IVR), and no-phone patients (physical paper token + verbal ETA + hospital display TV).

---

## Project Structure

```
aarogya-backend/
├── server/                           # Node.js + Express Main Backend
│   ├── src/
│   │   ├── config/                   # DB, Redis, Constants, Env config
│   │   ├── controllers/              # REST Controllers
│   │   ├── models/                   # 19 Mongoose Schemas
│   │   ├── services/                 # Unified Queue, Token, Prediction, No-Show, Notification
│   │   ├── middleware/               # Auth, RBAC, Central Error Handler
│   │   ├── routes/                   # Resource routers
│   │   ├── seed/                     # Demo hospital, OPDs, unified queue seed
│   │   ├── docs/                     # OpenAPI 3.0 specification
│   │   ├── app.js                    # Express app setup & middleware
│   │   └── server.js                 # Server entry point with Socket.IO
│   ├── package.json
│   └── .env.example
├── prediction-service/               # Python FastAPI Dynamic ETA Engine
│   ├── app/
│   │   ├── models/                   # Pydantic schemas
│   │   ├── prediction/               # Scikit-Learn ML engine & queue simulator
│   │   ├── routes/                   # /predict & /reforecast
│   │   └── main.py                   # FastAPI server entry point
│   └── requirements.txt
├── tests/                            # 36 Comprehensive Test Scenarios
│   └── runAllTests.js
├── AAROGYA_ARCHITECTURE.md
├── AAROGYA_API_DOCUMENTATION.md
├── AAROGYA_QUEUE_ENGINE.md
├── AAROGYA_PREDICTION_ENGINE.md
├── AAROGYA_NOTIFICATION_SYSTEM.md
├── AAROGYA_DATABASE_SCHEMA.md
├── AAROGYA_FEATURE_TRACEABILITY.md   # Flowchart node-by-node mapping
├── AAROGYA_PPT_FEATURE_TRACEABILITY.md # PPT slide-by-slide mapping
├── AAROGYA_EDGE_CASES.md
├── AAROGYA_FRONTEND_INTEGRATION.md
└── README.md
```

---

## Quick Start & Verification

### 1. Start FastAPI Prediction Engine
```bash
cd prediction-service
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
*Health Check:* `http://localhost:8000/health`

### 2. Start Node.js Backend Server
```bash
cd server
npm install
npm start
```
*API Base URL:* `http://localhost:5000/api`  
*OpenAPI Swagger UI:* `http://localhost:5000/api-docs`  
*Health Check:* `http://localhost:5000/health`

### 3. Seed Database with Demo Unified Queue
```bash
cd server
npm run seed
```

### 4. Run Automated Test Suite (All 36 Scenarios)
```bash
cd server
npm test
```

---

## Test Credentials (from Seed)

| Role | Phone Number | Password / Auth |
|---|---|---|
| **Admin** | `+919000000001` | `Aarogya@123` |
| **Desk Staff** | `+919000000002` | `Aarogya@123` |
| **Doctor (General)** | `+919000000003` | `Aarogya@123` |
| **Doctor (Cardiology)**| `+919000000004` | `Aarogya@123` |
| **Patient** | *Any Valid Phone*| `OTP via Twilio Verify` |

*Note: For patients, use the real phone number as Twilio Verify is integrated. In development mode without Twilio, OTP defaults to `123456`.*
