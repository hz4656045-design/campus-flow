/**
 * Prisma Client singleton.
 *
 * Usage anywhere in the app:
 *   const prisma = require('../config/database');
 *   const users = await prisma.user.findMany();
 *
 * Why a singleton:
 *   Every `new PrismaClient()` opens its own connection pool. Creating one per
 *   file (or one per nodemon reload) exhausts PostgreSQL connections quickly.
 *   Node's require cache already gives us one instance per process; the
 *   globalThis guard additionally survives dev hot-reloads.
 *
 * Lifecycle (connect on boot / disconnect on shutdown) lives in server.js.
 */
const { PrismaClient } = require('@prisma/client');
const config = require('./index'); // guarantees .env is loaded BEFORE the client is built

/**
 * Our schema uses BigInt ids (users, students, enrollments, ...).
 * JSON.stringify cannot serialize BigInt, so `res.json(user)` would throw
 * "TypeError: Do not know how to serialize a BigInt". Serialize them as strings.
 */
if (typeof BigInt.prototype.toJSON !== 'function') {
  // eslint-disable-next-line no-extend-native
  BigInt.prototype.toJSON = function toJSON() {
    return this.toString();
  };
}

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__campusFlowPrisma ||
  new PrismaClient({
    log: config.isDev ? ['warn', 'error'] : ['error'],
  });

if (!config.isProd) {
  globalForPrisma.__campusFlowPrisma = prisma;
}

module.exports = prisma;
