const request = require('supertest');
const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/config/db');
const app = require('../src/app');
const { Hospital } = require('../src/models');

describe('Hospital Search by Pincode', () => {
  beforeAll(async () => {
    await connectDB();
    await Hospital.deleteMany({});
    await Hospital.create({
      name: 'Aarogya Demo Government Hospital',
      code: 'DEMO-GOV-01',
      pinCode: '421301',
      isGovernment: true,
      address: { city: 'Kalyan', state: 'Maharashtra', pincode: '421301' }
    });
    await Hospital.create({
      name: 'Test Private Hospital',
      code: 'TPH',
      pinCode: '400001',
      isGovernment: false
    });
  });

  afterAll(async () => {
    await closeDB();
  });

  it('should find government hospitals by pincode', async () => {
    const res = await request(app)
      .get('/api/hospitals')
      .query({ pinCode: '421301', isGovernment: true });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBeTruthy();
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toEqual('Test Govt Hospital');
  });

  it('should handle no results gracefully', async () => {
    const res = await request(app)
      .get('/api/hospitals')
      .query({ pinCode: '000000', isGovernment: true });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBeTruthy();
    expect(res.body.data.length).toEqual(0);
  });
});
