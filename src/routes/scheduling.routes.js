/** Scheduling routes — read for all authed; write for registrar/admin. */
const express = require('express');
const router = express.Router();
const sch = require('../controllers/scheduling.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../utils/constants');

router.use(requireAuth);

// Semesters
router.get('/semesters', sch.listSemesters);
router.get('/semesters/:id', sch.getSemester);
router.post('/semesters', requirePermission(PERMISSIONS.SECTIONS_WRITE), ...sch.createSemester);

// Buildings
router.get('/buildings', sch.listBuildings);
router.post('/buildings', requirePermission(PERMISSIONS.SECTIONS_WRITE), ...sch.createBuilding);

// Rooms
router.get('/rooms', sch.listRooms);
router.post('/rooms', requirePermission(PERMISSIONS.SECTIONS_WRITE), ...sch.createRoom);

// Class sections
router.get('/sections', sch.listSections);
router.get('/sections/:id', sch.getSection);
router.post('/sections', requirePermission(PERMISSIONS.SECTIONS_WRITE), ...sch.createSection);

// Schedules (sub-resource of section)
router.get('/sections/:sectionId/schedules', sch.listSchedules);
router.post('/sections/:sectionId/schedules', requirePermission(PERMISSIONS.SECTIONS_WRITE), ...sch.addSchedule);

module.exports = router;
