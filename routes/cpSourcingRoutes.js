const express = require('express');
const auth = require('../middleware/auth');
const { checkPermission, checkHierarchy } = require('../middleware/rbacMiddleware');
const superadmin = require('../middleware/superadmin');
const {
  createCPSourcing,
  getCPSourcings,
  getCPSourcingById,
  updateCPSourcing,
  deleteCPSourcing,
  bulkCreateCPSourcings,
  bulkUpdateCPSourcings,
  bulkDeleteCPSourcings
} = require('../controllers/cpSourcingController');

const router = express.Router();

router.post('/', auth, checkPermission('cp-sourcing:create'), createCPSourcing);
router.get('/', auth, checkPermission('cp-sourcing:read_all'), getCPSourcings);
router.get('/:id', auth, checkPermission('cp-sourcing:read'), getCPSourcingById);
router.put('/:id', auth, checkPermission('cp-sourcing:update'), updateCPSourcing);
router.delete('/:id', auth, checkPermission('cp-sourcing:delete'), superadmin, deleteCPSourcing);
router.post('/bulk-create', auth, checkPermission('cp-sourcing:bulk-create'), superadmin, bulkCreateCPSourcings);
router.post('/bulk-update', auth, checkPermission('cp-sourcing:bulk-update'), superadmin, bulkUpdateCPSourcings);
router.post('/bulk-delete', auth, checkPermission('cp-sourcing:bulk-delete'), superadmin, bulkDeleteCPSourcings);

module.exports = router;