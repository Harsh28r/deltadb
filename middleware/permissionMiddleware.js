const User = require('../models/User');
const UserProjectPermission = require('../models/UserProjectPermission');
const Project = require('../models/Project');

/**
 * Advanced permission checking middleware
 * Supports both role-based and user-specific permissions
 */
const checkPermission = (requiredPermission, options = {}) => {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Check if user is active
      if (!req.user.isActive) {
        return res.status(403).json({ message: 'Account is deactivated' });
      }

      // Superadmin bypass
      if (req.user.role === 'superadmin' || req.user.level === 1) {
        return next();
      }

      // Get project ID if required
      const projectId = req.params.projectId || req.body.projectId || req.query.projectId;
      
      // If project-specific permission is required
      if (options.projectSpecific && projectId) {
        const hasProjectPermission = await checkProjectPermission(
          req.user._id, 
          projectId, 
          requiredPermission
        );
        
        if (hasProjectPermission === false) {
          return res.status(403).json({ 
            message: `Access denied: Missing permission '${requiredPermission}' for this project` 
          });
        }
        
        // If hasProjectPermission is null, fall back to role permissions
        if (hasProjectPermission === null) {
          const hasRolePermission = await req.user.hasPermission(requiredPermission);
          if (!hasRolePermission) {
            return res.status(403).json({ 
              message: `Access denied: Missing permission '${requiredPermission}'` 
            });
          }
        }
      } else {
        // Check role-based permission only
        const hasPermission = await req.user.hasPermission(requiredPermission);
        if (!hasPermission) {
          return res.status(403).json({ 
            message: `Access denied: Missing permission '${requiredPermission}'` 
          });
        }
      }

      // Check project access if projectId is provided
      if (projectId) {
        const canAccess = req.user.canAccessProject(projectId);
        if (!canAccess) {
          return res.status(403).json({ 
            message: 'Access denied: Cannot access this project' 
          });
        }
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Server error during permission check' });
    }
  };
};

/**
 * Check if user has specific permission for a project
 * Returns: true (has permission), false (explicitly denied), null (not specified, check role)
 */
const checkProjectPermission = async (userId, projectId, permission) => {
  try {
    const userProjectPerm = await UserProjectPermission.findOne({
      user: userId,
      project: projectId,
      isActive: true
    });

    if (!userProjectPerm) {
      return null; // No project-specific permissions, check role
    }

    return userProjectPerm.hasPermission(permission);
  } catch (error) {
    console.error('Project permission check error:', error);
    return false;
  }
};

/**
 * Check if user can perform specific action on project
 */
const checkProjectAction = (action) => {
  return async (req, res, next) => {
    try {
      const projectId = req.params.projectId || req.body.projectId || req.query.projectId;
      
      if (!projectId) {
        return res.status(400).json({ message: 'Project ID is required' });
      }

      // Superadmin bypass
      if (req.user.role === 'superadmin' || req.user.level === 1) {
        return next();
      }

      // Check project access
      const canAccess = req.user.canAccessProject(projectId);
      if (!canAccess) {
        return res.status(403).json({ 
          message: 'Access denied: Cannot access this project' 
        });
      }

      // Check project-specific restrictions
      const userProjectPerm = await UserProjectPermission.findOne({
        user: req.user._id,
        project: projectId,
        isActive: true
      });

      if (userProjectPerm && userProjectPerm.hasRestriction(action)) {
        return res.status(403).json({ 
          message: `Access denied: ${action} is restricted for this project` 
        });
      }

      next();
    } catch (error) {
      console.error('Project action check error:', error);
      res.status(500).json({ message: 'Server error during action check' });
    }
  };
};

/**
 * Check user hierarchy (for user management)
 */
const checkHierarchy = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId || req.body.userId;
    
    if (!targetUserId) {
      return next(); // No target user, skip check
    }

    // Superadmin can manage anyone
    if (req.user.role === 'superadmin' || req.user.level === 1) {
      return next();
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    // Users can only manage users with higher level (lower privilege)
    if (req.user.level >= targetUser.level) {
      return res.status(403).json({ 
        message: 'Access denied: Cannot manage user with same or higher privilege level' 
      });
    }

    next();
  } catch (error) {
    console.error('Hierarchy check error:', error);
    res.status(500).json({ message: 'Server error during hierarchy check' });
  }
};

/**
 * Get user's effective permissions for a project
 */
const getUserProjectPermissions = async (userId, projectId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return null;

    // Get base role permissions
    const rolePermissions = await user.getEffectivePermissions();
    
    // Get project-specific permissions
    const projectPerm = await UserProjectPermission.findOne({
      user: userId,
      project: projectId,
      isActive: true
    });

    let effectivePermissions = [...rolePermissions];

    if (projectPerm) {
      // Add project-specific allowed permissions
      if (projectPerm.permissions?.allowed) {
        effectivePermissions = [...effectivePermissions, ...projectPerm.permissions.allowed];
      }
      
      // Remove project-specific denied permissions
      if (projectPerm.permissions?.denied) {
        effectivePermissions = effectivePermissions.filter(
          perm => !projectPerm.permissions.denied.includes(perm)
        );
      }
    }

    return {
      permissions: [...new Set(effectivePermissions)],
      restrictions: projectPerm?.restrictions || {},
      projectAccess: user.canAccessProject(projectId)
    };
  } catch (error) {
    console.error('Get user project permissions error:', error);
    return null;
  }
};

module.exports = {
  checkPermission,
  checkProjectAction,
  checkHierarchy,
  getUserProjectPermissions,
  checkProjectPermission
};
