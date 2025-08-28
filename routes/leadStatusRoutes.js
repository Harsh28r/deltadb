const express = require('express');
const auth = require('../middleware/auth');
const { checkPermission, checkHierarchy } = require('../middleware/rbacMiddleware');
const { createLeadStatus, getLeadStatus, getLeadStatusById, updateLeadStatus, deleteLeadStatus } = require('../controllers/leadStatusController');

const router = express.Router();

router.post('/', auth, checkPermission('leadsstatus:create'), createLeadStatus);
router.get('/', auth, checkPermission('leadsstatus:read_all'), getLeadStatus);
router.get('/:id', auth, checkPermission('leadsstatus:read'), getLeadStatusById);
router.put('/:id', auth, checkPermission('leadsstatus:update'), updateLeadStatus);
router.delete('/:id', auth, checkPermission('leadsstatus:delete'), deleteLeadStatus);
// router.get('/', auth, checkPermission('leads:read'), getLeads);

module.exports = router;