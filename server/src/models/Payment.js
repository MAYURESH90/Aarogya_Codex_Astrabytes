const mongoose = require('mongoose');
const { PAYMENT_STATUS } = require('../config/constants');

const PaymentSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  idempotencyKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    default: null
  },
  opdId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OPD',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    default: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: Object.values(PAYMENT_STATUS),
    default: PAYMENT_STATUS.PENDING,
    index: true
  },
  provider: {
    type: String,
    default: 'SANDBOX'
  },
  transactionReference: {
    type: String,
    default: null
  },
  paymentMethod: {
    type: String,
    default: 'UPI'
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', PaymentSchema);
