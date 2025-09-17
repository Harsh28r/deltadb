const Role = require('../models/Role');
const User = require('../models/User');
const UserReporting = require('../models/UserReporting');

const checkPermission = (permission) => async (req, res, next) => {
  try {
    // Allow superadmin to bypass all permission checks
    if (req.user.role === 'superadmin' || req.user.level === 1) {
      console.log(`checkPermission: Superadmin bypass for user ${req.user.id}, permission: ${permission}`);
      return next();
    }
    
    const role = await Role.findById(req.user.roleRef);
    if (!role || !role.permissions.includes(permission)) {
      console.log(`checkPermission: Permission ${permission} denied for user ${req.user.id}, role: ${req.user.roleRef}`);
      return res.status(403).json({ message: `Forbidden: Missing permission ${permission}` });
    }
    console.log(`checkPermission: Permission ${permission} granted for user ${req.user.id}`);
    next();
  } catch (err) {
    console.error(`checkPermission error for user ${req.user.id}:`, err.message);
    res.status(500).json({ message: 'Server error in checkPermission' });
  }
};

const checkHierarchy = async (req, res, next) => {
  try {
    // Allow superadmin to bypass all hierarchy checks
    if (req.user.role === 'superadmin' || req.user.level === 1) {
      console.log(`checkHierarchy: Superadmin bypass for user ${req.user.id}`);
      return next();
    }

    // Extract targetUserId from possible sources
    const targetUserId = req.params.userId || req.body.userId || req.body.sourcingPersonId || req.user.id;
    if (!targetUserId) {
      console.log('checkHierarchy: Target user ID not provided');
      return res.status(400).json({ message: 'Target user ID not provided' });
    }

    // Allow self-access
    if (req.user.id === targetUserId) {
      console.log(`checkHierarchy: Self-access granted for user ${req.user.id}`);
      return next();
    }

    // Get requesting user's role
    const userRole = await Role.findById(req.user.roleRef);
    if (!userRole) {
      console.log(`checkHierarchy: Role not found for user ${req.user.id}`);
      return res.status(403).json({ message: 'Requesting user role not found' });
    }

    // Get target user and their role
    const targetUser = await User.findById(targetUserId).populate('roleRef');
    if (!targetUser) {
      console.log(`checkHierarchy: Target user ${targetUserId} not found`);
      return res.status(404).json({ message: 'Target user not found' });
    }

    // Check if target user reports to requesting user
    const targetReporting = await UserReporting.findOne({
      user: targetUserId,
      'reportsTo.path': { $regex: `/(${req.user.id})/` }
    });

    if (!targetReporting) {
      console.log(`checkHierarchy: No reporting record found for target user ${targetUserId} or not a subordinate of ${req.user.id}`);
      return res.status(403).json({ message: `Forbidden: Target user ${targetUserId} is not a subordinate` });
    }

    console.log(`checkHierarchy: User ${targetUserId} is a subordinate of ${req.user.id}, path: ${targetReporting.reportsTo.find(r => r.path.includes(`/${req.user.id}/`)).path}`);
    next();
  } catch (err) {
    console.error(`checkHierarchy error for user ${req.user.id}, target ${targetUserId}:`, err.message);
    res.status(500).json({ message: 'Server error in checkHierarchy' });
  }
};

module.exports = { checkPermission, checkHierarchy };