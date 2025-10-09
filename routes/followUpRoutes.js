const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbacMiddleware');
const redisCache = require('../utils/redisCache');
const {
  getAllFollowUps,
  getFollowUpStats,
  getTodayFollowUps,
  getFollowUpsByProject
} = require('../controllers/followUpController');

// Get all follow-ups with filters (no cache for real-time updates)
router.get('/', auth, checkPermission('reminders:read'), getAllFollowUps);

// Get follow-up statistics (no cache for real-time updates)
router.get('/stats', auth, checkPermission('reminders:read'), getFollowUpStats);

// Get today's follow-ups (no cache for real-time updates)
router.get('/today', auth, checkPermission('reminders:read'), getTodayFollowUps);

// Get follow-ups by project (no cache for real-time updates)
router.get('/project/:projectId', auth, checkPermission('reminders:read'), getFollowUpsByProject);

module.exports = router;
