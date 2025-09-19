const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getDashboardLeadsOverview,
  getUserPerformance,
  getProjectSummary
} = require('../controllers/dashBoardController'); // Adjust path as per your project structure

// Dashboard Stats - GET /api/dashboard/stats
// Query params: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&projectId=...&userId=...&channelPartnerId=...&leadSourceId=...
router.get('/stats', getDashboardStats);

// Dashboard Leads Overview - GET /api/dashboard/leads
// Query params: ?page=1&limit=10&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&projectId=...&userId=...&channelPartnerId=...&leadSourceId=...
router.get('/leads', getDashboardLeadsOverview);

// User Performance - GET /api/dashboard/user-performance
// Query params: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&projectId=...
router.get('/user-performance', getUserPerformance);

// Project Summary - GET /api/dashboard/project-summary
// Query params: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/project-summary', getProjectSummary);

module.exports = router;