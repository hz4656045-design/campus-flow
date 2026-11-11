/**
 * GPA computation helpers (SRD §3.6).
 *
 *  semesterGPA    = Σ(gpaPoints × creditHours) / Σ(creditHours)
 *  cumulativeGPA  = same, but across all completed semesters
 *
 * Inputs are rows from `finalGrades` joined to the course's `credit_hours`
 * via enrollment → class_section → course.
 */

/**
 * Compute semester GPA from a list of grade rows.
 * @param {Array<{gpaPoints: number, creditHours: number}>} rows
 * @returns {{ semesterGpa: number, creditsAttempted: number, creditsEarned: number }}
 */
function computeSemesterGpa(rows) {
  let earnedPts = 0; // Σ(gpa × credits)
  let attempted = 0;
  let earned = 0;

  for (const r of rows) {
    attempted += r.creditHours;
    earnedPts += Number(r.gpaPoints) * r.creditHours;
    if (Number(r.gpaPoints) > 0) earned += r.creditHours;
  }

  const semesterGpa = attempted === 0 ? 0 : earnedPts / attempted;
  return {
    semesterGpa: round(semesterGpa, 3),
    creditsAttempted: attempted,
    creditsEarned: earned,
  };
}

/**
 * Recompute cumulative GPA across all semesters' academic_records.
 * @param {Array<{semesterGpa: number, creditsAttempted: number}>} records
 */
function computeCumulativeGpa(records) {
  let earnedPts = 0;
  let attempted = 0;
  for (const r of records) {
    attempted += r.creditsAttempted;
    earnedPts += r.semesterGpa * r.creditsAttempted;
  }
  return round(attempted === 0 ? 0 : earnedPts / attempted, 3);
}

function round(n, decimals = 3) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

module.exports = { computeSemesterGpa, computeCumulativeGpa, round };
