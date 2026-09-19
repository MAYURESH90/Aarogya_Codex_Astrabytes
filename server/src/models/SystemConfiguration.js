const mongoose = require('mongoose');

const SystemConfigurationSchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    default: null,
    index: true
  },
  opdId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OPD',
    default: null,
    index: true
  },
  averageConsultationDurationMinutes: {
    type: Number,
    default: 8
  },
  emergencyPriorityPolicy: {
    type: String,
    enum: ['IMMEDIATE_AFTER_CURRENT', 'NEXT_SLOT', 'CUSTOM_PRIORITY'],
    default: 'IMMEDIATE_AFTER_CURRENT'
  },
  noShowGracePeriodMinutes: {
    type: Number,
    default: 10
  },
  turnApproachingReminderMinutes: {
    type: Number,
    default: 10
  },
  reentryPolicy: {
    type: String,
    enum: ['AFTER_CURRENT', 'NEXT_AVAILABLE', 'END_OF_QUEUE'],
    default: 'AFTER_CURRENT'
  },
  etaNotificationThresholdMinutes: {
    type: Number,
    default: 5 // Only notify patient if ETA shifts by >= 5 minutes
  },
  displayBoardShowUpcomingCount: {
    type: Number,
    default: 5
  },
  ivrEnabled: {
    type: Boolean,
    default: true
  },
  smsEnabled: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SystemConfiguration', SystemConfigurationSchema);
