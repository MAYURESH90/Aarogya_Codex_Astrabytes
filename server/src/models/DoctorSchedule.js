const mongoose = require('mongoose');

const DoctorScheduleSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true,
    index: true
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true
  },
  opdId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OPD',
    required: true
  },
  dayOfWeek: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    required: true
  },
  morningSession: {
    active: { type: Boolean, default: true },
    startTime: { type: String, default: '09:00' },
    endTime: { type: String, default: '13:00' },
    maxTokens: { type: Number, default: 40 }
  },
  eveningSession: {
    active: { type: Boolean, default: true },
    startTime: { type: String, default: '16:00' },
    endTime: { type: String, default: '20:00' },
    maxTokens: { type: Number, default: 40 }
  },
  leaves: [{
    date: String,
    reason: String
  }]
}, {
  timestamps: true
});

DoctorScheduleSchema.index({ doctorId: 1, dayOfWeek: 1 }, { unique: true });

module.exports = mongoose.model('DoctorSchedule', DoctorScheduleSchema);
