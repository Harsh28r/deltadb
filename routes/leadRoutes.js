const express = require('express');
const auth = require('../middleware/auth');
const { checkPermission, checkHierarchy } = require('../middleware/rbacMiddleware');
const { createLead, getLeads, changeLeadStatus, bulkUploadLeads, transferLeads } = require('../controllers/leadController');

const router = express.Router();

router.post('/', auth, checkPermission('leads:create'), createLead);
router.get('/', auth, checkPermission('leads:read'), getLeads);
router.put('/:id/status', auth, checkPermission('leads:update'), changeLeadStatus);
router.post('/bulk-upload', auth, checkPermission('leads:bulk'), bulkUploadLeads);
router.post('/transfer', auth, checkPermission('leads:transfer'), checkHierarchy, transferLeads);

// Add other routes

module.exports = router;