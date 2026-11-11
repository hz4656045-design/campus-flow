/** Course routes — catalog read for all authed; write for registrar/admin. */
const express = require('express');
const router = express.Router();
const courses = require('../controllers/course.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../utils/constants');

router.use(requireAuth);

router.get('/', courses.list);
router.get('/:id', courses.get);
router.post('/', requirePermission(PERMISSIONS.COURSES_WRITE), ...courses.create);
router.put('/:id', requirePermission(PERMISSIONS.COURSES_WRITE), ...courses.update);

// Prerequisites (sub-resource of :id)
router.get('/:id/prerequisites', courses.listPrereqs);
router.post('/:id/prerequisites', requirePermission(PERMISSIONS.COURSES_WRITE), ...courses.addPrereq);
router.delete(
  '/:id/prerequisites/:prerequisiteCourseId',
  requirePermission(PERMISSIONS.COURSES_WRITE),
  courses.removePrereq,
);

module.exports = router;
