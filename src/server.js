/**
 * Campus Flow — bootstrap.
 *
 *   node server.js        (production)
 *   npm run dev           (nodemon, hot reload)
 */
const app = require('./src/app');
const config = require('./src/config');
const logger = require('./src/utils/logger');

const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.env, app: config.appName },
    'Campus Flow API listening',
  );
});

// Graceful shutdown
const shutdown = (signal) => {
  logger.info({ signal }, 'Shutdown signal received, closing server…');
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
  // Force-exit after 10s if pending requests hang
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});
