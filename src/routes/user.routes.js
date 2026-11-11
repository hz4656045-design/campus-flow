/** User routes — admin-only. */
const express = require('express');
const router = express.Router();
const users = require('../controllers/user.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../utils/constants');

router.use(requireAuth);

router.get('/', requirePermission(PERMISSIONS.USERS_READ), users.list);
router.get('/:id', requirePermission(PERMISSIONS.USERS_READ), users.getById);
router.post('/', requirePermission(PERMISSIONS.USERS_WRITE), ...users.create);
router.put('/:id', requirePermission(PERMISSIONS.USERS_WRITE), ...users.update);
router.delete('/:id', requirePermission(PERMISSIONS.USERS_WRITE), users.deactivate);

module.exports = router;
