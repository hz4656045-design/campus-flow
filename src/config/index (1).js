/** Route aggregator. Mounted at /api by app.js. */
const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/university', require('./university.routes'));
router.use('/courses', require('./course.routes'));
router.use('/scheduling', require('./scheduling.routes'));
router.use('/enrollments', require('./enrollment.routes'));
router.use('/grades', require('./grade.routes'));

module.exports = router;
