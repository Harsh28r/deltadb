const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { checkPermission, checkHierarchy } = require('../middleware/rbacMiddleware');
const {
  getNotifications,
  markNotificationRead,
  bulkUpdateNotifications,
  bulkDeleteNotifications
} = require('../controllers/notificationController');

router.get('/:userId', auth, checkPermission('notifications:read'), checkHierarchy, getNotifications);
router.put('/:id/read', auth, checkPermission('notifications:update'), checkHierarchy, markNotificationRead);
router.post('/bulk-update', auth, checkPermission('notifications:bulk-update'), checkHierarchy, bulkUpdateNotifications);
router.post('/bulk-delete', auth, checkPermission('notifications:bulk-delete'), checkHierarchy, bulkDeleteNotifications);

module.exports = router;