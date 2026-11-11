/**
 * Express app composition.
 *
 * Pipeline order matters:
 *   trust proxy → real client IP behind nginx / load balancer
 *   helmet      → security headers
 *   cors        → CORS policy (allow-list from CORS_ORIGINS)
 *   pino-http   → structured request logging (before parsers, so bad bodies are logged too)
 *   rate-limit  → cheap abuse guard on /api (before body parsing)
 *   express.json + cookie-parser → body / cookie parsing
 *   health probes (no auth, no audit, no rate limit)
 *   audit       → mutation logging
 *   /api routes
 *   404 + errorHandler
 *
 * NOTE: this file lives in src/, so every require below is relative to src/.
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');

const config = require('./config');
const prisma = require('./config/database');
const logger = require('./utils/logger');
const routes = require('./routes');
const audit = require('./middlewares/audit.middleware');
const notFound = require('./middlewares/notFound.middleware');
const errorHandler = require('./middlewares/error.middleware');

const app = express();

if (config.trustProxy) {
  app.set('trust proxy', config.trustProxy);
}

// --- Security ---
app.use(helmet());
app.use(
  cors({
    // Production: strict allow-list. Development with no list: reflect origin.
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : !config.isProd,
    credentials: true,
  }),
);

// --- Logging ---
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/health/live' || req.url === '/health/ready',
    },
  }),
);

// --- Health probes (no auth, no audit, no rate limit) ---
app.get('/health/live', (_req, res) => res.json({ status: 'alive' }));
app.get('/health/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', database: 'up' });
  } catch (err) {
    req.log.error({ err }, 'Readiness check failed');
    res.status(503).json({ status: 'not_ready', database: 'down' });
  }
});

// --- Rate limiting (per-IP, applied to /api) ---
app.use(
  '/api',
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down' } },
  }),
);

// --- Parsing ---
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

// --- Audit (mutations only) ---
app.use('/api', audit);

// --- API routes ---
app.use('/api', routes);

// --- 404 + error handler (last) ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;
