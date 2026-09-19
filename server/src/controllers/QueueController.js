const QueueService = require('../services/QueueService');
const NoShowService = require('../services/NoShowService');

class QueueController {
  /**
   * Get Unified Live Queue
   * GET /api/queue/:sessionId/live
   */
  static async getLiveQueue(req, res, next) {
    try {
      const queueData = await QueueService.getLiveQueue(req.params.sessionId);
      res.json({
        success: true,
        data: queueData
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Doctor calls next patient
   * POST /api/queue/:sessionId/call-next
   */
  static async callNext(req, res, next) {
    try {
      const result = await QueueService.callNextPatient(req.params.sessionId, req.user._id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Start consultation
   * POST /api/queue/:sessionId/consultation-start
   */
  static async startConsultation(req, res, next) {
    try {
      const { tokenId } = req.body;
      if (!tokenId) {
        return res.status(400).json({
          success: false,
          error: { code: 'TOKEN_ID_REQUIRED', message: 'tokenId is required.' }
        });
      }

      const result = await QueueService.startConsultation(req.params.sessionId, tokenId, req.user._id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Complete consultation
   * POST /api/queue/:sessionId/consultation-complete
   */
  static async completeConsultation(req, res, next) {
    try {
      const { tokenId, clinicalData } = req.body;
      if (!tokenId) {
        return res.status(400).json({
          success: false,
          error: { code: 'TOKEN_ID_REQUIRED', message: 'tokenId is required.' }
        });
      }

      const result = await QueueService.completeConsultation(
        req.params.sessionId,
        tokenId,
        req.user._id,
        clinicalData
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Insert Emergency Token
   * POST /api/queue/:sessionId/emergency
   */
  static async addEmergency(req, res, next) {
    try {
      const {
        hospitalId,
        opdId,
        doctorId,
        patientName,
        patientPhone,
        emergencyReason
      } = req.body;

      const result = await QueueService.addEmergencyToken({
        sessionId: req.params.sessionId,
        hospitalId,
        opdId,
        doctorId,
        patientName,
        patientPhone,
        emergencyReason,
        staffUserId: req.user._id
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Report Doctor Delay
   * POST /api/queue/:sessionId/doctor-delay
   */
  static async reportDoctorDelay(req, res, next) {
    try {
      const { delayMinutes, reason } = req.body;
      if (!delayMinutes) {
        return res.status(400).json({
          success: false,
          error: { code: 'DELAY_REQUIRED', message: 'delayMinutes is required.' }
        });
      }

      const result = await QueueService.recordDoctorDelay(
        req.params.sessionId,
        delayMinutes,
        reason,
        req.user._id,
        req.user.role
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Report Doctor Early Finish
   * POST /api/queue/:sessionId/doctor-early-finish
   */
  static async reportDoctorEarlyFinish(req, res, next) {
    try {
      const result = await QueueService.recordDoctorEarlyFinish(
        req.params.sessionId,
        req.user._id,
        req.user.role
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle No-show
   * POST /api/queue/:sessionId/no-show
   */
  static async handleNoShow(req, res, next) {
    try {
      const { tokenId } = req.body;
      if (!tokenId) {
        return res.status(400).json({
          success: false,
          error: { code: 'TOKEN_ID_REQUIRED', message: 'tokenId is required.' }
        });
      }

      const result = await NoShowService.handlePatientNoShow(
        req.params.sessionId,
        tokenId,
        req.user._id,
        req.user.role
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle Smart Re-entry
   * POST /api/queue/:sessionId/re-entry
   */
  static async handleReentry(req, res, next) {
    try {
      const { tokenId, reason } = req.body;
      if (!tokenId) {
        return res.status(400).json({
          success: false,
          error: { code: 'TOKEN_ID_REQUIRED', message: 'tokenId is required.' }
        });
      }

      const result = await NoShowService.handleSmartReentry(
        req.params.sessionId,
        tokenId,
        req.user._id,
        req.user.role,
        reason
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Staff Queue Override with required reason
   * POST /api/queue/:sessionId/override
   */
  static async staffOverride(req, res, next) {
    try {
      const { tokenId, newStatus, reason } = req.body;
      if (!tokenId || !newStatus || !reason) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'tokenId, newStatus, and reason are required.'
          }
        });
      }

      const result = await QueueService.staffQueueOverride(
        req.params.sessionId,
        tokenId,
        newStatus,
        reason,
        req.user._id
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = QueueController;
