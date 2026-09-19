const { OPDSession, Token, OPD, Doctor } = require('../models');
const { TOKEN_STATUS } = require('../config/constants');

class DisplayController {
  /**
   * Hospital Display Board Queue API
   * Public / Sanitized - never leaks personal medical records
   * Shows unified queue with both Online and Paper tokens
   */
  static async getDisplayBoard(req, res, next) {
    try {
      const { hospitalId } = req.params;
      const today = new Date().toISOString().split('T')[0];

      const sessions = await OPDSession.find({
        hospitalId,
        date: today,
        status: { $in: ['ACTIVE', 'SCHEDULED'] }
      }).populate('opdId doctorId');

      const boards = [];

      for (const session of sessions) {
        // Current serving token
        const currentToken = await Token.findOne({
          sessionId: session._id,
          status: TOKEN_STATUS.IN_CONSULTATION
        });

        // Next waiting tokens in unified order
        const upcomingTokens = await Token.find({
          sessionId: session._id,
          status: { $in: [TOKEN_STATUS.WAITING, TOKEN_STATUS.RE_ENTRY_PENDING] }
        }).sort({ queuePosition: 1 }).limit(5);

        boards.push({
          sessionId: session._id,
          opdName: session.opdId?.name,
          roomNumber: session.opdId?.roomNumber,
          doctorName: session.doctorId?.name,
          sessionName: session.name,
          servingToken: currentToken ? {
            tokenNumber: currentToken.tokenNumber,
            tokenType: currentToken.tokenType
          } : null,
          upcomingTokens: upcomingTokens.map(t => ({
            tokenNumber: t.tokenNumber,
            tokenType: t.tokenType, // 'ONLINE' or 'PAPER'
            queuePosition: t.queuePosition,
            estimatedConsultationTime: t.estimatedConsultationTime
          })),
          totalWaiting: upcomingTokens.length
        });
      }

      res.json({
        success: true,
        hospitalId,
        date: today,
        timestamp: new Date().toISOString(),
        boards
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = DisplayController;
