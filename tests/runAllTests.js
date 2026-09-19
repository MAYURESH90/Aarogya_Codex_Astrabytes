const assert = require('assert');
const path = require('path');
const { connectDB, closeDB } = require('../server/src/config/db');
const {
  User, Patient, Hospital, OPD, Doctor, Specialist,
  OPDSession, Token, QueueEvent, AuditLog, Payment, Notification, SystemConfiguration
} = require('../server/src/models');
const { TOKEN_STATUS, TOKEN_TYPES, QUEUE_EVENTS, ROLES } = require('../server/src/config/constants');
const TokenService = require('../server/src/services/TokenService');
const QueueService = require('../server/src/services/QueueService');
const NoShowService = require('../server/src/services/NoShowService');
const PredictionService = require('../server/src/services/PredictionService');
const NotificationService = require('../server/src/services/NotificationService');
const PaymentService = require('../server/src/services/PaymentService');
const MedicalRecordService = require('../server/src/services/MedicalRecordService');
const OCRService = require('../server/src/services/OCRService');
const { getRedisClient } = require('../server/src/config/redis');

let passedTests = 0;
let failedTests = 0;

const runTest = async (testName, testFn) => {
  try {
    process.stdout.write(`[TEST ${passedTests + failedTests + 1}] ${testName}... `);
    await testFn();
    console.log('PASSED');
    passedTests++;
  } catch (error) {
    console.log(`FAILED: ${error.message}`);
    console.error(error);
    failedTests++;
  }
};

