const mongoose = require('mongoose');

const DoctorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
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
  name: {
    type: String,
    required: true,
    trim: true
  },
  qualification: {
    type: String,
    default: 'MBBS'
  },
  specialization: {
    type: String,
    required: true,
    index: true
  },
  isSpecialist: {
    type: Boolean,
    default: false
  },
  averageConsultationDuration: {
    type: Number,
    default: 8 // minutes
  },
  status: {
    type: String,
    enum: ['AVAILABLE', 'IN_CONSULTATION', 'ON_BREAK', 'DELAYED', 'UNAVAILABLE', 'COMPLETED_FOR_DAY'],
    default: 'AVAILABLE'
  },
  currentDelayMinutes: {
    type: Number,
    default: 0
  },
  delayReason: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Doctor', DoctorSchema);
