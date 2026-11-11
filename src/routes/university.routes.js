/** University structure routes — read for all authed; write for registrar/admin. */
const express = require('express');
const router = express.Router();
const uni = require('../controllers/university.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../utils/constants');

router.use(requireAuth);

// Faculties
router.get('/faculties', uni.listFaculties);
router.get('/faculties/:id', uni.getFaculty);
router.post('/faculties', requirePermission(PERMISSIONS.COURSES_WRITE), ...uni.createFaculty);

// Departments
router.get('/departments', uni.listDepartments);
router.get('/departments/:id', uni.getDepartment);
router.post('/departments', requirePermission(PERMISSIONS.COURSES_WRITE), ...uni.createDepartment);

// Majors
router.get('/majors', uni.listMajors);
router.get('/majors/:id', uni.getMajor);
router.post('/majors', requirePermission(PERMISSIONS.COURSES_WRITE), ...uni.createMajor);

module.exports = router;
