/**
 * Standardized API Response Helpers
 */

class ApiResponse {
  static success(res, data = null, message = 'Success', statusCode = 200, extra = {}) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      ...extra,
      timestamp: new Date().toISOString()
    });
  }

  static created(res, data = null, message = 'Resource created successfully') {
    return ApiResponse.success(res, data, message, 201);
  }

  static error(res, message = 'An unexpected error occurred', statusCode = 500, errors = null) {
    const payload = {
      success: false,
      message,
      timestamp: new Date().toISOString()
    };
    if (errors) {
      payload.errors = errors;
    }
    return res.status(statusCode).json(payload);
  }

  static notFound(res, message = 'Resource not found') {
    return ApiResponse.error(res, message, 404);
  }

  static badRequest(res, message = 'Invalid request parameters', errors = null) {
    return ApiResponse.error(res, message, 400, errors);
  }

  static unauthorized(res, message = 'Unauthorized access') {
    return ApiResponse.error(res, message, 401);
  }
}

module.exports = ApiResponse;
