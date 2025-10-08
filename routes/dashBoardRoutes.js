const express = require('express');
const router = express.Router();
const redisCache = require('../utils/redisCache');
const {
  getDashboardStats,
  getDashboardLeadsOverview,
  getUserPerformance,
  getProjectSummary
} = require('../controllers/dashBoardController'); // Adjust path as per your project structure

// Dashboard Stats - GET /api/dashboard/stats (cache for 5 minutes)
// Query params: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&projectId=...&userId=...&channelPartnerId=...&leadSourceId=...
router.get('/stats', redisCache.middleware(300), getDashboardStats);

// Dashboard Leads Overview - GET /api/dashboard/leads (cache for 3 minutes)
// Query params: ?page=1&limit=10&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&projectId=...&userId=...&channelPartnerId=...&leadSourceId=...
router.get('/leads', redisCache.middleware(180), getDashboardLeadsOverview);

// User Performance - GET /api/dashboard/user-performance (cache for 10 minutes)
// Query params: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&projectId=...
router.get('/user-performance', redisCache.middleware(600), getUserPerformance);

// Project Summary - GET /api/dashboard/project-summary (cache for 10 minutes)
// Query params: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/project-summary', redisCache.middleware(600), getProjectSummary);

module.exports = router;