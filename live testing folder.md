# Aarogya — Presentation (PPT) Feature Traceability Matrix

**Project:** Aarogya — Adaptive OPD Queue & Patient Continuity System  
**Team:** AstraBytes (PS No. CX0308 — The Waitlist Nobody Sees)  
**Presentation Source:** `CODEX ASTRABYTES.pptx`

This document provides complete end-to-end traceability between each slide, requirement, innovation, and architecture component from the AstraBytes presentation and its exact backend implementation.

---

## 1. Traceability by Slide and Functional Innovation

| Slide # | Slide Title & Requirement | Presentation Content & Innovation | Backend Implementation Module | API / Technical Interface | Status |
|---|---|---|---|---|---|
| **Slide 2** | Selected PS & Team Details | PS No. CX0308: *The Waitlist Nobody Sees*<br>Team: AstraBytes | Project metadata, OpenAPI Documentation, System constants | `/health`, `/api-docs` | Implemented |
| **Slide 3** | Existing Solutions & Limitations | Limitations of ORS, e-Hospital, and simple token screens:<br>1. Lack of live walk-in predictions<br>2. Sudden emergencies invalidate earlier ETAs<br>3. No automatic re-forecasting | `QueueService.js`, `PredictionService.js` | `POST /api/queue/:sessionId/emergency`, `POST /api/tokens/paper` | Implemented |
| **Slide 4** | Theme & Why Selected | Government hospitals handle massive OPD crowds; patients wait for hours without knowing turn; emergency disruptions | Unified queue architecture supporting Online + Walk-in Paper tokens in one place | `GET /api/queue/:sessionId/live` | Implemented |
| **Slide 5** | Target Users | 1. **Patients:** Tokens, live wait-time alerts (SMS/IVR/Web)<br>2. **Hospital Staff:** Manage registration, queues, emergencies<br>3. **Doctors & Nurses:** Call patients, consultation status, priority cases | `middleware/roleMiddleware.js`, `controllers/QueueController.js`, `controllers/TokenController.js` | Role-Based Access Control (PATIENT, STAFF, DOCTOR, ADMIN) | Implemented |
| **Slide 6** | **Key Innovation 1: Emergency Re-Forecasting** | System automatically recalculates and sends updated estimates when an emergency arrives | `services/QueueService.js` (`addEmergencyToken`), `prediction-service/app/routes/predict.py` (`/reforecast`) | `POST /api/queue/:sessionId/emergency` | Implemented |
| **Slide 6** | **Key Innovation 2: Dynamic ETA Prediction** | Live, realistic wait-time updates considering queue length, doctor pace, and delays | `services/PredictionService.js`, `prediction-service/app/prediction/engine.py` | `POST /api/predict`, `GET /api/tokens/:id/status` | Implemented |
| **Slide 6** | **Key Innovation 3: Smart No-Show Handling** | SMS / IVR reminders, grace period, temporary skip, and smart re-entry | `services/NoShowService.js` | `POST /api/queue/:sessionId/no-show`, `POST /api/queue/:sessionId/re-entry` | Implemented |
| **Slide 6** | **Key Innovation 4: Basic-Phone Access** | Works through SMS and Twilio IVR voice portal, not just smartphones | `services/NotificationService.js`, `controllers/IVRController.js` | `POST /api/ivr/webhook`, Twilio Voice TwiML | Implemented |
| **Slide 7** | System Technical Architecture | - Node.js + Express backend services<br>- FastAPI AI Prediction Engine<br>- MongoDB patient & queue storage<br>- Redis queue & distributed lock cache<br>- Twilio SMS / OTP alerts | `server/src/server.js`, `prediction-service/app/main.py`, `server/src/config/db.js`, `server/src/config/redis.js` | Complete 6-tier architecture | Implemented |
| **Slide 8** | Technical Feasibility: AI/ML Engine | AI/ML wait-time prediction engine with deterministic fallback | `prediction-service/app/prediction/engine.py`, `services/PredictionService.js` | Scikit-learn regressor + mathematical fallback (`predictionSource: 'AI' \| 'FALLBACK'`) | Implemented |
| **Slide 8** | Technical Feasibility: OCR Extraction | OCR for prescription / medical document extraction | `services/OCRService.js`, `controllers/MedicalController.js` | `POST /api/medical/documents/upload` | Implemented |
| **Slide 8** | Technical Feasibility: Medical Consent | Consent-based medical record access and patient continuity | `services/MedicalRecordService.js`, `models/Consent.js` | `POST /api/medical/consents`, `GET /api/medical/timeline/:patientId` | Implemented |
| **Slide 8** | **Accessibility Tier 1: Smartphone** | Web dashboard, QR lookup, live Socket.IO events | `services/RealtimeService.js` | WebSocket room `token_{tokenId}`, `GET /api/tokens/:tokenId/status` | Implemented |
| **Slide 8** | **Accessibility Tier 2: Basic Phone** | SMS notification alerts and interactive Twilio Voice IVR | `services/NotificationService.js`, `controllers/IVRController.js` | Twilio SMS API + `/api/ivr/webhook` | Implemented |
| **Slide 8** | **Accessibility Tier 3: No Phone** | Physical paper token, desk staff immediate ETA communication, public hospital display board | `services/TokenService.js`, `controllers/DisplayController.js` | `POST /api/tokens/paper`, `GET /api/display/:hospitalId` | Implemented |
| **Slide 8** | Operational Feasibility: Staff Override | Staff can monitor and override queue states according to hospital rules with mandatory reason | `services/QueueService.js` (`staffQueueOverride`) | `POST /api/queue/:sessionId/override` | Implemented |
| **Slide 9** | Development Plan & Testing | Unified token queue, SMS/IVR, display board, emergency re-forecasting, sample hospital seed data | `tests/runAllTests.js`, `server/src/seed/seedData.js` | 36 Automated Test Scenarios + Unified Seed Data | Implemented |

---

## 2. Key Differentiation & Innovations Verification

1. **One Unified OPD Queue:**
   - Both online tokens (`O101`) and physical walk-in tokens (`P102`, `P104`) share the same live queue array in MongoDB and Redis.
   - Paper tokens are never shunted to a secondary queue.

2. **Immediate Staff Paper Token ETA:**
   - When hospital staff registers a walk-in patient at `/api/tokens/paper`, the backend dynamically inserts the token, evaluates waiting tokens ahead, runs the prediction engine, and returns `predictedWaitMinutes` and `estimatedConsultationTime` in the response immediately.

3. **Emergency Priority Re-forecasting:**
   - Inserting an emergency case (`E001`) does not terminate ongoing doctor consultations.
   - It positions the emergency patient at the head of waiting patients and immediately re-forecasts downstream ETAs, notifying affected patients whose wait changes by >= 5 minutes.

4. **Smart No-Show Lifecycle:**
   - Approaching patients receive SMS and IVR notifications.
   - Absent patients enter a 10-minute grace period before temporary skip.
   - Returned patients use smart re-entry without being permanently cancelled or having to register anew.
