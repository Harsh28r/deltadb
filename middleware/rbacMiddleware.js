const Role = require('../models/Role');
const User = require('../models/User');
const UserReporting = require('../models/UserReporting');

const checkPermission = (permission) => async (req, res, next) => {
  try {
    // Allow superadmin to bypass all permission checks
    if (req.user.role === 'superadmin' || req.user.level === 1) {
      return next();
    }
    
    const role = await Role.findById(req.user.roleRef);
    if (!role || !role.permissions.includes(permission)) {
      return res.status(403).json({ message: 'Forbidden: Missing permission' });
    }
    next();
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const checkHierarchy = async (req, res, next) => {
  try {
    // Allow superadmin to bypass all hierarchy checks
    if (req.user.role === 'superadmin' || req.user.level === 1) {
      return next();
    }

    // Extract targetUserId from possible sources
    const targetUserId = req.params.userId || req.body.userId || req.user.id;
    if (!targetUserId) {
      return res.status(400).json({ message: 'Target user ID not provided' });
    }

    // Get requesting user's role
    const userRole = await Role.findById(req.user.roleRef);
    if (!userRole) {
      return res.status(403).json({ message: 'Requesting user role not found' });
    }

    // Get target user and their role
    const targetUser = await User.findById(targetUserId).populate('roleRef');
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    // Allow self-access
    if (req.user.id === targetUserId) {
      return next();
    }

    // Check if target user reports to requesting user
    const targetReporting = await UserReporting.findOne({ user: targetUserId });
    if (!targetReporting) {
      return res.status(403).json({ message: 'Forbidden: Target user has no reporting record' });
    }

    // Check if requesting user's ID is in any of the target user's reportsTo paths
    const isSubordinate = targetReporting.reportsTo.some(relation => 
      relation.path && relation.path.includes(`/${req.user.id}/`)
    );

    if (!isSubordinate) {
      return res.status(403).json({ message: 'Forbidden: Target user is not a subordinate' });
    }

    next();
  } catch (err) {
    console.error('Error in checkHierarchy:', err.message);
    res.status(500).json({ message: 'Server error in checkHierarchy' });
  }
};

module.exports = { checkPermission, checkHierarchy };