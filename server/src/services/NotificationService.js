const { Notification } = require('../models');
const { NOTIFICATION_CHANNELS, NOTIFICATION_TYPES } = require('../config/constants');
const env = require('../config/env');

class NotificationService {
  /**
   * Send SMS alert with significance threshold gating
   */
  static async sendSMS({
    recipientPhone,
    message,
    type,
    tokenId = null,
    tokenNumber = null,
    patientId = null,
    newWaitMinutes = null,
    lastNotifiedWaitMinutes = null,
    thresholdMinutes = 5,
    force = false
  }) {
    if (!recipientPhone) {
      return { success: false, reason: 'NO_PHONE_NUMBER' };
    }

    // Significance threshold check: prevent notification spam
    if (!force && newWaitMinutes !== null && lastNotifiedWaitMinutes !== null) {
      const delta = Math.abs(newWaitMinutes - lastNotifiedWaitMinutes);
      if (delta < thresholdMinutes) {
        // Record skipped notification for audit
        await Notification.create({
          type: type || NOTIFICATION_TYPES.ETA_UPDATE,
          channel: NOTIFICATION_CHANNELS.SMS,
          recipientPhone,
          patientId,
          tokenId,
          tokenNumber,
          message: `[SUPPRESSED - DELTA ${delta}m < ${thresholdMinutes}m] ${message}`,
          status: 'SKIPPED_THRESHOLD'
        });
        return { success: true, skipped: true, reason: 'BELOW_SIGNIFICANCE_THRESHOLD' };
      }
    }

    let providerMessageId = null;
    let status = 'SENT';
    let errorMessage = null;

    // Dispatch via Twilio if configured
    if (env.TWILIO.ACCOUNT_SID && env.TWILIO.AUTH_TOKEN) {
      if (!env.TWILIO.MESSAGING_SERVICE_SID) {
        console.log(`\n[SMS DEV MODE]`);
        console.log(`To: ${recipientPhone}`);
        console.log(`Message:\n${message}\n`);
        return {
          attempted: false,
          mode: 'development',
          reason: 'Messaging Service not configured'
        };
      }

      try {
        const twilio = require('twilio')(env.TWILIO.ACCOUNT_SID, env.TWILIO.AUTH_TOKEN);
        const result = await twilio.messages.create({
          body: message,
          messagingServiceSid: env.TWILIO.MESSAGING_SERVICE_SID,
          to: recipientPhone
        });
        providerMessageId = result.sid;
      } catch (err) {
        console.warn(`[NotificationService] Twilio delivery failed: ${err.message}. Marking FAILED in notification log.`);
        status = 'FAILED';
        errorMessage = err.message;
      }
    } else {
      // Sandboxed/Simulated SMS provider
      providerMessageId = `SIM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      console.log(`[NotificationService:SMS SIMULATOR] To: ${recipientPhone} | Type: ${type} | Msg: "${message}"`);
    }

    // Persist to MongoDB Notification audit log
    const record = await Notification.create({
      type: type || NOTIFICATION_TYPES.ETA_UPDATE,
      channel: NOTIFICATION_CHANNELS.SMS,
      recipientPhone,
      patientId,
      tokenId,
      tokenNumber,
      message,
      status,
      providerMessageId,
      errorMessage,
      sentAt: new Date()
    });

    return {
      success: status === 'SENT',
      notificationId: record._id,
      status,
      providerMessageId
    };
  }

  /**
   * Trigger IVR Voice Call / Notification via Twilio Voice webhook
   */
  static async triggerIVRCall({
    recipientPhone,
    tokenId,
    tokenNumber,
    patientName,
    message,
    type = NOTIFICATION_TYPES.TURN_APPROACHING
  }) {
    if (!recipientPhone) return { success: false, reason: 'NO_PHONE_NUMBER' };

    let providerMessageId = `IVR-SIM-${Date.now()}`;
    let status = 'SENT';

    if (env.TWILIO.ACCOUNT_SID && env.TWILIO.AUTH_TOKEN) {
      try {
        const twilio = require('twilio')(env.TWILIO.ACCOUNT_SID, env.TWILIO.AUTH_TOKEN);
        const call = await twilio.calls.create({
          twiml: `<Response><Say voice="alice">Hello ${patientName || 'Patient'}. This is Aarogya Hospital System. Your turn for token ${tokenNumber} is approaching. Please report to the OPD counter immediately.</Say></Response>`,
          to: recipientPhone,
          from: env.TWILIO.PHONE_NUMBER
        });
        providerMessageId = call.sid;
      } catch (err) {
        console.warn(`[NotificationService] Twilio IVR call failed: ${err.message}`);
        status = 'FAILED';
      }
    } else {
      console.log(`[NotificationService:IVR SIMULATOR] Calling ${recipientPhone} | Msg: ${message}`);
    }

    await Notification.create({
      type,
      channel: NOTIFICATION_CHANNELS.IVR,
      recipientPhone,
      tokenId,
      tokenNumber,
      message,
      status,
      providerMessageId,
      sentAt: new Date()
    });

    return { success: status === 'SENT', providerMessageId };
  }
}

module.exports = NotificationService;
