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
  bulkDeleteReminders,
  getLeadReminders,
  getUpcomingLeadReminders,
  getOverdueLeadReminders,
  snoozeReminder,
  dismissReminder
} = require('../controllers/reminderController');

router.post('/', auth, checkPermission('reminders:create'), checkHierarchy, createReminder);
router.get('/', auth, checkPermission('reminders:read'), checkHierarchy, getReminders);
router.get('/lead-reminders', auth, checkPermission('reminders:read'), getLeadReminders);
router.get('/upcoming', auth, checkPermission('reminders:read'), getUpcomingLeadReminders);
router.get('/overdue', auth, checkPermission('reminders:read'), getOverdueLeadReminders);
router.get('/:id', auth, checkPermission('reminders:read'), checkHierarchy, getReminderById);
router.put('/:id', auth, checkPermission('reminders:update'), checkHierarchy, updateReminder);
router.put('/:id/snooze', auth, checkPermission('reminders:update'), snoozeReminder);
router.put('/:id/dismiss', auth, checkPermission('reminders:update'), dismissReminder);
router.delete('/:id', auth, checkPermission('reminders:delete'), checkHierarchy, deleteReminder);
router.post('/bulk-update', auth, checkPermission('reminders:bulk-update'), checkHierarchy, bulkUpdateReminders);
router.post('/bulk-delete', auth, checkPermission('reminders:bulk-delete'), checkHierarchy, bulkDeleteReminders);

module.exports = router;