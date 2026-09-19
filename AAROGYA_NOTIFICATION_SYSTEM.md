# Aarogya — Notification & Multi-Channel Communication System

**Team:** AstraBytes  
**Core Module:** `server/src/services/NotificationService.js` & `server/src/controllers/IVRController.js`

---

## 1. Multi-Tier Patient Accessibility Architecture

Aarogya is built to ensure that no patient is excluded from knowing their expected consultation time, regardless of technological ownership:

```
+---------------------------------------------------------------------------------+
|                       PATIENT ACCESSIBILITY ARCHITECTURE                        |
|                                                                                 |
|  [ TIER 1: SMARTPHONE ]       [ TIER 2: BASIC PHONE ]     [ TIER 3: NO PHONE ]  |
|  - Web Application Dashboard  - Twilio SMS Notifications  - Printed Paper Token |
|  - Real-time Socket.IO Events - Twilio Voice IVR Webhook  - Staff Communicates  |
|  - QR Code Token Tracking     - Interactive Voice Queries   Immediate Wait Time |
|                                                           - Hospital Display TV |
+---------------------------------------------------------------------------------+
```

---

## 2. Significance Threshold Gating (No Notification Spam)

In a live OPD, small recalculations occur constantly (e.g. ETA fluctuates by 1 minute). Sending an SMS message on every 1-minute delta would flood patient inboxes, exhaust SMS budgets, and cause panic.

Aarogya enforces a **Significance Threshold Gate**:
- Configured via `etaNotificationThresholdMinutes` (default: **5 minutes**).
- When a queue event occurs:
  $$\Delta \text{Wait} = |\text{newWaitMinutes} - \text{lastNotifiedWaitMinutes}|$$
- If $\Delta \text{Wait} < 5$ minutes:
  - The notification is marked as `SKIPPED_THRESHOLD` in the audit log.
  - No SMS is dispatched.
- If $\Delta \text{Wait} \ge 5$ minutes OR if an Emergency is inserted:
  - An updated SMS is immediately dispatched.
  - The patient's `notificationState.lastNotifiedWaitMinutes` is updated.

---

## 3. Twilio IVR Webhook Integration

For basic-phone users without internet access:
- When calling the hospital's dedicated Twilio hotline, the request hits `/api/ivr/webhook`.
- The webhook matches the caller's phone number (`From`) against the active OPD database.
- It dynamically generates a TwiML response reading:
  > *"Welcome to Aarogya. Your token number is P106. Your current queue position is 6. Your estimated consultation time is around 2:18 PM with an expected wait of 48 minutes. Please remain in the waiting area."*
- If no token is active, it advises the patient to visit the registration desk.
