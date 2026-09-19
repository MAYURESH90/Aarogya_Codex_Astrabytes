const mongoose = require('mongoose');

const OPDSessionSchema = new mongoose.Schema({
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
  name: {
    type: String,
    required: true, // e.g. "Morning Session", "Evening Session"
    trim: true
  },
  date: {
    type: String,
    required: true, // "YYYY-MM-DD"
    index: true
  },
  startTime: {
    type: String,
    required: true // "09:00"
  },
  endTime: {
    type: String,
    required: true // "13:00"
  },
  maxCapacity: {
    type: Number,
    default: 50
  },
  status: {
    type: String,
    enum: ['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
    default: 'ACTIVE',
    index: true
  },
  currentConsultationTokenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Token',
    default: null
  },
  completedCount: {
    type: Number,
    default: 0
  },
  noShowCount: {
    type: Number,
    default: 0
  },
  activeDelays: [{
    delayMinutes: Number,
    reason: String,
    reportedAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

OPDSessionSchema.index({ hospitalId: 1, opdId: 1, doctorId: 1, date: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('OPDSession', OPDSessionSchema);
