const { Token, OPDSession, Patient, OPD, Doctor } = require('../models');
const { TOKEN_TYPES, TOKEN_STATUS, QUEUE_EVENTS } = require('../config/constants');
const QueueService = require('./QueueService');
const PredictionService = require('./PredictionService');
const NotificationService = require('./NotificationService');

class TokenService {
  /**
   * Register a Paper / Walk-in Token entered by Hospital Staff
   * MANDATORY: Returns immediate ETA, queue position and expected consultation time!
   */
  static async registerPaperToken({
    tokenNumber,
    patient, // { name, phone, abhaNumber, gender }
    hospitalId,
    opdId,
    doctorId,
    sessionId,
    date,
    staffUserId
  }) {
    // 1. Concurrency lock on session
    const lockKey = await QueueService.acquireSessionLock(sessionId);
    try {
      // 2. Validate tokenNumber format and collision within session
      const formattedTokenNumber = String(tokenNumber).toUpperCase().trim();
      const existing = await Token.findOne({ sessionId, tokenNumber: formattedTokenNumber });
      if (existing) {
        const error = new Error(`Token number ${formattedTokenNumber} already exists in this OPD session.`);
        error.code = 'TOKEN_ALREADY_EXISTS';
        throw error;
      }

      // 3. Resolve or create Patient record (walk-in patient may have no phone/account)
      let patientRecord = null;
      if (patient && patient.phone) {
        patientRecord = await Patient.findOne({ phone: patient.phone });
        if (!patientRecord) {
          patientRecord = await Patient.create({
            name: patient.name || 'Walk-in Patient',
            phone: patient.phone,
            abhaNumber: patient.abhaNumber || null,
            gender: patient.gender || 'UNDISCLOSED',
            isWalkInWithoutPhone: false
          });
        }
      } else {
        // No-phone walk-in patient
        patientRecord = await Patient.create({
          name: patient?.name || 'Walk-in Patient',
          phone: null,
          isWalkInWithoutPhone: true
        });
      }

      // 4. Determine current waiting count to set initial position
      const waitingCount = await Token.countDocuments({
        sessionId,
        status: { $in: [TOKEN_STATUS.WAITING, TOKEN_STATUS.RE_ENTRY_PENDING] }
      });
      const queuePosition = waitingCount + 1;

      // 5. Create PAPER Token record
      const token = new Token({
        tokenNumber: formattedTokenNumber,
        tokenType: TOKEN_TYPES.PAPER,
        patientId: patientRecord ? patientRecord._id : null,
        patientName: patient?.name || 'Walk-in Patient',
        patientPhone: patient?.phone || null,
        hospitalId,
        opdId,
        doctorId,
        sessionId,
        date: date || new Date().toISOString().split('T')[0],
        queuePosition,
        status: TOKEN_STATUS.WAITING,
        joinedAt: new Date(),
        createdBy: staffUserId
      });

      await token.save();

      // 6. Execute Event Pipeline: reorders queue, forecasts ETA
      const eventResult = await QueueService.processQueueEvent({
        eventType: QUEUE_EVENTS.PAPER_TOKEN_CREATED,
        sessionId,
        tokenId: token._id,
        actorId: staffUserId,
        actorRole: 'STAFF',
        payload: {
          tokenNumber: formattedTokenNumber,
          tokenType: TOKEN_TYPES.PAPER
        }
      });

      // 7. Refresh token state after pipeline recalculation
      const refreshedToken = await Token.findById(token._id);

      // 8. If patient provided a phone, send SMS confirmation
      if (refreshedToken.patientPhone) {
        await NotificationService.sendSMS({
          recipientPhone: refreshedToken.patientPhone,
          message: `Aarogya: Paper Token ${refreshedToken.tokenNumber} registered. Queue position #${refreshedToken.queuePosition}. Estimated consultation: ~${new Date(refreshedToken.estimatedConsultationTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}.`,
          type: 'TOKEN_CONFIRMATION',
          tokenId: refreshedToken._id,
          tokenNumber: refreshedToken.tokenNumber,
          patientId: refreshedToken.patientId,
          force: true
        });
      }

      // 9. Return exact API contract required by Section 12 & 51
      return {
        success: true,
        token: {
          id: refreshedToken._id,
          tokenNumber: refreshedToken.tokenNumber,
          tokenType: refreshedToken.tokenType,
          queuePosition: refreshedToken.queuePosition,
          status: refreshedToken.status
        },
        prediction: {
          predictedWaitMinutes: refreshedToken.predictedWaitMinutes,
          estimatedConsultationTime: refreshedToken.estimatedConsultationTime,
          predictionTimestamp: refreshedToken.predictionTimestamp,
          predictionSource: refreshedToken.predictionSource,
          confidence: refreshedToken.confidence,
          factors: refreshedToken.predictionFactors
        }
      };
    } finally {
      await QueueService.releaseSessionLock(lockKey);
    }
  }

