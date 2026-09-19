const mongoose = require('mongoose');
const { NOTIFICATION_CHANNELS, NOTIFICATION_TYPES } = require('../config/constants');

const NotificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: Object.values(NOTIFICATION_TYPES),
    required: true,
    index: true
  },
  channel: {
    type: String,
    enum: Object.values(NOTIFICATION_CHANNELS),
    required: true,
    index: true
  },
  recipientPhone: {
    type: String,
    required: true,
    index: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    default: null
  },
  tokenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Token',
    default: null,
    index: true
  },
  tokenNumber: String,
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['SENT', 'DELIVERED', 'FAILED', 'SKIPPED_THRESHOLD'],
    default: 'SENT',
    index: true
  },
  providerMessageId: {
    type: String,
    default: null
  },
  errorMessage: {
    type: String,
    default: null
  },
  eventTrigger: {
    type: String,
    default: null
  },
  sentAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Notification', NotificationSchema);
