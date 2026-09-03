const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const ApiResponse = require('../helpers/apiResponse');

const chatLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return ApiResponse.error(
      res, 
      'Too many requests from this IP, please try again in a minute.', 
      429
    );
  }
});

const configLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300, // higher limit for config fetches
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  chatLimiter,
  configLimiter
};
