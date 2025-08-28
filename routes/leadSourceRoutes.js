const express = require('express');
const auth = require('../middleware/auth');
const { checkPermission, checkHierarchy } = require('../middleware/rbacMiddleware');
const { createLeadSource, getLeadSources, getLeadSourcesById, updateLeadSource, deleteLeadSource } = require('../controllers/leadSourceController');

const router = express.Router();

router.post('/', auth, checkPermission('leadssource:create'), createLeadSource);
router.get('/', auth, checkPermission('leadssource:read_all'), getLeadSources);
router.get('/:id', auth, checkPermission('leadssource:read'), getLeadSourcesById);
router.put('/:id', auth, checkPermission('leadssource:update'), updateLeadSource);
router.delete('/:id', auth, checkPermission('leadssource:delete'), deleteLeadSource);
// router.get('/', auth, checkPermission('leads:read'), getLeads);

// Add other routes

module.exports = router;