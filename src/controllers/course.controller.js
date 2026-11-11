/** Course controller — catalog + prerequisites. */
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const svc = require('../services/course.service');

const levels = ['undergraduate', 'graduate', 'doctoral'];
const grades = ['A', 'B', 'C', 'D', 'F'];

const createCourseSchema = z.object({
  departmentId: z.coerce.number().int(),
  code: z.string().min(1).max(16),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  creditHours: z.coerce.number().int().min(1).max(8),
  level: z.enum(levels),
});

const updateCourseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  creditHours: z.coerce.number().int().min(1).max(8).optional(),
  level: z.enum(levels).optional(),
  isActive: z.boolean().optional(),
});

const prereqSchema = z.object({
  prerequisiteCourseId: z.coerce.number().int(),
  minGrade: z.enum(grades).default('C'),
});

const list = asyncHandler(async (req, res) => res.json(await svc.listCourses(req.query)));
const get = asyncHandler(async (req, res) => res.json(await svc.getCourse(req.params.id)));
const create = asyncHandler(async (req, res) =>
  res.status(201).json(await svc.createCourse(createCourseSchema.parse(req.body))));
const update = asyncHandler(async (req, res) =>
  res.json(await svc.updateCourse(req.params.id, updateCourseSchema.parse(req.body))));

// Prerequisites
const listPrereqs = asyncHandler(async (req, res) =>
  res.json(await svc.listPrerequisites(req.params.id)));
const addPrereq = asyncHandler(async (req, res) =>
  res.status(201).json(await svc.addPrerequisite(req.params.id, req.body.prerequisiteCourseId, req.body.minGrade)));
const removePrereq = asyncHandler(async (req, res) => {
  await svc.removePrerequisite(req.params.id, req.params.prerequisiteCourseId);
  res.status(204).end();
});

module.exports = {
  list, get,
  create: [validate({ body: createCourseSchema }), create],
  update: [validate({ body: updateCourseSchema }), update],
  listPrereqs,
  addPrereq: [validate({ body: prereqSchema }), addPrereq],
  removePrereq,
};
