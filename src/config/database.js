/**
 * Prisma Client singleton.
 *
 * Re-use one client across the entire process:
 *   - one connection pool
 *   - one prepared-statement cache
 *
 * In development, attach the client to globalThis so nodemon restarts
 * don't pile up extra connections.
 */
const { PrismaClient } = require('@prisma/client');

const config = require('./index');
const logger = require('../utils/logger');

const prisma =
  global.__prisma ||
  new PrismaClient({
    log: config.isDev ? ['query', 'warn', 'error'] : ['warn', 'error'],
    datasources: { db: { url: config.database.url } },
  });

if (config.isDev) {
  global.__prisma = prisma;

  // Graceful shutdown — close the pool when the process exits.
  const shutdown = async (signal) => {
    logger.info({ signal }, 'Prisma client disconnecting…');
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = prisma;
