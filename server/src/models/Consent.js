const mongoose = require('mongoose');

const ConsentSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    default: null
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    default: null
  },
  purpose: {
    type: String,
    default: 'OPD_CONSULTATION'
  },
  status: {
    type: String,
    enum: ['GRANTED', 'REVOKED', 'EXPIRED'],
    default: 'GRANTED',
    index: true
  },
  grantedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days default
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Consent', ConsentSchema);
