const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { checkPermission, checkHierarchy } = require('../middleware/rbacMiddleware');
const {
  createReporting,
  getHierarchy,
  getAllUserReportings,
  updateReporting,
  deleteReporting,
  bulkUpdateUserReportings,
  bulkDeleteUserReportings
} = require('../controllers/userReportingController');

router.post('/', auth, checkPermission('user-reporting:create'), createReporting);
router.get('/hierarchy/:userId', auth, checkPermission('user-reporting:read'), checkHierarchy, getHierarchy);
router.get('/', auth, checkPermission('user-reporting:read'), getAllUserReportings);
router.put('/:id', auth, checkPermission('user-reporting:update'), checkHierarchy, updateReporting);
router.delete('/:id', auth, checkPermission('user-reporting:delete'), checkHierarchy, deleteReporting);
router.post('/bulk-update', auth, checkPermission('user-reporting:bulk-update'), checkHierarchy, bulkUpdateUserReportings);
router.post('/bulk-delete', auth, checkPermission('user-reporting:bulk-delete'), checkHierarchy, bulkDeleteUserReportings);

module.exports = router;