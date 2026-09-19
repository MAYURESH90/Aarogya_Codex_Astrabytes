const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    sparse: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true,
    default: null
  },
  abhaNumber: {
    type: String,
    trim: true,
    sparse: true
  },
  dateOfBirth: {
    type: Date,
    default: null
  },
  gender: {
    type: String,
    enum: ['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED'],
    default: 'UNDISCLOSED'
  },
  emergencyContact: {
    name: String,
    phone: String,
    relation: String
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  isWalkInWithoutPhone: {
    type: Boolean,
    default: false
  },
  medicalHistoryConsent: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

PatientSchema.index({ phone: 1 });

module.exports = mongoose.model('Patient', PatientSchema);
