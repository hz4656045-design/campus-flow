/**
 * Enrollment service — the heart of the academic workflow.
 *
 * Business rules enforced (matching SRD §3.5):
 *   - Registration window must be open
 *   - No active holds on the student
 *   - Section capacity respected (else waitlist)
 *   - Prerequisites satisfied (min_grade met in prior enrollment)
 *   - At most one active enrollment per (student, section)
 *   - Per-semester credit cap (default 21, overridable per student)
 *
 * NOTE: schedule time-conflict detection is implemented as a pre-insert
 *       check here (no exclusion constraint at the DB layer for cross-section
 *       conflicts). Room/instructor double-booking is enforced via the
 *       GiST exclusion constraint in prisma/migration_extras.sql when the
 *       schema is bootstrapped from logical_schema.sql.
 */
const prisma = require('../config/database');
const ApiError = require('../utils/ApiError');
const toBigInt = require('../utils/toBigInt');

const ACTIVE_STATUSES = ['draft', 'enrolled', 'waitlisted'];
const TERMINAL_STATUSES = ['dropped', 'completed', 'failed'];

/** Load everything we need to evaluate enrollment eligibility in one round-trip. */
async function loadEnrollmentContext(studentId, sectionId) {
  const ctx = await prisma.$transaction([
    prisma.student.findUnique({
      where: { id: toBigInt(studentId) },
      include: {
        registrationHolds: {
          where: { releasedAt: null, heldUntil: { gt: new Date() } },
        },
      },
    }),
    prisma.classSection.findUnique({
      where: { id: Number(sectionId) },
      include: {
        course: { include: { prerequisitesForThis: true } },
        semester: true,
        enrollments: {
          where: { status: { in: ACTIVE_STATUSES } },
          select: { id: true, studentId: true },
        },
        classSchedules: true,
      },
    }),
  ]);

  return { student: ctx[0], section: ctx[1] };
}

/** Has the student passed every prerequisite of the section's course? */
async function checkPrerequisites(student, course) {
  const prereqs = course.prerequisitesForThis; // [{ prerequisiteCourseId, minGrade }]
  if (prereqs.length === 0) return;

  for (const p of prereqs) {
    const prior = await prisma.enrollment.findFirst({
      where: {
        studentId: student.id,
        classSection: { courseId: p.prerequisiteCourseId },
        status: { in: ['completed'] },
        finalGrades: {
          some: { letterGrade: { in: letterAtOrAbove(p.minGrade) } },
        },
      },
      select: { id: true },
    });
    if (!prior) {
      throw ApiError.badRequest(
        'PREREQ_NOT_MET',
        `Prerequisite course ${p.prerequisiteCourseId} not satisfied (min grade ${p.minGrade})`,
      );
    }
  }
}

function letterAtOrAbove(letter) {
  const order = ['F', 'D', 'C', 'B', 'A'];
  const idx = order.indexOf(letter);
  return order.slice(idx);
}

/** Are there schedule time conflicts with the student's existing enrollments? */
async function checkScheduleConflict(studentId, section) {
  if (section.classSchedules.length === 0) return;
  const existing = await prisma.classSchedule.findMany({
    where: {
      classSection: {
        semesterId: section.semesterId,
        enrollments: {
          some: { studentId: toBigInt(studentId), status: { in: ACTIVE_STATUSES } },
        },
      },
    },
  });
  for (const slot of section.classSchedules) {
    for (const ex of existing) {
      if (
        slot.dayOfWeek === ex.dayOfWeek &&
        timeOverlap(slot.startTime, ex.startTime, slot.endTime, ex.endTime)
      ) {
        throw ApiError.badRequest(
          'SCHEDULE_CONFLICT',
          `Time conflict with another section on day ${slot.dayOfWeek}`,
        );
      }
    }
  }
}

function timeOverlap(s1, e1, s2, e2) {
  return new Date(s1) < new Date(e2) && new Date(s2) < new Date(e1);
}

/** Total credits the student is currently registered for this semester. */
async function currentCredits(studentId, semesterId) {
  const rows = await prisma.enrollment.findMany({
    where: {
      studentId: toBigInt(studentId),
      status: { in: ACTIVE_STATUSES },
      classSection: { semesterId: Number(semesterId) },
    },
    select: { classSection: { select: { course: { select: { creditHours: true } } } } },
  });
  return rows.reduce((sum, r) => sum + r.classSection.course.creditHours, 0);
}

/**
 * Attempt to enroll a student in a section.
 * Returns the enrollment row (status = 'enrolled' or 'waitlisted').
 */
