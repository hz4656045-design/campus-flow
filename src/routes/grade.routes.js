/** Grade routes. */
const express = require('express');
const router = express.Router();
const grades = require('../controllers/grade.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../utils/constants');

router.use(requireAuth);

// Assessments (sub-resource of section)
router.get('/sections/:sectionId/assessments', requirePermission(PERMISSIONS.GRADES_READ), grades.listAssessments);
router.post('/sections/:sectionId/assessments', requirePermission(PERMISSIONS.GRADES_WRITE), ...grades.createAssessment);

// Grade entry
router.post('/', requirePermission(PERMISSIONS.GRADES_WRITE), ...grades.enterGrade);
router.post('/bulk', requirePermission(PERMISSIONS.GRADES_WRITE), ...grades.bulkEnterGrades);

// Finalization (faculty or registrar)
router.post('/finalize', requirePermission([PERMISSIONS.GRADES_WRITE, PERMISSIONS.GRADES_CORRECT]), ...grades.finalizeGrade);

// Transcripts
router.get('/transcript', requirePermission(PERMISSIONS.TRANSCRIPTS_READ), ...grades.transcript);

// Compute semester academic record (registrar-only)
router.post(
  '/compute-record',
  requirePermission(PERMISSIONS.GRADES_CORRECT),
  grades.computeSemesterRecord,
);

module.exports = router;
