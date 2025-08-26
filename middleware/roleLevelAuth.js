const Role = require('../models/Role');
const User = require('../models/User');

// Middleware to check if user can assign/edit roles at specific levels
const canManageRoleLevel = (targetLevel) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const userLevel = req.user.level || 999; // Default to high level if not set
      
      // Superadmin (level 1) can manage any role
      if (userLevel === 1) {
        return next();
      }

      // Check if user is trying to manage a role at their level or higher
      if (targetLevel <= userLevel) {
        return res.status(403).json({ 
          message: `You can only manage roles at level ${userLevel + 1} or higher. Your level: ${userLevel}` 
        });
      }

      next();
    } catch (error) {
      res.status(500).json({ message: 'Role level check failed' });
    }
  };
};

// Middleware to check if user can assign a specific role to another user
const canAssignRole = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { roleName } = req.body;
    if (!roleName) {
      return next(); // No role specified, skip check
    }

    const userLevel = req.user.level || 999;
    
    // Superadmin (level 1) can assign any role
    if (userLevel === 1) {
      return next();
    }

    // Find the role being assigned
    const targetRole = await Role.findOne({ name: String(roleName).toLowerCase().trim() });
    if (!targetRole) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Check if user can assign this role level
    if (targetRole.level <= userLevel) {
      return res.status(403).json({ 
        message: `You can only assign roles at level ${userLevel + 1} or higher. Cannot assign role '${roleName}' (level ${targetRole.level})` 
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Role assignment check failed' });
  }
};

// Middleware to check if user can edit/delete a specific user
const canManageUser = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { userId } = req.params;
    if (!userId) {
      return next(); // No user ID specified, skip check
    }

    const userLevel = req.user.level || 999;
    
    // Superadmin (level 1) can manage any user
    if (userLevel === 1) {
      return next();
    }

    // Find the target user
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent managing users at same level or higher
    if (targetUser.level <= userLevel) {
      return res.status(403).json({ 
        message: `You can only manage users at level ${userLevel + 1} or higher. Cannot manage user '${targetUser.name}' (level ${targetUser.level})` 
      });
    }

    // Prevent managing superadmin users
    if (targetUser.role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot manage superadmin users' });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'User management check failed' });
  }
};

// Helper function to get available roles for a user level
const getAvailableRolesForLevel = async (userLevel) => {
  try {
    if (userLevel === 1) {
      // Superadmin can see all roles
      return await Role.find().sort({ level: 1, name: 1 });
    } else {
      // Other users can only see roles at higher levels
      return await Role.find({ level: { $gt: userLevel } }).sort({ level: 1, name: 1 });
    }
  } catch (error) {
    console.error('Error getting available roles:', error);
    return [];
  }
};

module.exports = {
  canManageRoleLevel,
  canAssignRole,
  canManageUser,
  getAvailableRolesForLevel
};
