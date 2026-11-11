/** User management service — CRUD with role assignment. */
const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const toBigInt = require('../utils/toBigInt');

const PUBLIC_FIELDS = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  userRoles: { select: { role: { select: { id: true, code: true, displayName: true } } } },
};

async function list({ page = 1, pageSize = 25, search } = {}) {
  const where = {};
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: PUBLIC_FIELDS,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

async function getById(id) {
  const user = await prisma.user.findUnique({
    where: { id: toBigInt(id) },
    select: PUBLIC_FIELDS,
  });
  if (!user) throw ApiError.notFound('USER_NOT_FOUND', `User ${id} not found`);
  return user;
}

async function create({ email, password, firstName, lastName, phone, roleIds = [] }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw ApiError.conflict('EMAIL_TAKEN', `Email ${email} already registered`);
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptCost);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      phone,
      userRoles: roleIds.length
        ? { createMany: { data: roleIds.map((rid) => ({ roleId: Number(rid) })) } }
        : undefined,
    },
    select: PUBLIC_FIELDS,
  });
  return user;
}

async function update(id, { email, firstName, lastName, phone, isActive, roleIds }) {
  const existing = await prisma.user.findUnique({ where: { id: toBigInt(id) } });
  if (!existing) throw ApiError.notFound('USER_NOT_FOUND', `User ${id} not found`);

  // Role sync: replace all assignments
  const user = await prisma.user.update({
    where: { id: toBigInt(id) },
    data: {
      email,
      firstName,
      lastName,
      phone,
      isActive,
      ...(roleIds
        ? {
            userRoles: {
              deleteMany: {},
              createMany: {
                data: roleIds.map((rid) => ({ roleId: Number(rid) })),
              },
            },
          }
        : {}),
    },
    select: PUBLIC_FIELDS,
  });
  return user;
}

async function softDelete(id) {
  const existing = await prisma.user.findUnique({ where: { id: toBigInt(id) } });
  if (!existing) throw ApiError.notFound('USER_NOT_FOUND', `User ${id} not found`);
  return prisma.user.update({
    where: { id: toBigInt(id) },
    data: { isActive: false },
    select: { id: true, isActive: true },
  });
}

module.exports = { list, getById, create, update, softDelete, PUBLIC_FIELDS };
