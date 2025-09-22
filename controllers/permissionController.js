const User = require('../models/User');
const UserProjectPermission = require('../models/UserProjectPermission');
const Project = require('../models/Project');
const { getUserProjectPermissions: getUserProjectPermissionsMiddleware } = require('../middleware/permissionMiddleware');

/**
 * Get user's permissions (SIMPLE & CLEAN)
 */
const getUserPermissions = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    
    // Check if requesting user can view target user's permissions
    if (userId !== req.user._id.toString()) {
      // Only superadmin or higher level can view other users' permissions
      if (req.user.role !== 'superadmin' && req.user.level >= 1) {
        return res.status(403).json({ message: 'Access denied: Cannot view other users\' permissions' });
      }
    }

    console.log(`🔍 Looking for user with ID: ${userId}`);
    const user = await User.findById(userId).populate('roleRef');
    if (!user) {
      console.log(`❌ User not found with ID: ${userId}`);
      return res.status(404).json({ message: 'User not found' });
    }
    console.log(`✅ Found user: ${user.name} (${user.email})`);

    // Get role information
    const Role = require('../models/Role');
    const roleDef = await Role.findOne({ name: user.role });
    const rolePermissions = roleDef?.permissions || [];

    const canAccessAllProjects = user.role === 'superadmin' || user.level === 1;

    // GET ALL PERMISSIONS: Role + Custom Allowed - Denied
    const currentCustomAllowed = user.customPermissions?.allowed || [];
    const currentCustomDenied = user.customPermissions?.denied || [];
    
    // Combine role permissions + custom allowed permissions
    const allAllowed = [...rolePermissions, ...currentCustomAllowed];
    
    // Remove denied permissions from allowed list
    const finalAllowed = allAllowed.filter(perm => !currentCustomDenied.includes(perm));
    
    // Remove duplicates
    const uniqueAllowed = [...new Set(finalAllowed)];

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level,
        isActive: user.isActive
      },
      permissions: {
        allowed: uniqueAllowed,
        denied: currentCustomDenied
      },
      projectAccess: {
        canAccessAll: canAccessAllProjects,
        allowedProjects: user.restrictions?.allowedProjects || [],
        deniedProjects: user.restrictions?.deniedProjects || [],
        maxProjects: user.restrictions?.maxProjects || null
      }
    });
  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({ message: 'Server error while fetching permissions' });
  }
};

/**
 * Update user's custom permissions
 */
const updateUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { effective, allowed, denied } = req.body;

    // Only superadmin can update permissions
    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      return res.status(403).json({ message: 'Access denied: Only superadmin can update permissions' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's role permissions
    const Role = require('../models/Role');
    const roleDef = await Role.findOne({ name: user.role });
    const rolePermissions = roleDef?.permissions || [];

    // Initialize custom permissions if not exists
    user.customPermissions = user.customPermissions || { allowed: [], denied: [] };

    // If effective permissions are provided, calculate allowed/denied based on role
    if (effective !== undefined) {
      // Validate effective permissions
      if (!Array.isArray(effective)) {
        return res.status(400).json({ 
          message: 'Effective permissions must be an array',
          received: effective 
        });
      }

      const effectiveSet = new Set(effective);
      const roleSet = new Set(rolePermissions);
      
      // Calculate what should be allowed (in effective but not in role)
      const newAllowed = effective.filter(perm => !roleSet.has(perm));
      
      // Calculate what should be denied (in role but not in effective)
      const newDenied = rolePermissions.filter(perm => !effectiveSet.has(perm));
      
      user.customPermissions.allowed = newAllowed;
      user.customPermissions.denied = newDenied;
    } else {
      // Legacy support: update allowed/denied directly
      if (allowed !== undefined) {
        user.customPermissions.allowed = allowed;
      }
      
      if (denied !== undefined) {
        user.customPermissions.denied = denied;
      }
    }

    await user.save();

    // Get updated effective permissions
    const updatedEffectivePermissions = await user.getEffectivePermissions();

    res.json({
      success: true,
      message: 'User permissions updated successfully',
      permissions: {
        effective: updatedEffectivePermissions,
        custom: {
          allowed: user.customPermissions.allowed,
          denied: user.customPermissions.denied
        },
        role: {
          permissions: rolePermissions
        }
      }
    });
  } catch (error) {
    console.error('Update user permissions error:', error);
    res.status(500).json({ message: 'Server error while updating permissions' });
  }
};

