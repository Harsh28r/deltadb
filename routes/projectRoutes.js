const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const superadmin = require('../middleware/superadmin');
const authorize = require('../middleware/authorize');
const {
  createProject,
  getProjects,
  addMember,
  bulkAddMembers,
  removeMember,
  bulkRemoveMembers,
  checkProjectPermission,
  createUserAndAddToProject,
} = require('../controllers/projectController');

// Project creation requires authentication
router.post('/', auth, createProject);
// Project listing is public - no authentication required
router.get('/', getProjects);

// Debug route to check if projects exist
router.get('/debug/all', superadmin, async (req, res) => {
  try {
    const Project = require('../models/Project');
    const projects = await Project.find({});
    res.json({ 
      count: projects.length, 
      projects: projects.map(p => ({ id: p._id, name: p.name, members: p.members }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post('/members/add', superadmin, authorize('manage_project'), addMember);
router.post('/members/add-bulk',  superadmin, authorize('manage_project'), bulkAddMembers);
router.post('/members/remove',  superadmin, authorize('manage_project'), removeMember);
router.post('/members/remove-bulk',  superadmin, authorize('manage_project'), bulkRemoveMembers);

// Create a user (by email if not exists) and add to a project in one call
router.post('/members/create-and-add', auth, authorize('manage_project'), createUserAndAddToProject);

// Permission check endpoints (examples)
router.get('/:projectId/can/view-team-dashboard', auth, authorize('view_team_dashboard'), checkProjectPermission);
router.get('/:projectId/can/view-sales-data', auth, authorize('view_sales_data'), checkProjectPermission);

module.exports = router;