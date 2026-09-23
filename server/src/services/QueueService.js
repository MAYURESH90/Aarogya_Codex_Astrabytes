const { Token, OPDSession, QueueEvent, SystemConfiguration, Doctor } = require('../models');
const { TOKEN_STATUS, QUEUE_EVENTS, NOTIFICATION_TYPES, DEFAULT_CONFIG } = require('../config/constants');
const { getRedisClient } = require('../config/redis');
const PredictionService = require('./PredictionService');
const NotificationService = require('./NotificationService');
const RealtimeService = require('./RealtimeService');
const AuditService = require('./AuditService');

class QueueService {
  /**
   * Acquire a distributed lock for concurrency safety across online & paper token additions
   */
  static async acquireSessionLock(sessionId, timeoutMs = 4000) {
    const redis = getRedisClient();
    const lockKey = `lock:session:${sessionId}`;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const acquired = await redis.acquireLock(lockKey, 5);
      if (acquired) return lockKey;
      await new Promise(res => setTimeout(res, 50));
    }
    throw new Error('Could not acquire queue session lock. System is busy, please retry.');
  }

  static async releaseSessionLock(lockKey) {
    const redis = getRedisClient();
    await redis.releaseLock(lockKey);
  }

  /**
   * Recalculate dynamic queue positions for all active tokens in a session
   */
  static async recalculateQueuePositions(sessionId) {
    // Priority order: 
    // Status: IN_CONSULTATION is always serving
    // WAITING / RE_ENTRY_PENDING: ordered by priority DESC (2=Emergency, 1=Priority, 0=Normal), then joinedAt ASC
    const activeWaitingTokens = await Token.find({
      sessionId,
      status: { $in: [TOKEN_STATUS.WAITING, TOKEN_STATUS.RE_ENTRY_PENDING] }
    }).sort({ priority: -1, joinedAt: 1 });

    const bulkOps = [];
    let pos = 1;
    for (const token of activeWaitingTokens) {
      if (token.queuePosition !== pos) {
        bulkOps.push({
          updateOne: {
            filter: { _id: token._id },
            update: { $set: { queuePosition: pos } }
          }
        });
        token.queuePosition = pos;
      }
      pos++;
    }

    if (bulkOps.length > 0) {
      await Token.bulkWrite(bulkOps);
    }

    return activeWaitingTokens;
  }

  /**
   * Core Event Pipeline:
   * Process a queue-changing event, re-order positions, reforecast remaining patients,
   * trigger notifications if significant, update display board, audit.
   */
  static async processQueueEvent({
    eventType,
    sessionId,
    tokenId = null,
    actorId = null,
    actorRole = 'SYSTEM',
    reason = null,
    payload = {}
  }) {
    const session = await OPDSession.findById(sessionId).populate('opdId doctorId hospitalId');
    if (!session) throw new Error('OPDSession not found');

    const config = await SystemConfiguration.findOne({
      $or: [{ opdId: session.opdId._id }, { hospitalId: session.hospitalId._id }]
    }) || DEFAULT_CONFIG;

    // 1. Recalculate dynamic positions
    const waitingTokens = await this.recalculateQueuePositions(sessionId);
    const currentConsultation = await Token.findOne({
      sessionId,
      status: TOKEN_STATUS.IN_CONSULTATION
    });

    // 2. Fetch active operational delays
    const delays = session.activeDelays || [];

    // 3. Build queue context for dynamic prediction
    const emergencyPatients = waitingTokens.filter(t => t.priority >= 2);
    const regularWaitingPatients = waitingTokens.filter(t => t.priority < 2);

    const queueContext = {
      hospitalId: session.hospitalId._id,
      opdId: session.opdId._id,
      doctorId: session.doctorId._id,
      sessionId: session._id,
      averageConsultationDuration: session.opdId.averageConsultationDuration || config.AVERAGE_CONSULTATION_DURATION || 8,
      currentPatient: currentConsultation,
      waitingPatients: waitingTokens,
      emergencyPatients,
      delays,
      doctorAvailability: { status: session.doctorId.status }
    };

    // 4. Re-forecast ETA for all waiting tokens
    const updatedTokens = [];
    for (const token of waitingTokens) {
      const prediction = await PredictionService.getWaitTimePrediction({
        ...queueContext,
        targetToken: token
      });

      const previousWait = token.predictedWaitMinutes;
      const newWait = prediction.predictedWaitMinutes;
      const waitDelta = Math.abs(newWait - previousWait);

      token.predictedWaitMinutes = newWait;
      token.estimatedConsultationTime = prediction.estimatedConsultationTime;
      token.predictionTimestamp = prediction.predictionTimestamp;
      token.predictionSource = prediction.predictionSource;
      token.confidence = prediction.confidence;
      token.predictionFactors = prediction.factors;
      await token.save();

      updatedTokens.push(token);

      // Check notification threshold
      if (token.patientPhone && (waitDelta >= (config.etaNotificationThresholdMinutes || 5) || eventType === QUEUE_EVENTS.EMERGENCY_ADDED)) {
        await NotificationService.sendSMS({
          recipientPhone: token.patientPhone,
          message: `Aarogya OPD Update: Token ${token.tokenNumber}. Expected consultation at ~${new Date(token.estimatedConsultationTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} (Wait ~${token.predictedWaitMinutes}m).`,
          type: eventType === QUEUE_EVENTS.EMERGENCY_ADDED ? NOTIFICATION_TYPES.EMERGENCY_DELAY_ALERT : NOTIFICATION_TYPES.ETA_UPDATE,
          tokenId: token._id,
          tokenNumber: token.tokenNumber,
          patientId: token.patientId,
          newWaitMinutes: newWait,
          lastNotifiedWaitMinutes: token.notificationState?.lastNotifiedWaitMinutes,
          thresholdMinutes: config.etaNotificationThresholdMinutes || 5
        });

        token.notificationState.lastNotifiedETA = token.estimatedConsultationTime;
        token.notificationState.lastNotifiedWaitMinutes = newWait;
        token.notificationState.lastSentAt = new Date();
        await token.save();
      }

      // Individual real-time update
      RealtimeService.emitTokenETA(token._id, {
        tokenNumber: token.tokenNumber,
        queuePosition: token.queuePosition,
        predictedWaitMinutes: token.predictedWaitMinutes,
        estimatedConsultationTime: token.estimatedConsultationTime,
        status: token.status
      });
    }

    // 5. Log Queue Event
    const queueEvent = await QueueEvent.create({
      eventType,
      sessionId,
      tokenId,
      tokenNumber: payload.tokenNumber || null,
      actorId,
      actorRole,
      reason,
      payload,
      timestamp: new Date()
    });

    // 6. Audit Log
    await AuditService.log({
      actorId,
      actorRole,
      action: eventType,
      entity: 'QUEUE',
      entityId: String(sessionId),
      reason,
      metadata: payload
    });

    // 7. Realtime broadcast for OPD session subscribers & display board
    RealtimeService.emitQueueUpdate(sessionId, eventType, {
      activeServing: currentConsultation ? {
        tokenNumber: currentConsultation.tokenNumber,
        tokenType: currentConsultation.tokenType,
        startedAt: currentConsultation.consultationStartedAt
      } : null,
      totalWaiting: waitingTokens.length,
      upcomingTokens: waitingTokens.slice(0, 5).map(t => ({
        tokenNumber: t.tokenNumber,
        tokenType: t.tokenType,
        queuePosition: t.queuePosition,
        estimatedConsultationTime: t.estimatedConsultationTime
      }))
    });

    // Display Board Sanitized Update
    RealtimeService.emitDisplayBoard(session.hospitalId._id, {
      opdName: session.opdId.name,
      doctorName: session.doctorId.name,
      roomNumber: session.opdId.roomNumber,
      servingToken: currentConsultation ? currentConsultation.tokenNumber : 'NONE',
      nextTokens: waitingTokens.slice(0, 3).map(t => t.tokenNumber)
    });

    return {
      success: true,
      eventType,
      waitingCount: waitingTokens.length,
      currentServing: currentConsultation ? currentConsultation.tokenNumber : null,
      updatedTokens
    };
  }

  /**
   * Get Unified Live Queue for Staff and Doctor Dashboards
   */
  static async getLiveQueue(sessionId) {
    const session = await OPDSession.findById(sessionId)
      .populate('opdId doctorId hospitalId');
    if (!session) throw new Error('OPDSession not found');

    const currentConsultation = await Token.findOne({
      sessionId,
      status: TOKEN_STATUS.IN_CONSULTATION
    }).populate('patientId');

    const waitingTokens = await Token.find({
      sessionId,
      status: { $in: [TOKEN_STATUS.WAITING, TOKEN_STATUS.RE_ENTRY_PENDING, TOKEN_STATUS.CALLED] }
    }).sort({ queuePosition: 1 }).populate('patientId');

    const completedTokens = await Token.find({
      sessionId,
      status: TOKEN_STATUS.COMPLETED
    }).sort({ consultationEndedAt: -1 }).limit(10);

    return {
      session: {
        id: session._id,
        name: session.name,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
        opd: session.opdId,
        doctor: session.doctorId,
        hospital: session.hospitalId
      },
      currentConsultation: currentConsultation ? {
        id: currentConsultation._id,
        tokenNumber: currentConsultation.tokenNumber,
        tokenType: currentConsultation.tokenType,
        patientName: currentConsultation.patientName,
        consultationStartedAt: currentConsultation.consultationStartedAt,
        elapsedMinutes: Math.round((Date.now() - new Date(currentConsultation.consultationStartedAt).getTime()) / 60000)
      } : null,
      unifiedQueue: waitingTokens.map(t => ({
        id: t._id,
        tokenNumber: t.tokenNumber,
        tokenType: t.tokenType, // 'ONLINE', 'PAPER', or 'EMERGENCY'
        queuePosition: t.queuePosition,
        priority: t.priority,
        priorityReason: t.priorityReason,
        status: t.status,
        patientName: t.patientName,
        patientPhone: t.patientPhone,
        joinedAt: t.joinedAt,
        predictedWaitMinutes: t.predictedWaitMinutes,
        estimatedConsultationTime: t.estimatedConsultationTime,
        predictionSource: t.predictionSource,
        confidence: t.confidence
      })),
      completedCount: session.completedCount || completedTokens.length
    };
  }

  /**
   * Doctor calls next waiting patient
   */
  static async callNextPatient(sessionId, doctorUserId) {
    const lockKey = await this.acquireSessionLock(sessionId);
    try {
      // 1. Find next waiting token by queuePosition
      const nextToken = await Token.findOne({
        sessionId,
        status: TOKEN_STATUS.WAITING
      }).sort({ queuePosition: 1 });

      if (!nextToken) {
        return { success: false, message: 'No waiting patients in queue.' };
      }

      nextToken.status = TOKEN_STATUS.CALLED;
      nextToken.calledAt = new Date();
      await nextToken.save();

      // Trigger event pipeline
      await this.processQueueEvent({
        eventType: QUEUE_EVENTS.PATIENT_CALLED,
        sessionId,
        tokenId: nextToken._id,
        actorId: doctorUserId,
        actorRole: 'DOCTOR',
        payload: { tokenNumber: nextToken.tokenNumber }
      });

      // Send immediate SMS reminder to called patient
      if (nextToken.patientPhone) {
        await NotificationService.sendSMS({
          recipientPhone: nextToken.patientPhone,
          message: `Aarogya Alert: Your token ${nextToken.tokenNumber} is now CALLED. Please proceed immediately to room!`,
          type: NOTIFICATION_TYPES.TURN_APPROACHING,
          tokenId: nextToken._id,
          tokenNumber: nextToken.tokenNumber,
          patientId: nextToken.patientId,
          force: true
        });
      }

      return {
        success: true,
        calledToken: nextToken
      };
    } finally {
      await this.releaseSessionLock(lockKey);
    }
  }

  /**
   * Start consultation
   */
  static async startConsultation(sessionId, tokenId, doctorUserId) {
    const lockKey = await this.acquireSessionLock(sessionId);
    try {
      const token = await Token.findById(tokenId);
      if (!token) throw new Error('Token not found');

      // Verify no other active consultation is in progress
      const ongoing = await Token.findOne({
        sessionId,
        status: TOKEN_STATUS.IN_CONSULTATION
      });
      if (ongoing && String(ongoing._id) !== String(tokenId)) {
        throw new Error(`Another patient (${ongoing.tokenNumber}) is currently in consultation.`);
      }

      token.status = TOKEN_STATUS.IN_CONSULTATION;
      token.consultationStartedAt = new Date();
      token.queuePosition = 0; // Serving now
      await token.save();

      await OPDSession.findByIdAndUpdate(sessionId, {
        currentConsultationTokenId: token._id
      });

      await this.processQueueEvent({
        eventType: QUEUE_EVENTS.CONSULTATION_STARTED,
        sessionId,
        tokenId: token._id,
        actorId: doctorUserId,
        actorRole: 'DOCTOR',
        payload: { tokenNumber: token.tokenNumber }
      });

      return { success: true, token };
    } finally {
      await this.releaseSessionLock(lockKey);
    }
  }

  /**
   * Complete consultation
   */
  static async completeConsultation(sessionId, tokenId, doctorUserId, clinicalData = {}) {
    const lockKey = await this.acquireSessionLock(sessionId);
    try {
      const token = await Token.findById(tokenId);
      if (!token) throw new Error('Token not found');

      const endedAt = new Date();
      const startedAt = token.consultationStartedAt || token.calledAt || new Date(endedAt.getTime() - 8 * 60000);
      const durationMinutes = Math.max(1, Math.round((endedAt.getTime() - new Date(startedAt).getTime()) / 60000));

      token.status = TOKEN_STATUS.COMPLETED;
      token.consultationEndedAt = endedAt;
      token.actualConsultationDurationMinutes = durationMinutes;
      token.queuePosition = 0;
      await token.save();

      await OPDSession.findByIdAndUpdate(sessionId, {
        currentConsultationTokenId: null,
        $inc: { completedCount: 1 }
      });

      // Reforecast remaining queue now that consultation is completed
      await this.processQueueEvent({
        eventType: QUEUE_EVENTS.CONSULTATION_COMPLETED,
        sessionId,
        tokenId: token._id,
        actorId: doctorUserId,
        actorRole: 'DOCTOR',
        payload: {
          tokenNumber: token.tokenNumber,
          durationMinutes
        }
      });

      // Automated Post-Appointment SMS Dispatch with Next Steps & Exit Pass details
      if (token.patientPhone) {
        const shortHex = token._id.toString().slice(-4).toUpperCase();
        const digitalTokenId = `#TKN-${shortHex}`;
        await NotificationService.sendSMS({
          recipientPhone: token.patientPhone,
          message: `Aarogya Post-Appointment Summary: Consultation concluded for Token ID ${digitalTokenId} (${token.tokenNumber}). Patient: ${token.patientName}. Next steps: Please proceed to Pharmacy / Billing Counter #3 for medication prescription & digital exit pass clearance.`,
          type: NOTIFICATION_TYPES.CONSULTATION_COMPLETE,
          tokenId: token._id,
          tokenNumber: token.tokenNumber,
          patientId: token.patientId,
          force: true
        });
      }

      return {
        success: true,
        token,
        durationMinutes
      };
    } finally {
      await this.releaseSessionLock(lockKey);
    }
  }

  /**
   * Insert Emergency Patient into Unified Queue
   */
  static async addEmergencyToken({
    sessionId,
    hospitalId,
    opdId,
    doctorId,
    patientName,
    patientPhone = null,
    emergencyReason,
    staffUserId
  }) {
    const lockKey = await this.acquireSessionLock(sessionId);
    try {
      // Find highest existing emergency token number for this session
      const count = await Token.countDocuments({ sessionId, tokenType: 'EMERGENCY' });
      const tokenNumber = `E${String(count + 1).padStart(3, '0')}`;

      // Insert with emergency priority = 2
      // Rules: Does NOT interrupt current consultation! Inserts at queuePosition 1 among WAITING patients.
      const emergencyToken = new Token({
        tokenNumber,
        tokenType: 'EMERGENCY',
        patientName: patientName || 'Emergency Case',
        patientPhone,
        hospitalId,
        opdId,
        doctorId,
        sessionId,
        date: new Date().toISOString().split('T')[0],
        priority: 2,
        priorityReason: emergencyReason || 'Acute Emergency',
        queuePosition: 1,
        status: TOKEN_STATUS.WAITING,
        joinedAt: new Date(),
        createdBy: staffUserId
      });

      await emergencyToken.save();

      // Trigger event pipeline: reforecasts all waiting patients and sends notifications
      await this.processQueueEvent({
        eventType: QUEUE_EVENTS.EMERGENCY_ADDED,
        sessionId,
        tokenId: emergencyToken._id,
        actorId: staffUserId,
        actorRole: 'STAFF',
        reason: emergencyReason,
        payload: { tokenNumber }
      });

      return {
        success: true,
        token: emergencyToken
      };
    } finally {
      await this.releaseSessionLock(lockKey);
    }
  }

  /**
   * Record Doctor Delay
   */
  static async recordDoctorDelay(sessionId, delayMinutes, reason, actorUserId, actorRole) {
    const session = await OPDSession.findById(sessionId);
    if (!session) throw new Error('OPDSession not found');

    session.activeDelays.push({
      delayMinutes: Number(delayMinutes),
      reason,
      reportedAt: new Date()
    });
    await session.save();

    await Doctor.findByIdAndUpdate(session.doctorId, {
      status: 'DELAYED',
      currentDelayMinutes: Number(delayMinutes),
      delayReason: reason
    });

    await this.processQueueEvent({
      eventType: QUEUE_EVENTS.DOCTOR_DELAYED,
      sessionId,
      actorId: actorUserId,
      actorRole,
      reason,
      payload: { delayMinutes }
    });

    return { success: true, activeDelays: session.activeDelays };
  }

  /**
   * Record Doctor Early Finish
   */
  static async recordDoctorEarlyFinish(sessionId, actorUserId, actorRole) {
    const session = await OPDSession.findById(sessionId);
    if (!session) throw new Error('OPDSession not found');

    // Reset active delays
    session.activeDelays = [];
    await session.save();

    await this.processQueueEvent({
      eventType: QUEUE_EVENTS.DOCTOR_EARLY_FINISH,
      sessionId,
      actorId: actorUserId,
      actorRole,
      payload: { resetDelays: true }
    });

    return { success: true, message: 'Queue updated for doctor early finish.' };
  }

  /**
   * Staff Queue Override with Mandatory Reason
   */
  static async staffQueueOverride(sessionId, tokenId, newStatus, reason, staffUserId) {
    if (!reason) {
      throw new Error('Override reason is mandatory for staff queue alterations.');
    }

    const token = await Token.findById(tokenId);
    if (!token) throw new Error('Token not found');

    const previousState = {
      status: token.status,
      queuePosition: token.queuePosition
    };

    token.status = newStatus;
    await token.save();

    await this.processQueueEvent({
      eventType: QUEUE_EVENTS.QUEUE_OVERRIDE,
      sessionId,
      tokenId: token._id,
      actorId: staffUserId,
      actorRole: 'STAFF',
      reason,
      payload: {
        previousState,
        newState: { status: newStatus },
        tokenNumber: token.tokenNumber
      }
    });

    return { success: true, token };
  }
}

module.exports = QueueService;
