const logger = require('../helpers/logger');
const ApiResponse = require('../helpers/apiResponse');

function errorHandler(err, req, res, next) {
  logger.error(`Unhandled Exception: ${err.message}`, {
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return ApiResponse.badRequest(res, 'Validation error', messages);
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return ApiResponse.badRequest(res, `Invalid format for field '${err.path}'`);
  }

  // Duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return ApiResponse.badRequest(res, `Duplicate entry for field '${field}'`);
  }

  // Default internal server error
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'An unexpected internal error occurred.' 
    : err.message;

  return ApiResponse.error(res, message, statusCode);
}

module.exports = errorHandler;
