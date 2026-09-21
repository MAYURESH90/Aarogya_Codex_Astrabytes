# Aarogya — Database Schema & Data Dictionary

**Database Engine:** MongoDB  
**ORM:** Mongoose 8.x  
**Primary Models:** 19 Collections

---

## 1. Collections & Structural Schemas

### 1.1 `users`
Represents authenticating actors (Patients, Desk Staff, Doctors, System Administrators).
- `_id`: ObjectId
- `phone`: String (Unique, Indexed)
- `name`: String
- `email`: String (Optional, Sparse)
- `passwordHash`: String (Bcrypt)
- `role`: Enum (`'PATIENT'`, `'STAFF'`, `'DOCTOR'`, `'ADMIN'`)
- `hospitalId`: ObjectId -> `hospitals`
- `opdId`: ObjectId -> `opds`
- `doctorId`: ObjectId -> `doctors`
- `isPhoneVerified`: Boolean
- `otpHash`: String
- `otpExpiresAt`: Date
- `isActive`: Boolean

### 1.2 `patients`
Demographic profile for clinical visits and medical continuity.
- `_id`: ObjectId
- `userId`: ObjectId -> `users` (Sparse)
- `name`: String
- `phone`: String (Indexed)
- `abhaNumber`: String (Ayushman Bharat Health Account ID, Sparse)
- `dateOfBirth`: Date
- `gender`: Enum (`'MALE'`, `'FEMALE'`, `'OTHER'`, `'UNDISCLOSED'`)
- `isWalkInWithoutPhone`: Boolean

### 1.3 `hospitals` & `opds`
Hospital facilities and clinical departments.
- `Hospital`: `name`, `code` (Unique), `address`, `pinCode` (String, Indexed), `isGovernment` (Boolean, Indexed), `timezone` (`'Asia/Kolkata'`), `isActive`
- `OPD`: `hospitalId`, `name`, `code`, `department`, `roomNumber`, `isGeneralOPD` (Boolean), `paymentRequired` (Boolean), `consultationFee` (Number), `averageConsultationDuration` (Minutes)

### 1.4 `opdsessions`
Multi-session boundaries (e.g. Morning 09:00–13:00, Evening 16:00–20:00).
- `_id`: ObjectId
- `hospitalId`: ObjectId -> `hospitals`
- `opdId`: ObjectId -> `opds`
- `doctorId`: ObjectId -> `doctors`
- `name`: String (`"Morning Session"`)
- `date`: String (`"YYYY-MM-DD"`, Indexed)
- `startTime`: String (`"09:00"`)
- `endTime`: String (`"13:00"`)
- `status`: Enum (`'SCHEDULED'`, `'ACTIVE'`, `'COMPLETED'`, `'CANCELLED'`)
- `currentConsultationTokenId`: ObjectId -> `tokens`
- `completedCount`: Number
- `activeDelays`: Array of `{ delayMinutes, reason, reportedAt }`

### 1.5 `tokens` (Core Unified Queue Item)
Co-locates Online, Paper, and Emergency tokens.
- `_id`: ObjectId
- `tokenNumber`: String (e.g. `"O101"`, `"P102"`, `"E001"`, Indexed)
- `tokenType`: Enum (`'ONLINE'`, `'PAPER'`, `'EMERGENCY'`)
- `patientId`: ObjectId -> `patients`
- `patientName`: String
- `patientPhone`: String (Indexed)
- `hospitalId`, `opdId`, `doctorId`, `sessionId`: ObjectIds
- `priority`: Number (`2` = Emergency, `1` = Senior/Priority, `0` = Normal)
- `queuePosition`: Number (Dynamic sequential rank)
- `status`: Enum (`'WAITING'`, `'CALLED'`, `'IN_CONSULTATION'`, `'COMPLETED'`, `'NO_SHOW'`, `'TEMPORARILY_SKIPPED'`, `'RE_ENTRY_PENDING'`, `'CANCELLED'`)
- `joinedAt`, `arrivedAt`, `calledAt`, `consultationStartedAt`, `consultationEndedAt`: Dates
- `actualConsultationDurationMinutes`: Number
- `predictedWaitMinutes`: Number
- `estimatedConsultationTime`: Date (IST)
- `predictionSource`: Enum (`'AI'`, `'FALLBACK'`)
- `confidence`: Number
- `noShowState`: `{ reminderSentAt, ivrTriggeredAt, gracePeriodEndsAt, isSkipped, reentryCount }`
- `notificationState`: `{ lastNotifiedETA, lastNotifiedWaitMinutes, smsCount }`

### 1.6 Clinical Collections
- `consultations`: `tokenId`, `patientId`, `doctorId`, `sessionId`, `symptoms`, `diagnosis`, `clinicalNotes`, `durationMinutes`, `startedAt`, `endedAt`, `followUpDate`.
- `prescriptions`: `consultationId`, `patientId`, `doctorId`, `medicines` (`name`, `dosage`, `frequency`, `durationDays`), `dietaryAdvice`.
- `reports`: `patientId`, `doctorId`, `consultationId`, `title`, `reportType`, `summary`, `fileUrl`.
- `documents`: Medical files, `ocrStatus`, `ocrExtractedText`, `ocrExtractedFields`.
- `consents`: `patientId`, `doctorId`, `hospitalId`, `status` (`'GRANTED'`, `'REVOKED'`), `expiresAt`.

### 1.7 Audit & Security
- `auditlogs`: Immutable logs tracking `actorId`, `actorRole`, `action`, `entity`, `entityId`, `reason`, `previousState`, `newState`, `timestamp`, `ipAddress`.
- `queueevents`: Detailed event stream capturing all queue transitions.

---

## 2. Key Compound Indexes & Uniqueness Guarantees

```javascript
// Prevent duplicate token numbers within the same OPD session
TokenSchema.index({ sessionId: 1, tokenNumber: 1 }, { unique: true });

// Optimize live queue rendering and priority sorting
TokenSchema.index({ sessionId: 1, status: 1, queuePosition: 1 });

// Prevent duplicate sessions for same doctor on the same date and time slot
OPDSessionSchema.index({ hospitalId: 1, opdId: 1, doctorId: 1, date: 1, name: 1 }, { unique: true });

// Prevent duplicate payment processing by idempotency key
PaymentSchema.index({ idempotencyKey: 1 }, { unique: true });
```
