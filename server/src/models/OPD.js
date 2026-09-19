const mongoose = require('mongoose');

const OPDSchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  department: {
    type: String,
    required: true
  },
  roomNumber: {
    type: String,
    default: '101'
  },
  isGeneralOPD: {
    type: Boolean,
    default: false
  },
  paymentRequired: {
    type: Boolean,
    default: false
  },
  consultationFee: {
    type: Number,
    default: 0
  },
  averageConsultationDuration: {
    type: Number,
    default: 8 // default 8 minutes
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

OPDSchema.index({ hospitalId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('OPD', OPDSchema);
