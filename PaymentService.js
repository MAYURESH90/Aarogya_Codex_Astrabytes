const { Payment, OPD } = require('../models');
const { PAYMENT_STATUS } = require('../config/constants');
const AuditService = require('./AuditService');
const { v4: uuidv4 } = require('uuid');

class PaymentService {
  /**
   * Check if OPD requires payment and create payment order if so
   */
  static async initiateConsultationPayment({ opdId, patientId, amount, idempotencyKey }) {
    const opd = await OPD.findById(opdId);
    if (!opd) throw new Error('OPD not found');

    if (!opd.paymentRequired) {
      return {
        paymentRequired: false,
        paymentStatus: PAYMENT_STATUS.NOT_REQUIRED,
        paymentId: null,
        message: 'This OPD is free of charge. No payment required.'
      };
    }

    const key = idempotencyKey || `idem-${patientId}-${opdId}-${Date.now()}`;

    // Check existing payment by idempotencyKey to prevent duplicate charges
    const existing = await Payment.findOne({ idempotencyKey: key });
    if (existing) {
      return {
        paymentRequired: true,
        orderId: existing.orderId,
        paymentId: existing._id,
        amount: existing.amount,
        status: existing.status,
        message: 'Existing payment order retrieved.'
      };
    }

    const requiredAmount = amount !== undefined ? amount : (opd.consultationFee || 100);
    const orderId = `ORDER-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const payment = new Payment({
      orderId,
      idempotencyKey: key,
      patientId,
      opdId,
      amount: requiredAmount,
      currency: 'INR',
      status: PAYMENT_STATUS.PENDING,
      provider: 'SANDBOX',
      metadata: { opdName: opd.name, roomNumber: opd.roomNumber }
    });

    await payment.save();

    return {
      paymentRequired: true,
      orderId: payment.orderId,
      paymentId: payment._id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      razorpayMockDetails: {
        keyId: 'rzp_test_aarogya_mock',
        orderId: payment.orderId,
        amount: payment.amount * 100
      }
    };
  }

  /**
   * Server-side idempotent payment verification
   */
  static async verifyPayment({ orderId, transactionReference, paymentMethod = 'UPI', actorUserId }) {
    const payment = await Payment.findOne({ orderId });
    if (!payment) throw new Error('Payment order not found');

    if (payment.status === PAYMENT_STATUS.COMPLETED) {
      return {
        success: true,
        alreadyProcessed: true,
        payment
      };
    }

    // In a production environment with Razorpay/Stripe, verify signature with crypto HMAC
    // In our provider abstraction:
    payment.status = PAYMENT_STATUS.COMPLETED;
    payment.transactionReference = transactionReference || `TXN-${uuidv4().substring(0, 8).toUpperCase()}`;
    payment.paymentMethod = paymentMethod;
    payment.verifiedAt = new Date();
    await payment.save();

    await AuditService.log({
      actorId: actorUserId,
      actorRole: 'PATIENT',
      action: 'PAYMENT_VERIFIED',
      entity: 'PAYMENT',
      entityId: String(payment._id),
      metadata: { orderId, amount: payment.amount, transactionReference: payment.transactionReference }
    });

    return {
      success: true,
      paymentId: payment._id,
      status: payment.status,
      transactionReference: payment.transactionReference
    };
  }
}

module.exports = PaymentService;
