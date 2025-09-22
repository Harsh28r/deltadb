const express = require('express');
const auth = require('../middleware/auth');
const { checkPermission, checkHierarchy } = require('../middleware/rbacMiddleware');
const {
  createCPSourcing,
  getCPSourcings,
  getCPSourcingById,
  getUniqueSourcingPersons,
  updateCPSourcing,
  deleteCPSourcing,
  bulkCreateCPSourcings,
  bulkUpdateCPSourcings,
  bulkDeleteCPSourcings,
  validateCPSourcing
} = require('../controllers/cpSourcingController');

const router = express.Router();

router.get('/unique-users', auth, checkPermission('leads:create'), getUniqueSourcingPersons);
router.post('/validate', auth, checkPermission('leads:create'), checkHierarchy, validateCPSourcing);
router.post('/', auth, checkPermission('cp-sourcing:create'), createCPSourcing);
router.get('/', auth, checkPermission('cp-sourcing:read'), getCPSourcings);
router.get('/:id', auth, checkPermission('cp-sourcing:read'), checkHierarchy, getCPSourcingById);
router.put('/:id', auth, checkPermission('cp-sourcing:update'), checkHierarchy, updateCPSourcing);
router.delete('/:id', auth, checkPermission('cp-sourcing:delete'), checkHierarchy, deleteCPSourcing);
router.post('/bulk-create', auth, checkPermission('cp-sourcing:bulk-create'), bulkCreateCPSourcings);
router.post('/bulk-update', auth, checkPermission('cp-sourcing:bulk-update'), checkHierarchy, bulkUpdateCPSourcings);
router.post('/bulk-delete', auth, checkPermission('cp-sourcing:bulk-delete'), checkHierarchy, bulkDeleteCPSourcings);

module.exports = router;