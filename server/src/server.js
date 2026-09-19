const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/db');
const { getRedisClient } = require('./config/redis');
const RealtimeService = require('./services/RealtimeService');
const env = require('./config/env');

const server = http.createServer(app);

// Initialize Socket.IO Realtime WebSocket
RealtimeService.init(server);

const startServer = async () => {
  try {
    // Connect to Persistent Storage
    await connectDB();

    // Initialize Redis cache & distributed lock
    getRedisClient();

    server.listen(env.PORT, () => {
      console.log('============================================================');
      console.log(` AAROGYA BACKEND SERVER ACTIVE ON PORT ${env.PORT}`);
      console.log(` Environment: ${env.NODE_ENV}`);
      console.log(` Timezone: ${env.TIMEZONE}`);
      console.log(` API Docs: http://localhost:${env.PORT}/api-docs`);
      console.log(` Health Check: http://localhost:${env.PORT}/health`);
      console.log('============================================================');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start if executed directly
if (require.main === module) {
  startServer();
}

module.exports = { app, server, startServer };
