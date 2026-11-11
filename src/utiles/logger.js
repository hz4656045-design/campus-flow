/**
 * Lightweight pino logger.
 * Pretty-prints in dev, JSON in prod (parseable by ELK / Loki / CloudWatch).
 */
const pino = require('pino');
const config = require('../config');

const logger = pino({
  level: config.log.level,
  base: { app: config.appName },
  ...(config.isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
        },
      }
    : {}), // JSON in prod
});

module.exports = logger;
