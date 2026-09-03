const env = require('../config/env');

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const CURRENT_LEVEL = env.isProduction ? LOG_LEVELS.info : LOG_LEVELS.debug;

function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` | ${typeof meta === 'object' ? JSON.stringify(meta) : meta}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] [iso-middleware]: ${message}${metaStr}`;
}

const logger = {
  error: (message, meta) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.error) {
      console.error(formatMessage('error', message, meta));
    }
  },
  warn: (message, meta) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', message, meta));
    }
  },
  info: (message, meta) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.info) {
      console.log(formatMessage('info', message, meta));
    }
  },
  debug: (message, meta) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.debug) {
      console.debug(formatMessage('debug', message, meta));
    }
  }
};

module.exports = logger;
