const express = require('express');
const auth = require('../middleware/auth');
const { checkPermission, checkHierarchy } = require('../middleware/rbacMiddleware');
const { getNotifications, markNotificationRead, bulkDeleteNotifications, bulkUpdateNotifications } = require('../controllers/notificationController');

const router = express.Router();

// router.get('/:userId', auth, checkPermission('notifications:read'), checkHierarchy, getNotifications);
// router.put('/:id/read', auth, checkPermission('notifications:update'), checkHierarchy, markNotificationRead);

router.get('/:userId', auth, checkPermission('notifications:read'), getNotifications);
router.put('/:id/read', auth, checkPermission('notifications:update'), markNotificationRead);
router.post('/bulk-update', auth, checkPermission('notifications:bulk-update'), bulkUpdateNotifications);
router.post('/bulk-delete', auth, checkPermission('notifications:bulk-delete'), bulkDeleteNotifications);

module.exports = router;