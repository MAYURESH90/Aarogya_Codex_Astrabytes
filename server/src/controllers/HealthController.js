const mongoose = require('mongoose');
const { getRedisClient } = require('../config/redis');
const axios = require('axios');
const env = require('../config/env');

class HealthController {
  static async getHealth(req, res) {
    res.json({
      status: 'UP',
      system: 'Aarogya Adaptive OPD Queue & Patient Continuity System',
      team: 'AstraBytes',
      timestamp: new Date().toISOString(),
      timezone: 'Asia/Kolkata'
    });
  }

  static async getDbHealth(req, res) {
    const isDbConnected = mongoose.connection.readyState === 1;
    res.status(isDbConnected ? 200 : 503).json({
      status: isDbConnected ? 'UP' : 'DOWN',
      database: 'MongoDB',
      readyState: mongoose.connection.readyState
    });
  }

  static async getRedisHealth(req, res) {
    const redis = getRedisClient();
    res.json({
      status: 'UP',
      cache: 'Redis',
      isFallback: !!redis.isFallback,
      mode: redis.isFallback ? 'IN_MEMORY_RESILIENT_FALLBACK' : 'EXTERNAL_SERVER'
    });
  }

  static async getPredictionHealth(req, res) {
    try {
      const response = await axios.get(`${env.PREDICTION_SERVICE_URL.replace('/api', '')}/health`, { timeout: 1500 });
      res.json({
        status: 'UP',
        service: 'FastAPI Prediction Engine',
        details: response.data
      });
    } catch (err) {
      res.json({
        status: 'DEGRADED_FALLBACK_ACTIVE',
        service: 'FastAPI Prediction Engine',
        message: `Prediction service offline (${err.message}). Node.js fallback deterministic engine is active.`,
        fallbackReady: true
      });
    }
  }

  static async getTwilioHealth(req, res) {
    const isConfigured = !!(env.TWILIO.ACCOUNT_SID && env.TWILIO.AUTH_TOKEN);
    res.json({
      status: 'UP',
      provider: isConfigured ? 'Twilio Live' : 'Twilio Sandbox Simulator',
      configured: isConfigured
    });
  }
}

module.exports = HealthController;