/**
 * Update user's project restrictions
 */
const updateUserRestrictions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { maxProjects, allowedProjects, deniedProjects } = req.body;

    // Only superadmin can update restrictions
    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      return res.status(403).json({ message: 'Access denied: Only superadmin can update restrictions' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update restrictions
    user.restrictions = user.restrictions || {};
    
    if (maxProjects !== undefined) {
      user.restrictions.maxProjects = maxProjects;
    }
    
    if (allowedProjects !== undefined) {
      user.restrictions.allowedProjects = allowedProjects;
    }
    
    if (deniedProjects !== undefined) {
      user.restrictions.deniedProjects = deniedProjects;
    }

    await user.save();

    res.json({
      success: true,
      message: 'User restrictions updated successfully',
      restrictions: user.restrictions
    });
  } catch (error) {
    console.error('Update user restrictions error:', error);
    res.status(500).json({ message: 'Server error while updating restrictions' });
  }
};

/**
 * Get user's project-specific permissions
 */
const getUserProjectPermissions = async (req, res) => {
  try {
    const { userId, projectId } = req.params;

    // Check if requesting user can view target user's permissions
    if (userId !== req.user._id.toString()) {
      if (req.user.role !== 'superadmin' && req.user.level !== 1) {
        return res.status(403).json({ message: 'Access denied: Cannot view other users\' permissions' });
      }
    }

    const permissions = await getUserProjectPermissionsMiddleware(userId, projectId);
    if (!permissions) {
      return res.status(404).json({ message: 'User or project not found' });
    }

    res.json({
      success: true,
      permissions: permissions.permissions,
      restrictions: permissions.restrictions,
      projectAccess: permissions.projectAccess
    });
  } catch (error) {
    console.error('Get user project permissions error:', error);
    res.status(500).json({ message: 'Server error while fetching project permissions' });
  }
};

/**
 * Set user's project-specific permissions
 */
const setUserProjectPermissions = async (req, res) => {
  try {
    const { userId, projectId } = req.params;
    const { permissions, restrictions } = req.body;

    // Only superadmin can set project permissions
    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      return res.status(403).json({ message: 'Access denied: Only superadmin can set project permissions' });
    }

    // Verify user and project exist
    const user = await User.findById(userId);
    const project = await Project.findById(projectId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Create or update project permissions
    const userProjectPerm = await UserProjectPermission.findOneAndUpdate(
      { user: userId, project: projectId },
      {
        user: userId,
        project: projectId,
        permissions: permissions || {},
        restrictions: restrictions || {},
        assignedBy: req.user._id,
        isActive: true
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Project permissions updated successfully',
      permissions: userProjectPerm.permissions,
      restrictions: userProjectPerm.restrictions
    });
  } catch (error) {
    console.error('Set user project permissions error:', error);
    res.status(500).json({ message: 'Server error while setting project permissions' });
  }
};

/**
 * Remove user's project-specific permissions
 */
const removeUserProjectPermissions = async (req, res) => {
  try {
    const { userId, projectId } = req.params;

    // Only superadmin can remove project permissions
    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      return res.status(403).json({ message: 'Access denied: Only superadmin can remove project permissions' });
    }

    const result = await UserProjectPermission.findOneAndDelete({
      user: userId,
      project: projectId
    });

    if (!result) {
      return res.status(404).json({ message: 'Project permissions not found' });
    }

    res.json({
      success: true,
      message: 'Project permissions removed successfully'
    });
  } catch (error) {
    console.error('Remove user project permissions error:', error);
    res.status(500).json({ message: 'Server error while removing project permissions' });
  }
};

/**
 * Get all users with their permissions (superadmin only)
 */
