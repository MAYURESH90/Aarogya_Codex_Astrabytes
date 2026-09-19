const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
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
  consultationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Consultation',
    default: null
  },
  title: {
    type: String,
    required: true
  },
  reportType: {
    type: String,
    enum: ['LAB_TEST', 'IMAGING', 'PATHOLOGY', 'ECG', 'OTHER'],
    default: 'LAB_TEST'
  },
  summary: String,
  fileUrl: String,
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Report', ReportSchema);
