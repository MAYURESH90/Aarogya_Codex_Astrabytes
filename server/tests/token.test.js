const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/config/db');
const { Token, OPDSession, Hospital, OPD, Doctor } = require('../src/models');
const TokenService = require('../src/services/TokenService');
const env = require('../src/config/env');

describe('Token Service & SMS Dev Mode Tests', () => {
  let session;
  let hospital;
  let opd;
  let doctor;

  beforeAll(async () => {
    await connectDB();
    env.TWILIO.MESSAGING_SERVICE_SID = ''; // Force dev mode for SMS
  });

  afterAll(async () => {
    await closeDB();
  });

  beforeEach(async () => {
    await Token.deleteMany({});
    await OPDSession.deleteMany({});
    await Hospital.deleteMany({});
    await OPD.deleteMany({});
    await Doctor.deleteMany({});

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

  it('1. should generate unique ARO-XXX token format', async () => {
    const result1 = await TokenService.registerOnlineToken({
      patientName: 'Test Patient 1',
      patientPhone: '+919999999999',
      hospitalId: hospital._id,
      opdId: opd._id,
      doctorId: doctor._id,
      sessionId: session._id,
      date: new Date().toISOString().split('T')[0]
    });
    
    expect(result1.success).toBe(true);
    expect(result1.token.tokenNumber).toBe('ARO-001');
    expect(result1.token.queuePosition).toBe(1);

    const result2 = await TokenService.registerOnlineToken({
      patientName: 'Test Patient 2',
      patientPhone: '+918888888888',
      hospitalId: hospital._id,
      opdId: opd._id,
      doctorId: doctor._id,
      sessionId: session._id,
      date: new Date().toISOString().split('T')[0]
    });
    
    expect(result2.success).toBe(true);
    expect(result2.token.tokenNumber).toBe('ARO-002');
    expect(result2.token.queuePosition).toBe(2);
  });
});
