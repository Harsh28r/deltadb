const express = require('express');
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbacMiddleware');
const superadmin = require('../middleware/superadmin');
const {
  createLeadStatus,
  getLeadStatus,
  getLeadStatusById,
  updateLeadStatus,
  deleteLeadStatus
} = require('../controllers/leadStatusController');

const router = express.Router();

router.post('/', auth, checkPermission('leadsstatus:create'), superadmin, createLeadStatus);
router.get('/', auth, checkPermission('leadsstatus:read_all'), getLeadStatus);
router.get('/:id', auth, checkPermission('leadsstatus:read'), getLeadStatusById);
router.put('/:id', auth, checkPermission('leadsstatus:update'), superadmin, updateLeadStatus);
router.delete('/:id', auth, checkPermission('leadsstatus:delete'), superadmin, deleteLeadStatus);

module.exports = router;