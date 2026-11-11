/** Auth routes. */
const express = require('express');
const router = express.Router();
const auth = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

router.post('/login', ...auth.login);
router.post('/refresh', ...auth.refresh);
router.post('/logout', auth.logout);
router.get('/me', requireAuth, auth.me);

module.exports = router;
