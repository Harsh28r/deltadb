const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Test notification endpoint
router.post('/test-notification', auth, async (req, res) => {
  try {
    const { userId, message } = req.body;

    console.log('🧪 Test notification endpoint called');
    console.log('  userId:', userId);
    console.log('  message:', message);
    console.log('  global.notificationService exists:', !!global.notificationService);

    if (!global.notificationService) {
      return res.status(500).json({
        error: 'Notification service not initialized',
        message: 'global.notificationService is not available'
      });
    }

    const targetUserId = userId || req.user._id.toString();

    await global.notificationService.sendNotification(targetUserId, {
      type: 'test',
      title: 'Test Notification',
      message: message || 'This is a test notification',
      data: {
        testData: 'Hello from test endpoint',
        timestamp: new Date()
      },
      priority: 'normal'
    });

    res.json({
      success: true,
      message: 'Test notification sent',
      targetUserId,
      queueSize: global.notificationService.notificationQueue.length
    });
  } catch (error) {
    console.error('❌ Test notification error:', error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Check notification service status
router.get('/notification-status', auth, (req, res) => {
  res.json({
    notificationServiceAvailable: !!global.notificationService,
    socketManagerAvailable: !!global.socketManager,
    reminderServiceAvailable: !!global.reminderService,
    queueSize: global.notificationService?.notificationQueue?.length || 0,
    batchSize: global.notificationService?.batchSize || 0,
    socketConnections: global.socketManager?.getConnectedUsersCount() || 0
  });
});

module.exports = router;