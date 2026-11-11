/**
 * Grade service — assessment management, score entry, finalization, GPA.
 *
 * Lifecycle:
 *   1. Instructor creates Assessments (weights must sum to 100 at finalize time)
 *   2. Instructor enters Grade rows (one per enrollment × assessment)
 *   3. Registrar or Instructor finalizes → FinalGrade row + Enrollment status flip
 *   4. Semester close → AcademicRecord per student per semester
 */
const prisma = require('../config/database');
const ApiError = require('../utils/ApiError');
const gradeScale = require('../utils/gradeScale');
const { computeSemesterGpa, computeCumulativeGpa } = require('../utils/gpaCalculator');

// --- Assessments -----------------------------------------------------------
async function listAssessments(classSectionId) {
  return prisma.assessment.findMany({
    where: { classSectionId: Number(classSectionId) },
    include: { _count: { select: { grades: true } } },
    orderBy: { dueDate: 'asc' },
  });
}

async function createAssessment({
  classSectionId, title, type, maxScore, weight, dueDate,
}) {
  return prisma.assessment.create({
    data: {
      classSectionId: Number(classSectionId),
      title,
      type,
      maxScore: Number(maxScore),
      weight: Number(weight),
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });
}

// --- Grade entry -----------------------------------------------------------
/**
 * Enter or update a single score for (enrollment, assessment).
 * The trigger in prisma/migration_extras.sql guarantees score <= max_score.
 */
async function enterGrade({ enrollmentId, assessmentId, score, gradedBy }) {
  const enr = await prisma.enrollment.findUnique({
    where: { id: BigInt(enrollmentId) },
    include: { classSection: { select: { instructorId: true, status: true } } },
  });
  if (!enr) throw ApiError.notFound('ENROLLMENT_NOT_FOUND', `Enrollment ${enrollmentId} not found`);

  // Only the section's instructor (or registrar override via route) may grade
  if (enr.classSection.instructorId !== BigInt(gradedBy)) {
    throw ApiError.forbidden('NOT_INSTRUCTOR', 'Only the section instructor may enter grades');
  }
  if (enr.classSection.status === 'closed') {
    throw ApiError.badRequest('SECTION_CLOSED', 'Cannot enter grades on a closed section');
  }

  return prisma.grade.upsert({
    where: {
      enrollmentId_assessmentId: {
        enrollmentId: BigInt(enrollmentId),
        assessmentId: Number(assessmentId),
      },
    },
    create: {
      enrollmentId: BigInt(enrollmentId),
      assessmentId: Number(assessmentId),
      score: Number(score),
      gradedById: BigInt(gradedBy),
    },
    update: {
      score: Number(score),
      gradedById: BigInt(gradedBy),
      gradedAt: new Date(),
    },
  });
}

/**
 * Bulk-enter grades for an assessment (roster-style form submission).
 * @param {number} assessmentId
 * @param {Array<{enrollmentId: string, score: number}>} entries
 * @param {string} gradedBy  user id
 */
async function bulkEnterGrades({ assessmentId, entries, gradedBy }) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: Number(assessmentId) },
    include: { classSection: { select: { instructorId: true, status: true } } },
  });
  if (!assessment) throw ApiError.notFound('ASSESSMENT_NOT_FOUND');
  if (assessment.classSection.instructorId !== BigInt(gradedBy)) {
    throw ApiError.forbidden('NOT_INSTRUCTOR');
  }

  return prisma.$transaction(
    entries.map((e) =>
      prisma.grade.upsert({
        where: {
          enrollmentId_assessmentId: {
            enrollmentId: BigInt(e.enrollmentId),
            assessmentId: Number(assessmentId),
          },
        },
        create: {
          enrollmentId: BigInt(e.enrollmentId),
          assessmentId: Number(assessmentId),
          score: Number(e.score),
          gradedById: BigInt(gradedBy),
        },
        update: {
          score: Number(e.score),
          gradedById: BigInt(gradedBy),
          gradedAt: new Date(),
        },
      }),
    ),
  );
}

// --- Finalization ----------------------------------------------------------
/**
 * Finalize the grade for one enrollment.
 * numericGrade = Σ(score / max_score × weight) over the section's assessments
 */