const getAllUsersPermissions = async (req, res) => {
  try {
    // Only superadmin can view all users' permissions
    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      return res.status(403).json({ message: 'Access denied: Only superadmin can view all users\' permissions' });
    }

    const users = await User.find({})
      .populate('roleRef')
      .select('-password')
      .sort({ level: 1, name: 1 });

    const usersWithPermissions = await Promise.all(
      users.map(async (user) => {
        try {
          const effectivePermissions = await user.getEffectivePermissions();
          return {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            roleid: user.roleRef,
            level: user.level,
            isActive: user.isActive,
            permissions: {
              effective: effectivePermissions || [],
              custom: {
                allowed: user.customPermissions?.allowed || [],
                denied: user.customPermissions?.denied || []
              }
            },
            restrictions: user.restrictions || {}
          };
        } catch (error) {
          console.error(`Error processing user ${user.email}:`, error);
          return {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            roleid: user.roleRef,
            level: user.level,
            isActive: user.isActive,
            permissions: {
              effective: [],
              custom: {
                allowed: [],
                denied: []
              }
            },
            restrictions: user.restrictions || {},
            error: 'Failed to load permissions'
          };
        }
      })
    );

    res.json({
      success: true,
      users: usersWithPermissions,
      total: usersWithPermissions.length
    });
  } catch (error) {
    console.error('Get all users permissions error:', error);
    res.status(500).json({ message: 'Server error while fetching all users\' permissions' });
  }
};

/**
 * Update user's permissions (NEW STRUCTURE)
 */
const updateUserEffectivePermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { allowed, denied } = req.body;

    // Only superadmin can update permissions
    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      return res.status(403).json({ message: 'Access denied: Only superadmin can update permissions' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's role permissions
    const Role = require('../models/Role');
    const roleDef = await Role.findOne({ name: user.role });
    const rolePermissions = roleDef?.permissions || [];

    // Initialize custom permissions if not exists
    user.customPermissions = user.customPermissions || { allowed: [], denied: [] };

    console.log(`🔧 UPDATING PERMISSIONS for ${user.name} (${user.role})`);
    console.log(`   📋 Role permissions: ${rolePermissions.length}`);
    console.log(`   🎯 Target allowed: ${allowed?.length || 0}`);
    console.log(`   🚫 Target denied: ${denied?.length || 0}`);

    // Calculate what should be custom allowed/denied
    if (allowed && Array.isArray(allowed)) {
      // What should be custom allowed (in allowed but NOT in role)
      const roleSet = new Set(rolePermissions);
      const customAllowed = allowed.filter(perm => !roleSet.has(perm));
      user.customPermissions.allowed = [...new Set(customAllowed.filter(perm => perm && typeof perm === 'string'))];
    }

    if (denied && Array.isArray(denied)) {
      // What should be custom denied (in denied but NOT in role)
      const roleSet = new Set(rolePermissions);
      const customDenied = denied.filter(perm => !roleSet.has(perm));
      user.customPermissions.denied = [...new Set(customDenied.filter(perm => perm && typeof perm === 'string'))];
    }

    await user.save();

    // Get updated permissions using the same logic as GET
    const currentCustomAllowed = user.customPermissions?.allowed || [];
    const currentCustomDenied = user.customPermissions?.denied || [];
    
    // Combine role permissions + custom allowed permissions
    const allAllowed = [...rolePermissions, ...currentCustomAllowed];
    
    // Remove denied permissions from allowed list
    const finalAllowed = allAllowed.filter(perm => !currentCustomDenied.includes(perm));
    
    // Remove duplicates
    const uniqueAllowed = [...new Set(finalAllowed)];

    console.log(`   ✅ UPDATED RESULT:`);
    console.log(`   ➕ Custom allowed: ${user.customPermissions.allowed.length}`);
    console.log(`   ➖ Custom denied: ${user.customPermissions.denied.length}`);
    console.log(`   🎯 Final allowed: ${uniqueAllowed.length}`);

    res.json({
      success: true,
      message: 'User permissions updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level
      },
      permissions: {
        allowed: uniqueAllowed,
        denied: currentCustomDenied
      },
      projectAccess: {
        canAccessAll: user.role === 'superadmin' || user.level === 1,
        allowedProjects: user.restrictions?.allowedProjects || [],
        deniedProjects: user.restrictions?.deniedProjects || [],
        maxProjects: user.restrictions?.maxProjects || null
      }
    });
  } catch (error) {
    console.error('Update user permissions error:', error);
    res.status(500).json({ message: 'Server error while updating permissions' });
  }
};

/**
 * Deny specific role permissions for a user
 */
const denyRolePermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissionsToDeny } = req.body;

    // Only superadmin can update permissions
    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      return res.status(403).json({ message: 'Access denied: Only superadmin can update permissions' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's role permissions
    const Role = require('../models/Role');
    const roleDef = await Role.findOne({ name: user.role });
    const rolePermissions = roleDef?.permissions || [];

    // Initialize custom permissions if not exists
    user.customPermissions = user.customPermissions || { allowed: [], denied: [] };

    // Add permissions to denied list (these will override role permissions)
    const newDenied = [...(user.customPermissions.denied || []), ...permissionsToDeny];
    user.customPermissions.denied = [...new Set(newDenied)]; // Remove duplicates

    // Remove any permissions from allowed list if they're being denied
    user.customPermissions.allowed = (user.customPermissions.allowed || []).filter(
      perm => !permissionsToDeny.includes(perm)
    );

    await user.save();

    // Get updated effective permissions
    const updatedEffectivePermissions = await user.getEffectivePermissions();

    res.json({
      success: true,
      message: `Denied ${permissionsToDeny.length} permissions for user`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level
      },
      permissions: {
        effective: updatedEffectivePermissions,
        custom: {
          allowed: user.customPermissions.allowed,
          denied: user.customPermissions.denied
        },
        role: {
          permissions: rolePermissions
        },
        deniedPermissions: permissionsToDeny
      }
    });
  } catch (error) {
    console.error('Deny role permissions error:', error);
    res.status(500).json({ message: 'Server error while denying permissions' });
  }
};

/**
 * Allow specific role permissions for a user (remove from denied)
 */
const allowRolePermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissionsToAllow } = req.body;

    // Only superadmin can update permissions
    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      return res.status(403).json({ message: 'Access denied: Only superadmin can update permissions' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's role permissions
    const Role = require('../models/Role');
    const roleDef = await Role.findOne({ name: user.role });
    const rolePermissions = roleDef?.permissions || [];

    // Initialize custom permissions if not exists
    user.customPermissions = user.customPermissions || { allowed: [], denied: [] };

    // Remove permissions from denied list
    user.customPermissions.denied = (user.customPermissions.denied || []).filter(
      perm => !permissionsToAllow.includes(perm)
    );

    // Add permissions to allowed list if they're not in role
    const roleSet = new Set(rolePermissions);
    const newAllowed = permissionsToAllow.filter(perm => !roleSet.has(perm));
    user.customPermissions.allowed = [...new Set([...(user.customPermissions.allowed || []), ...newAllowed])];

    await user.save();

    // Get updated effective permissions
    const updatedEffectivePermissions = await user.getEffectivePermissions();

    res.json({
      success: true,
      message: `Allowed ${permissionsToAllow.length} permissions for user`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level
      },
      permissions: {
        effective: updatedEffectivePermissions,
        custom: {
          allowed: user.customPermissions.allowed,
          denied: user.customPermissions.denied
        },
        role: {
          permissions: rolePermissions
        },
        allowedPermissions: permissionsToAllow
      }
    });
  } catch (error) {
    console.error('Allow role permissions error:', error);
    res.status(500).json({ message: 'Server error while allowing permissions' });
  }
};

/**
 * Update role permissions (affects all users with that role)
 */
const updateRolePermissions = async (req, res) => {
  try {
    const { roleName } = req.params;
    const { permissions } = req.body;

    // Only superadmin can update role permissions
    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      return res.status(403).json({ message: 'Access denied: Only superadmin can update role permissions' });
    }

    // Find the role
    const Role = require('../models/Role');
    const role = await Role.findOne({ name: roleName });
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Update role permissions
    role.permissions = permissions || [];
    await role.save();

    // Get all users with this role
    const usersWithRole = await User.find({ role: roleName });
    
    // Update all users' custom permissions based on new role permissions
    const updatePromises = usersWithRole.map(async (user) => {
      // Get user's current effective permissions
      const currentEffective = await user.getEffectivePermissions();
      
      // Calculate new allowed/denied based on new role permissions
      const effectiveSet = new Set(currentEffective);
      const newRoleSet = new Set(permissions || []);
      
      // What should be allowed (in current effective but not in new role)
      const newAllowed = currentEffective.filter(perm => !newRoleSet.has(perm));
      
      // What should be denied (in new role but not in current effective)
      const newDenied = (permissions || []).filter(perm => !effectiveSet.has(perm));
      
      // Update user's custom permissions
      user.customPermissions = user.customPermissions || { allowed: [], denied: [] };
      user.customPermissions.allowed = newAllowed;
      user.customPermissions.denied = newDenied;
      
      return user.save();
    });

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: `Role permissions updated successfully. This affects ${usersWithRole.length} users.`,
      role: {
        name: role.name,
        level: role.level,
        permissions: role.permissions
      },
      affectedUsers: usersWithRole.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email
      }))
    });
  } catch (error) {
    console.error('Update role permissions error:', error);
    res.status(500).json({ message: 'Server error while updating role permissions' });
  }
};

