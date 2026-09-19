const mongoose = require('mongoose');
const { QUEUE_EVENTS } = require('../config/constants');

const QueueEventSchema = new mongoose.Schema({
  eventType: {
    type: String,
    enum: Object.values(QUEUE_EVENTS),
    required: true,
    index: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OPDSession',
    required: true,
    index: true
  },
  tokenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Token',
    default: null,
    index: true
  },
  tokenNumber: {
    type: String,
    default: null
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  actorRole: {
    type: String,
    default: 'SYSTEM'
  },
  previousState: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  newState: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('QueueEvent', QueueEventSchema);
