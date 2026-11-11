/**
 * Campus Flow — bootstrap.
 *
 *   node server.js        (production)
 *   npm run dev           (nodemon, hot reload)
 *
 * Require order matters: config FIRST (loads and validates .env), then
 * everything that depends on process.env (Prisma, app).
 */
const config = require('./src/config');
const logger = require('./src/utils/logger');
const prisma = require('./src/config/database');
const app = require('./src/app');

let server;
let shuttingDown = false;

async function start() {
  // Bind the HTTP port FIRST so the process is immediately observable
  // (health/live, /api map) regardless of how long the DB handshake takes.
  // The DB connection is then probed in the background; /health/ready reflects
  // its real status. Set FAIL_ON_DB_ERROR=1 to restore fail-fast behaviour.
  server = app.listen(config.port, () => {
    logger.info(
      { port: config.port, env: config.env, app: config.appName },
      'Campus Flow API listening',
    );
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.fatal({ port: config.port }, 'Port already in use');
    } else {
      logger.fatal({ err }, 'HTTP server error');
    }
    process.exit(1);
  });

  // Background DB probe (non-blocking — never delays the listen above).
  prisma
    .$connect()
    .then(() => logger.info('Database connected'))
    .catch((err) => {
      if (config.failOnDbError) {
        logger.fatal(
          { err },
          'Cannot connect to PostgreSQL — check DATABASE_URL in .env and that the server is running (FAIL_ON_DB_ERROR=1)',
        );
        process.exit(1);
      }
      logger.warn(
        { err },
        'Could not connect to PostgreSQL — running in degraded mode. Check DATABASE_URL in .env. /health/ready will report "down" until the DB is reachable.',
      );
    });
}

// Graceful shutdown: stop accepting requests → finish in-flight → close DB pool.
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutdown signal received, closing server…');

  // Force-exit after 10s if pending requests hang
  setTimeout(() => process.exit(1), 10_000).unref();

  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      logger.info('HTTP server closed.');
    }
    await prisma.$disconnect();
    logger.info('Database disconnected.');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});

start();