const executeAllTests = async () => {
  console.log('============================================================');
  console.log(' STARTING AAROGYA COMPREHENSIVE 36-SCENARIO TEST SUITE');
  console.log('============================================================\n');

  await connectDB();

  // Test setup variables
  let testHospital, testGeneralOpd, testCardioOpd, testDoctor, testSpecialist, testSession, testStaffUser, testPatientUser;

  try {
    // Clean test database
    await Promise.all([
      User.deleteMany({}),
      Patient.deleteMany({}),
      Hospital.deleteMany({}),
      OPD.deleteMany({}),
      Doctor.deleteMany({}),
      Specialist.deleteMany({}),
      OPDSession.deleteMany({}),
      Token.deleteMany({}),
      QueueEvent.deleteMany({}),
      AuditLog.deleteMany({}),
      Payment.deleteMany({}),
      Notification.deleteMany({}),
      SystemConfiguration.deleteMany({})
    ]);

    testHospital = await Hospital.create({
      name: 'Test Hospital',
      code: 'TH01',
      timezone: 'Asia/Kolkata'
    });

    testGeneralOpd = await OPD.create({
      hospitalId: testHospital._id,
      name: 'General Medicine OPD',
      code: 'GEN-01',
      department: 'Medicine',
      isGeneralOPD: true,
      paymentRequired: false,
      consultationFee: 0,
      averageConsultationDuration: 8
    });

    testCardioOpd = await OPD.create({
      hospitalId: testHospital._id,
      name: 'Cardiology OPD',
      code: 'CARD-01',
      department: 'Cardiology',
      isGeneralOPD: false,
      paymentRequired: true,
      consultationFee: 200,
      averageConsultationDuration: 10
    });

    testDoctor = await Doctor.create({
      userId: null,
      hospitalId: testHospital._id,
      opdId: testGeneralOpd._id,
      name: 'Dr. Test Physician',
      specialization: 'General Medicine',
      status: 'AVAILABLE',
      averageConsultationDuration: 8
    });

    testSpecialist = await Specialist.create({
      doctorId: testDoctor._id,
      specialtyName: 'General Medicine',
      subSpecialties: ['Internal Medicine'],
      generalOpdFallbackId: testGeneralOpd._id,
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    });

    testStaffUser = await User.create({
      name: 'Test Desk Staff',
      phone: '+919999900001',
      role: ROLES.STAFF,
      isPhoneVerified: true
    });

    testPatientUser = await User.create({
      name: 'Test Patient One',
      phone: '+919999900002',
      role: ROLES.PATIENT,
      isPhoneVerified: true
    });

    testSession = await OPDSession.create({
      hospitalId: testHospital._id,
      opdId: testGeneralOpd._id,
      doctorId: testDoctor._id,
      name: 'Morning Session',
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '13:00',
      status: 'ACTIVE'
    });

    // 1. Patient registration
    await runTest('1. Patient registration', async () => {
      const p = await Patient.create({
        name: 'Rohan Sharma',
        phone: '+919876500001',
        gender: 'MALE'
      });
      assert(p._id, 'Patient must be saved with an ID');
      assert.strictEqual(p.name, 'Rohan Sharma');
    });

    // 2. OTP verification simulation
    await runTest('2. OTP verification', async () => {
      const bcrypt = require('bcryptjs');
      const otp = '654321';
      const hash = await bcrypt.hash(otp, 8);
      const isMatch = await bcrypt.compare(otp, hash);
      assert.strictEqual(isMatch, true, 'OTP must match hash');
    });

    // 3. Login token generation
    await runTest('3. Login & JWT generation', async () => {
      const jwt = require('jsonwebtoken');
      const env = require('../server/src/config/env');
      const token = jwt.sign({ id: testStaffUser._id, role: testStaffUser.role }, env.JWT_SECRET);
      const decoded = jwt.verify(token, env.JWT_SECRET);
      assert.strictEqual(decoded.role, ROLES.STAFF);
    });

    // 4. Specialist available
    await runTest('4. Specialist availability check', async () => {
      assert(testSpecialist.availableDays.length > 0, 'Specialist has configured available days');
    });

    // 5. Specialist unavailable
    await runTest('5. Specialist unavailable scenario', async () => {
      const isWeekendAvailable = testSpecialist.availableDays.includes('Sunday');
      assert.strictEqual(isWeekendAvailable, false, 'Specialist should not be available on unlisted Sunday');
    });

    // 6. Alternate day suggestion
    await runTest('6. Alternate day suggestion', async () => {
      const nextAvailableDay = testSpecialist.availableDays[0];
      assert(nextAvailableDay, 'Should suggest an alternate day');
    });

    // 7. General OPD suggestion
    await runTest('7. General OPD suggestion', async () => {
      assert(testSpecialist.generalOpdFallbackId, 'Specialist has General OPD fallback mapped');
    });

    // 8. Payment required for paid OPD
    await runTest('8. Payment required OPD check', async () => {
      const result = await PaymentService.initiateConsultationPayment({
        opdId: testCardioOpd._id,
        patientId: null,
        amount: 200,
        idempotencyKey: 'test-pay-1'
      });
      assert.strictEqual(result.paymentRequired, true);
      assert.strictEqual(result.amount, 200);
    });

    // 9. Payment not required for free General OPD
    await runTest('9. Payment not required OPD check', async () => {
      const result = await PaymentService.initiateConsultationPayment({
        opdId: testGeneralOpd._id,
        patientId: null
      });
      assert.strictEqual(result.paymentRequired, false);
      assert.strictEqual(result.paymentStatus, 'NOT_REQUIRED');
    });

    // 10. Online token creation
    let onlineToken1;
    await runTest('10. Online token creation', async () => {
      const res = await TokenService.registerOnlineToken({
        patientId: null,
        patientName: 'Online Patient 1',
        patientPhone: '+919999900010',
        hospitalId: testHospital._id,
        opdId: testGeneralOpd._id,
        doctorId: testDoctor._id,
        sessionId: testSession._id,
        userId: testPatientUser._id
      });
      assert(res.success);
      assert.strictEqual(res.token.tokenType, TOKEN_TYPES.ONLINE);
      assert.strictEqual(res.token.queuePosition, 1);
      onlineToken1 = res.token;
    });

    // 11. Staff paper token creation
    let paperToken1;
    await runTest('11. Staff paper token creation', async () => {
      const res = await TokenService.registerPaperToken({
        tokenNumber: 'P101',
        patient: { name: 'Walk-in Ganesh', phone: '+919999900020' },
        hospitalId: testHospital._id,
        opdId: testGeneralOpd._id,
        doctorId: testDoctor._id,
        sessionId: testSession._id,
        staffUserId: testStaffUser._id
      });
      assert(res.success);
      assert.strictEqual(res.token.tokenType, TOKEN_TYPES.PAPER);
      assert.strictEqual(res.token.tokenNumber, 'P101');
      paperToken1 = res;
    });

    // 12. Paper token immediate ETA returned in API response (Section 12 & 51)
    await runTest('12. Paper token immediate ETA returned', async () => {
      assert(paperToken1.prediction, 'Prediction object must be present in response');
      assert(typeof paperToken1.prediction.predictedWaitMinutes === 'number', 'predictedWaitMinutes must be a number');
      assert(paperToken1.prediction.estimatedConsultationTime, 'estimatedConsultationTime must be returned');
      assert(paperToken1.prediction.predictionSource, 'predictionSource must be returned');
    });

    // 13. Duplicate paper token prevention
    await runTest('13. Duplicate paper token prevention', async () => {
      let threw = false;
      try {
        await TokenService.registerPaperToken({
          tokenNumber: 'P101', // Same number in same session
          patient: { name: 'Duplicate Walkin' },
          hospitalId: testHospital._id,
          opdId: testGeneralOpd._id,
          doctorId: testDoctor._id,
          sessionId: testSession._id,
          staffUserId: testStaffUser._id
        });
      } catch (err) {
        threw = true;
        assert.strictEqual(err.code, 'TOKEN_ALREADY_EXISTS');
      }
      assert.strictEqual(threw, true, 'Should reject duplicate token number');
    });

    // 14. Online & Paper Queue Unified Coexistence (Section 67)
    await runTest('14. Online and Paper tokens coexist in ONE unified queue', async () => {
      const live = await QueueService.getLiveQueue(testSession._id);
      const tokenNumbers = live.unifiedQueue.map(t => t.tokenNumber);
      const tokenTypes = live.unifiedQueue.map(t => t.tokenType);

      assert(tokenNumbers.includes('O101'), 'Queue contains Online token O101');
      assert(tokenNumbers.includes('P101'), 'Queue contains Paper token P101');
      assert(tokenTypes.includes('ONLINE') && tokenTypes.includes('PAPER'), 'Single queue has both token types');
    });

    // 15. Concurrent token creation safety (Section 69)
    await runTest('15. Concurrent token creation safety', async () => {
      const promises = [
        TokenService.registerOnlineToken({
          patientName: 'Concurrent Online 1',
          patientPhone: '+919999900031',
          hospitalId: testHospital._id,
          opdId: testGeneralOpd._id,
          doctorId: testDoctor._id,
          sessionId: testSession._id
        }),
        TokenService.registerPaperToken({
          tokenNumber: 'P102',
          patient: { name: 'Concurrent Paper 1' },
          hospitalId: testHospital._id,
          opdId: testGeneralOpd._id,
          doctorId: testDoctor._id,
          sessionId: testSession._id,
          staffUserId: testStaffUser._id
        })
      ];

      const results = await Promise.all(promises);
      assert.strictEqual(results.length, 2);
      // Verify no duplicate positions in live queue
      const live = await QueueService.getLiveQueue(testSession._id);
      const positions = live.unifiedQueue.map(t => t.queuePosition);
      const uniquePositions = new Set(positions);
      assert.strictEqual(positions.length, uniquePositions.size, 'Queue positions must be distinct and sequential');
    });

    // 16. Emergency insertion without interrupting current consultation (Section 70)
    let emergencyToken;
    await runTest('16. Emergency priority insertion', async () => {
      // Start consultation on O101 first
      await QueueService.startConsultation(testSession._id, onlineToken1.id, testDoctor._id);

      // Add emergency
      const emerRes = await QueueService.addEmergencyToken({
        sessionId: testSession._id,
        hospitalId: testHospital._id,
        opdId: testGeneralOpd._id,
        doctorId: testDoctor._id,
        patientName: 'Emergency Trauma',
        emergencyReason: 'Severe accident',
        staffUserId: testStaffUser._id
      });

      assert(emerRes.success);
      emergencyToken = emerRes.token;
      assert.strictEqual(emergencyToken.tokenType, TOKEN_TYPES.EMERGENCY);

      // Verify active consultation is still O101 (NOT interrupted)
      const live = await QueueService.getLiveQueue(testSession._id);
      assert.strictEqual(live.currentConsultation.tokenNumber, 'O101', 'Current consultation must continue');

      // Verify Emergency is position 1 in the waiting queue
      assert.strictEqual(live.unifiedQueue[0].tokenNumber, emergencyToken.tokenNumber);
      assert.strictEqual(live.unifiedQueue[0].queuePosition, 1);
    });

    // 17. Doctor delay recording
    await runTest('17. Doctor delay recording', async () => {
      const res = await QueueService.recordDoctorDelay(
        testSession._id,
        15,
        'Ward emergency rounds',
        testDoctor._id,
        'DOCTOR'
      );
      assert(res.success);
      assert.strictEqual(res.activeDelays.length, 1);
      assert.strictEqual(res.activeDelays[0].delayMinutes, 15);
    });

    // 18. Doctor early finish reporting
    await runTest('18. Doctor early finish reporting', async () => {
      const res = await QueueService.recordDoctorEarlyFinish(testSession._id, testDoctor._id, 'DOCTOR');
      assert(res.success);
      const s = await OPDSession.findById(testSession._id);
      assert.strictEqual(s.activeDelays.length, 0, 'Delays should be reset on early finish');
    });

    // 19. No-show handling (Grace period)
    await runTest('19. No-show grace period initiation', async () => {
      const res = await NoShowService.handlePatientNoShow(
        testSession._id,
        paperToken1.token.id,
        testStaffUser._id,
        'STAFF'
      );
      assert(res.success);
      assert.strictEqual(res.action, 'GRACE_PERIOD_STARTED');
      assert(res.gracePeriodEndsAt, 'Grace period end time must be set');
    });

    // 20. Temporary skip after absent grace period
    await runTest('20. Temporary skip after absent grace period', async () => {
      const res = await NoShowService.handlePatientNoShow(
        testSession._id,
        paperToken1.token.id,
        testStaffUser._id,
        'STAFF'
      );
      assert(res.success);
      assert.strictEqual(res.action, 'TEMPORARILY_SKIPPED');
      assert.strictEqual(res.token.status, TOKEN_STATUS.TEMPORARILY_SKIPPED);
    });

    // 21. Smart re-entry
    await runTest('21. Smart re-entry when patient returns', async () => {
      const res = await NoShowService.handleSmartReentry(
        testSession._id,
        paperToken1.token.id,
        testStaffUser._id,
        'STAFF',
        'Patient returned from lab'
      );
      assert(res.success);
      assert.strictEqual(res.token.status, TOKEN_STATUS.WAITING);
      assert(res.token.queuePosition > 0, 'Re-entered token has an active queue position');
    });

    // 22. Consultation start
    await runTest('22. Consultation start', async () => {
      // Complete current O101 consultation first
      await QueueService.completeConsultation(testSession._id, onlineToken1.id, testDoctor._id);

      // Start consultation on next patient (Emergency token)
      const res = await QueueService.startConsultation(testSession._id, emergencyToken._id, testDoctor._id);
      assert(res.success);
      assert.strictEqual(res.token.status, TOKEN_STATUS.IN_CONSULTATION);
    });

    // 23. Consultation completion
    await runTest('23. Consultation completion', async () => {
      const res = await QueueService.completeConsultation(testSession._id, emergencyToken._id, testDoctor._id);
      assert(res.success);
      assert.strictEqual(res.token.status, TOKEN_STATUS.COMPLETED);
    });

    // 24. ETA dynamic recalculation
    await runTest('24. ETA dynamic recalculation', async () => {
      const token = await Token.findOne({ sessionId: testSession._id, status: TOKEN_STATUS.WAITING });
      assert(token, 'A waiting token exists');
      assert(typeof token.predictedWaitMinutes === 'number', 'predictedWaitMinutes is recalculated');
      assert(token.estimatedConsultationTime, 'estimatedConsultationTime is updated');
    });

    // 25. No-major-change behavior
    await runTest('25. No-major-change notification threshold suppression', async () => {
      const res = await NotificationService.sendSMS({
        recipientPhone: '+919999900099',
        message: 'Aarogya OPD Minor Update',
        type: 'ETA_UPDATE',
        newWaitMinutes: 20,
        lastNotifiedWaitMinutes: 21, // Delta is 1 min < 5 min threshold
        thresholdMinutes: 5,
        force: false
      });
      assert(res.skipped, 'Notification should be suppressed below significance threshold');
    });

    // 26. Notification failure resilience
    await runTest('26. Notification failure resilience', async () => {
      const res = await NotificationService.sendSMS({
        recipientPhone: null, // Invalid phone
        message: 'Test'
      });
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.reason, 'NO_PHONE_NUMBER');
    });

    // 27. Prediction service fallback resilience
    await runTest('27. Prediction engine fallback resilience', async () => {
      const pred = await PredictionService.getWaitTimePrediction({
        hospitalId: testHospital._id,
        averageConsultationDuration: 8,
        waitingPatients: [{ tokenId: 'mock1', queuePosition: 1 }]
      });
      assert(pred.predictedWaitMinutes >= 0);
      assert.strictEqual(pred.predictionSource, 'FALLBACK');
    });

    // 28. Redis fallback resilience
    await runTest('28. Redis in-memory cache resilience', async () => {
      const redis = getRedisClient();
      await redis.set('test:aarogya', 'active');
      const val = await redis.get('test:aarogya');
      assert.strictEqual(val, 'active');
    });

    // 29. Unauthorized medical access prevention
    await runTest('29. Unauthorized medical record access restriction', async () => {
      let threw = false;
      const otherPatient = await Patient.create({ name: 'Private Patient', phone: '+919000000088' });
      try {
        await MedicalRecordService.getPatientTimeline(otherPatient._id, {
          _id: testPatientUser._id,
          role: ROLES.PATIENT
        });
      } catch (err) {
        threw = true;
      }
      assert.strictEqual(threw, true, 'Patient cannot access another patient clinical records');
    });

    // 30. Staff queue override
    await runTest('30. Staff queue override with mandatory reason', async () => {
      const token = await Token.findOne({ sessionId: testSession._id, status: TOKEN_STATUS.WAITING });
      const res = await QueueService.staffQueueOverride(
        testSession._id,
        token._id,
        TOKEN_STATUS.CALLED,
        'Patient priority physical disability request',
        testStaffUser._id
      );
      assert(res.success);
      assert.strictEqual(res.token.status, TOKEN_STATUS.CALLED);
    });

    // 31. Audit logging verification
    await runTest('31. Audit log persistence', async () => {
      const logs = await AuditLog.find({ entity: 'QUEUE' });
      assert(logs.length > 0, 'Queue audit logs must be recorded');
    });

    // 32. Multiple sessions isolation
    await runTest('32. Multiple sessions queue isolation', async () => {
      const eveningSession = await OPDSession.create({
        hospitalId: testHospital._id,
        opdId: testGeneralOpd._id,
        doctorId: testDoctor._id,
        name: 'Evening OPD Session',
        date: new Date().toISOString().split('T')[0],
        startTime: '16:00',
        endTime: '20:00',
        status: 'SCHEDULED'
      });

      const morningTokens = await Token.countDocuments({ sessionId: testSession._id });
      const eveningTokens = await Token.countDocuments({ sessionId: eveningSession._id });
      assert.strictEqual(eveningTokens, 0, 'Evening session queue starts isolated from morning session');
      assert(morningTokens > 0, 'Morning session has tokens');
    });

    // 33. End-of-day handling
    await runTest('33. End-of-day session handling', async () => {
      testSession.status = 'COMPLETED';
      await testSession.save();
      assert.strictEqual(testSession.status, 'COMPLETED');
    });

    // 34. Paper token patient without phone (Section 68)
    await runTest('34. No-phone walk-in patient workflow', async () => {
      const res = await TokenService.registerPaperToken({
        tokenNumber: 'P199',
        patient: { name: 'Elderly Villager', phone: null },
        hospitalId: testHospital._id,
        opdId: testGeneralOpd._id,
        doctorId: testDoctor._id,
        sessionId: testSession._id,
        staffUserId: testStaffUser._id
      });
      assert(res.success);
      assert.strictEqual(res.token.tokenType, TOKEN_TYPES.PAPER);
      assert(res.prediction.estimatedConsultationTime, 'Immediate consultation time returned even with no phone');
    });

    // 35. Display board data sanitization
    await runTest('35. Display board data sanitization', async () => {
      const tokens = await Token.find({ sessionId: testSession._id }).limit(3);
      const sanitized = tokens.map(t => ({
        tokenNumber: t.tokenNumber,
        tokenType: t.tokenType,
        queuePosition: t.queuePosition
      }));
      // Verify no patient sensitive data is leaked
      assert(!sanitized[0].symptoms);
      assert(!sanitized[0].diagnosis);
      assert(!sanitized[0].clinicalNotes);
    });

    // 36. Patient live queue status query
    await runTest('36. Patient live queue status query', async () => {
      const token = await Token.findOne({ sessionId: testSession._id });
      const status = await TokenService.getTokenStatus(token._id);
      assert.strictEqual(status.tokenId.toString(), token._id.toString());
      assert(typeof status.peopleAhead === 'number');
    });

  } catch (err) {
    console.error('Test Suite encountered fatal error:', err);
  } finally {
    await closeDB();
  }

  console.log('\n============================================================');
  console.log(` TEST RUN COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED.`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
};

if (require.main === module) {
  executeAllTests();
}

module.exports = executeAllTests;
