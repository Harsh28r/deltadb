const express = require('express');
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbacMiddleware');
const superadmin = require('../middleware/superadmin');

const {
  createLeadSource,
  getLeadSources,
  getLeadSourceById,
  updateLeadSource,
  deleteLeadSource
} = require('../controllers/leadSourceController');

const router = express.Router();

router.post('/', auth, checkPermission('leadssource:create'), superadmin, createLeadSource);
router.get('/', auth, checkPermission('leadssource:read_all'), getLeadSources);
router.get('/:id', auth, checkPermission('leadssource:read'), getLeadSourceById);
router.put('/:id', auth, checkPermission('leadssource:update'), superadmin, updateLeadSource);
router.delete('/:id', auth, checkPermission('leadssource:delete'), superadmin, deleteLeadSource);

module.exports = router;