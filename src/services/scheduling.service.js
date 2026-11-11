/** Scheduling service: semesters, buildings, rooms, class sections, schedules. */
const prisma = require('../config/database');
const ApiError = require('../utils/ApiError');

// --- Semesters -------------------------------------------------------------
async function listSemesters({ status } = {}) {
  return prisma.semester.findMany({
    where: status ? { status } : {},
    orderBy: { startDate: 'desc' },
  });
}

async function getSemester(id) {
  const s = await prisma.semester.findUnique({ where: { id: Number(id) } });
  if (!s) throw ApiError.notFound('SEMESTER_NOT_FOUND', `Semester ${id} not found`);
  return s;
}

async function createSemester(data) {
  return prisma.semester.create({
    data: {
      code: data.code,
      name: data.name,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      registrationStart: new Date(data.registrationStart),
      registrationEnd: new Date(data.registrationEnd),
      status: data.status || 'planned',
    },
  });
}

// --- Buildings / Rooms -----------------------------------------------------
async function listBuildings() {
  return prisma.building.findMany({
    include: { _count: { select: { rooms: true } } },
    orderBy: { name: 'asc' },
  });
}

async function createBuilding({ code, name, location }) {
  return prisma.building.create({ data: { code, name, location } });
}

async function listRooms({ buildingId, type } = {}) {
  return prisma.room.findMany({
    where: {
      ...(buildingId ? { buildingId: Number(buildingId) } : {}),
      ...(type ? { type } : {}),
    },
    include: { building: { select: { code: true, name: true } } },
    orderBy: [{ buildingId: 'asc' }, { code: 'asc' }],
  });
}

async function createRoom({ buildingId, code, name, capacity, type }) {
  return prisma.room.create({
    data: { buildingId: Number(buildingId), code, name, capacity: Number(capacity), type },
  });
}

// --- Class sections --------------------------------------------------------
async function listSections({ semesterId, courseId, instructorId, status } = {}) {
  return prisma.classSection.findMany({
    where: {
      ...(semesterId ? { semesterId: Number(semesterId) } : {}),
      ...(courseId ? { courseId: Number(courseId) } : {}),
      ...(instructorId ? { instructorId: BigInt(instructorId) } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      course: { select: { id: true, code: true, title: true, creditHours: true } },
      semester: { select: { id: true, code: true, name: true } },
      instructor: {
        select: { id: true, employeeNumber: true, user: { select: { firstName: true, lastName: true } } },
      },
      room: { select: { id: true, code: true, name: true, capacity: true } },
      _count: { select: { enrollments: true, classSchedules: true, assessments: true } },
    },
    orderBy: [{ semesterId: 'desc' }, { courseId: 'asc' }, { sectionNumber: 'asc' }],
  });
}

async function getSection(id) {
  const s = await prisma.classSection.findUnique({
    where: { id: Number(id) },
    include: {
      course: true,
      semester: true,
      instructor: { include: { user: { select: { firstName: true, lastName: true } } } },
      room: { include: { building: true } },
      classSchedules: { orderBy: { dayOfWeek: 'asc' } },
      assessments: { orderBy: { dueDate: 'asc' } },
    },
  });
  if (!s) throw ApiError.notFound('SECTION_NOT_FOUND', `Section ${id} not found`);
  return s;
}

async function createSection({
  courseId, semesterId, instructorId, sectionNumber,
  capacity, roomId, status = 'planned', passingGrade = 'D',
}) {
  return prisma.classSection.create({
    data: {
      courseId: Number(courseId),
      semesterId: Number(semesterId),
      instructorId: BigInt(instructorId),
      sectionNumber,
      capacity: Number(capacity),
      roomId: roomId ? Number(roomId) : null,
      status,
      passingGrade,
    },
  });
}

// --- Class schedules (weekly time slots) ----------------------------------
async function addSchedule({ classSectionId, dayOfWeek, startTime, endTime }) {
  return prisma.classSchedule.create({
    data: {
      classSectionId: Number(classSectionId),
      dayOfWeek: Number(dayOfWeek),
      startTime: new Date(`1970-01-01T${startTime}Z`),
      endTime: new Date(`1970-01-01T${endTime}Z`),
    },
  });
}

async function listSchedules(classSectionId) {
  return prisma.classSchedule.findMany({
    where: { classSectionId: Number(classSectionId) },
    orderBy: { dayOfWeek: 'asc' },
  });
}

module.exports = {
  listSemesters, getSemester, createSemester,
  listBuildings, createBuilding,
  listRooms, createRoom,
  listSections, getSection, createSection,
  addSchedule, listSchedules,
};
