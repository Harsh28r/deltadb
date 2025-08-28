const express = require('express');
const auth = require('../middleware/auth');
const { checkPermission, checkHierarchy } = require('../middleware/rbacMiddleware');
const { getNotifications, markNotificationRead } = require('../controllers/notificationController');

const router = express.Router();

// router.get('/:userId', auth, checkPermission('notifications:read'), checkHierarchy, getNotifications);
// router.put('/:id/read', auth, checkPermission('notifications:update'), checkHierarchy, markNotificationRead);

router.get('/:userId', auth, checkPermission('notifications:read'), getNotifications);
router.put('/:id/read', auth, checkPermission('notifications:update'), markNotificationRead);

module.exports = router;