/** Enrollment routes. */
const express = require('express');
const router = express.Router();
const enr = require('../controllers/enrollment.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../utils/constants');

router.use(requireAuth);

// Student self-enroll: needs enrollments:create
router.post('/sections/:sectionId', requirePermission(PERMISSIONS.ENROLLMENTS_CREATE), enr.enroll);

// Drop: student drops own; registrar/admin can drop on behalf (studentId in query)
router.delete('/:enrollmentId', requirePermission([PERMISSIONS.ENROLLMENTS_DROP, PERMISSIONS.ENROLLMENTS_CREATE]), enr.drop);

// List own enrollments (student) or any (faculty/advisor/registrar)
router.get('/', requirePermission(PERMISSIONS.ENROLLMENTS_READ), enr.myList);

// Roster (instructor + registrar)
router.get('/sections/:sectionId/roster', requirePermission(PERMISSIONS.ENROLLMENTS_READ), enr.roster);

module.exports = router;
