const morgan = require('morgan');
const env = require('../config/env');

// Format token: format output nicely for production and development
const format = env.isProduction
  ? ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms'
  : ':method :url :status :response-time ms - :res[content-length]';

const requestLogger = morgan(format, {
  skip: (req) => req.url === '/health' || req.url === '/favicon.ico'
});

module.exports = requestLogger;
