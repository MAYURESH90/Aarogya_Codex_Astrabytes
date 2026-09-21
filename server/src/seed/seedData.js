const bcrypt = require('bcryptjs');
const { connectDB, closeDB } = require('../config/db');
const {
  User, Patient, Hospital, OPD, Doctor, Specialist,
  DoctorSchedule, OPDSession, Token, SystemConfiguration, Consultation, Prescription
} = require('../models');
const { ROLES, TOKEN_TYPES, TOKEN_STATUS } = require('../config/constants');
const QueueService = require('../services/QueueService');

const seedDatabase = async (closeDbConnection = true) => {
  try {
    console.log('[Seed] Checking database connection...');
    if (closeDbConnection) {
      await connectDB();
    }

    console.log('[Seed] Clearing existing collections...');
    await Promise.all([
      User.deleteMany({}),
      Patient.deleteMany({}),
      Hospital.deleteMany({}),
      OPD.deleteMany({}),
      Doctor.deleteMany({}),
      Specialist.deleteMany({}),
      DoctorSchedule.deleteMany({}),
      OPDSession.deleteMany({}),
      Token.deleteMany({}),
      SystemConfiguration.deleteMany({}),
      Consultation.deleteMany({}),
      Prescription.deleteMany({})
    ]);

    console.log('[Seed] Creating Hospital...');
    const hospital = await Hospital.create({
      name: 'Aarogya Demo Government Hospital',
      code: 'DEMO-GOV-01',
      address: {
        street: '10 Hospital Road',
        city: 'Kalyan',
        state: 'Maharashtra',
        pincode: '421301'
      },
      pinCode: '421301',
      isGovernment: true,
      phone: '+912222334455',
      timezone: 'Asia/Kolkata'
    });

    console.log('[Seed] Creating System Configuration...');
    await SystemConfiguration.create({
      hospitalId: hospital._id,
      averageConsultationDurationMinutes: 8,
      emergencyPriorityPolicy: 'IMMEDIATE_AFTER_CURRENT',
      noShowGracePeriodMinutes: 10,
      turnApproachingReminderMinutes: 10,
      reentryPolicy: 'AFTER_CURRENT',
      etaNotificationThresholdMinutes: 5
    });

    console.log('[Seed] Creating OPDs...');
    // General Medicine (Free OPD)
    const generalOpd = await OPD.create({
      hospitalId: hospital._id,
      name: 'General Medicine OPD',
      code: 'GEN-OPD',
      department: 'General Medicine',
      roomNumber: '101',
      isGeneralOPD: true,
      paymentRequired: false,
      consultationFee: 0,
      averageConsultationDuration: 7
    });

    // Cardiology OPD (Paid Specialty OPD)
    const cardioOpd = await OPD.create({
      hospitalId: hospital._id,
      name: 'Cardiology Specialist OPD',
      code: 'CARDIO-OPD',
      department: 'Cardiology',
      roomNumber: '204',
      isGeneralOPD: false,
      paymentRequired: true,
      consultationFee: 150,
      averageConsultationDuration: 10
    });

    const defaultPasswordHash = await bcrypt.hash('Aarogya@123', 10);

    console.log('[Seed] Creating Users (Admin, Staff, Doctors, Patients)...');
    // Admin
    const adminUser = await User.create({
      name: 'Admin Supervisor',
      phone: '+919000000001',
      passwordHash: defaultPasswordHash,
      role: ROLES.ADMIN,
      isPhoneVerified: true
    });

    // Staff Operator
    const staffUser = await User.create({
      name: 'Rekha Deshmukh (Desk Staff)',
      phone: '+919000000002',
      passwordHash: defaultPasswordHash,
      role: ROLES.STAFF,
      hospitalId: hospital._id,
      isPhoneVerified: true
    });

    // Doctor 1 - General Physician
    const docUser1 = await User.create({
      name: 'Dr. Ramesh Patel',
      phone: '+919000000003',
      passwordHash: defaultPasswordHash,
      role: ROLES.DOCTOR,
      hospitalId: hospital._id,
      opdId: generalOpd._id,
      isPhoneVerified: true
    });

    const doctor1 = await Doctor.create({
      userId: docUser1._id,
      hospitalId: hospital._id,
      opdId: generalOpd._id,
      name: 'Dr. Ramesh Patel',
      qualification: 'MBBS, MD (Medicine)',
      specialization: 'General Medicine',
      isSpecialist: false,
      averageConsultationDuration: 7,
      status: 'AVAILABLE'
    });
    docUser1.doctorId = doctor1._id;
    await docUser1.save();

    // Doctor 2 - Cardiologist Specialist
    const docUser2 = await User.create({
      name: 'Dr. Anita Sharma',
      phone: '+919000000004',
      passwordHash: defaultPasswordHash,
      role: ROLES.DOCTOR,
      hospitalId: hospital._id,
      opdId: cardioOpd._id,
      isPhoneVerified: true
    });

    const doctor2 = await Doctor.create({
      userId: docUser2._id,
      hospitalId: hospital._id,
      opdId: cardioOpd._id,
      name: 'Dr. Anita Sharma',
      qualification: 'MBBS, DM (Cardiology)',
      specialization: 'Cardiology',
      isSpecialist: true,
      averageConsultationDuration: 10,
      status: 'AVAILABLE'
    });
    docUser2.doctorId = doctor2._id;
    await docUser2.save();

    // Specialist Mapping
    await Specialist.create({
      doctorId: doctor2._id,
      specialtyName: 'Cardiology',
      subSpecialties: ['Interventional Cardiology', 'Hypertension'],
      generalOpdFallbackId: generalOpd._id,
      availableDays: ['Monday', 'Wednesday', 'Friday', 'Saturday']
    });

    // Patients
    const patientUser1 = await User.create({
      name: 'Aakash Verma',
      phone: '+919111111101',
      passwordHash: defaultPasswordHash,
      role: ROLES.PATIENT,
      isPhoneVerified: true
    });
    const patient1 = await Patient.create({
      userId: patientUser1._id,
      name: 'Aakash Verma',
      phone: '+919111111101',
      gender: 'MALE'
    });

    const patientUser2 = await User.create({
      name: 'Sunita Patil',
      phone: '+919111111102',
      passwordHash: defaultPasswordHash,
      role: ROLES.PATIENT,
      isPhoneVerified: true
    });
    const patient2 = await Patient.create({
      userId: patientUser2._id,
      name: 'Sunita Patil',
      phone: '+919111111102',
      gender: 'FEMALE'
    });

    // Walk-in Paper Patient (with phone)
    const patient3 = await Patient.create({
      name: 'Ganesh More',
      phone: '+919111111103',
      gender: 'MALE',
      isWalkInWithoutPhone: false
    });

    // Walk-in Paper Patient (without phone - basic phone / no phone)
    const patient4 = await Patient.create({
      name: 'Tukaram Shinde',
      phone: null,
      gender: 'MALE',
      isWalkInWithoutPhone: true
    });

    console.log('[Seed] Creating Multi-Session OPDs (Morning & Evening)...');
    const today = new Date().toISOString().split('T')[0];

    const morningSession = await OPDSession.create({
      hospitalId: hospital._id,
      opdId: generalOpd._id,
      doctorId: doctor1._id,
      name: 'Morning OPD Session',
      date: today,
      startTime: '09:00',
      endTime: '13:00',
      status: 'ACTIVE'
    });

    const eveningSession = await OPDSession.create({
      hospitalId: hospital._id,
      opdId: generalOpd._id,
      doctorId: doctor1._id,
      name: 'Evening OPD Session',
      date: today,
      startTime: '16:00',
      endTime: '20:00',
      status: 'SCHEDULED'
    });

    console.log('[Seed] Populating Unified OPD Queue for Morning Session...');
    // 1. O101 (Online Token - Currently in consultation)
    const token1 = await Token.create({
      tokenNumber: 'O101',
      tokenType: TOKEN_TYPES.ONLINE,
      patientId: patient1._id,
      patientName: patient1.name,
      patientPhone: patient1.phone,
      hospitalId: hospital._id,
      opdId: generalOpd._id,
      doctorId: doctor1._id,
      sessionId: morningSession._id,
      date: today,
      queuePosition: 0,
      status: TOKEN_STATUS.IN_CONSULTATION,
      joinedAt: new Date(Date.now() - 30 * 60000),
      consultationStartedAt: new Date(Date.now() - 5 * 60000)
    });
    morningSession.currentConsultationTokenId = token1._id;
    await morningSession.save();

    // 2. P102 (Paper / Walk-in Token - Entered by staff into SAME queue)
    await Token.create({
      tokenNumber: 'P102',
      tokenType: TOKEN_TYPES.PAPER,
      patientId: patient3._id,
      patientName: patient3.name,
      patientPhone: patient3.phone,
      hospitalId: hospital._id,
      opdId: generalOpd._id,
      doctorId: doctor1._id,
      sessionId: morningSession._id,
      date: today,
      queuePosition: 1,
      status: TOKEN_STATUS.WAITING,
      joinedAt: new Date(Date.now() - 25 * 60000),
      predictedWaitMinutes: 3,
      estimatedConsultationTime: new Date(Date.now() + 3 * 60000),
      predictionSource: 'FALLBACK',
      createdBy: staffUser._id
    });

    // 3. O103 (Online Token - Waiting)
    await Token.create({
      tokenNumber: 'O103',
      tokenType: TOKEN_TYPES.ONLINE,
      patientId: patient2._id,
      patientName: patient2.name,
      patientPhone: patient2.phone,
      hospitalId: hospital._id,
      opdId: generalOpd._id,
      doctorId: doctor1._id,
      sessionId: morningSession._id,
      date: today,
      queuePosition: 2,
      status: TOKEN_STATUS.WAITING,
      joinedAt: new Date(Date.now() - 20 * 60000),
      predictedWaitMinutes: 10,
      estimatedConsultationTime: new Date(Date.now() + 10 * 60000),
      predictionSource: 'FALLBACK',
      createdBy: patientUser2._id
    });

    // 4. P104 (Paper Token without phone - Waiting in SAME queue)
    await Token.create({
      tokenNumber: 'P104',
      tokenType: TOKEN_TYPES.PAPER,
      patientId: patient4._id,
      patientName: patient4.name,
      patientPhone: null,
      hospitalId: hospital._id,
      opdId: generalOpd._id,
      doctorId: doctor1._id,
      sessionId: morningSession._id,
      date: today,
      queuePosition: 3,
      status: TOKEN_STATUS.WAITING,
      joinedAt: new Date(Date.now() - 15 * 60000),
      predictedWaitMinutes: 17,
      estimatedConsultationTime: new Date(Date.now() + 17 * 60000),
      predictionSource: 'FALLBACK',
      createdBy: staffUser._id
    });

    // 5. Recalculate queue to synchronize positions and dynamic ETAs
    await QueueService.recalculateQueuePositions(morningSession._id);

    console.log('============================================================');
    console.log(' SEEDING COMPLETED SUCCESSFULLY!');
    console.log(' Demo Unified Queue created with:');
    console.log('   - Serving: O101 (Online Token)');
    console.log('   - Pos #1 : P102 (Walk-in Paper Token with phone)');
    console.log('   - Pos #2 : O103 (Online Token)');
    console.log('   - Pos #3 : P104 (Walk-in Paper Token without phone)');
    console.log(' Credentials:');
    console.log('   - Admin:   +919000000001 / Aarogya@123');
    console.log('   - Staff:   +919000000002 / Aarogya@123');
    console.log('   - Doctor:  +919000000003 / Aarogya@123');
    console.log('   - Patient: +919111111101 / Aarogya@123');
    console.log(' Session ID:', morningSession._id.toString());
    console.log('============================================================');
  } catch (error) {
    console.error('Seeding failed:', error);
    if (closeDbConnection) process.exit(1);
  } finally {
    if (closeDbConnection) {
      await closeDB();
    }
  }
};

if (require.main === module) {
  seedDatabase(true);
}

module.exports = seedDatabase;
