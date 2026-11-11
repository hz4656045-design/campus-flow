/** Scheduling controller — semesters, buildings, rooms, sections, schedules. */
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const svc = require('../services/scheduling.service');

const semesterStatuses = ['planned', 'open', 'closed', 'archived'];
const sectionStatuses = ['planned', 'open', 'closed', 'cancelled'];
const roomTypes = ['lecture', 'lab', 'seminar', 'auditorium'];
const grades = ['A', 'B', 'C', 'D', 'F'];

const semesterSchema = z.object({
  code: z.string().min(1).max(16),
  name: z.string().min(1).max(64),
  startDate: z.string(),
  endDate: z.string(),
  registrationStart: z.string(),
  registrationEnd: z.string(),
  status: z.enum(semesterStatuses).default('planned'),
});

const buildingSchema = z.object({
  code: z.string().min(1).max(16),
  name: z.string().min(1).max(128),
  location: z.string().max(255).optional(),
});

const roomSchema = z.object({
  buildingId: z.coerce.number().int(),
  code: z.string().min(1).max(16),
  name: z.string().min(1).max(64),
  capacity: z.coerce.number().int().min(1),
  type: z.enum(roomTypes),
});

const sectionSchema = z.object({
  courseId: z.coerce.number().int(),
  semesterId: z.coerce.number().int(),
  instructorId: z.string(),
  sectionNumber: z.string().min(1).max(8),
  capacity: z.coerce.number().int().min(1),
  roomId: z.coerce.number().int().optional(),
  status: z.enum(sectionStatuses).default('planned'),
  passingGrade: z.enum(grades).default('D'),
});

const scheduleSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

// Semesters
const listSemesters = asyncHandler(async (req, res) => res.json(await svc.listSemesters(req.query)));
const getSemester = asyncHandler(async (req, res) => res.json(await svc.getSemester(req.params.id)));
const createSemester = asyncHandler(async (req, res) =>
  res.status(201).json(await svc.createSemester(semesterSchema.parse(req.body))));

// Buildings
const listBuildings = asyncHandler(async (_req, res) => res.json(await svc.listBuildings()));
const createBuilding = asyncHandler(async (req, res) =>
  res.status(201).json(await svc.createBuilding(buildingSchema.parse(req.body))));

// Rooms
const listRooms = asyncHandler(async (req, res) => res.json(await svc.listRooms(req.query)));
const createRoom = asyncHandler(async (req, res) =>
  res.status(201).json(await svc.createRoom(roomSchema.parse(req.body))));

// Sections
const listSections = asyncHandler(async (req, res) => res.json(await svc.listSections(req.query)));
const getSection = asyncHandler(async (req, res) => res.json(await svc.getSection(req.params.id)));
const createSection = asyncHandler(async (req, res) =>
  res.status(201).json(await svc.createSection(sectionSchema.parse(req.body))));

// Schedules
const listSchedules = asyncHandler(async (req, res) =>
  res.json(await svc.listSchedules(req.params.sectionId)));
const addSchedule = asyncHandler(async (req, res) =>
  res.status(201).json(
    await svc.addSchedule({ classSectionId: req.params.sectionId, ...scheduleSchema.parse(req.body) }),
  ));

module.exports = {
  listSemesters, getSemester, createSemester: [validate({ body: semesterSchema }), createSemester],
  listBuildings, createBuilding: [validate({ body: buildingSchema }), createBuilding],
  listRooms, createRoom: [validate({ body: roomSchema }), createRoom],
  listSections, getSection, createSection: [validate({ body: sectionSchema }), createSection],
  listSchedules, addSchedule: [validate({ body: scheduleSchema }), addSchedule],
};
