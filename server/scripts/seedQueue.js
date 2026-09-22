const mongoose = require('mongoose');
const { Token, OPDSession, Patient } = require('../src/models');
const { TOKEN_STATUS, TOKEN_TYPES } = require('../src/config/constants');
const QueueService = require('../src/services/QueueService');
const env = require('../src/config/env');

const seedQueue = async () => {
  try {
    const sessionId = process.argv[2];
    if (!sessionId) {
      console.error('Please provide a sessionId as argument: node seedQueue.js <sessionId>');
      process.exit(1);
    }

    await mongoose.connect(env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    const session = await OPDSession.findById(sessionId).populate('hospitalId opdId doctorId');
    if (!session) {
      console.error('Session not found!');
      process.exit(1);
    }

    console.log(`Seeding queue for session: ${session.name} (${sessionId})`);

    // Create a dummy patient
    const dummyPatient = await Patient.create({
      name: 'Demo Patient',
      phone: '+919999999999',
      gender: 'OTHER',
      dateOfBirth: new Date(1990, 0, 1)
    });

    const tokensToCreate = [
      {
        tokenNumber: 'ARO-021',
        tokenType: TOKEN_TYPES.ONLINE,
        patientName: 'John Doe',
        status: TOKEN_STATUS.IN_CONSULTATION,
        queuePosition: 0,
        consultationStartedAt: new Date(Date.now() - 5 * 60000)
      },
      {
        tokenNumber: 'ARO-022',
        tokenType: TOKEN_TYPES.ONLINE,
        patientName: 'Jane Smith',
        status: TOKEN_STATUS.WAITING,
        queuePosition: 1,
        joinedAt: new Date(Date.now() - 30 * 60000)
      }
    ];

    for (const tokenData of tokensToCreate) {
      const existing = await Token.findOne({ sessionId, tokenNumber: tokenData.tokenNumber });
      if (!existing) {
        const token = new Token({
          ...tokenData,
          sessionId: session._id,
          hospitalId: session.hospitalId._id,
          opdId: session.opdId._id,
          doctorId: session.doctorId._id,
          patientId: dummyPatient._id,
          date: session.date,
          createdBy: null
        });
        await token.save();
        console.log(`Created dummy token: ${tokenData.tokenNumber}`);
      } else {
        console.log(`Token ${tokenData.tokenNumber} already exists.`);
      }
    }

    await OPDSession.findByIdAndUpdate(sessionId, {
      currentConsultationTokenId: await Token.findOne({ sessionId, tokenNumber: 'ARO-021' }).then(t => t?._id)
    });

    // Force recalculate queue positions and ETA
    await QueueService.recalculateQueuePositions(sessionId);
    await QueueService.processQueueEvent({
      eventType: 'SEED_DEV_DATA',
      sessionId: session._id,
      actorRole: 'SYSTEM'
    });

    console.log('Development seed complete.');
    process.exit(0);

  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
};

seedQueue();
