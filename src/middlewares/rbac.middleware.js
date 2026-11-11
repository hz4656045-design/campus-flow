/**
 * RBAC permission middleware factory.
 *
 *   router.post('/courses', requirePermission(PERMISSIONS.COURSES_WRITE), ...);
 *
 * Must run AFTER auth.middleware so req.user is populated.
 * Supports OR semantics: pass an array and any match grants access.
 */
const ApiError = require('../utils/ApiError');

const requirePermission = (required) => (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized());
  }

  const requiredList = Array.isArray(required) ? required : [required];
  const granted = new Set(req.user.permissions);

  const ok = requiredList.some((p) => granted.has(p));
  if (!ok) {
    return next(
      ApiError.forbidden(
        'MISSING_PERMISSION',
        `Required permission(s): ${requiredList.join(', ')}`,
      ),
    );
  }
  next();
};

/**
 * Require that the user holds one of the given role codes.
 * Use sparingly — prefer requirePermission for granularity.
 */
const requireRole = (roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  const list = Array.isArray(roles) ? roles : [roles];
  const ok = list.some((r) => req.user.roles.includes(r));
  if (!ok) {
    return next(
      ApiError.forbidden(
        'MISSING_ROLE',
        `Required role(s): ${list.join(', ')}`,
      ),
    );
  }
  next();
};

module.exports = { requirePermission, requireRole };
