/**
 * Authoritative role + permission constants.
 * Mirrors the seed in prisma/seed.js and the SRD §2 RBAC matrix.
 */

const ROLES = Object.freeze({
  ADMIN: 'admin',
  FACULTY: 'faculty',
  STUDENT: 'student',
  ADVISOR: 'advisor',
  REGISTRAR: 'registrar',
});

const PERMISSIONS = Object.freeze({
  // Users & roles
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  ROLES_READ: 'roles:read',
  ROLES_WRITE: 'roles:write',
  // Catalog
  COURSES_READ: 'courses:read',
  COURSES_WRITE: 'courses:write',
  // Sections / scheduling
  SECTIONS_READ: 'sections:read',
  SECTIONS_WRITE: 'sections:write',
  // Enrollments
  ENROLLMENTS_CREATE: 'enrollments:create',
  ENROLLMENTS_READ: 'enrollments:read',
  ENROLLMENTS_DROP: 'enrollments:drop',
  // Grades
  GRADES_WRITE: 'grades:write',
  GRADES_READ: 'grades:read',
  GRADES_CORRECT: 'grades:correct',
  // Holds
  HOLDS_WRITE: 'holds:write',
  HOLDS_READ: 'holds:read',
  // Transcripts
  TRANSCRIPTS_READ: 'transcripts:read',
  // Audit / config
  AUDIT_READ: 'audit:read',
  CONFIG_WRITE: 'config:write',
});

module.exports = { ROLES, PERMISSIONS };
