const { Token, SystemConfiguration, OPDSession } = require('../models');
const { TOKEN_STATUS, QUEUE_EVENTS, NOTIFICATION_TYPES } = require('../config/constants');
const QueueService = require('./QueueService');
const NotificationService = require('./NotificationService');
const AuditService = require('./AuditService');

class NoShowService {
  /**
   * Check approaching turns and initiate proactive reminders
   */
  static async checkApproachingTurns(sessionId) {
    const session = await OPDSession.findById(sessionId);
    if (!session) return;

    // Tokens currently in WAITING with queuePosition <= 3
    const approachingTokens = await Token.find({
      sessionId,
      status: TOKEN_STATUS.WAITING,
      queuePosition: { $lte: 3 },
      'noShowState.reminderSentAt': null
    });

    for (const token of approachingTokens) {
      if (token.patientPhone) {
        // 1. Send SMS Turn Approaching Alert
        await NotificationService.sendSMS({
          recipientPhone: token.patientPhone,
          message: `Aarogya Alert: Your turn for Token ${token.tokenNumber} is approaching (Position #${token.queuePosition}). Please be ready near Room.`,
          type: NOTIFICATION_TYPES.TURN_APPROACHING,
          tokenId: token._id,
          tokenNumber: token.tokenNumber,
          patientId: token.patientId,
          force: true
        });

        // 2. Trigger IVR automated call if position is 1 or 2
        if (token.queuePosition <= 2 && !token.noShowState.ivrTriggeredAt) {
          await NotificationService.triggerIVRCall({
            recipientPhone: token.patientPhone,
            tokenId: token._id,
            tokenNumber: token.tokenNumber,
            patientName: token.patientName,
            message: `Aarogya Alert: Your token ${token.tokenNumber} is next in line.`
          });
          token.noShowState.ivrTriggeredAt = new Date();
        }

        token.noShowState.reminderSentAt = new Date();
        await token.save();
      }
    }
  }

  /**
   * Handle No-Show: Start grace period or temporarily skip
   */
  static async handlePatientNoShow(sessionId, tokenId, actorUserId, actorRole = 'STAFF') {
    const token = await Token.findById(tokenId);
    if (!token) throw new Error('Token not found');

    const config = await SystemConfiguration.findOne() || { noShowGracePeriodMinutes: 10 };
    const graceMinutes = config.noShowGracePeriodMinutes || 10;

    const now = new Date();

    // If grace period was not yet initiated:
    if (!token.noShowState.gracePeriodEndsAt) {
      token.status = TOKEN_STATUS.NO_SHOW;
      token.noShowState.gracePeriodEndsAt = new Date(now.getTime() + graceMinutes * 60000);
      await token.save();

      // Send SMS notice to absent patient
      if (token.patientPhone) {
        await NotificationService.sendSMS({
          recipientPhone: token.patientPhone,
          message: `Aarogya Alert: Token ${token.tokenNumber} was called but absent. You have a ${graceMinutes}-minute grace period until ${token.noShowState.gracePeriodEndsAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} before being temporarily skipped.`,
          type: NOTIFICATION_TYPES.NO_SHOW_REMINDER,
          tokenId: token._id,
          tokenNumber: token.tokenNumber,
          patientId: token.patientId,
          force: true
        });
      }

      await QueueService.processQueueEvent({
        eventType: QUEUE_EVENTS.NO_SHOW,
        sessionId,
        tokenId: token._id,
        actorId: actorUserId,
        actorRole,
        reason: 'Patient absent when called - Grace period started',
        payload: { tokenNumber: token.tokenNumber, gracePeriodMinutes: graceMinutes }
      });

      return {
        success: true,
        action: 'GRACE_PERIOD_STARTED',
        gracePeriodEndsAt: token.noShowState.gracePeriodEndsAt,
        token
      };
    } else {
      // Grace period has elapsed or staff confirmed patient still absent -> Temporary Skip
      token.status = TOKEN_STATUS.TEMPORARILY_SKIPPED;
      token.noShowState.isSkipped = true;
      token.skippedAt = new Date();
      token.queuePosition = 999; // Deprioritized out of active sequence
      await token.save();

      await QueueService.processQueueEvent({
        eventType: QUEUE_EVENTS.TEMPORARY_SKIP,
        sessionId,
        tokenId: token._id,
        actorId: actorUserId,
        actorRole,
        reason: 'Grace period expired without patient arrival',
        payload: { tokenNumber: token.tokenNumber }
      });

      return {
        success: true,
        action: 'TEMPORARILY_SKIPPED',
        message: 'Patient temporarily skipped. Smart re-entry remains available when patient returns.',
        token
      };
    }
  }

  /**
   * Smart Re-entry: When patient returns to OPD counter
   */
  static async handleSmartReentry(sessionId, tokenId, actorUserId, actorRole = 'STAFF', reason = 'Patient returned to clinic') {
    const token = await Token.findById(tokenId);
    if (!token) throw new Error('Token not found');

    if (token.status !== TOKEN_STATUS.TEMPORARILY_SKIPPED && token.status !== TOKEN_STATUS.NO_SHOW) {
      throw new Error(`Token is in ${token.status} status and does not require re-entry.`);
    }

    const previousState = {
      status: token.status,
      queuePosition: token.queuePosition
    };

    // Policy: Re-enter into active waiting queue with priority = 0 (or re-entry pending)
    // Placed after currently waiting tokens, or 2nd next according to configured policy
    token.status = TOKEN_STATUS.WAITING;
    token.reenteredAt = new Date();
    token.noShowState.isSkipped = false;
    token.noShowState.gracePeriodEndsAt = null;
    token.noShowState.reentryCount = (token.noShowState.reentryCount || 0) + 1;
    // Set joinedAt to now so FCFS places them appropriately after already waiting patients
    token.joinedAt = new Date();
    await token.save();

    await QueueService.processQueueEvent({
      eventType: QUEUE_EVENTS.SMART_REENTRY,
      sessionId,
      tokenId: token._id,
      actorId: actorUserId,
      actorRole,
      reason,
      payload: {
        previousState,
        reentryCount: token.noShowState.reentryCount,
        tokenNumber: token.tokenNumber
      }
    });

    const updatedToken = await Token.findById(token._id);

    if (updatedToken.patientPhone) {
      await NotificationService.sendSMS({
        recipientPhone: updatedToken.patientPhone,
        message: `Aarogya Re-entry Confirmed: Token ${updatedToken.tokenNumber} re-activated at queue position #${updatedToken.queuePosition}. Estimated consultation: ~${new Date(updatedToken.estimatedConsultationTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}.`,
        type: NOTIFICATION_TYPES.ETA_UPDATE,
        tokenId: updatedToken._id,
        tokenNumber: updatedToken.tokenNumber,
        patientId: updatedToken.patientId,
        force: true
      });
    }

    return {
      success: true,
      token: updatedToken,
      message: `Token ${updatedToken.tokenNumber} re-entered queue at position #${updatedToken.queuePosition}.`
    };
  }
}

module.exports = NoShowService;
