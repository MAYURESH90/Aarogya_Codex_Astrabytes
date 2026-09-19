const mongoose = require('mongoose');
const { TOKEN_TYPES, TOKEN_STATUS } = require('../config/constants');

const TokenSchema = new mongoose.Schema({
  tokenNumber: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true
  },
  tokenType: {
    type: String,
    enum: Object.values(TOKEN_TYPES),
    required: true,
    index: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    default: null,
    index: true
  },
  patientName: {
    type: String,
    required: true,
    trim: true
  },
  patientPhone: {
    type: String,
    trim: true,
    default: null,
    index: true
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
    index: true
  },
  opdId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OPD',
    required: true,
    index: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true,
    index: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OPDSession',
    required: true,
    index: true
  },
  date: {
    type: String,
    required: true,
    index: true
  },
  priority: {
    type: Number,
    default: 0 // 0 = Normal, 1 = Priority / Senior, 2 = Emergency
  },
  priorityReason: {
    type: String,
    default: null
  },
  queuePosition: {
    type: Number,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: Object.values(TOKEN_STATUS),
    default: TOKEN_STATUS.WAITING,
    index: true
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  arrivedAt: {
    type: Date,
    default: null
  },
  calledAt: {
    type: Date,
    default: null
  },
  consultationStartedAt: {
    type: Date,
    default: null
  },
  consultationEndedAt: {
    type: Date,
    default: null
  },
  actualConsultationDurationMinutes: {
    type: Number,
    default: null
  },
  skippedAt: {
    type: Date,
    default: null
  },
  reenteredAt: {
    type: Date,
    default: null
  },
  predictedWaitMinutes: {
    type: Number,
    default: 0
  },
  estimatedConsultationTime: {
    type: Date,
    default: null
  },
  predictionTimestamp: {
    type: Date,
    default: null
  },
  predictionSource: {
    type: String,
    enum: ['AI', 'FALLBACK'],
    default: 'FALLBACK'
  },
  confidence: {
    type: Number,
    default: 0.85
  },
  predictionFactors: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  noShowState: {
    reminderSentAt: { type: Date, default: null },
    ivrTriggeredAt: { type: Date, default: null },
    gracePeriodEndsAt: { type: Date, default: null },
    isSkipped: { type: Boolean, default: false },
    reentryCount: { type: Number, default: 0 }
  },
  notificationState: {
    lastNotifiedETA: { type: Date, default: null },
    lastNotifiedWaitMinutes: { type: Number, default: null },
    smsCount: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: null }
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Compound unique index to prevent duplicate token numbers in the same session
TokenSchema.index({ sessionId: 1, tokenNumber: 1 }, { unique: true });
TokenSchema.index({ sessionId: 1, status: 1, queuePosition: 1 });

module.exports = mongoose.model('Token', TokenSchema);