/**
 * Get all roles with their permissions
 */
const getAllRoles = async (req, res) => {
  try {
    // Only superadmin can view all roles
    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      return res.status(403).json({ message: 'Access denied: Only superadmin can view all roles' });
    }

    const Role = require('../models/Role');
    const roles = await Role.find({}).sort({ level: 1, name: 1 });

    // Get user count for each role
    const rolesWithUserCount = await Promise.all(
      roles.map(async (role) => {
        const userCount = await User.countDocuments({ role: role.name });
        return {
          id: role._id,
          name: role.name,
          level: role.level,
          permissions: role.permissions,
          userCount: userCount,
          createdAt: role.createdAt
        };
      })
    );

    res.json({
      success: true,
      roles: rolesWithUserCount,
      total: rolesWithUserCount.length
    });
  } catch (error) {
    console.error('Get all roles error:', error);
    res.status(500).json({ message: 'Server error while fetching roles' });
  }
};

/**
 * Get specific role with its permissions and users
 */
const getRoleDetails = async (req, res) => {
  try {
    const { roleName } = req.params;

    // Only superadmin can view role details
    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      return res.status(403).json({ message: 'Access denied: Only superadmin can view role details' });
    }

    const Role = require('../models/Role');
    const role = await Role.findOne({ name: roleName });
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Get all users with this role
    const usersWithRole = await User.find({ role: roleName })
      .select('name email level isActive customPermissions')
      .sort({ name: 1 });

    // Get effective permissions for each user
    const usersWithPermissions = await Promise.all(
      usersWithRole.map(async (user) => {
        const effectivePermissions = await user.getEffectivePermissions();
        return {
          id: user._id,
          name: user.name,
          email: user.email,
          level: user.level,
          isActive: user.isActive,
          effectivePermissions: effectivePermissions,
          customPermissions: user.customPermissions || { allowed: [], denied: [] }
        };
      })
    );

    res.json({
      success: true,
      role: {
        id: role._id,
        name: role.name,
        level: role.level,
        permissions: role.permissions,
        createdAt: role.createdAt
      },
      users: usersWithPermissions,
      totalUsers: usersWithPermissions.length
    });
  } catch (error) {
    console.error('Get role details error:', error);
    res.status(500).json({ message: 'Server error while fetching role details' });
  }
};

/**
 * CLEAN ALL USER PERMISSIONS (Superadmin only)
 */
