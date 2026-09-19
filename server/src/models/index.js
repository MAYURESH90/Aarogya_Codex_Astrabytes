const User = require('./User');
const Patient = require('./Patient');
const Hospital = require('./Hospital');
const OPD = require('./OPD');
const Doctor = require('./Doctor');
const Specialist = require('./Specialist');
const DoctorSchedule = require('./DoctorSchedule');
const OPDSession = require('./OPDSession');
const Token = require('./Token');
const QueueEvent = require('./QueueEvent');
const Consultation = require('./Consultation');
const Prescription = require('./Prescription');
const Report = require('./Report');
const Payment = require('./Payment');
const Notification = require('./Notification');
const Consent = require('./Consent');
const Document = require('./Document');
const AuditLog = require('./AuditLog');
const SystemConfiguration = require('./SystemConfiguration');

module.exports = {
  User,
  Patient,
  Hospital,
  OPD,
  Doctor,
  Specialist,
  DoctorSchedule,
  OPDSession,
  Token,
  QueueEvent,
  Consultation,
  Prescription,
  Report,
  Payment,
  Notification,
  Consent,
  Document,
  AuditLog,
  SystemConfiguration
};
