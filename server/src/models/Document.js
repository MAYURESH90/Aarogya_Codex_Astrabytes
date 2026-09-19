const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  storagePath: {
    type: String,
    required: true
  },
  ocrStatus: {
    type: String,
    enum: ['PENDING', 'PROCESSED', 'FAILED', 'NOT_APPLICABLE'],
    default: 'PENDING'
  },
  ocrExtractedText: {
    type: String,
    default: null
  },
  ocrExtractedFields: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Document', DocumentSchema);
