# Aarogya — Operational Edge Cases & Failure Recovery

**Team:** AstraBytes

---

## 1. Concurrency: Simultaneous Online & Paper Registration

**Scenario:** At 10:00:00 AM, Patient A submits an online token request while Desk Staff registers walk-in token P106.
- **Vulnerability:** Standard read-then-write code would assign both patients `queuePosition = 6` or cause duplicate keys.
- **Aarogya Solution:**
  1. Operations acquire a distributed mutex lock on the session (`lock:session:${sessionId}`) via Redis with a 4-second timeout.
  2. Sequential insertion guarantees distinct positions.
  3. Unique compound index `{ sessionId: 1, tokenNumber: 1 }` in MongoDB prevents any duplicate token collisions.

---

## 2. Emergency Arrival During Active Consultation

**Scenario:** Emergency trauma patient arrives while the doctor is examining a regular patient (`IN_CONSULTATION`).
- **Policy:** The ongoing consultation is **not** aborted or interrupted.
- **Aarogya Solution:**
  1. The emergency token (`E001`, `priority = 2`) is inserted at `queuePosition = 1` among *waiting* patients.
  2. The active consultation continues to completion.
  3. When the active consultation ends, the doctor calls next, automatically bringing in `E001`.
  4. All subsequent waiting patients have their ETAs shifted back by the emergency's anticipated duration.

---

## 3. Paper Token Walk-in Patient Without a Phone

**Scenario:** An elderly daily-wage worker or villager arrives at the hospital without a smartphone or basic mobile number.
- **Policy:** Aarogya strictly forbids requiring mobile phones or digital apps for walk-in patients.
- **Aarogya Solution:**
  1. Staff enters `phone: null` and the patient's name into `/api/tokens/paper`.
  2. The backend generates token `P104`, determines queue position, runs prediction, and **immediately returns the expected consultation time** in the API response.
  3. The staff member verbally communicates: *"Your expected turn is at approximately 11:35 AM at Room 101."*
  4. The public hospital TV display board displays token `P104` alongside online tokens.

---

## 4. External Service Outages & Graceful Degradation

### 4.1 Twilio Outage
- **Handling:** If Twilio is down or credentials are unconfigured, `NotificationService` catches the network error, marks the notification record as `FAILED`, and logs the attempt.
- **Result:** The central OPD queue and doctor consultation flow continue operating without interruption.

### 4.2 FastAPI Prediction Engine Offline
- **Handling:** If `http://localhost:8000/api/predict` is unreachable, `PredictionService` automatically engages its internal deterministic queue simulator (`_calculateFallbackPrediction`).
- **Result:** Wait times and consultation times continue to be provided with `predictionSource: "FALLBACK"`.

### 4.3 Redis Service Offline
- **Handling:** If external Redis fails or cannot be reached, the system activates `InMemoryRedisFallback`.
- **Result:** In-memory caching and mutex locking continue working without throwing unhandled exceptions.

### 4.4 OCR Extraction Failure
- **Handling:** If a document is blurry or the OCR module encounters an error, the raw uploaded document is preserved in the filesystem and marked with `ocrStatus: "FAILED"`.
- **Result:** The patient's clinical file is never corrupted or deleted.

---

## 5. End-of-Day & Midnight Session Rollover

**Scenario:** Session ends with unfinished tokens.
- **Policy:** Tokens are strictly scoped to their `OPDSession` and `date`.
- **Aarogya Solution:**
  1. Unfinished tokens are finalized and retained for departmental audit history.
  2. Unfinished tokens do not automatically spill over or contaminate the next morning's clean queue.
  3. A fresh session is generated for the new day with queue positions starting cleanly at 1.
