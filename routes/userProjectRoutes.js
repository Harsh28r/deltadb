const express = require('express');
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbacMiddleware');
const { assignProject, getUserProjects, removeProject, bulkUpdateUserProjects, bulkDeleteUserProjects} = require('../controllers/userProjectController');

const router = express.Router();

router.post('/assign', auth, checkPermission('user-projects:assign'), assignProject);
router.get('/:userId', auth, checkPermission('user-projects:read'), getUserProjects);
router.delete('/:userId/:projectId', auth, checkPermission('user-projects:remove'), removeProject);
router.post('/bulk-update', auth, checkPermission('user-projects:bulk-update'), bulkUpdateUserProjects);
router.post('/bulk-delete', auth, checkPermission('user-projects:bulk-delete'), bulkDeleteUserProjects);

module.exports = router;