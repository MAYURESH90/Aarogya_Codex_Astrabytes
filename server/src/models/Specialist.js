const mongoose = require('mongoose');

const SpecialistSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true,
    index: true
  },
  specialtyName: {
    type: String,
    required: true,
    index: true
  },
  subSpecialties: [String],
  generalOpdFallbackId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OPD',
    default: null
  },
  availableDays: {
    type: [String],
    default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Specialist', SpecialistSchema);
