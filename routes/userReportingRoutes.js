const express = require('express');
const auth = require('../middleware/auth');
const superadmin = require('../middleware/superadmin');
const { checkPermission, checkHierarchy } = require('../middleware/rbacMiddleware');
const { createReporting, getHierarchy, updateReporting, deleteReporting, bulkUpdateUserReportings, bulkDeleteUserReportings } = require('../controllers/userReportingController');

const router = express.Router();

router.post('/', auth, superadmin, createReporting);
router.get('/hierarchy/:userId', auth, checkPermission('reporting:read'), checkHierarchy, getHierarchy);
router.put('/:id', auth, superadmin, updateReporting);
router.delete('/:id', auth, superadmin, deleteReporting);
router.post('/bulk-update', auth, superadmin, bulkUpdateUserReportings);
router.post('/bulk-delete', auth, superadmin, bulkDeleteUserReportings);

module.exports = router;