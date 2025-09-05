const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const superadmin = require('../middleware/superadmin');
const { checkPermission } = require('../middleware/permissionMiddleware');
const {
  getUserPermissions,
  updateUserPermissions,
  updateUserRestrictions,
  getUserProjectPermissions,
  setUserProjectPermissions,
  removeUserProjectPermissions,
  getAllUsersPermissions,
  updateUserEffectivePermissions,
  denyRolePermissions,
  allowRolePermissions,
  updateRolePermissions,
  getAllRoles,
  getRoleDetails,
  debugPermissions
} = require('../controllers/permissionController');

// Get current user's permissions
router.get('/my-permissions', auth, getUserPermissions);

// Get specific user's permissions (superadmin only)
router.get('/user/:userId', auth, superadmin, getUserPermissions);

// Update user's custom permissions (superadmin only)
router.put('/user/:userId/permissions', auth, superadmin, updateUserPermissions);

// Update user's effective permissions (simplified - superadmin only)
router.put('/user/:userId/effective-permissions', auth, superadmin, updateUserEffectivePermissions);

// Deny specific role permissions for a user (superadmin only)
router.post('/user/:userId/deny-permissions', auth, superadmin, denyRolePermissions);

// Allow specific role permissions for a user (superadmin only)
router.post('/user/:userId/allow-permissions', auth, superadmin, allowRolePermissions);

// Update user's restrictions (superadmin only)
router.put('/user/:userId/restrictions', auth, superadmin, updateUserRestrictions);

// Get user's project-specific permissions
router.get('/user/:userId/project/:projectId', auth, getUserProjectPermissions);

// Set user's project-specific permissions (superadmin only)
router.put('/user/:userId/project/:projectId', auth, superadmin, setUserProjectPermissions);

// Remove user's project-specific permissions (superadmin only)
router.delete('/user/:userId/project/:projectId', auth, superadmin, removeUserProjectPermissions);

// Get all users with permissions (superadmin only)
router.get('/all-users', auth, superadmin, getAllUsersPermissions);

// Role management endpoints (superadmin only)
router.get('/roles', auth, superadmin, getAllRoles);
router.get('/roles/:roleName', auth, superadmin, getRoleDetails);
router.put('/roles/:roleName/permissions', auth, superadmin, updateRolePermissions);

// Debug endpoint (no auth required for testing)
router.get('/debug', debugPermissions);

// Permission checking endpoints for testing
router.get('/check/:permission', auth, checkPermission('*'), (req, res) => {
  res.json({ 
    success: true, 
    message: `User has permission: ${req.params.permission}`,
    user: {
      id: req.user._id,
      name: req.user.name,
      role: req.user.role,
      level: req.user.level
    }
  });
});

// Project-specific permission checking
router.get('/check/:permission/project/:projectId', auth, checkPermission('*', { projectSpecific: true }), (req, res) => {
  res.json({ 
    success: true, 
    message: `User has permission: ${req.params.permission} for project: ${req.params.projectId}`,
    user: {
      id: req.user._id,
      name: req.user.name,
      role: req.user.role,
      level: req.user.level
    },
    projectId: req.params.projectId
  });
});

module.exports = router;
