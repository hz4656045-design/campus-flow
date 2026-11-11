/**
 * Audit middleware — logs every state-mutating API call to `audit_logs`.
 *
 * Only runs for POST/PUT/PATCH/DELETE; GETs are excluded (volume too high,
 * and FERPA already constrains their access via RBAC).
 *
 * The write is fire-and-forget: failure to log must not fail the request.
 */
const crypto = require('crypto');
const prisma = require('../config/database');
const logger = require('../utils/logger');

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const audit = (req, res, next) => {
  if (!MUTATING.has(req.method)) return next();

  // Defer audit row creation until response is finished so we can capture
  // the status code.
  res.on('finish', () => {
    const payload = JSON.stringify(req.body || {});
    const payloadHash = crypto
      .createHash('sha256')
      .update(payload)
      .digest('hex');

    prisma.auditLog
      .create({
        data: {
          userId: req.user?.id ?? null,
          roleSnapshot: req.user?.roles?.join(',') ?? null,
          endpoint: `${req.method} ${req.originalUrl}`,
          method: req.method,
          payloadHash,
          ip: req.ip || null,
          userAgent: req.headers['user-agent'] || null,
          result:
            res.statusCode >= 200 && res.statusCode < 300
              ? 'success'
              : res.statusCode === 401 || res.statusCode === 403
                ? 'denied'
                : 'failure',
        },
      })
      .catch((err) =>
        logger.error({ err }, 'audit_log write failed (non-fatal)'),
      );
  });

  next();
};

module.exports = audit;
