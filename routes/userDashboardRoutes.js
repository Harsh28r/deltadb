const express = require('express');
const auth = require('../middleware/auth');
const { 
  getUserDashboard, 
  getUserProjects, 
  getUserLeads, 
  getUserNotifications, 
  markNotificationAsRead, 
  getUserProfile, 
  updateUserProfile 
} = require('../controllers/userDashboardController');
const router = express.Router();

// All routes require authentication
router.use(auth);

// Dashboard routes
router.get('/dashboard', getUserDashboard);
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);
router.get('/projects', getUserProjects);
router.get('/leads', getUserLeads);
router.get('/notifications', getUserNotifications);
router.put('/notifications/:notificationId/read', markNotificationAsRead);

module.exports = router;