const cleanAllUserPermissions = async (req, res) => {
  try {
    // Only superadmin can clean all permissions
    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      return res.status(403).json({ message: 'Access denied: Only superadmin can clean all permissions' });
    }

    console.log('🧹 CLEANING ALL USER PERMISSIONS...');
    
    const users = await User.find({});
    const Role = require('../models/Role');
    
    let cleanedUsers = 0;
    let totalPermissionsRemoved = 0;
    const results = [];

    for (const user of users) {
      console.log(`\n👤 Cleaning user: ${user.name} (${user.email}) - Role: ${user.role}`);
      
      // Get role permissions
      const roleDef = await Role.findOne({ name: user.role });
      const rolePermissions = roleDef?.permissions || [];
      
      // Get current effective permissions
      const currentEffective = await user.getEffectivePermissions();
      
      // Clear custom permissions (start fresh)
      const oldCustomAllowed = user.customPermissions?.allowed?.length || 0;
      const oldCustomDenied = user.customPermissions?.denied?.length || 0;
      
      user.customPermissions = {
        allowed: [],
        denied: []
      };
      
      await user.save();
      
      // Get new effective permissions
      const newEffective = await user.getEffectivePermissions();
      
      // Calculate what was removed
      const removed = currentEffective.filter(perm => !newEffective.includes(perm));
      totalPermissionsRemoved += removed.length;
      
      results.push({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level,
        before: {
          rolePermissions: rolePermissions.length,
          customAllowed: oldCustomAllowed,
          customDenied: oldCustomDenied,
          effectiveTotal: currentEffective.length
        },
        after: {
          rolePermissions: rolePermissions.length,
          customAllowed: 0,
          customDenied: 0,
          effectiveTotal: newEffective.length
        },
        removed: removed.length,
        efficiency: `${Math.round((rolePermissions.length / newEffective.length) * 100)}% role-based`
      });
      
      console.log(`   ✅ Cleaned: ${removed.length} excessive permissions removed`);
      console.log(`   📊 Efficiency: ${Math.round((rolePermissions.length / newEffective.length) * 100)}% role-based`);
      
      cleanedUsers++;
    }

    console.log(`\n🎉 CLEANING COMPLETED!`);
    console.log(`   👥 Users cleaned: ${cleanedUsers}`);
    console.log(`   🗑️ Total permissions removed: ${totalPermissionsRemoved}`);
    console.log(`   📈 Average efficiency improvement: ${Math.round(totalPermissionsRemoved / cleanedUsers)} permissions per user`);

    res.json({
      success: true,
      message: `Successfully cleaned permissions for ${cleanedUsers} users`,
      summary: {
        usersCleaned: cleanedUsers,
        totalPermissionsRemoved,
        averageRemovedPerUser: Math.round(totalPermissionsRemoved / cleanedUsers)
      },
      results: results
    });

  } catch (error) {
    console.error('❌ Clean all permissions error:', error);
    res.status(500).json({ message: 'Server error while cleaning all permissions' });
  }
};

/**
 * Debug endpoint to test permission system
 */
const debugPermissions = async (req, res) => {
  try {
    console.log('🔍 Debug: Starting permission debug...');
    
    // Test database connection
    const userCount = await User.countDocuments();
    console.log(`📊 Total users in database: ${userCount}`);
    
    // Test role count
    const roleCount = await Role.countDocuments();
    console.log(`📊 Total roles in database: ${roleCount}`);
    
    // Get first user for testing
    const firstUser = await User.findOne({}).select('-password');
    if (!firstUser) {
      return res.json({
        success: false,
        message: 'No users found in database',
        userCount,
        roleCount
      });
    }
    
    console.log(`👤 Testing with user: ${firstUser.email}`);
    
    // Test getEffectivePermissions
    let effectivePermissions = [];
    try {
      effectivePermissions = await firstUser.getEffectivePermissions();
      console.log(`✅ getEffectivePermissions worked: ${effectivePermissions.length} permissions`);
    } catch (error) {
      console.error(`❌ getEffectivePermissions failed:`, error);
    }
    
    // Test hasPermission
    let hasReadPermission = false;
    try {
      hasReadPermission = await firstUser.hasPermission('leads:read');
      console.log(`✅ hasPermission worked: ${hasReadPermission}`);
    } catch (error) {
      console.error(`❌ hasPermission failed:`, error);
    }
    
    res.json({
      success: true,
      debug: {
        userCount,
        roleCount,
        testUser: {
          id: firstUser._id,
          email: firstUser.email,
          role: firstUser.role,
          level: firstUser.level,
          isActive: firstUser.isActive
        },
        effectivePermissions,
        hasReadPermission,
        customPermissions: firstUser.customPermissions || {},
        restrictions: firstUser.restrictions || {}
      }
    });
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    res.status(500).json({
      success: false,
      message: 'Debug failed',
      error: error.message
    });
  }
};

module.exports = {
  getUserPermissions,
  updateUserPermissions,
  updateUserRestrictions,
  getUserProjectPermissions,
  setUserProjectPermissions,
  removeUserProjectPermissions,
  getAllUsersPermissions,
  updateUserEffectivePermissions,
  denyRolePermissions,
  allowRolePermissions,
  updateRolePermissions,
  getAllRoles,
  getRoleDetails,
  cleanAllUserPermissions,
  debugPermissions
};
