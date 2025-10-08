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

// Get all follow-ups with filters (cache for 5 minutes)
router.get('/', auth, checkPermission('reminders:read'), redisCache.middleware(300), getAllFollowUps);

// Get follow-up statistics (cache for 10 minutes)
router.get('/stats', auth, checkPermission('reminders:read'), redisCache.middleware(600), getFollowUpStats);

// Get today's follow-ups (cache for 2 minutes)
router.get('/today', auth, checkPermission('reminders:read'), redisCache.middleware(120), getTodayFollowUps);

// Get follow-ups by project (cache for 5 minutes)
router.get('/project/:projectId', auth, checkPermission('reminders:read'), redisCache.middleware(300), getFollowUpsByProject);

module.exports = router;
