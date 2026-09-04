const Redis = require('ioredis');
const env = require('./env');
const logger = require('../helpers/logger');

let redisClient = null;
let isConnected = false;

function initRedis() {
  if (!env.REDIS_URI) {
    logger.warn('[Redis] No REDIS_URI provided. Running without Redis cache.');
    return null;
  }

  try {
    redisClient = new Redis(env.REDIS_URI, {
      connectTimeout: 10000,
      maxRetriesPerRequest: 2,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
      enableReadyCheck: true,
      lazyConnect: false
    });

    redisClient.on('connect', () => {
      isConnected = true;
      logger.info('[Redis] Connected to Redis Cloud Cache successfully.');
    });

    redisClient.on('ready', () => {
      isConnected = true;
      logger.info('[Redis] Client is ready to accept commands.');
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      logger.warn(`[Redis] Connection error: ${err.message}. Non-blocking fallback active.`);
    });

    redisClient.on('close', () => {
      isConnected = false;
    });

    return redisClient;
  } catch (err) {
    logger.error(`[Redis] Failed to initialize Redis: ${err.message}`);
    return null;
  }
}

function getRedisClient() {
  if (!redisClient) {
    return initRedis();
  }
  return redisClient;
}

function isRedisReady() {
  return Boolean(redisClient && isConnected && redisClient.status === 'ready');
}

module.exports = {
  initRedis,
  getRedisClient,
  isRedisReady
};
