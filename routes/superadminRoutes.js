const express = require('express');
const router = express.Router();
const { registerUser, loginUser,  registerManager, registerSales, initSuperadmin, createRole, editRole, deleteRole, listRoles, createUserWithRole, createUserWithProjects, getUsersWithProjects, editUserWithRole, deleteUserWithRole, getUserById, adminLogin, currentUser, getUsersByRole, getAllUsersGroupedByRole, getUserHistory, getUserTimeline, getAllUsersWithHistory, updateSuperadminPermissions, updateUserProjects, deleteUserProjects, assignProjectsToUser, getUserProjectsAssignment, getindividualRoleById, updateUserCustomPermissions, addUserCustomPermission, removeUserCustomPermission, getUserEffectivePermissions, checkUserPermission, updateUserPermissionsDirect, updateAllUsersWithRolePermissions } = require('../controllers/superadminController');
const superadmin = require('../middleware/superadmin');


// Public routes (no authentication required)
// router.post('/register', registerUser);
// router.post('/register/manager', registerManager);
// router.post('/register/sales', registerSales);


router.post('/login', loginUser);
router.post('/admin-login', adminLogin);
router.post('/init-superadmin', initSuperadmin);

// Superadmin only routes
router.post('/roles', superadmin, createRole);
router.put('/roles/:roleName', superadmin, editRole);
router.delete('/roles/:roleName', superadmin, deleteRole);
router.get('/roles', superadmin, listRoles);
// router.get('/roles/:roleName', superadmin, getindividualRole);
router.get('/roles/:roleId', superadmin, getindividualRoleById);

// Update superadmin permissions
router.put('/superadmin/permissions', superadmin, updateSuperadminPermissions);

router.post('/create-user', superadmin, createUserWithRole);
router.post('/create-user-with-projects', superadmin, createUserWithProjects);

// User management routes
router.get('/users/with-projects', superadmin, getUsersWithProjects);
router.get('/users/by-role', superadmin, getAllUsersGroupedByRole);

// Update user's project assignments
router.put('/update-user-projects', superadmin, updateUserProjects);
router.delete('/delete-user-projects', superadmin, deleteUserProjects);
router.post('/assign-projects-to-user', superadmin, assignProjectsToUser);
router.delete('/get-user-projects-assignment/:userId', superadmin, getUserProjectsAssignment);

// Individual user management
router.get('/users/:userId', superadmin, getUserById);
router.put('/users/:userId', superadmin, editUserWithRole);
router.delete('/users/:userId', superadmin, deleteUserWithRole);

// User history and project assignments
router.get('/users/:userId/history', superadmin, getUserHistory);
router.get('/users/:userId/timeline', superadmin, getUserTimeline);
router.get('/users/history/all', superadmin, getAllUsersWithHistory);

// Custom permissions management
router.put('/users/:userId/custom-permissions', superadmin, updateUserCustomPermissions);
router.post('/users/:userId/custom-permissions/add', superadmin, addUserCustomPermission);
router.post('/users/:userId/custom-permissions/remove', superadmin, removeUserCustomPermission);
router.get('/users/:userId/effective-permissions', superadmin, getUserEffectivePermissions);
router.post('/users/:userId/check-permission', superadmin, checkUserPermission);
// Simple direct permission update
router.put('/users/:userId/permissions', superadmin, updateUserPermissionsDirect);

// Update all users with role permissions (one-time migration)
router.post('/update-all-users-permissions', superadmin, updateAllUsersWithRolePermissions);

// Who am I
router.get('/me', superadmin, currentUser);

module.exports = router;
