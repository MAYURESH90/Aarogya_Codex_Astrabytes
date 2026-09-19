const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGODB_URI: process.env.MONGODB_URI || '',
  REDIS_URL: process.env.REDIS_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'aarogya-jwt-super-secret-key-astrabytes-2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  PREDICTION_SERVICE_URL: process.env.PREDICTION_SERVICE_URL || 'http://localhost:8000/api',
  TWILIO: {
    ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
    AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
    PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '+10000000000'
  },
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER || 'SANDBOX',
  TIMEZONE: 'Asia/Kolkata',
  UPLOAD_DIR: path.resolve(__dirname, '../../uploads')
};
