/** University structure service: faculties, departments, majors. */
const prisma = require('../config/database');
const ApiError = require('../utils/ApiError');

// --- Faculties -------------------------------------------------------------
async function listFaculties() {
  return prisma.faculty.findMany({
    include: {
      _count: { select: { departments: true } },
      dean: { select: { id: true, employeeNumber: true, user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { name: 'asc' },
  });
}

async function createFaculty({ code, name, deanId, establishedAt }) {
  return prisma.faculty.create({
    data: { code, name, deanId: deanId ? BigInt(deanId) : null, establishedAt: establishedAt ? new Date(establishedAt) : null },
  });
}

async function getFaculty(id) {
  const f = await prisma.faculty.findUnique({
    where: { id: Number(id) },
    include: { departments: true, dean: true },
  });
  if (!f) throw ApiError.notFound('FACULTY_NOT_FOUND', `Faculty ${id} not found`);
  return f;
}

// --- Departments -----------------------------------------------------------
async function listDepartments(facultyId) {
  return prisma.department.findMany({
    where: facultyId ? { facultyId: Number(facultyId) } : {},
    include: {
      faculty: { select: { code: true, name: true } },
      _count: { select: { majors: true, courses: true, facultyMembers: true } },
    },
    orderBy: { name: 'asc' },
  });
}

async function createDepartment({ facultyId, code, name, headId }) {
  return prisma.department.create({
    data: {
      facultyId: Number(facultyId),
      code,
      name,
      headId: headId ? BigInt(headId) : null,
    },
  });
}

async function getDepartment(id) {
  const d = await prisma.department.findUnique({
    where: { id: Number(id) },
    include: { majors: true, courses: true, faculty: true },
  });
  if (!d) throw ApiError.notFound('DEPARTMENT_NOT_FOUND', `Department ${id} not found`);
  return d;
}

// --- Majors ----------------------------------------------------------------
async function listMajors(departmentId) {
  return prisma.major.findMany({
    where: departmentId ? { departmentId: Number(departmentId) } : {},
    include: {
      department: { select: { code: true, name: true, faculty: { select: { code: true } } } },
      _count: { select: { students: true } },
    },
    orderBy: { name: 'asc' },
  });
}

async function createMajor({ departmentId, code, name, degreeLevel }) {
  return prisma.major.create({
    data: { departmentId: Number(departmentId), code, name, degreeLevel },
  });
}

async function getMajor(id) {
  const m = await prisma.major.findUnique({
    where: { id: Number(id) },
    include: { department: true, students: { take: 20, orderBy: { admissionDate: 'desc' } } },
  });
  if (!m) throw ApiError.notFound('MAJOR_NOT_FOUND', `Major ${id} not found`);
  return m;
}

module.exports = {
  listFaculties, createFaculty, getFaculty,
  listDepartments, createDepartment, getDepartment,
  listMajors, createMajor, getMajor,
};
