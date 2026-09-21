const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { connectDB, closeDB } = require('../src/config/db');
const app = require('../src/app');
const { User, Patient, Document } = require('../src/models');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');

describe('Document Upload & Timeline (Bug 1 & Bug 2 fixes)', () => {
  let patientUser, patientRecord, patientToken;
  let otherPatient;
  const testFilePath = path.join(__dirname, 'fixtures', 'test-doc.pdf');

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({});
    await Patient.deleteMany({});
    await Document.deleteMany({});

    // Create fixture file
    const fixtureDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(fixtureDir)) fs.mkdirSync(fixtureDir);
    // Minimal valid PDF bytes
    fs.writeFileSync(testFilePath, '%PDF-1.4 test content');

    // Create a patient user
    patientUser = await User.create({
      name: 'Test Patient',
      phone: '+919800000001',
      role: 'PATIENT',
      isPhoneVerified: true,
      isActive: true
    });

    // Create linked Patient record
    patientRecord = await Patient.create({
      userId: patientUser._id,
      name: 'Test Patient',
      phone: '+919800000001',
      gender: 'MALE'
    });

    // Create JWT for this user
    patientToken = jwt.sign({ id: patientUser._id }, env.JWT_SECRET, { expiresIn: '1h' });

    // Another patient (no user link — walk-in)
    otherPatient = await Patient.create({
      name: 'Other Walk-in Patient',
      phone: '+919800000002',
      gender: 'FEMALE',
      isWalkInWithoutPhone: false
    });
  });

  afterAll(async () => {
    await closeDB();

    if (fs.existsSync(testFilePath)) {
      try {
        fs.unlinkSync(testFilePath);
      } catch (err) {
        if (err.code !== 'EBUSY') {
          throw err;
        }
      }
    }
  });

  it('BUG 2: Patient upload uses authenticated userId, ignores patientId in body', async () => {
    const res = await request(app)
      .post('/api/medical/documents/upload')
      .set('Authorization', `Bearer ${patientToken}`)
      // Deliberately send another patient's ID — should be ignored
      .field('patientId', otherPatient._id.toString())
      .attach('document', testFilePath);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);

    // The saved document must use OUR patientRecord._id, NOT otherPatient._id
    const saved = await Document.findById(res.body.data._id);
    expect(saved.patientId.toString()).toBe(patientRecord._id.toString());
    expect(saved.patientId.toString()).not.toBe(otherPatient._id.toString());
  });

  it('BUG 1: Uploaded document appears in the timeline', async () => {
    const timelineRes = await request(app)
      .get(`/api/medical/timeline/${patientRecord._id}`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(timelineRes.statusCode).toBe(200);
    expect(timelineRes.body.success).toBe(true);

    const timeline = timelineRes.body.data;
    const docEntry = timeline.find(e => e.type === 'DOCUMENT_UPLOAD');
    expect(docEntry).toBeDefined();
    expect(docEntry.details.ocrStatus).toBeTruthy();
    expect(docEntry.details.title).toBeDefined();
  });
});
