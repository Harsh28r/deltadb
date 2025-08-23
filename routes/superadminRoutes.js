const express = require('express');
const router = express.Router();
const { registerUser, loginUser,  registerManager, registerSales, initSuperadmin, createRole, editRole, deleteRole, listRoles, createUserWithRole, adminLogin, currentUser, getUsersByRole, getAllUsersGroupedByRole } = require('../controllers/superadminController');
const superadmin = require('../middleware/superadmin');


// Public auth
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/login', loginUser); // GET variant using query params
router.post('/admin-login', adminLogin); // direct superadmin login with fixed admin pass
router.get('/admin-login', adminLogin); // GET variant using query params

// Superadmin-only creates
// router.post('/register-superadmin', superadmin, registerSuperadmin);
router.post('/create-manager', superadmin, registerManager);
router.post('/create-sales', superadmin, registerSales);


router.post('/roles', superadmin, createRole);
router.get('/roles', superadmin, listRoles);
router.put('/roles/:roleName', superadmin, editRole);
router.delete('/roles/:roleName', superadmin, deleteRole);
router.post('/create-user', superadmin, createUserWithRole);

// User management by role
router.get('/users/role/:roleName', superadmin, getUsersByRole);
router.get('/users/by-role', superadmin, getAllUsersGroupedByRole);

// Who am I
router.get('/me', superadmin, currentUser);

// One-time setup to create first superadmin if none exists
router.post('/init-superadmin', initSuperadmin);

module.exports = router;
