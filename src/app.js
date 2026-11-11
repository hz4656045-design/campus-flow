/**
 * Express app composition.
 *
 * Pipeline order matters:
 *   helmet   → security headers
 *   cors     → CORS policy
 *   pino-http→ structured request logging
 *   express.json + cookie-parser → body / cookie parsing
 *   rate-limit → basic abuse guard on /api
 *   audit → mutation logging (after auth so userId is populated where possible)
 *   /api routes
 *   404 + errorHandler
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');

const config = require('./config/index.js');
const logger = require('./utils/logger');
const routes = require('./routes');
const audit = require('./middlewares/audit.middleware');
const notFound = require('./middlewares/notFound.middleware');
const errorHandler = require('./middlewares/error.middleware');

const app = express();

// --- Security & parsing ---
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// --- Logging ---
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignorePaths: ['/health/live', '/health/ready'],
    },
  }),
);

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

// --- Health probes (no auth, no audit) ---
app.get('/health/live', (_req, res) => res.json({ status: 'alive' }));
app.get('/health/ready', async (_req, res) => {
  try {
    const prisma = require('./config/database');
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', database: 'up' });
  } catch (err) {
    res.status(503).json({ status: 'not_ready', database: 'down', error: err.message });
  }
});

// --- Audit (mutations only; runs after auth middleware attaches req.user) ---
app.use('/api', audit);

// --- API routes ---
app.use('/api', routes);

// --- 404 + error handler (last) ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;
