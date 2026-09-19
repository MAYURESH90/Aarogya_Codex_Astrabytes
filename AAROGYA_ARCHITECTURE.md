# Aarogya — System Architecture Documentation

**Team:** AstraBytes  
**Project:** Aarogya — Adaptive OPD Queue & Patient Continuity System (PS No. CX0308)

---

## 1. High-Level Architectural Overview

Aarogya is built as a production-grade, distributed healthcare backend designed to eliminate OPD waitlist uncertainty and overcrowding in government hospitals.

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT APPLICATIONS                               |
|   +-------------------+  +--------------------+  +---------------+  +-----------+ |
|   | Patient Mobile/Web|  | Staff Desk Console |  | Doctor Portal |  | DisplayTV | |
|   +-------------------+  +--------------------+  +---------------+  +-----------+ |
+------------------------------------------+----------------------------------------+
                                           | HTTP REST & WebSocket (Socket.IO)
                                           v
+-----------------------------------------------------------------------------------+
|                            NODE.JS + EXPRESS BACKEND (:5000)                      |
|                                                                                   |
|  [ Authentication & RBAC ]        [ Central Unified Queue Engine ]                 |
|  - JWT Bearer Tokens              - Concurrency Lock (Redis Mutex)                |
|  - Phone OTP (Twilio/Sim)         - Dynamic Queue Position Recalculator           |
|  - Passwords (Bcrypt)             - Central Queue Event Pipeline                  |
|                                                                                   |
|  [ Domain Services ]              [ Clinical & Patient Continuity ]               |
|  - TokenService (Online/Paper)    - MedicalRecordService (Patient Timeline)       |
|  - NoShowService (Grace/Reentry)  - OCRService (Document Field Extraction)        |
|  - NotificationService (SMS/IVR)  - ConsentService (Patient Data Governance)      |
|  - PaymentService (Idempotent)    - AuditService (Tamper-evident logs)            |
+-------------------+----------------------+--------------------+-------------------+
                    |                      |                    |
       Internal HTTP|         Redis Cache &|             Mongoose|
              (JSON)|           Distributed|          Persistent|
                    v                 Locks|                Data|
+--------------------------+               v                    v
|   PYTHON FASTAPI         |     +-------------------+    +-------------------+
|   PREDICTION SERVICE     |     |   REDIS (PORT 6379|    |  MONGODB DATABASE |
|   (:8000)                |     |   OR IN-MEMORY    |    |  (MONGODB URI OR  |
|                          |     |   FALLBACK)       |    |  STANDALONE)      |
| - Scikit-Learn Model     |     +-------------------+    +-------------------+
| - Dynamic Reforecasting  |
| - Deterministic Fallback |
+--------------------------+
```

---

## 2. Component Responsibilities

### 2.1 Node.js / Express Main Server
- **REST API Endpoints:** Handles authentication, token generation, queue mutations, doctor consultations, prescriptions, payments, and hospital display queries.
- **WebSocket Gateway (Socket.IO):** Broadcasts real-time queue shifts to OPD session rooms, sends private ETA alerts to patient rooms, and updates hospital TV display boards.
- **Resilience Engine:** Automatically falls back to internal deterministic queue simulation if the Python prediction engine is unavailable, ensuring that hospitals never lose ETA functionality.

### 2.2 Python FastAPI Prediction Service
- Runs on port 8000.
- Exposes `/api/predict` and `/api/reforecast`.
- Considers queue context: waiting patients, active consultation elapsed time, recent doctor consultation pace (rolling averages), emergency patients, and operational delays.
- Tags prediction with `predictionSource: "AI"` or `"FALLBACK"`.

### 2.3 MongoDB Persistent Store
- Single persistent source of truth.
- Stores users, patients, tokens, consultations, prescriptions, payments, events, and audit logs.
- Indexed with compound keys for rapid lookups and collision prevention.

### 2.4 Redis Queue & Mutex Cache
- Used for sub-millisecond queue state retrieval and distributed concurrency locking (`acquireSessionLock`).
- Accompanied by an in-memory fallback client (`InMemoryRedisFallback`) so that the backend operates seamlessly even if native Redis is offline.

---

## 3. Concurrency & Race-Condition Protection
To prevent duplicate token numbers or conflicting queue positions when an online patient and a desk staff operator enter tokens at the exact same millisecond:
1. Every mutating queue operation acquires a session lock: `lock:session:${sessionId}`.
2. Tokens are saved to MongoDB with a compound unique index: `{ sessionId: 1, tokenNumber: 1 }`.
3. `recalculateQueuePositions(sessionId)` dynamically reassigns positions sequentially based on priority and arrival time, preventing gaps or duplicate ranks.
