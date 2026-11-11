/**
 * Grade scale: numeric → letter → GPA points.
 * Default scale per SRD §3.6 (A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F < 60).
 * Configurable per semester via a (future) `grade_scales` table.
 */

const SCALE = [
  { min: 90, letter: 'A', points: 4.0 },
  { min: 80, letter: 'B', points: 3.0 },
  { min: 70, letter: 'C', points: 2.0 },
  { min: 60, letter: 'D', points: 1.0 },
  { min: 0, letter: 'F', points: 0.0 },
];

/**
 * Convert a numeric grade (0-100) to { letter, points }.
 */
function fromNumeric(numeric) {
  if (numeric < 0 || numeric > 100) {
    throw new RangeError(`numeric grade must be 0-100, got ${numeric}`);
  }
  return SCALE.find((tier) => numeric >= tier.min);
}

/**
 * Did the student pass per a section's passing-grade threshold?
 * Pass = letter grade >= passing (using SCALE ordering).
 */
function isPassing(letter, passingLetter = 'D') {
  const order = ['F', 'D', 'C', 'B', 'A']; // ascending
  return order.indexOf(letter) >= order.indexOf(passingLetter);
}

module.exports = { SCALE, fromNumeric, isPassing };
