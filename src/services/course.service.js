/** Course catalog + prerequisites service. */
const prisma = require('../config/database');
const ApiError = require('../utils/ApiError');

async function listCourses({ departmentId, level, active } = {}) {
  return prisma.course.findMany({
    where: {
      ...(departmentId ? { departmentId: Number(departmentId) } : {}),
      ...(level ? { level } : {}),
      ...(active !== undefined ? { isActive: active === 'true' } : {}),
    },
    include: {
      department: { select: { code: true, name: true, faculty: { select: { code: true } } } },
      _count: { select: { classSections: true, prerequisitesForThis: true } },
    },
    orderBy: [{ code: 'asc' }],
  });
}

async function getCourse(id) {
  const c = await prisma.course.findUnique({
    where: { id: Number(id) },
    include: {
      department: true,
      prerequisitesForThis: {
        include: { prerequisiteCourse: { select: { id: true, code: true, title: true } } },
      },
      prerequisitesAsPrereq: {
        include: { course: { select: { id: true, code: true, title: true } } },
      },
    },
  });
  if (!c) throw ApiError.notFound('COURSE_NOT_FOUND', `Course ${id} not found`);
  return c;
}

async function createCourse({ departmentId, code, title, description, creditHours, level }) {
  return prisma.course.create({
    data: {
      departmentId: Number(departmentId),
      code,
      title,
      description,
      creditHours: Number(creditHours),
      level,
    },
  });
}

async function updateCourse(id, patch) {
  const existing = await prisma.course.findUnique({ where: { id: Number(id) } });
  if (!existing) throw ApiError.notFound('COURSE_NOT_FOUND', `Course ${id} not found`);
  return prisma.course.update({
    where: { id: Number(id) },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.creditHours !== undefined ? { creditHours: Number(patch.creditHours) } : {}),
      ...(patch.level !== undefined ? { level: patch.level } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
    },
  });
}

// --- Prerequisites (self-ref M:N) ----------------------------------------
async function addPrerequisite(courseId, prerequisiteCourseId, minGrade = 'C') {
  if (Number(courseId) === Number(prerequisiteCourseId)) {
    throw ApiError.badRequest('SELF_PREREQ', 'A course cannot be a prerequisite of itself');
  }
  return prisma.prerequisite.create({
    data: {
      courseId: Number(courseId),
      prerequisiteCourseId: Number(prerequisiteCourseId),
      minGrade,
    },
  });
}

async function listPrerequisites(courseId) {
  return prisma.prerequisite.findMany({
    where: { courseId: Number(courseId) },
    include: {
      prerequisiteCourse: { select: { id: true, code: true, title: true, creditHours: true } },
    },
  });
}

async function removePrerequisite(courseId, prerequisiteCourseId) {
  return prisma.prerequisite.delete({
    where: {
      courseId_prerequisiteCourseId: {
        courseId: Number(courseId),
        prerequisiteCourseId: Number(prerequisiteCourseId),
      },
    },
  });
}

module.exports = {
  listCourses, getCourse, createCourse, updateCourse,
  addPrerequisite, listPrerequisites, removePrerequisite,
};
