const express = require('express');
const router = express.Router();
const { registerUser, loginUser,  registerManager, registerSales, initSuperadmin, createRole, editRole, deleteRole, listRoles, createUserWithRole, editUserWithRole, deleteUserWithRole, getUserById, adminLogin, currentUser, getUsersByRole, getAllUsersGroupedByRole, getUserHistory, getUserTimeline, getAllUsersWithHistory, updateSuperadminPermissions } = require('../controllers/superadminController');
const superadmin = require('../middleware/superadmin');

// Public routes (no authentication required)
router.post('/register', registerUser);
router.post('/register/manager', registerManager);
router.post('/register/sales', registerSales);
router.post('/login', loginUser);
router.post('/admin-login', adminLogin);
router.post('/init-superadmin', initSuperadmin);

// Superadmin only routes
router.post('/roles', superadmin, createRole);
router.put('/roles/:roleName', superadmin, editRole);
router.delete('/roles/:roleName', superadmin, deleteRole);
router.get('/roles', superadmin, listRoles);

// Update superadmin permissions
router.put('/superadmin/permissions', superadmin, updateSuperadminPermissions);

router.post('/create-user', superadmin, createUserWithRole);

// User management routes
router.get('/users/by-role', superadmin, getAllUsersGroupedByRole);

// Individual user management
router.get('/users/:userId', superadmin, getUserById);
router.put('/users/:userId', superadmin, editUserWithRole);
router.delete('/users/:userId', superadmin, deleteUserWithRole);

// User history and project assignments
router.get('/users/:userId/history', superadmin, getUserHistory);
router.get('/users/:userId/timeline', superadmin, getUserTimeline);
router.get('/users/history/all', superadmin, getAllUsersWithHistory);

// Who am I
router.get('/me', superadmin, currentUser);

module.exports = router;
