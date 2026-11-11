/**
 * ApiError — typed application error with status code and machine-readable code.
 *
 * Usage:
 *   throw new ApiError(404, 'USER_NOT_FOUND', 'User 123 not found');
 *   throw new ApiError(403, 'FORBIDDEN', 'Missing permission grades:write');
 */
class ApiError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // expected error — safe to expose to client
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(code, message, details) {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(code = 'UNAUTHORIZED', message = 'Authentication required') {
    return new ApiError(401, code, message);
  }

  static forbidden(code = 'FORBIDDEN', message = 'You do not have permission to perform this action') {
    return new ApiError(403, code, message);
  }

  static notFound(code = 'NOT_FOUND', message = 'Resource not found') {
    return new ApiError(404, code, message);
  }

  static conflict(code = 'CONFLICT', message = 'Resource already exists', details) {
    return new ApiError(409, code, message, details);
  }

  static unprocessable(code = 'UNPROCESSABLE', message = 'Validation failed', details) {
    return new ApiError(422, code, message, details);
  }
}

module.exports = ApiError;
