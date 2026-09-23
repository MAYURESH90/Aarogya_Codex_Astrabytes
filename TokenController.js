const TokenService = require('../services/TokenService');
const { Token, OPDSession, OPD } = require('../models');

class TokenController {
  /**
   * Register Staff-Entered Paper / Walk-in Token
   * POST /api/tokens/paper
   * Mandatory: Immediately returns predictedWaitMinutes, estimatedConsultationTime, queuePosition
   */
  static async registerPaperToken(req, res, next) {
    try {
      const {
        tokenNumber,
        patient,
        hospitalId,
        opdId,
        doctorId,
        sessionId,
        date
      } = req.body;

      if (!tokenNumber || !hospitalId || !opdId || !doctorId || !sessionId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'tokenNumber, hospitalId, opdId, doctorId, and sessionId are required.'
          }
        });
      }

      const result = await TokenService.registerPaperToken({
        tokenNumber,
        patient,
        hospitalId,
        opdId,
        doctorId,
        sessionId,
        date,
        staffUserId: req.user?._id
      });

      res.status(201).json(result);
    } catch (error) {
      if (error.code === 'TOKEN_ALREADY_EXISTS') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'TOKEN_ALREADY_EXISTS',
            message: error.message
          }
        });
      }
      next(error);
    }
  }

  /**
   * Register Online Patient Token
   * POST /api/tokens/online
   */
  static async registerOnlineToken(req, res, next) {
    try {
      const {
        hospitalId,
        opdId,
        doctorId,
        sessionId,
        date,
        patientName,
        patientPhone,
        paymentId
      } = req.body;

      if (!hospitalId || !opdId || !doctorId || !sessionId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'hospitalId, opdId, doctorId, and sessionId are required.'
          }
        });
      }

      // Check payment requirement if not provided
      // Idempotency: check if patient already booked this exact OPD/session recently
      if (req.user?.patientId) {
        const recentToken = await Token.findOne({
          patientId: req.user.patientId,
          hospitalId,
          opdId,
          sessionId,
          date
        });
        if (recentToken) {
          return res.status(409).json({
            success: false,
            error: {
              code: 'DUPLICATE_BOOKING',
              message: 'You have already booked a token for this session.'
            },
            data: recentToken
          });
        }
      }

      const opd = await OPD.findById(opdId);
      if (opd && opd.paymentRequired && !paymentId) {
        return res.status(402).json({
          success: false,
          error: {
            code: 'PAYMENT_REQUIRED',
            message: 'Payment verification is required before token can be registered for this OPD.'
          }
        });
      }

      const result = await TokenService.registerOnlineToken({
        patientId: req.user?.patientId || null,
        patientName: patientName || req.user?.name || 'Online Patient',
        patientPhone: patientPhone || req.user?.phone || null,
        hospitalId,
        opdId,
        doctorId,
        sessionId,
        date,
        paymentId,
        userId: req.user?._id
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Token by ID
   * GET /api/tokens/:tokenId
   */
  static async getTokenById(req, res, next) {
    try {
      const token = await Token.findById(req.params.tokenId)
        .populate('hospitalId opdId doctorId sessionId patientId');
      if (!token) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Token not found.' }
        });
      }

      res.json({
        success: true,
        data: token
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Live Patient-facing Token Status
   * GET /api/tokens/:tokenId/status
   */
  static async getTokenStatus(req, res, next) {
    try {
      const status = await TokenService.getTokenStatus(req.params.tokenId);
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get ETA Refresh
   * GET /api/tokens/:tokenId/eta
   */
  static async getTokenETA(req, res, next) {
    try {
      const status = await TokenService.getTokenStatus(req.params.tokenId);
      res.json({
        success: true,
        data: {
          predictedWaitMinutes: status.predictedWaitMinutes,
          estimatedConsultationTime: status.estimatedConsultationTime,
          predictionSource: status.predictionSource,
          confidence: status.confidence
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = TokenController;
