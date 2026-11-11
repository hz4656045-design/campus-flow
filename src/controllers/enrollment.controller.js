/** Enrollment controller. */
const { z } = require('zod');
const prisma = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const svc = require('../services/enrollment.service');

/**
 * Resolve the student profile for the current user.
 * Students act on their own profile; faculty/registrar/admin must pass ?studentId=.
 */
async function resolveStudentId(req) {
  const { ROLES } = require('../utils/constants');
  if (req.user.roles.includes(ROLES.STUDENT)) {
    const s = await prisma.student.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!s) throw ApiError.notFound('STUDENT_PROFILE_MISSING', 'Your user has no student profile');
    return s.id;
  }
  // Faculty / registrar / admin acting on behalf
  const sid = req.params.studentId || req.body.studentId || req.query.studentId;
  if (!sid) throw ApiError.badRequest('STUDENT_ID_REQUIRED', 'studentId is required for this role');
  return BigInt(sid);
}

const enroll = asyncHandler(async (req, res) => {
  const studentId = await resolveStudentId(req);
  const enrollment = await svc.enroll(studentId, req.params.sectionId);
  res.status(201).json(enrollment);
});

const drop = asyncHandler(async (req, res) => {
  const studentId = await resolveStudentId(req);
  const updated = await svc.drop(studentId, req.params.enrollmentId);
  res.json(updated);
});

const myList = asyncHandler(async (req, res) => {
  const studentId = await resolveStudentId(req);
  res.json(await svc.listForStudent(studentId, req.query));
});

const roster = asyncHandler(async (req, res) => {
  res.json(await svc.roster(req.params.sectionId));
});

module.exports = { enroll, drop, myList, roster };
