const express = require('express');
const auth = require('../middleware/auth');
const { checkPermission, checkHierarchy } = require('../middleware/rbacMiddleware');
const {
  createLead,
  getLeads,
  getLeadById,
  editLead,
  deleteLead,
  changeLeadStatus,
  bulkUploadLeads,
  bulkTransferLeads,
  bulkDeleteLeads
} = require('../controllers/leadController');

const router = express.Router();

// Create a new lead
router.post('/', auth, checkPermission('leads:create'), checkHierarchy, createLead);

// Get all leads (with optional projectId filter)
router.get('/', auth, checkPermission('leads:read'), checkHierarchy, getLeads);
router.get('/:id', auth, checkPermission('leads:read'), checkHierarchy, getLeadById);
router.put('/:id', auth, checkPermission('leads:update'), editLead);
router.delete('/:id', auth, checkPermission('leads:delete'), deleteLead);
router.put('/:id/status', auth, checkPermission('leads:status:update'), changeLeadStatus);
router.post('/bulk-upload', auth, checkPermission('leads:bulk'), bulkUploadLeads);
router.post('/bulk-transfer', auth, checkPermission('leads:transfer'), checkHierarchy, bulkTransferLeads);
router.post('/bulk-delete', auth, checkPermission('leads:bulk-delete'), checkHierarchy, bulkDeleteLeads);

module.exports = router;