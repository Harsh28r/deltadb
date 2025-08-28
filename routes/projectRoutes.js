const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const superadmin = require('../middleware/superadmin');
const {
  createProject,
  getProjects,
  addMember,
  bulkAddMembers,
  removeMember,
  bulkRemoveMembers,
  checkProjectPermission,
  createUserAndAddToProject,
  assignRoleInProject,
  bulkAssignRoleInProject,
  getAssignableRolesInProject,
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

// Member management
router.post('/members/add', auth, addMember);
router.post('/members/bulk-add', auth, bulkAddMembers);
router.post('/members/remove', auth, removeMember);
router.post('/members/bulk-remove', auth, bulkRemoveMembers);

// User creation and project assignment
router.post('/members/create-and-add', auth, createUserAndAddToProject);

// Dynamic role assignment within projects
router.post('/members/assign-role', auth, assignRoleInProject);
router.post('/members/bulk-assign-role', auth, bulkAssignRoleInProject);
router.get('/:projectId/assignable-roles', auth, getAssignableRolesInProject);

// Project permission check
router.get('/:projectId/permission', auth, checkProjectPermission);

module.exports = router;