  /**
   * Register an Online Digital Token
   */
  static async registerOnlineToken({
    patientId,
    patientName,
    patientPhone,
    hospitalId,
    opdId,
    doctorId,
    sessionId,
    date,
    paymentId = null,
    userId = null
  }) {
    const lockKey = await QueueService.acquireSessionLock(sessionId);
    try {
      // 1. Auto-generate collision-free online token number (e.g. ARO-001)
      const count = await Token.countDocuments({ sessionId, tokenType: TOKEN_TYPES.ONLINE });
      const paddedCount = String(count + 1).padStart(3, '0');
      const tokenNumber = `ARO-${paddedCount}`;

      // Check collision
      const existing = await Token.findOne({ sessionId, tokenNumber });
      const finalTokenNumber = existing ? `ARO-${String(count + 1 + Math.floor(Math.random() * 100)).padStart(3, '0')}` : tokenNumber;

      const waitingCount = await Token.countDocuments({
        sessionId,
        status: { $in: [TOKEN_STATUS.WAITING, TOKEN_STATUS.RE_ENTRY_PENDING] }
      });
      const queuePosition = waitingCount + 1;

      const token = new Token({
        tokenNumber: finalTokenNumber,
        tokenType: TOKEN_TYPES.ONLINE,
        patientId,
        patientName,
        patientPhone,
        hospitalId,
        opdId,
        doctorId,
        sessionId,
        date: date || new Date().toISOString().split('T')[0],
        queuePosition,
        status: TOKEN_STATUS.WAITING,
        paymentId,
        joinedAt: new Date(),
        createdBy: userId
      });

      await token.save();

      // Trigger event pipeline
      await QueueService.processQueueEvent({
        eventType: QUEUE_EVENTS.TOKEN_CREATED,
        sessionId,
        tokenId: token._id,
        actorId: userId,
        actorRole: 'PATIENT',
        payload: {
          tokenNumber: finalTokenNumber,
          tokenType: TOKEN_TYPES.ONLINE
        }
      });

      const refreshedToken = await Token.findById(token._id)
        .populate('hospitalId opdId doctorId');

      const shortHex = refreshedToken._id.toString().slice(-4).toUpperCase();
      const digitalTokenId = `#TKN-${shortHex}`;

      if (patientPhone) {
        const estTimeStr = refreshedToken.estimatedConsultationTime
          ? new Date(refreshedToken.estimatedConsultationTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
          : 'Pending';

        await NotificationService.sendSMS({
          recipientPhone: patientPhone,
          message: `Aarogya Appointment Confirmed! Digital Token ID: ${digitalTokenId} (${refreshedToken.tokenNumber}). Patient: ${patientName || 'Patient'}. Doctor: ${refreshedToken.doctorId?.name || 'Assigned Doctor'} (${refreshedToken.opdId?.name || 'OPD'}). Position: #${refreshedToken.queuePosition}, Est. Wait: ~${refreshedToken.predictedWaitMinutes} mins (expected ~${estTimeStr}). Next steps: Proceed to OPD Room ${refreshedToken.opdId?.roomNumber || '101'} when called.`,
          type: 'TOKEN_CONFIRMATION',
          tokenId: refreshedToken._id,
          tokenNumber: refreshedToken.tokenNumber,
          patientId: refreshedToken.patientId,
          force: true
        });
      }

      return {
        success: true,
        token: {
          id: refreshedToken._id,
          digitalTokenId,
          tokenNumber: refreshedToken.tokenNumber,
          tokenType: refreshedToken.tokenType,
          queuePosition: refreshedToken.queuePosition,
          status: refreshedToken.status,
          patientName: refreshedToken.patientName,
          patientPhone: refreshedToken.patientPhone,
          createdAt: refreshedToken.createdAt || refreshedToken.joinedAt,
          hospitalName: refreshedToken.hospitalId?.name,
          opdName: refreshedToken.opdId?.name,
          roomNumber: refreshedToken.opdId?.roomNumber,
          doctorName: refreshedToken.doctorId?.name,
          specialization: refreshedToken.doctorId?.specialization,
          sessionId: refreshedToken.sessionId
        },
        prediction: {
          predictedWaitMinutes: refreshedToken.predictedWaitMinutes,
          estimatedConsultationTime: refreshedToken.estimatedConsultationTime,
          predictionTimestamp: refreshedToken.predictionTimestamp,
          predictionSource: refreshedToken.predictionSource,
          confidence: refreshedToken.confidence,
          factors: refreshedToken.predictionFactors
        }
      };
    } finally {
      await QueueService.releaseSessionLock(lockKey);
    }
  }

  /**
   * Get Live Token Status for Patient
   */
  static async getTokenStatus(tokenId) {
    const token = await Token.findById(tokenId)
      .populate('hospitalId opdId doctorId sessionId');
    if (!token) throw new Error('Token not found');

    const waitingAhead = await Token.countDocuments({
      sessionId: token.sessionId._id,
      status: { $in: [TOKEN_STATUS.WAITING, TOKEN_STATUS.RE_ENTRY_PENDING] },
      queuePosition: { $lt: token.queuePosition }
    });

    const shortHex = token._id.toString().slice(-4).toUpperCase();
    const digitalTokenId = `#TKN-${shortHex}`;

    return {
      tokenId: token._id,
      digitalTokenId,
      sessionId: token.sessionId._id,
      tokenNumber: token.tokenNumber,
      tokenType: token.tokenType,
      patientName: token.patientName,
      patientPhone: token.patientPhone,
      queuePosition: token.queuePosition,
      peopleAhead: waitingAhead,
      status: token.status,
      predictedWaitMinutes: token.predictedWaitMinutes,
      estimatedConsultationTime: token.estimatedConsultationTime,
      predictionTimestamp: token.predictionTimestamp,
      predictionSource: token.predictionSource,
      confidence: token.confidence,
      opdName: token.opdId?.name,
      doctorName: token.doctorId?.name,
      roomNumber: token.opdId?.roomNumber,
      hospitalName: token.hospitalId?.name
    };
  }
}

module.exports = TokenService;
