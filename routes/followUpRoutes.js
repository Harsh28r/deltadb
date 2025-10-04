const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbacMiddleware');
const {
  getAllFollowUps,
  getFollowUpStats,
  getTodayFollowUps,
  getFollowUpsByProject
} = require('../controllers/followUpController');

// Get all follow-ups with filters
router.get('/', auth, checkPermission('reminders:read'), getAllFollowUps);

// Get follow-up statistics
router.get('/stats', auth, checkPermission('reminders:read'), getFollowUpStats);

// Get today's follow-ups
router.get('/today', auth, checkPermission('reminders:read'), getTodayFollowUps);

// Get follow-ups by project
router.get('/project/:projectId', auth, checkPermission('reminders:read'), getFollowUpsByProject);

module.exports = router;
