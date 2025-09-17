const express = require('express');
const auth = require('../middleware/auth');
const superadmin = require('../middleware/superadmin');
const { checkPermission, checkHierarchy } = require('../middleware/rbacMiddleware');
const { createReporting, getHierarchy,getAllUserReportings, updateReporting, deleteReporting, bulkUpdateUserReportings, bulkDeleteUserReportings } = require('../controllers/userReportingController');

const router = express.Router();

router.post('/', auth, superadmin, createReporting);
router.get('/hierarchy/:userId', auth, checkPermission('reporting:read'), checkHierarchy, getHierarchy);
router.get('/', auth, checkPermission('reporting:read'), getAllUserReportings);
router.put('/:id', auth, superadmin, updateReporting);
router.delete('/:id', auth, superadmin, deleteReporting);
router.post('/bulk-update', auth, superadmin, bulkUpdateUserReportings);
router.post('/bulk-delete', auth, superadmin, bulkDeleteUserReportings);

module.exports = router;