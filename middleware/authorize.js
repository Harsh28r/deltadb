const Project = require('../models/Project');
const Role = require('../models/Role');

// authorize(requiredPermission?: string)
// Checks that the logged-in user either belongs to the project (membership)
// and optionally that their GLOBAL role has the required permission.
// Project id is expected in req.params.projectId or req.body.projectId or req.query.projectId
module.exports = function authorize(requiredPermission) {
  return async function (req, res, next) {
    try {
      const projectId = req.params.projectId || req.body.projectId || req.query.projectId;
      if (!projectId) return res.status(400).json({ message: 'projectId is required' });

      const project = await Project.findById(projectId);
      if (!project) return res.status(404).json({ message: 'Project not found' });

      // Superadmin (global) or project owner bypass
      if (req.user?.role === 'superadmin' || String(project.owner) === String(req.user?._id)) {
        req.project = project;
        return next();
      }

      // Must be a member of this project
      const isMember = (project.members || []).map(String).includes(String(req.user?._id));
      if (!isMember) return res.status(403).json({ message: 'Access denied: not a member of this project' });

      // If no specific permission required, membership is enough
      if (!requiredPermission) {
        req.project = project;
        return next();
      }

      // Check required permission on GLOBAL role
      const userRoleName = String(req.user?.role || '').toLowerCase();
      const roleDef = await Role.findOne({ name: userRoleName });
      const hasPermission = (roleDef?.permissions || []).includes(String(requiredPermission).toLowerCase());
      if (!hasPermission) return res.status(403).json({ message: 'Access denied: missing permission' });

      req.project = project;
      next();
    } catch (error) {
      res.status(500).json({ message: error.message || 'Server error' });
    }
  };
};


