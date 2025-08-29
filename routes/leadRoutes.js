const express = require('express');
const auth = require('../middleware/auth');
const { checkPermission, checkHierarchy } = require('../middleware/rbacMiddleware');
const { 
  createLead, 
  getLeads, 
  getLeadById,
  changeLeadStatus, 
  bulkUploadLeads, 
  transferLeads,
  updateLead,
  deleteLead
} = require('../controllers/leadController');

const router = express.Router();

// Create a new lead
router.post('/', auth, checkPermission('leads:create'), createLead);

// Get all leads (with optional projectId filter)
router.get('/', auth, checkPermission('leads:read'), getLeads);

// Get a specific lead by ID
router.get('/:id', auth, checkPermission('leads:read'), getLeadById);

// Update lead status
router.put('/:id/status', auth, checkPermission('leads:update'), changeLeadStatus);

// Update lead details
router.put('/:id', auth, checkPermission('leads:update'), updateLead);

// Delete a lead
router.delete('/:id', auth, checkPermission('leads:delete'), deleteLead);

// Bulk operations
router.post('/bulk-upload', auth, checkPermission('leads:bulk'), bulkUploadLeads);
router.post('/transfer', auth, checkPermission('leads:transfer'), checkHierarchy, transferLeads);

module.exports = router;