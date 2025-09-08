const express = require('express');
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbacMiddleware');
const superadmin = require('../middleware/superadmin');
const {
  getLeadActivities,
  getLeadHistory,
  bulkUpdateLeadActivities,
  bulkDeleteLeadActivities
} = require('../controllers/leadActivityController');

const router = express.Router();

router.get('/:leadId', auth, checkPermission('lead-activities:read'), getLeadActivities);
router.get('/:leadId/history', auth, superadmin, getLeadHistory);
router.post('/bulk-update', auth, checkPermission('lead-activities:bulk-update'), bulkUpdateLeadActivities);
router.post('/bulk-delete', auth, checkPermission('lead-activities:bulk-delete'), bulkDeleteLeadActivities);

module.exports = router;