async function enroll(studentId, sectionId) {
  const { student, section } = await loadEnrollmentContext(studentId, sectionId);

  if (!student) throw ApiError.notFound('STUDENT_NOT_FOUND', `Student ${studentId} not found`);
  if (!section) throw ApiError.notFound('SECTION_NOT_FOUND', `Section ${sectionId} not found`);

  // 1. Registration window
  if (section.semester.status !== 'open') {
    throw ApiError.badRequest('SEMESTER_NOT_OPEN', `Semester ${section.semester.code} is not open for registration`);
  }
  const now = new Date();
  if (now < section.semester.registrationStart || now > section.semester.registrationEnd) {
    throw ApiError.badRequest('REG_WINDOW_CLOSED', 'Registration window is not open');
  }

  // 2. Holds
  if (student.registrationHolds.length > 0) {
    const h = student.registrationHolds[0];
    throw ApiError.forbidden(
      'REGISTRATION_HOLD',
      `Active hold (${h.holdType}): ${h.reason}`,
    );
  }

  // 3. Prerequisites
  await checkPrerequisites(student, section.course);

  // 4. Schedule conflict
  await checkScheduleConflict(studentId, section);

  // 5. Credit cap
  const credits = await currentCredits(studentId, section.semesterId);
  if (credits + section.course.creditHours > student.creditCap) {
    throw ApiError.badRequest(
      'CREDIT_CAP_EXCEEDED',
      `Enrolling would exceed credit cap (${student.creditCap}). Currently registered: ${credits}.`,
    );
  }

  // 6. Capacity (enrolled vs waitlisted)
  const enrolledCount = section.enrollments.filter(
    (e) => e.studentId !== toBigInt(studentId),
  ).length;
  const isFull = enrolledCount >= section.capacity;

  // 7. Create or upgrade
  const enrollment = await prisma.enrollment.upsert({
    where: {
      studentId_classSectionId: { studentId: toBigInt(studentId), classSectionId: Number(sectionId) },
    },
    create: {
      studentId: toBigInt(studentId),
      classSectionId: Number(sectionId),
      status: isFull ? 'waitlisted' : 'enrolled',
      enrolledAt: new Date(),
    },
    update: {
      // Reactivate a previously-dropped enrollment if room exists
      status: isFull ? 'waitlisted' : 'enrolled',
      droppedAt: null,
      enrolledAt: new Date(),
    },
  });

  return enrollment;
}

/** Drop a section before the semester's end date. */
async function drop(studentId, enrollmentId) {
  const enr = await prisma.enrollment.findUnique({
    where: { id: toBigInt(enrollmentId) },
    include: { classSection: { include: { semester: true } } },
  });
  if (!enr) throw ApiError.notFound('ENROLLMENT_NOT_FOUND', `Enrollment ${enrollmentId} not found`);
  if (enr.studentId !== toBigInt(studentId)) {
    // faculty/registrar override handled in the route layer via RBAC
    throw ApiError.forbidden('NOT_OWNER', 'Cannot drop another student\'s enrollment');
  }
  if (TERMINAL_STATUSES.includes(enr.status)) {
    throw ApiError.badRequest('ALREADY_TERMINAL', `Enrollment already ${enr.status}`);
  }

  const updated = await prisma.enrollment.update({
    where: { id: toBigInt(enrollmentId) },
    data: { status: 'dropped', droppedAt: new Date() },
  });

  // If the dropped seat was enrolled, promote the earliest waitlisted
  if (enr.status === 'enrolled') {
    await promoteWaitlist(enr.classSectionId);
  }

  return updated;
}

async function promoteWaitlist(classSectionId) {
  const next = await prisma.enrollment.findFirst({
    where: { classSectionId: Number(classSectionId), status: 'waitlisted' },
    orderBy: { enrolledAt: 'asc' },
  });
  if (!next) return null;
  return prisma.enrollment.update({
    where: { id: next.id },
    data: { status: 'enrolled', enrolledAt: new Date() },
  });
}

/** List enrollments for a student (optionally scoped to a semester). */
async function listForStudent(studentId, { semesterId, status } = {}) {
  return prisma.enrollment.findMany({
    where: {
      studentId: toBigInt(studentId),
      ...(semesterId ? { classSection: { semesterId: Number(semesterId) } } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      classSection: {
        include: {
          course: { select: { id: true, code: true, title: true, creditHours: true } },
          semester: { select: { id: true, code: true, name: true } },
          instructor: {
            select: { id: true, user: { select: { firstName: true, lastName: true } } },
          },
        },
      },
    },
    orderBy: { enrolledAt: 'desc' },
  });
}

/** Roster for an instructor's section. */
async function roster(classSectionId) {
  return prisma.enrollment.findMany({
    where: { classSectionId: Number(classSectionId), status: { in: ACTIVE_STATUSES } },
    include: {
      student: {
        select: {
          id: true,
          studentNumber: true,
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      },
    },
    orderBy: { student: { studentNumber: 'asc' } },
  });
}

module.exports = { enroll, drop, listForStudent, roster, promoteWaitlist };
