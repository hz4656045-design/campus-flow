/** Grade controller — assessments, grade entry, finalization, transcript. */
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const validate = require('../middlewares/validate.middleware');
const svc = require('../services/grade.service');

const assessmentTypes = ['quiz', 'assignment', 'midterm', 'final', 'project', 'lab'];

const assessmentSchema = z.object({
  title: z.string().min(1).max(128),
  type: z.enum(assessmentTypes),
  maxScore: z.coerce.number().positive(),
  weight: z.coerce.number().min(0).max(100),
  dueDate: z.string().datetime().optional(),
});

const gradeSchema = z.object({
  enrollmentId: z.coerce.bigint(),
  assessmentId: z.coerce.number().int(),
  score: z.coerce.number().min(0),
});

const bulkGradeSchema = z.object({
  assessmentId: z.coerce.number().int(),
  entries: z.array(
    z.object({
      enrollmentId: z.coerce.bigint(),
      score: z.coerce.number().min(0),
    }),
  ).min(1),
});

const finalizeSchema = z.object({
  enrollmentId: z.coerce.bigint(),
  isCorrection: z.boolean().default(false),
});

const transcriptQuerySchema = z.object({
  studentId: z.coerce.bigint().optional(),
});

// Assessments
const listAssessments = asyncHandler(async (req, res) =>
  res.json(await svc.listAssessments(req.params.sectionId)));
const createAssessment = asyncHandler(async (req, res) =>
  res.status(201).json(
    await svc.createAssessment({ classSectionId: req.params.sectionId, ...assessmentSchema.parse(req.body) }),
  ));

// Grades
const enterGrade = asyncHandler(async (req, res) => {
  // Graded by the current user — RBAC enforces faculty-only at route level
  const body = gradeSchema.parse(req.body);
  res.json(await svc.enterGrade({ ...body, gradedBy: req.user.id }));
});

const bulkEnterGrades = asyncHandler(async (req, res) => {
  const body = bulkGradeSchema.parse(req.body);
  res.json(await svc.bulkEnterGrades({ ...body, gradedBy: req.user.id }));
});

// Finalization
const finalizeGrade = asyncHandler(async (req, res) => {
  const body = finalizeSchema.parse(req.body);
  // Only registrar (or instructor for non-correction) may finalize
  if (body.isCorrection && !req.user.permissions.includes('grades:correct')) {
    throw ApiError.forbidden('NEED_GRADES_CORRECT', 'Grade corrections require grades:correct permission');
  }
  res.status(201).json(await svc.finalizeGrade({ ...body, finalizedBy: req.user.id }));
});

// Transcript
const transcript = asyncHandler(async (req, res) => {
  const { ROLES } = require('../utils/constants');
  let studentId = req.query.studentId;
  if (req.user.roles.includes(ROLES.STUDENT)) {
    // Students may only view their own transcript
    const prisma = require('../config/database');
    const s = await prisma.student.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!s) throw ApiError.notFound('STUDENT_PROFILE_MISSING');
    studentId = s.id;
  } else if (!studentId) {
    throw ApiError.badRequest('STUDENT_ID_REQUIRED', 'studentId query param is required');
  }
  res.json(await svc.transcript(studentId));
});

// Compute semester record (registrar-only job endpoint)
const computeSemesterRecord = asyncHandler(async (req, res) => {
  const studentId = req.query.studentId;
  const semesterId = req.query.semesterId;
  if (!studentId || !semesterId) {
    throw ApiError.badRequest('PARAMS_REQUIRED', 'studentId and semesterId are required');
  }
  res.json(await svc.computeSemesterRecord(studentId, semesterId));
});

module.exports = {
  listAssessments,
  createAssessment: [validate({ body: assessmentSchema }), createAssessment],
  enterGrade: [validate({ body: gradeSchema }), enterGrade],
  bulkEnterGrades: [validate({ body: bulkGradeSchema }), bulkEnterGrades],
  finalizeGrade: [validate({ body: finalizeSchema }), finalizeGrade],
  transcript: [validate({ query: transcriptQuerySchema }), transcript],
  computeSemesterRecord,
};
