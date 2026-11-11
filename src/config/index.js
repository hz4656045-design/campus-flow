/** Route aggregator. Mounted at /api by app.js. */
const express = require('express');
const router = express.Router();

router.use('/auth', require('../routes/auth.routes'));
router.use('/users', require('../routes/user.routes'));
router.use('/university', require('../routes/university.routes'));
router.use('/courses', require('../routes/course.routes'));
router.use('/scheduling', require('../routes/scheduling.routes'));
router.use('/enrollments', require('../routes/enrollment.routes'));
router.use('/grades', require('../routes/grade.routes'));