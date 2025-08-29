const Role = require('../models/Role');

const checkPermission = (permission) => async (req, res, next) => {
    try {
      const role = await Role.findById(req.user.roleRef);
      if (!role || !role.permissions.includes(permission)) {
        return res.status(403).json({ message: 'Forbidden: Missing permission' });
      }
      next();
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  };

// For hierarchy, example: check if target user reports to req.user or same level ggf
const checkHierarchy = async (req, res, next) => {
    try {
        // Implement logic based on reportingTo chain
        // For simplicity, assume super admin can, others only if same team or reporting
        const targetUserId = req.user.id || req.params.userId;
        if (!targetUserId) return next(); // No target user, skip check

        const targetUser = await User.findById(targetUserId).populate('roleRef');
        if (!targetUser) return res.status(404).json({ message: 'Target user not found' });

        const userRole = await Role.findById(req.user.roleRef);
        const targetRole = await Role.findById(targetUser.roleRef);

        // Superadmin bypasses hierarchy
        if (userRole.name.toLowerCase() === 'superadmin' || userRole.level === 1) {
            return next();
        }

        next(); // Placeholder, implement as needed
    } catch (err) {
        res.status(500).json({ message: 'Server error in check Hierarchy'});
    }
};

module.exports = { checkPermission, checkHierarchy };