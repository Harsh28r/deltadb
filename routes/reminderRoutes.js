const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { checkPermission, checkHierarchy } = require('../middleware/rbacMiddleware');
const {
  createReminder,
  getReminders,
  getReminderById,
  updateReminder,
  deleteReminder,
  bulkUpdateReminders,
  bulkDeleteReminders
} = require('../controllers/reminderController');

router.post('/', auth, checkPermission('reminders:create'), checkHierarchy, createReminder);
router.get('/', auth, checkPermission('reminders:read'), checkHierarchy, getReminders);
router.get('/:id', auth, checkPermission('reminders:read'), checkHierarchy, getReminderById);
router.put('/:id', auth, checkPermission('reminders:update'), checkHierarchy, updateReminder);
router.delete('/:id', auth, checkPermission('reminders:delete'), checkHierarchy, deleteReminder);
router.post('/bulk-update', auth, checkPermission('reminders:bulk-update'), checkHierarchy, bulkUpdateReminders);
router.post('/bulk-delete', auth, checkPermission('reminders:bulk-delete'), checkHierarchy, bulkDeleteReminders);

module.exports = router;