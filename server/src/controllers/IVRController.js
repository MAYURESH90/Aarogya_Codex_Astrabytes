const { Token } = require('../models');

class IVRController {
  /**
   * Twilio IVR Voice Webhook
   * Responds with TwiML audio for basic phone patients checking token status
   */
  static async handleVoiceQuery(req, res) {
    const callerPhone = req.body.From || req.query.From || '';

    // Search for latest active token associated with this phone number
    const token = await Token.findOne({
      patientPhone: callerPhone,
      status: { $in: ['WAITING', 'CALLED', 'IN_CONSULTATION', 'RE_ENTRY_PENDING'] }
    }).sort({ createdAt: -1 });

    res.type('text/xml');

    if (!token) {
      return res.send(`
        <Response>
          <Say voice="alice">Welcome to Aarogya OPD Voice Portal. No active OPD token was found for this phone number. Please visit the hospital registration counter to generate a token.</Say>
        </Response>
      `);
    }

    const estimatedTime = token.estimatedConsultationTime 
      ? new Date(token.estimatedConsultationTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
      : 'shortly';

    res.send(`
      <Response>
        <Say voice="alice">
          Welcome to Aarogya. Your token number is ${token.tokenNumber}. 
          Your current queue position is ${token.queuePosition}. 
          Current status is ${token.status}. 
          Your estimated consultation time is around ${estimatedTime}, with an expected wait of ${token.predictedWaitMinutes} minutes. 
          Please remain in the waiting area. Thank you.
        </Say>
      </Response>
    `);
  }
}

module.exports = IVRController;
