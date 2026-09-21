const request = require('supertest');
const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/config/db');
const app = require('../src/app');
const { User, Patient } = require('../src/models');

describe('Patient Authentication (Twilio Verify)', () => {
  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({});
    await Patient.deleteMany({});
  });

  afterAll(async () => {
    await closeDB();
  });

  it('should send an OTP for registration', async () => {
    const res = await request(app)
      .post('/api/auth/patient/register')
      .send({
        name: 'Test Patient',
        phone: '9999999999'
      });
    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBeTruthy();
    expect(res.body.message).toContain('OTP sent');
  });

  it('should prevent verifying with invalid OTP', async () => {
    const res = await request(app)
      .post('/api/auth/patient/verify-otp')
      .send({
        phone: '9999999999',
        otp: '000000'
      });
    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBeFalsy();
  });

  it('should send an OTP for login', async () => {
    const res = await request(app)
      .post('/api/auth/patient/send-otp')
      .send({
        phone: '9999999999'
      });
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBeTruthy();
  });
});
