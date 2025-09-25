const express = require('express');
const auth = require('../middleware/auth');
const { checkPermission, checkHierarchy } = require('../middleware/rbacMiddleware');
const superadmin = require('../middleware/superadmin');

const {
  createChannelPartner,
  getChannelPartners,
  getChannelPartnerById,
  updateChannelPartner,
  deleteChannelPartner,
  bulkCreateChannelPartners,
  bulkUpdateChannelPartners,
  bulkDeleteChannelPartners
} = require('../controllers/channelPartnerController');

const router = express.Router();

router.post('/', auth, checkPermission('channel-partner:create'), createChannelPartner);
router.get('/', auth, checkPermission('channel-partner:read_all'), getChannelPartners);
router.get('/:id', auth, checkPermission('channel-partner:read'), getChannelPartnerById);
router.put('/:id', auth, checkPermission('channel-partner:update'), updateChannelPartner);
router.delete('/:id', auth, checkPermission('channel-partner:delete'), superadmin, deleteChannelPartner);
router.post('/bulk-create', auth, checkPermission('channel-partner:bulk-create'), superadmin, bulkCreateChannelPartners);
router.post('/bulk-update', auth, checkPermission('channel-partner:bulk-update'), superadmin, bulkUpdateChannelPartners);
router.post('/bulk-delete', auth, checkPermission('channel-partner:bulk-delete'), superadmin, bulkDeleteChannelPartners);

module.exports = router;