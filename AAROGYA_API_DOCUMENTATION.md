# Aarogya — API Documentation & Contract Reference

**Team:** AstraBytes  
**API Base URL:** `http://localhost:5000/api`  
**Interactive OpenAPI UI:** `http://localhost:5000/api-docs`

---

## 1. Authentication Endpoints

### Register User
`POST /api/auth/register`  
Creates a patient or hospital personnel user account.
```json
// Request Body
{
  "name": "Rajesh Sharma",
  "phone": "+919876543210",
  "password": "Password@123",
  "role": "PATIENT" // "PATIENT" | "STAFF" | "DOCTOR" | "ADMIN"
}
// Response (201 Created)
{
  "success": true,
  "message": "User registered successfully. OTP sent for phone verification.",
  "userId": "66e9a8f...",
  "role": "PATIENT"
}
```

### Request Phone OTP
`POST /api/auth/request-otp`
```json
{
  "phone": "+919876543210"
}
```

### Verify OTP & Receive JWT
`POST /api/auth/verify-otp`
```json
// Request Body
{
  "phone": "+919876543210",
  "otp": "123456"
}
// Response (200 OK)
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "user": {
    "id": "66e9a8f...",
    "name": "Rajesh Sharma",
    "phone": "+919876543210",
    "role": "PATIENT"
  }
}
```

---

## 2. Token & Unified Queue Endpoints

### Register Staff Paper / Walk-in Token (Mandatory Immediate ETA Contract)
`POST /api/tokens/paper`  
*Requires Authorization: Bearer JWT (Role: STAFF or ADMIN)*
```json
// Request Body
{
  "tokenNumber": "P106",
  "patient": {
    "name": "Babu Rao",
    "phone": null // Phone is optional for walk-in patients!
  },
  "hospitalId": "66e9a8f1...",
  "opdId": "66e9a8f2...",
  "doctorId": "66e9a8f3...",
  "sessionId": "66e9a8f4...",
  "date": "2026-09-19"
}
// Response (201 Created)
{
  "success": true,
  "token": {
    "id": "66e9a8f5...",
    "tokenNumber": "P106",
    "tokenType": "PAPER",
    "queuePosition": 6,
    "status": "WAITING"
  },
  "prediction": {
    "predictedWaitMinutes": 48,
    "estimatedConsultationTime": "2026-09-19T14:18:00.000Z",
    "predictionTimestamp": "2026-09-19T13:30:00.000Z",
    "predictionSource": "AI",
    "confidence": 0.88,
    "factors": {
      "patientsAhead": 5,
      "emergencyAhead": 0,
      "currentConsultationRemainingMinutes": 3.2,
      "effectiveConsultationDuration": 8.0,
      "operationalDelayMinutes": 0
    }
  }
}
```

### Register Online Patient Token
`POST /api/tokens/online`  
*Requires Authorization: Bearer JWT (Role: PATIENT)*
```json
{
  "hospitalId": "66e9a8f1...",
  "opdId": "66e9a8f2...",
  "doctorId": "66e9a8f3...",
  "sessionId": "66e9a8f4...",
  "date": "2026-09-19",
  "paymentId": null // Required only if OPD requires payment
}
```

### Patient Live Queue Status Query
`GET /api/tokens/:tokenId/status`  
Public endpoint for patients to check their position and updated ETA from their mobile browser or by scanning a QR code on their token slip.
```json
{
  "success": true,
  "data": {
    "tokenId": "66e9a8f5...",
    "tokenNumber": "P106",
    "tokenType": "PAPER",
    "queuePosition": 6,
    "peopleAhead": 5,
    "status": "WAITING",
    "predictedWaitMinutes": 48,
    "estimatedConsultationTime": "2026-09-19T14:18:00.000Z",
    "doctorName": "Dr. Ramesh Patel",
    "opdName": "General Medicine OPD",
    "roomNumber": "101"
  }
}
```

### Get Unified Live Queue (Staff & Doctor View)
`GET /api/queue/:sessionId/live`  
Returns the single live queue containing Online (`O-`), Paper (`P-`), and Emergency (`E-`) tokens.
```json
{
  "success": true,
  "data": {
    "currentConsultation": {
      "tokenNumber": "O101",
      "tokenType": "ONLINE",
      "patientName": "Aakash Verma",
      "elapsedMinutes": 5
    },
    "unifiedQueue": [
      {
        "tokenNumber": "P102",
        "tokenType": "PAPER",
        "queuePosition": 1,
        "status": "WAITING",
        "predictedWaitMinutes": 3,
        "estimatedConsultationTime": "2026-09-19T09:23:00.000Z"
      },
      {
        "tokenNumber": "O103",
        "tokenType": "ONLINE",
        "queuePosition": 2,
        "status": "WAITING",
        "predictedWaitMinutes": 11,
        "estimatedConsultationTime": "2026-09-19T09:31:00.000Z"
      }
    ],
    "completedCount": 4
  }
}
```

---

## 3. Queue Mutation & Clinical Control Endpoints

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/api/queue/:sessionId/call-next` | POST | DOCTOR, STAFF | Calls the next waiting patient, updates status to `CALLED`, triggers SMS. |
| `/api/queue/:sessionId/consultation-start` | POST | DOCTOR | Marks token `IN_CONSULTATION`, starts duration timer. |
| `/api/queue/:sessionId/consultation-complete`| POST | DOCTOR | Marks token `COMPLETED`, records duration, and re-forecasts downstream queue. |
| `/api/queue/:sessionId/emergency` | POST | STAFF, DOCTOR, ADMIN | Inserts priority emergency case at front of waiting list without interrupting active doctor consultation. |
| `/api/queue/:sessionId/doctor-delay` | POST | DOCTOR, STAFF | Records doctor operational delay and recalculates waiting ETAs. |
| `/api/queue/:sessionId/doctor-early-finish` | POST | DOCTOR, STAFF | Clears delays and recalculates queue following faster-than-anticipated consultations. |
| `/api/queue/:sessionId/no-show` | POST | STAFF, DOCTOR | Initiates 10-minute grace period or temporarily skips absent patient. |
| `/api/queue/:sessionId/re-entry` | POST | STAFF | Restores returned patient to the waiting queue with smart re-entry policy. |
| `/api/queue/:sessionId/override` | POST | STAFF, ADMIN | Overrides queue state with a mandatory justification reason and creates an audit record. |

---

## 4. Hospital Display Board & IVR

### Hospital Display Board Endpoint
`GET /api/display/:hospitalId`  
Public, sanitized endpoint showing current serving tokens and upcoming tokens across all active OPD rooms without leaking personal clinical data.

### Twilio Voice IVR Webhook
`POST /api/ivr/webhook`  
Responds with audio TwiML reading live token status and ETA to basic-phone callers.
