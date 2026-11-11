/**
 * Authentication middleware.
 *
 *  requireAuth   — verify the Bearer access JWT; attach req.user (id, roles, perms).
 *  optionalAuth  — attach req.user if a token is present, else continue anonymously.
 */
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const toBigInt = require('../utils/toBigInt');

/**
 * Decode the access token and hydrate the user's roles + permissions.
 * Returns a lean object — never the password hash.
 *
 * `userId` may arrive as a string (JWT `sub`) or a bigint (from req.user.id),
 * so it is normalised with toBigInt before the Prisma lookup.
 */
async function hydrateUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: toBigInt(userId) },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      lockedUntil: true,
      userRoles: {
        select: {
          role: {
            select: {
              code: true,
              rolePermissions: { select: { permission: { select: { code: true } } } },
            },
          },
        },
      },
    },
  });

  if (!user || !user.isActive) return null;
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) return null;

  const roles = user.userRoles.map((ur) => ur.role.code);
  const permissions = [
    ...new Set(
      user.userRoles.flatMap((ur) =>
        ur.role.rolePermissions.map((rp) => rp.permission.code),
      ),
    ),
  ];

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles,
    permissions,
  };
}

const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('NO_TOKEN', 'Missing Bearer access token');
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.accessSecret, {
      issuer: config.jwt.issuer,
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('TOKEN_EXPIRED', 'Access token expired');
    }
    throw ApiError.unauthorized('TOKEN_INVALID', 'Access token invalid');
  }

  const user = await hydrateUser(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('USER_INACTIVE', 'User not found or locked');
  }

  req.user = user;
  next();
});

const optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next();

  try {
    const payload = jwt.verify(token, config.jwt.accessSecret, {
      issuer: config.jwt.issuer,
    });
    const user = await hydrateUser(payload.sub);
    if (user) req.user = user;
  } catch (_) {
    /* swallow — optional */
  }
  next();
});

module.exports = { requireAuth, optionalAuth, hydrateUser };
