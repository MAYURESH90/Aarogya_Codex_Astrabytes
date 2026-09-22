const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/config/db');
const { Token, OPDSession, SystemConfiguration, Doctor, OPD, Hospital } = require('../src/models');
const QueueService = require('../src/services/QueueService');
const PredictionService = require('../src/services/PredictionService');
const NoShowService = require('../src/services/NoShowService');
const { TOKEN_STATUS } = require('../src/config/constants');

describe('Queue Management & ETA Tests', () => {
  let session;
  let hospital;
  let opd;
  let doctor;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  beforeEach(async () => {
    await Token.deleteMany({});
    await OPDSession.deleteMany({});
    await Doctor.deleteMany({});
    await OPD.deleteMany({});
    await Hospital.deleteMany({});

    hospital = await Hospital.create({
      name: 'Test Hospital',
      code: 'TH01',
      address: '123 Test St',
      pinCode: '110001',
      isGovernment: true
    });

    opd = await OPD.create({
      hospitalId: hospital._id,
      name: 'General Medicine',
      code: 'GM01',
      department: 'Medicine',
      roomNumber: '101',
      averageConsultationDuration: 10
    });

    doctor = await Doctor.create({
      name: 'Dr. John Doe',
      specialization: 'General',
      phone: '1234567890',
      hospitalId: hospital._id,
      opdId: opd._id
    });

    session = await OPDSession.create({
      hospitalId: hospital._id,
      opdId: opd._id,
      doctorId: doctor._id,
      name: 'Morning Session',
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '13:00',
      status: 'ACTIVE'
    });
  });

  it('1. should insert Emergency patient at the top of the queue', async () => {
    // Add two normal waiting patients
    await Token.create({
      tokenNumber: 'O001',
      tokenType: 'ONLINE',
      hospitalId: hospital._id,
      opdId: opd._id,
      doctorId: doctor._id,
      sessionId: session._id,
      queuePosition: 1,
      status: TOKEN_STATUS.WAITING,
      priority: 0,
      joinedAt: new Date(Date.now() - 10000),
      date: '2026-09-22',
      patientName: 'John Doe'
    });

    await Token.create({
      tokenNumber: 'P002',
      tokenType: 'PAPER',
      hospitalId: hospital._id,
      opdId: opd._id,
      doctorId: doctor._id,
      sessionId: session._id,
      queuePosition: 2,
      status: TOKEN_STATUS.WAITING,
      priority: 0,
      joinedAt: new Date(Date.now() - 5000),
      date: '2026-09-22',
      patientName: 'Jane Doe'
    });

    // Add Emergency
    await QueueService.addEmergencyToken({
      sessionId: session._id,
      hospitalId: hospital._id,
      opdId: opd._id,
      doctorId: doctor._id,
      patientName: 'Emergency Victim',
      emergencyReason: 'Heart Attack',
      staffUserId: new mongoose.Types.ObjectId()
    });

    const liveQueue = await QueueService.getLiveQueue(session._id);
    expect(liveQueue.unifiedQueue.length).toBe(3);
    
    // Emergency token should be queuePosition 1
    const emergencyToken = liveQueue.unifiedQueue.find(t => t.tokenType === 'EMERGENCY');
    expect(emergencyToken.queuePosition).toBe(1);
    expect(emergencyToken.priority).toBe(2);

    // Normal tokens should be pushed down to 2 and 3
    const o001 = liveQueue.unifiedQueue.find(t => t.tokenNumber === 'O001');
    expect(o001.queuePosition).toBe(2);
  });

  it('2. should calculate deterministic ETA correctly', () => {
    const queueContext = {
      averageConsultationDuration: 10,
      currentPatient: {
        tokenId: 't0',
        tokenNumber: 'O001',
        consultationStartedAt: new Date(Date.now() - (3 * 60000)) // 3 minutes ago
      },
      waitingPatients: [
        { tokenId: 't1', tokenNumber: 'P002', queuePosition: 1 },
        { tokenId: 't2', tokenNumber: 'O003', queuePosition: 2 },
        { tokenId: 't3', tokenNumber: 'P004', queuePosition: 3 }
      ],
      emergencyPatients: [],
      delays: [],
      targetToken: { tokenId: 't3', tokenNumber: 'P004', queuePosition: 3 }
    };

    const prediction = PredictionService._calculateFallbackPrediction(queueContext);
    
    // Target is position 3, meaning 2 patients ahead (P002, O003).
    // Patients ahead = 2.
    // Emergency ahead = 0.
    // Delay = 0.
    // Current consultation remaining = 10 - 3 = 7 minutes.
    // Math: 7 + (2 * 10) + 0 + 0 = 27 minutes.
    expect(prediction.predictedWaitMinutes).toBe(27);
    expect(prediction.predictionSource).toBe('FALLBACK');
  });

  it('3. should handle No-Show grace period and smart re-entry', async () => {
    const token = await Token.create({
      tokenNumber: 'O001',
      tokenType: 'ONLINE',
      hospitalId: hospital._id,
      opdId: opd._id,
      doctorId: doctor._id,
      sessionId: session._id,
      queuePosition: 1,
      status: TOKEN_STATUS.WAITING,
      priority: 0,
      joinedAt: new Date(),
      date: '2026-09-22',
      patientName: 'Test Patient'
    });

    const actorId = new mongoose.Types.ObjectId();

    // Trigger No-Show
    const noShowRes = await NoShowService.handlePatientNoShow(session._id, token._id, actorId, 'STAFF');
    expect(noShowRes.action).toBe('GRACE_PERIOD_STARTED');
    
    const updatedToken = await Token.findById(token._id);
    expect(updatedToken.status).toBe(TOKEN_STATUS.NO_SHOW);
    expect(updatedToken.noShowState.gracePeriodEndsAt).toBeTruthy();

    // Trigger Smart Re-entry
    const reentryRes = await NoShowService.handleSmartReentry(session._id, token._id, actorId, 'STAFF', 'Returned');
    expect(reentryRes.success).toBe(true);

    const reenteredToken = await Token.findById(token._id);
    expect(reenteredToken.status).toBe(TOKEN_STATUS.WAITING);
    expect(reenteredToken.noShowState.isSkipped).toBe(false);
    expect(reenteredToken.noShowState.gracePeriodEndsAt).toBeNull();
  });
});
