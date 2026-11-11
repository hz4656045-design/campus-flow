/** University controller — faculties / departments / majors. */
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const svc = require('../services/university.service');

const degreeLevels = ['undergraduate', 'graduate', 'doctoral'];

const facultySchema = z.object({
  code: z.string().min(1).max(16),
  name: z.string().min(1).max(128),
  deanId: z.string().optional(),
  establishedAt: z.string().date().optional(),
});

const departmentSchema = z.object({
  facultyId: z.coerce.number().int(),
  code: z.string().min(1).max(16),
  name: z.string().min(1).max(128),
  headId: z.string().optional(),
});

const majorSchema = z.object({
  departmentId: z.coerce.number().int(),
  code: z.string().min(1).max(16),
  name: z.string().min(1).max(128),
  degreeLevel: z.enum(degreeLevels),
});

// Faculties
const listFaculties = asyncHandler(async (_req, res) => res.json(await svc.listFaculties()));
const getFaculty = asyncHandler(async (req, res) => res.json(await svc.getFaculty(req.params.id)));
const createFaculty = asyncHandler(async (req, res) =>
  res.status(201).json(await svc.createFaculty(facultySchema.parse(req.body))));

// Departments
const listDepartments = asyncHandler(async (req, res) =>
  res.json(await svc.listDepartments(req.query.facultyId)));
const getDepartment = asyncHandler(async (req, res) =>
  res.json(await svc.getDepartment(req.params.id)));
const createDepartment = asyncHandler(async (req, res) =>
  res.status(201).json(await svc.createDepartment(departmentSchema.parse(req.body))));

// Majors
const listMajors = asyncHandler(async (req, res) =>
  res.json(await svc.listMajors(req.query.departmentId)));
const getMajor = asyncHandler(async (req, res) =>
  res.json(await svc.getMajor(req.params.id)));
const createMajor = asyncHandler(async (req, res) =>
  res.status(201).json(await svc.createMajor(majorSchema.parse(req.body))));

module.exports = {
  listFaculties, getFaculty, createFaculty: [validate({ body: facultySchema }), createFaculty],
  listDepartments, getDepartment, createDepartment: [validate({ body: departmentSchema }), createDepartment],
  listMajors, getMajor, createMajor: [validate({ body: majorSchema }), createMajor],
};