async function finalizeGrade({ enrollmentId, finalizedBy, isCorrection = false }) {
  const enr = await prisma.enrollment.findUnique({
    where: { id: BigInt(enrollmentId) },
    include: {
      classSection: {
        include: {
          assessments: true,
          course: { select: { creditHours: true } },
        },
      },
      grades: true,
    },
  });
  if (!enr) throw ApiError.notFound('ENROLLMENT_NOT_FOUND');

  // Σ weight must equal 100
  const totalWeight = enr.classSection.assessments.reduce((s, a) => s + Number(a.weight), 0);
  if (Math.abs(totalWeight - 100) > 0.01) {
    throw ApiError.badRequest(
      'WEIGHTS_INCOMPLETE',
      `Assessment weights sum to ${totalWeight}, must equal 100`,
    );
  }

  // Compute numeric grade
  let numeric = 0;
  for (const a of enr.classSection.assessments) {
    const g = enr.grades.find((x) => x.assessmentId === a.id);
    if (!g) {
      throw ApiError.badRequest(
        'MISSING_GRADE',
        `Assessment ${a.id} (${a.title}) has no grade for this enrollment`,
      );
    }
    numeric += (Number(g.score) / Number(a.maxScore)) * Number(a.weight);
  }
  numeric = Math.round(numeric * 100) / 100;

  const tier = gradeScale.fromNumeric(numeric);
  const passing = gradeScale.isPassing(tier.letter, enr.classSection.passingGrade);

  // Append-only: always create a new row; isCorrection marks overrides
  const finalGrade = await prisma.finalGrade.create({
    data: {
      enrollmentId: BigInt(enrollmentId),
      numericGrade: numeric,
      letterGrade: tier.letter,
      gpaPoints: tier.points,
      isCorrection,
      finalizedById: BigInt(finalizedBy),
    },
  });

  // Flip enrollment status to terminal
  await prisma.enrollment.update({
    where: { id: BigInt(enrollmentId) },
    data: { status: passing ? 'completed' : 'failed' },
  });

  return finalGrade;
}

// --- GPA / transcript ------------------------------------------------------
/**
 * Recompute and persist the academic record for one student × semester.
 * Idempotent: upserts on (studentId, semesterId).
 */
async function computeSemesterRecord(studentId, semesterId) {
  // Pull all final grades with credit hours via joins
  const rows = await prisma.finalGrade.findMany({
    where: {
      enrollment: {
        studentId: BigInt(studentId),
        classSection: { semesterId: Number(semesterId) },
        status: { in: ['completed', 'failed'] },
      },
    },
    select: {
      gpaPoints: true,
      enrollment: {
        select: {
          classSection: { select: { course: { select: { creditHours: true } } } },
        },
      },
    },
  });

  const flat = rows.map((r) => ({
    gpaPoints: r.gpaPoints,
    creditHours: r.enrollment.classSection.course.creditHours,
  }));

  const { semesterGpa, creditsAttempted, creditsEarned } = computeSemesterGpa(flat);

  // Cumulative across all prior semesters + this one
  const priorRecords = await prisma.academicRecord.findMany({
    where: { studentId: BigInt(studentId), semesterId: { not: Number(semesterId) } },
  });
  const cumulative = computeCumulativeGpa([
    ...priorRecords.map((p) => ({ semesterGpa: Number(p.semesterGpa), creditsAttempted: p.creditsAttempted })),
    { semesterGpa, creditsAttempted },
  ]);

  return prisma.academicRecord.upsert({
    where: {
      studentId_semesterId: {
        studentId: BigInt(studentId),
        semesterId: Number(semesterId),
      },
    },
    create: {
      studentId: BigInt(studentId),
      semesterId: Number(semesterId),
      semesterGpa,
      cumulativeGpa: cumulative,
      creditsAttempted,
      creditsEarned,
    },
    update: {
      semesterGpa,
      cumulativeGpa: cumulative,
      creditsAttempted,
      creditsEarned,
      computedAt: new Date(),
    },
  });
}

/** Full transcript for a student (all semesters). */
async function transcript(studentId) {
  const records = await prisma.academicRecord.findMany({
    where: { studentId: BigInt(studentId) },
    include: { semester: { select: { code: true, name: true, startDate: true, endDate: true } } },
    orderBy: { semester: { startDate: 'asc' } },
  });

  const courseRows = await prisma.enrollment.findMany({
    where: {
      studentId: BigInt(studentId),
      status: { in: ['completed', 'failed'] },
    },
    include: {
      classSection: {
        include: {
          course: { select: { code: true, title: true, creditHours: true } },
          semester: { select: { id: true, code: true } },
        },
      },
      finalGrades: {
        orderBy: { finalizedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { classSection: { semester: { startDate: 'asc' } } },
  });

  // Group course rows by semester
  const bySemester = {};
  for (const r of courseRows) {
    const sid = r.classSection.semester.id;
    if (!bySemester[sid]) bySemester[sid] = [];
    bySemester[sid].push({
      course: r.classSection.course,
      finalGrade: r.finalGrades[0] ?? null,
      status: r.status,
    });
  }

  return records.map((rec) => ({
    semester: rec.semester,
    semesterGpa: rec.semesterGpa,
    cumulativeGpa: rec.cumulativeGpa,
    creditsAttempted: rec.creditsAttempted,
    creditsEarned: rec.creditsEarned,
    courses: bySemester[rec.semesterId] || [],
  }));
}

module.exports = {
  listAssessments, createAssessment,
  enterGrade, bulkEnterGrades,
  finalizeGrade,
  computeSemesterRecord, transcript,
};
