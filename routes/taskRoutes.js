const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { checkPermission, checkHierarchy } = require('../middleware/rbacMiddleware');
const {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  changeTaskStatus,
  deleteTask,
  bulkTransferTasks,
  bulkUpdateTasks,
  bulkDeleteTasks
} = require('../controllers/taskController');

router.post('/', auth, checkPermission('tasks:create'), checkHierarchy, createTask);
router.get('/', auth, checkPermission('tasks:read'), checkHierarchy, getTasks);
router.get('/:id', auth, checkPermission('tasks:read'), checkHierarchy, getTaskById);
router.put('/:id', auth, checkPermission('tasks:update'), checkHierarchy, updateTask);
router.put('/:id/status', auth, checkPermission('tasks:update'), checkHierarchy, changeTaskStatus);
router.delete('/:id', auth, checkPermission('tasks:delete'), checkHierarchy, deleteTask);
router.post('/bulk-transfer', auth, checkPermission('tasks:bulk-transfer'), checkHierarchy, bulkTransferTasks);
router.post('/bulk-update', auth, checkPermission('tasks:bulk-update'), checkHierarchy, bulkUpdateTasks);
router.post('/bulk-delete', auth, checkPermission('tasks:bulk-delete'), checkHierarchy, bulkDeleteTasks);

module.exports = router;