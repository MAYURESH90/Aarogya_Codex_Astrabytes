const PaymentService = require('../services/PaymentService');

class PaymentController {
  static async createOrder(req, res, next) {
    try {
      const { opdId, amount, idempotencyKey } = req.body;
      if (!opdId) {
        return res.status(400).json({
          success: false,
          error: { code: 'OPD_ID_REQUIRED', message: 'opdId is required.' }
        });
      }

      const result = await PaymentService.initiateConsultationPayment({
        opdId,
        patientId: req.user?.patientId,
        amount,
        idempotencyKey
      });

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async verifyPayment(req, res, next) {
    try {
      const { orderId, transactionReference, paymentMethod } = req.body;
      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: { code: 'ORDER_ID_REQUIRED', message: 'orderId is required.' }
        });
      }

      const result = await PaymentService.verifyPayment({
        orderId,
        transactionReference,
        paymentMethod,
        actorUserId: req.user?._id
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PaymentController;
