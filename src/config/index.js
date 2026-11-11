/**
 * Central configuration.
 *
 * - Loads .env from the PROJECT ROOT (not from process.cwd()), so it works
 *   no matter where you start node / nodemon / a test runner from.
 * - Fails fast with a clear message if a required variable is missing.
 * - This must be the FIRST local module required (server.js does that), so
 *   process.env is fully populated before Prisma Client is created.
 */
const path = require('path');
const dotenv = require('dotenv');

// src/config/index.js → project root is two levels up
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const env = process.env;

const required = (name) => {
  const value = env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `[config] Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
};

const int = (name, fallback) => {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) {
    throw new Error(`[config] ${name} must be an integer, got "${raw}"`);
  }
  return n;
};

const bool = (name, fallback) => {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
};

const nodeEnv = env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

const config = {
  env: nodeEnv,
  isProd,
  isDev: nodeEnv === 'development',
  port: int('PORT', 3000),
  appName: env.APP_NAME || 'campus-flow',

  databaseUrl: required('DATABASE_URL'),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessTtl: env.JWT_ACCESS_TTL || '15m',
    refreshTtl: env.JWT_REFRESH_TTL || '7d',
    issuer: env.JWT_ISSUER || 'campus-flow',
  },

  cookie: {
    secure: bool('COOKIE_SECURE', isProd),
    sameSite: env.COOKIE_SAMESITE || 'lax',
  },

  bcryptCost: int('BCRYPT_COST', 12),

  rateLimit: {
    windowMs: int('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    max: int('RATE_LIMIT_MAX', 300),
  },

  // Comma-separated list of allowed browser origins, e.g.
  // CORS_ORIGINS=http://localhost:5173,https://campus.example.edu
  // Empty in development = reflect any origin (convenient locally).
  corsOrigins: (env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Set TRUST_PROXY=1 when running behind nginx / a load balancer so that
  // per-IP rate limiting and req.ip use the real client address.
  trustProxy: env.TRUST_PROXY ? int('TRUST_PROXY', 1) : false,

  logLevel: env.LOG_LEVEL || (isProd ? 'info' : 'debug'),

  // When true, the server exits if PostgreSQL is unreachable on boot.
  // Default false (dev-friendly): the HTTP server still starts and /health/ready
  // reports the DB as down until it becomes reachable.
  failOnDbError: bool('FAIL_ON_DB_ERROR', isProd),
};

if (isProd) {
  for (const key of ['accessSecret', 'refreshSecret']) {
    if (config.jwt[key].length < 32) {
      throw new Error(`[config] jwt.${key} must be at least 32 characters in production`);
    }
  }
  if (config.corsOrigins.length === 0) {
    throw new Error('[config] CORS_ORIGINS must be set in production');
  }
}

module.exports = config;
