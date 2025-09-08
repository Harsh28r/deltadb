const express = require('express');
const auth = require('../middleware/auth');
const { checkPermission, checkHierarchy } = require('../middleware/rbacMiddleware');
const {
  createLead,
  getLeads,
  editLead,
  deleteLead,
  changeLeadStatus,
  bulkUploadLeads,
  bulkTransferLeads,
  bulkDeleteLeads
} = require('../controllers/leadController');

const router = express.Router();

// Create a new lead
router.post('/', auth, checkPermission('leads:create'), createLead);

// Get all leads (with optional projectId filter)
router.get('/', auth, checkPermission('leads:read'), getLeads);
router.put('/:id', auth, checkPermission('leads:update'), checkHierarchy, editLead);
router.delete('/:id', auth, checkPermission('leads:delete'), checkHierarchy, deleteLead);
router.put('/:id/status', auth, checkPermission('leads:update'), checkHierarchy, changeLeadStatus);
router.post('/bulk-upload', auth, checkPermission('leads:bulk'), bulkUploadLeads);
router.post('/bulk-transfer', auth, checkPermission('leads:transfer'), checkHierarchy, bulkTransferLeads);
router.post('/bulk-delete', auth, checkPermission('leads:bulk-delete'), checkHierarchy, bulkDeleteLeads);

module.exports = router;