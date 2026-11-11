/**
 * API route aggregator.
 *
 * Mounted at /api in src/app.js. Each sub-router is responsible for its own
 * auth + RBAC guards, so we just wire prefixes → routers here.
 *
 *   GET  /api            → lightweight service map (no auth)
 *   /api/auth            → login / refresh / logout / me
 *   /api/users           → admin user CRUD
 *   /api/university      → faculties / departments / majors
 *   /api/courses         → catalog + prerequisites
 *   /api/scheduling      → semesters / buildings / rooms / sections / schedules
 *   /api/enrollments     → enroll / drop / roster
 *   /api/grades          → assessments / grades / finalize / transcript
 */
const express = require('express');
const router = express.Router();

const auth = require('./auth.routes');
const users = require('./user.routes');
const university = require('./university.routes');
const courses = require('./course.routes');
const scheduling = require('./scheduling.routes');
const enrollments = require('./enrollment.routes');
const grades = require('./grade.routes');

// Public service map (no auth) — handy for discoverability / smoke tests.
router.get('/', (_req, res) => {
  res.json({
    name: 'Campus Flow API',
    version: '1.0.0',
    endpoints: [
      '/auth',
      '/users',
      '/university',
      '/courses',
      '/scheduling',
      '/enrollments',
      '/grades',
    ],
    health: ['/health/live', '/health/ready'],
  });
});

router.use('/auth', auth);
router.use('/users', users);
router.use('/university', university);
router.use('/courses', courses);
router.use('/scheduling', scheduling);
router.use('/enrollments', enrollments);
router.use('/grades', grades);

module.exports = router;
