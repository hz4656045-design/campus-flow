/**
 * Prisma seed — bootstraps roles, permissions, role-permission mapping,
 * and one admin user. Idempotent (safe to re-run).
 *
 *   node prisma/seed.js
 *
 * Admin credentials (override via ADMIN_EMAIL / ADMIN_PASSWORD env):
 *   email:    admin@campusflow.edu
 *   password: ChangeMe!Strong123
 */
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ROLES = [
  { code: 'admin', display: 'System Administrator', desc: 'Full system access; user/role management, global config, audit.' },
  { code: 'faculty', display: 'Faculty / Professor', desc: 'Owns class sections; creates assessments and enters grades.' },
  { code: 'student', display: 'Student', desc: 'Enrolls in sections, views own academic records.' },
  { code: 'advisor', display: 'Academic Advisor', desc: 'Views advisee records, places/releases registration hold.' },
  { code: 'registrar', display: 'Registrar Officer', desc: 'Manages calendar, catalog, room allocation, transcript generation.' },
];

const PERMISSIONS = [
  ['users:read', 'users', 'read'],
  ['users:write', 'users', 'write'],
  ['roles:read', 'roles', 'read'],
  ['roles:write', 'roles', 'write'],
  ['courses:read', 'courses', 'read'],
  ['courses:write', 'courses', 'write'],
  ['sections:read', 'sections', 'read'],
  ['sections:write', 'sections', 'write'],
  ['enrollments:create', 'enrollments', 'create'],
  ['enrollments:read', 'enrollments', 'read'],
  ['enrollments:drop', 'enrollments', 'delete'],
  ['grades:write', 'grades', 'write'],
  ['grades:read', 'grades', 'read'],
  ['grades:correct', 'grades', 'correct'],
  ['holds:write', 'holds', 'write'],
  ['holds:read', 'holds', 'read'],
  ['transcripts:read', 'transcripts', 'read'],
  ['audit:read', 'audit', 'read'],
  ['config:write', 'config', 'write'],
];

const ROLE_PERMS = {
  admin: [
    'users:read', 'users:write', 'roles:read', 'roles:write',
    'courses:read', 'courses:write', 'sections:read', 'sections:write',
    'enrollments:read', 'grades:read', 'grades:correct',
    'holds:read', 'holds:write', 'transcripts:read',
    'audit:read', 'config:write',
  ],
  faculty: [
    'courses:read', 'sections:read', 'sections:write',
    'enrollments:read', 'grades:write', 'grades:read', 'holds:read',
  ],
  student: [
    'courses:read', 'sections:read',
    'enrollments:create', 'enrollments:read', 'enrollments:drop',
    'grades:read', 'holds:read', 'transcripts:read',
  ],
  advisor: [
    'courses:read', 'sections:read', 'enrollments:read',
    'grades:read', 'holds:write', 'holds:read', 'transcripts:read',
  ],
  registrar: [
    'courses:read', 'courses:write', 'sections:read', 'sections:write',
    'enrollments:read', 'enrollments:drop', 'grades:read', 'grades:correct',
    'holds:read', 'holds:write', 'transcripts:read',
  ],
};

async function main() {
  console.log('→ Seeding roles…');
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { code: r.code },
      update: { displayName: r.display, description: r.desc },
      create: { code: r.code, displayName: r.display, description: r.desc },
    });
  }

  console.log('→ Seeding permissions…');
  for (const [code, resource, action] of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: { resource, action },
      create: { code, resource, action },
    });
  }

  console.log('→ Mapping permissions to roles…');
  const allRoles = await prisma.role.findMany();
  const allPerms = await prisma.permission.findMany();

  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMS)) {
    const role = allRoles.find((r) => r.code === roleCode);
    if (!role) continue;
    for (const permCode of permCodes) {
      const perm = allPerms.find((p) => p.code === permCode);
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }

  console.log('→ Seeding bootstrap admin user…');
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@campusflow.edu';
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe!Strong123';
  const hash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: hash,
      firstName: 'System',
      lastName: 'Administrator',
      userRoles: {
        create: [{ roleId: allRoles.find((r) => r.code === 'admin').id }],
      },
    },
    select: { id: true, email: true },
  });
  console.log(`   ✓ admin user: ${admin.email} (id=${admin.id})`);
  if (adminPassword === 'ChangeMe!Strong123') {
    console.log('   ⚠ default password in use — change via ADMIN_PASSWORD env or PUT /api/users/:id');
  }

  console.log('\nSeed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
