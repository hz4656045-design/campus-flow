/**
 * Central error handler. Mounted last in the Express middleware chain.
 *
 * Handles:
 *   - ApiError          → forwarded as-is with its statusCode
 *   - Prisma errors     → mapped to 4xx (not-found, conflict, validation)
 *   - Zod errors        → 422 with field-level details
 *   - Everything else   → 500 (stack in dev, opaque in prod)
 */
const ApiError = require('../utils/ApiError');
const config = require('../config');
const logger = require('../utils/logger');

// Prisma error codes → HTTP status
// P2025 = record not found; P2002 = unique constraint; P2014 = invalid relation
const PRISMA_STATUS = {
  P2025: 404,
  P2002: 409,
  P2014: 422,
  P2003: 409, // foreign-key violation
};

function errorHandler(err, req, res, _next) {
  // Default to 500
  let status = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Internal server error';
  let details = err.details || undefined;

  // --- Prisma errors ------------------------------------------------------
  if (err.name === 'PrismaClientKnownRequestError') {
    status = PRISMA_STATUS[err.code] || 500;
    if (err.code === 'P2025') {
      code = 'NOT_FOUND';
      message = 'Resource not found';
    } else if (err.code === 'P2002') {
      code = 'CONFLICT';
      const target = Array.isArray(err.meta?.target)
        ? err.meta.target.join(', ')
        : 'resource';
      message = `Duplicate value for: ${target}`;
      details = { target: err.meta?.target };
    } else if (err.code === 'P2003') {
      code = 'FOREIGN_KEY_VIOLATION';
      message = 'Referenced entity does not exist';
      details = { field: err.meta?.field_name };
    }
  }

  // --- Zod validation errors ---------------------------------------------
  if (err.name === 'ZodError') {
    status = 422;
    code = 'VALIDATION_FAILED';
    message = 'Request validation failed';
    details = err.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
  }

  // --- JSON parse errors --------------------------------------------------
  if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body is not valid JSON';
  }

  // --- Logging ------------------------------------------------------------
  if (status >= 500) {
    logger.error(
      {
        err,
        userId: req.user?.id,
        method: req.method,
        url: req.originalUrl,
      },
      'Unhandled error',
    );
  } else if (status >= 400) {
    logger.warn(
      {
        code,
        status,
        userId: req.user?.id,
        method: req.method,
        url: req.originalUrl,
      },
      'Client error',
    );
  }

  // --- Response -----------------------------------------------------------
  res.status(status).json({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      // Only expose stack in development
      ...(config.isDev && status >= 500 ? { stack: err.stack } : {}),
    },
  });
}

module.exports = errorHandler;
