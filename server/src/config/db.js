const mongoose = require('mongoose');
const env = require('./env');

let memoryServerInstance = null;

const connectDB = async () => {
  let mongoUri = env.MONGODB_URI;

  // Attempt direct connection if URI provided
  if (mongoUri) {
    try {
      console.log(`Connecting to MongoDB at: ${mongoUri}...`);
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 2500
      });
      console.log('MongoDB connected successfully via MONGODB_URI.');
      return mongoose.connection;
    } catch (err) {
      console.warn(`Direct MongoDB connection to ${mongoUri} failed (${err.message}). Attempting standalone memory-server fallback...`);
    }
  }

  // Fallback: Start embedded mongodb-memory-server for zero-config local development and testing
  try {
    const fs = require('fs');
    const cachedBinary = 'C:\\Users\\Mayuresh\\.cache\\mongodb-binaries\\mongod-x64-win32-8.2.6.exe';
    if (fs.existsSync(cachedBinary)) {
      process.env.MONGOMS_SYSTEM_BINARY = cachedBinary;
    }

    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServerInstance = await MongoMemoryServer.create({
      instance: {
        dbName: 'aarogya_dev_db'
      },
      binary: fs.existsSync(cachedBinary) ? { systemBinary: cachedBinary } : undefined
    });
    const fallbackUri = memoryServerInstance.getUri();
    console.log(`Starting embedded in-memory MongoDB instance at: ${fallbackUri}`);
    await mongoose.connect(fallbackUri);
    console.log('Connected to embedded MongoDB successfully.');
    return mongoose.connection;
  } catch (err) {
    console.error('CRITICAL: Failed to connect to MongoDB and failed to start in-memory fallback:', err.message);
    throw err;
  }
};

const closeDB = async () => {
  try {
    await mongoose.disconnect();
    if (memoryServerInstance) {
      await memoryServerInstance.stop();
    }
    console.log('MongoDB connection closed.');
  } catch (err) {
    console.error('Error closing MongoDB connection:', err);
  }
};

module.exports = {
  connectDB,
  closeDB
};
