# Aarogya SMS Architecture and Setup (Twilio)

Aarogya utilizes Twilio for patient notifications, OTP verification, and IVR calls.

## Current Trial/Mock Mode
The system is designed to work safely in a development or trial environment without causing booking failures.

1. **Twilio Verify for OTP**: This is active and relies on `TWILIO_VERIFY_SERVICE_SID`. Do not remove these credentials as OTP flow depends on it.
2. **Messaging Service**: For custom automated SMS messages (like Booking Confirmations, ETAs), Twilio requires a Messaging Service. If this is **not configured**, the backend will run in a safe development mode.

### Behavior Without Messaging Service SID
If `TWILIO_MESSAGING_SERVICE_SID` is left blank or undefined in your environment:
- The system will **not** attempt to hit the real Twilio Messaging API.
- The server will log a clear `[SMS DEV MODE]` notification containing the exact message and recipient.
- The API will gracefully return `{ attempted: false, mode: 'development', reason: 'Messaging Service not configured' }`.
- Patient bookings will proceed successfully without crashing.

## Setup Requirements for Production/Real SMS

To enable real SMS delivery, follow these steps:
1. Log in to your Twilio Console.
2. Navigate to Explore Products -> Messaging -> Services.
3. Create a new Messaging Service.
4. Add your Twilio Phone Number to the Sender Pool of this Messaging Service.
5. Copy the Messaging Service SID (starts with `MG...`).

### Environment Configuration (.env)

Your `.env` file should eventually contain the following for full functionality:

```env
# Core Twilio Auth
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890

# Twilio Verify (Used for OTP - MUST REMAIN ACTIVE)
TWILIO_VERIFY_SERVICE_SID=VA...

# Twilio Messaging (Used for Confirmations & ETA - Optional for Dev)
TWILIO_MESSAGING_SERVICE_SID=MG...
```

*Note: Never commit real credentials to version control.*
