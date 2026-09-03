const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../helpers/logger');

let isConnected = false;
let reconnectTimer = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return mongoose.connection;
  }

  // If already in the process of connecting, return the existing promise
  if (mongoose.connection.readyState === 2) {
    return mongoose.connection;
  }

  const options = {
    maxPoolSize: env.MONGODB_POOL_SIZE,
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    autoIndex: true
  };

  try {
    logger.info(`Connecting to MongoDB at ${env.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}...`);
    const conn = await mongoose.connect(env.MONGODB_URI, options);
    isConnected = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    logger.info(`MongoDB connected successfully. Host: ${conn.connection.host}, DB: ${conn.connection.name}`);
    return conn.connection;
  } catch (err) {
    isConnected = false;
    logger.error(`MongoDB connection failed: ${err.message}`);
    
    // Automatically retry connection after 10 seconds in the background
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectDB().catch(() => {});
      }, 10000);
    }

    if (env.isProduction) {
      throw err;
    }
    return null;
  }
};

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection runtime error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected. Attempting automatic reconnection in 5s...');
  isConnected = false;
  if (!reconnectTimer) {
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectDB().catch(() => {});
    }, 5000);
  }
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected successfully.');
  isConnected = true;
});

const ensureConnected = async () => {
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }
  return mongoose.connection.readyState === 1;
};

const disconnectDB = async () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    isConnected = false;
    logger.info('MongoDB connection closed gracefully.');
  }
};

const getDBStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return {
    state: states[mongoose.connection.readyState] || 'unknown',
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null
  };
};

module.exports = {
  connectDB,
  ensureConnected,
  disconnectDB,
  getDBStatus
};
