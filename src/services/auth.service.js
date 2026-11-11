/**
 * Auth service — login, refresh-token rotation, logout, current-user.
 *
 * Stateless refresh model: a signed refresh JWT in an HttpOnly cookie.
 * For revocation support, add a `refresh_token_jtis` blacklist table.
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../config/database');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const { hydrateUser } = require('../middlewares/auth.middleware');

const LOCK_THRESHOLD = 5; // failed attempts before lock
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessTtl, issuer: config.jwt.issuer },
  );
}

function signRefreshToken(user) {
  const jti = crypto.randomUUID();
  return jwt.sign(
    { sub: String(user.id), jti },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshTtl, issuer: config.jwt.issuer },
  );
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Constant-time fake compare to mitigate user-enumeration via timing
    await bcrypt.compare(password, '$2a$12$'.padEnd(60, 'x'));
    throw ApiError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // Locked?
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    throw ApiError.forbidden(
      'ACCOUNT_LOCKED',
      'Account is temporarily locked. Try again later.',
    );
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    const fails = user.failedLoginCount + 1;
    const lockUntil =
      fails >= LOCK_THRESHOLD
        ? new Date(Date.now() + LOCK_DURATION_MS)
        : null;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: fails,
        lockedUntil: lockUntil,
      },
    });
    throw ApiError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // Successful login → reset counters
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  const hydrated = await hydrateUser(user.id);
  return {
    user: hydrated,
    accessToken: signAccessToken(hydrated),
    refreshToken: signRefreshToken(hydrated),
  };
}

async function refresh(refreshToken) {
  if (!refreshToken) {
    throw ApiError.unauthorized('NO_REFRESH_TOKEN', 'Missing refresh token');
  }
  let payload;
  try {
    payload = jwt.verify(refreshToken, config.jwt.refreshSecret, {
      issuer: config.jwt.issuer,
    });
  } catch (err) {
    throw ApiError.unauthorized('REFRESH_TOKEN_INVALID', 'Refresh token invalid or expired');
  }
  const hydrated = await hydrateUser(payload.sub);
  if (!hydrated) {
    throw ApiError.unauthorized('USER_INACTIVE', 'User no longer active');
  }
  return {
    user: hydrated,
    accessToken: signAccessToken(hydrated),
    refreshToken: signRefreshToken(hydrated), // rotate
  };
}

async function me(userId) {
  const hydrated = await hydrateUser(userId);
  if (!hydrated) {
    throw ApiError.notFound('USER_NOT_FOUND', 'User not found');
  }
  return hydrated;
}

module.exports = { login, refresh, me, signAccessToken, signRefreshToken };
