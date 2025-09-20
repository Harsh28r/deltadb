const Project = require('../models/Project');
const User = require('../models/User');
const Role = require('../models/Role');

function publicUser(user, rolePermsMap) {
  if (!user) return null;
  const roleKey = String(user.role || '').toLowerCase();
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    // level: user.level,
    // mobile: user.mobile,
    // companyName: user.companyName,
    // permissions: rolePermsMap?.get(roleKey) || [],
  };
}

function shapeProject(project, rolePermsMap) {
  if (!project) return null;
  return {
    _id: project._id,
    name: project.name,
    location: project.location,
    logo: project.logo,
    developBy: project.developBy,
    owner: publicUser(project.owner, rolePermsMap),
    members: (project.members || []).map((u) => publicUser(u, rolePermsMap)),
    managers: (project.managers || []).map((u) => publicUser(u, rolePermsMap)),
    createdAt: project.createdAt,
  };
}

async function buildRolePermsMapForProjects(projects) {
  const roleNames = new Set();
  const list = Array.isArray(projects) ? projects : [projects];
  for (const p of list) {
    const pushRole = (u) => {
      if (u && u.role) roleNames.add(String(u.role).toLowerCase());
    };
    pushRole(p.owner);
    for (const m of p.members || []) pushRole(m);
    for (const m of p.managers || []) pushRole(m);
  }
  if (roleNames.size === 0) return new Map();
  const roles = await Role.find({ name: { $in: Array.from(roleNames) } }).select('name permissions');
  const map = new Map();
  for (const r of roles) {
    map.set(String(r.name).toLowerCase(), (r.permissions || []).map((perm) => String(perm).toLowerCase()));
  }
  return map;
}

// Helper: recompute managers based on GLOBAL role permissions
async function computeManagersArray(project) {
  const managerUserIds = new Set();
  // Project owner is always a manager
  if (project.owner) managerUserIds.add(String(project.owner));

  const memberIds = (project.members || []).map((id) => String(id));
  if (memberIds.length === 0) return Array.from(managerUserIds);

  const users = await User.find({ _id: { $in: memberIds } }).select('role');
  const uniqueRoleNames = [...new Set(users.map((u) => String(u.role || '').toLowerCase()))];
  const roles = await Role.find({ name: { $in: uniqueRoleNames } }).select('name permissions');
  const roleNameToPerms = new Map(roles.map((r) => [r.name, (r.permissions || []).map((p) => String(p).toLowerCase())]));

  for (const u of users) {
    const perms = roleNameToPerms.get(String(u.role || '').toLowerCase()) || [];
    if (perms.includes('manage_project')) {
      managerUserIds.add(String(u._id));
    }
  }
  return Array.from(managerUserIds);
}

const createProject = async (req, res) => {
  const { name, location, logo, developBy, ownerEmail, ownerName } = req.body;
  try {
    if (!name || !location || !developBy) {
      return res.status(400).json({ message: 'Name, location, and developBy are required' });
    }

    let ownerId = null;
    
    // If user is authenticated, use their ID as owner
    if (req.user) {
      ownerId = req.user._id;
    } 
    // If no user but ownerEmail provided, try to find or create user
    else if (ownerEmail && ownerName) {
      try {
        const User = require('../models/User');
        let owner = await User.findOne({ email: ownerEmail });
        
        if (!owner) {
          // Create a new user with default role
          owner = new User({
            name: ownerName,
            email: ownerEmail,
            password: 'default123', // You might want to generate a random password
            role: 'user',
            level: 3
          });
          await owner.save();
        }
        ownerId = owner._id;
      } catch (userError) {
        console.error('Error creating/finding owner:', userError);
        return res.status(400).json({ message: 'Invalid owner information' });
      }
    }
    // If no owner specified, create project without owner (optional)
    // ownerId will remain null

    const project = new Project({
      name,
      location,
      logo,
      developBy,
      owner: ownerId,
      members: ownerId ? [ownerId] : [], 
      managers: ownerId ? [ownerId] : [],
    });
    
    await project.save();
    const populated = await Project.findById(project._id)
      .populate('owner', 'name email role level mobile companyName')
      .populate('members', 'name email role level mobile companyName')
      .populate('managers', 'name email role level mobile companyName');
    const rolePermsMap = await buildRolePermsMapForProjects(populated);
    res.status(201).json(shapeProject(populated, rolePermsMap));
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

const getProjects = async (req, res) => {
  try {
    console.log('=== GET PROJECTS REQUEST ===');
    console.log('User authenticated:', !!req.user);
    
    let projects;
    
    // If user is authenticated and is superadmin, get all projects
    if (req.user && req.user.role === 'superadmin') {
      console.log('Superadmin user - getting all projects');
      projects = await Project.find({})
        .populate('owner', 'name email role level mobile companyName')
        .populate('members', 'name email role level mobile companyName')
        .populate('managers', 'name email role level mobile companyName');
    } 
    // If user is authenticated but not superadmin, get projects they're members of
    else if (req.user) {
      console.log('Regular user - getting user-specific projects');
      projects = await Project.find({ 
        $or: [
          { members: req.user._id },
          { owner: req.user._id },
          { managers: req.user._id }
        ]
      })
        .populate('owner', 'name email role level mobile companyName')
        .populate('members', 'name email role level mobile companyName')
        .populate('managers', 'name email role level mobile companyName');
    } 
    // If no user (public access), get all projects but with limited data
    else {
      console.log('Public access - getting all projects with limited data');
      projects = await Project.find({})
        .populate('owner', 'name email role level mobile companyName')
        .populate('members', 'name email role level mobile companyName')
        .populate('managers', 'name email role level mobile companyName');
    }
    
    console.log('Found projects:', projects.length);
    const rolePermsMap = await buildRolePermsMapForProjects(projects);
    res.json(projects.map((p) => shapeProject(p, rolePermsMap)));
  } catch (error) {
    console.error('Error in getProjects:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add a single member to a project; managers recomputed based on global role permissions
const addMember = async (req, res) => {
  const { projectId, userId } = req.body;
  try {
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!project.members.map(String).includes(String(userId))) {
      project.members.push(userId);
    }
    project.managers = await computeManagersArray(project);
    await project.save();
    const populated = await Project.findById(project._id)
      .populate('owner', 'name email role level mobile companyName')
      .populate('members', 'name email role level mobile companyName')
      .populate('managers', 'name email role level mobile companyName');
    const rolePermsMap = await buildRolePermsMapForProjects(populated);
    res.json({ message: 'Member added', project: shapeProject(populated, rolePermsMap) });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Bulk add members to a project
const bulkAddMembers = async (req, res) => {
  const { projectId, userIds } = req.body || {};
  try {
    if (!projectId || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'projectId and non-empty userIds are required' });
    }
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const uniqueIds = [...new Set(userIds.map((id) => String(id)))];
    for (const id of uniqueIds) {
      if (!project.members.map(String).includes(String(id))) {
        project.members.push(id);
      }
    }
    project.managers = await computeManagersArray(project);
    await project.save();
    const populated = await Project.findById(project._id)
      .populate('owner', 'name email role level mobile companyName')
      .populate('members', 'name email role level mobile companyName')
      .populate('managers', 'name email role level mobile companyName');
    const rolePermsMap = await buildRolePermsMapForProjects(populated);
    res.json({ message: 'Members added', project: shapeProject(populated, rolePermsMap) });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Remove a single member from a project; owner cannot be removed
const removeMember = async (req, res) => {
  const { projectId, userId } = req.body || {};
  try {
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (String(project.owner) === String(userId)) {
      return res.status(400).json({ message: 'Cannot remove project owner' });
    }
    project.members = (project.members || []).filter((id) => String(id) !== String(userId));
    project.managers = await computeManagersArray(project);
    await project.save();
    const populated = await Project.findById(project._id)
      .populate('owner', 'name email role level mobile companyName')
      .populate('members', 'name email role level mobile companyName')
      .populate('managers', 'name email role level mobile companyName');
    const rolePermsMap = await buildRolePermsMapForProjects(populated);
    res.json({ message: 'Member removed', project: shapeProject(populated, rolePermsMap) });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Bulk remove members from a project; owner cannot be removed
const bulkRemoveMembers = async (req, res) => {
  const { projectId, userIds } = req.body || {};
  try {
    if (!projectId || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'projectId and non-empty userIds are required' });
    }
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const removeSet = new Set(userIds.map((id) => String(id)));
    removeSet.delete(String(project.owner));
    project.members = (project.members || []).filter((id) => !removeSet.has(String(id)));
    project.managers = await computeManagersArray(project);
    await project.save();
    const populated = await Project.findById(project._id)
      .populate('owner', 'name email role level mobile companyName')
      .populate('members', 'name email role level mobile companyName')
      .populate('managers', 'name email role level mobile companyName');
    const rolePermsMap = await buildRolePermsMapForProjects(populated);
    res.json({ message: 'Members removed', project: shapeProject(populated, rolePermsMap) });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Note: No per-project role operations anymore; roles are global.

// Rename role: not applicable at project level anymore

// Check if current user has a permission in a project
const checkProjectPermission = async (req, res) => {
  try {
    const project = req.project; // injected by authorize middleware
    res.json({ allowed: true, projectId: project._id });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Create a new user (or use existing by email) and add to a project in one call
const createUserAndAddToProject = async (req, res) => {
  const { projectId, name, email, password, mobile, companyName, updatePasswordIfExists, roleName } = req.body || {};
  try {
    if (!projectId) {
      return res.status(400).json({ message: 'projectId is required' });
    }
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, and password are required' });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Find or create user by email
    const normalizedEmail = String(email).trim().toLowerCase();
    let user = await User.findOne({ email: normalizedEmail });
    let created = false;
    if (!user) {
      // Optional: set a global role if provided
      let roleDoc = null;
      if (roleName) {
        roleDoc = await require('../models/Role').findOne({ name: String(roleName).toLowerCase().trim() });
      }
      user = new User({ name, email: normalizedEmail, password, mobile, companyName, role: roleDoc?.name || 'user', level: roleDoc?.level || 3 });
      await user.save();
      created = true;
    }
    // Optional: update password for existing user if requested
    if (!created && updatePasswordIfExists && password) {
      user.password = password;
      await user.save();
    }

    // Ensure user is a project member
    if (!project.members.map((id) => String(id)).includes(String(user._id))) {
      project.members.push(user._id);
    }

    // Recompute managers based on permissions
    project.managers = await computeManagersArray(project);
    await project.save();
    const populated = await Project.findById(project._id)
      .populate('owner', 'name email role level mobile companyName')
      .populate('members', 'name email role level mobile companyName')
      .populate('managers', 'name email role level mobile companyName');
    const rolePermsMap = await buildRolePermsMapForProjects(populated);
    res.status(created ? 201 : 200).json({ message: 'User added to project', created, user: { id: user._id, name: user.name, email: user.email }, project: shapeProject(populated, rolePermsMap) });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Dynamic role assignment within project based on user's role level
const assignRoleInProject = async (req, res) => {
  const { projectId, userId, newRoleName } = req.body || {};
  try {
    if (!projectId || !userId || !newRoleName) {
      return res.status(400).json({ message: 'projectId, userId, and newRoleName are required' });
    }

    // Check if current user is authenticated and is a project member
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Check if current user is a project member
    const isMember = project.members.some(id => String(id) === String(req.user._id));
    const isOwner = String(project.owner) === String(req.user._id);
    const isManager = project.managers.some(id => String(id) === String(req.user._id));

    if (!isMember && !isOwner && !isManager) {
      return res.status(403).json({ message: 'You must be a project member to assign roles' });
    }

    // Find the target user
    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ message: 'Target user not found' });

    // Check if target user is in the project
    if (!project.members.some(id => String(id) === String(userId))) {
      return res.status(400).json({ message: 'Target user is not a project member' });
    }

    // Find the new role
    const newRole = await Role.findOne({ name: String(newRoleName).toLowerCase().trim() });
    if (!newRole) return res.status(404).json({ message: 'Role not found' });

    // Dynamic role assignment logic based on current user's role level
    const currentUserLevel = req.user.level || 999;
    const targetUserLevel = targetUser.level || 999;
    const newRoleLevel = newRole.level || 999;

    // Superadmin can assign any role
    if (currentUserLevel === 1) {
      // Allow assignment
    }
    // Project owner can assign roles at their level or lower
    else if (isOwner) {
      if (newRoleLevel < currentUserLevel) {
        return res.status(403).json({ 
          message: `As project owner (level ${currentUserLevel}), you can only assign roles at level ${currentUserLevel} or lower. Cannot assign role '${newRoleName}' (level ${newRoleLevel})` 
        });
      }
    }
    // Managers can assign roles at their level or lower
    else if (isManager) {
      if (newRoleLevel < currentUserLevel) {
        return res.status(403).json({ 
          message: `As a project manager (level ${currentUserLevel}), you can only assign roles at level ${currentUserLevel} or lower. Cannot assign role '${newRoleName}' (level ${newRoleLevel})` 
        });
      }
    }
    // Regular members can only assign roles at their level or lower
    else {
      if (newRoleLevel < currentUserLevel) {
        return res.status(403).json({ 
          message: `As a project member (level ${currentUserLevel}), you can only assign roles at level ${currentUserLevel} or lower. Cannot assign role '${newRoleName}' (level ${newRoleLevel})` 
        });
      }
    }

    // Prevent assigning superadmin role to regular users
    if (newRoleLevel === 1 && currentUserLevel !== 1) {
      return res.status(403).json({ message: 'Only superadmin can assign superadmin role' });
    }

    // Update user's role
    targetUser.role = newRole.name;
    targetUser.roleRef = newRole._id;
    targetUser.level = newRole.level;
    await targetUser.save();

    // Recompute project managers based on new role permissions
    project.managers = await computeManagersArray(project);
    await project.save();

    // Return updated project
    const populated = await Project.findById(project._id)
      .populate('owner', 'name email role level mobile companyName')
      .populate('members', 'name email role level mobile companyName')
      .populate('managers', 'name email role level mobile companyName');
    const rolePermsMap = await buildRolePermsMapForProjects(populated);

    res.json({ 
      message: `Role assigned successfully. ${targetUser.name} is now ${newRole.name}`,
      user: { 
        id: targetUser._id, 
        name: targetUser.name, 
        email: targetUser.email,
        oldRole: targetUser.role,
        newRole: newRole.name,
        newLevel: newRole.level
      },
      project: shapeProject(populated, rolePermsMap),
      roleAssignment: {
        assignedBy: req.user.name,
        assignedByRole: req.user.role,
        assignedByLevel: req.user.level,
        assignedTo: targetUser.name,
        newRole: newRole.name,
        newLevel: newRole.level
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Get available roles that current user can assign in a project
const getAssignableRolesInProject = async (req, res) => {
  const { projectId } = req.params;
  try {
    if (!projectId) {
      return res.status(400).json({ message: 'projectId is required' });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Check if current user is a project member
    const isMember = project.members.some(id => String(id) === String(req.user._id));
    const isOwner = String(project.owner) === String(req.user._id);
    const isManager = project.managers.some(id => String(id) === String(req.user._id));

    if (!isMember && !isOwner && !isManager) {
      return res.status(403).json({ message: 'You must be a project member to view assignable roles' });
    }

    const currentUserLevel = req.user.level || 999;
    let assignableRoles;

    if (currentUserLevel === 1) {
      // Superadmin can assign any role
      assignableRoles = await Role.find().sort({ level: 1, name: 1 });
    } else {
      // Others can only assign roles at their level or lower
      assignableRoles = await Role.find({ level: { $lte: currentUserLevel } }).sort({ level: 1, name: 1 });
    }

    res.json({
      assignableRoles,
      currentUser: {
        name: req.user.name,
        role: req.user.role,
        level: req.user.level
      },
      project: {
        id: project._id,
        name: project.name
      },
      roleAssignmentRules: {
        canAssignSuperadmin: currentUserLevel === 1,
        maxAssignableLevel: currentUserLevel,
        message: currentUserLevel === 1 
          ? 'You can assign any role' 
          : `You can assign roles at level ${currentUserLevel} or lower`
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Bulk role assignment within project - assign same role to multiple users
const bulkAssignRoleInProject = async (req, res) => {
  const { projectId, userIds, newRoleName } = req.body || {};
  try {
    if (!projectId || !userIds || !newRoleName) {
      return res.status(400).json({ message: 'projectId, userIds, and newRoleName are required' });
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'userIds must be a non-empty array' });
    }

    // Check if current user is authenticated and is a project member
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Check if current user is a project member
    const isMember = project.members.some(id => String(id) === String(req.user._id));
    const isOwner = String(project.owner) === String(req.user._id);
    const isManager = project.managers.some(id => String(id) === String(req.user._id));

    if (!isMember && !isOwner && !isManager) {
      return res.status(403).json({ message: 'You must be a project member to assign roles' });
    }

    // Find the new role
    const newRole = await Role.findOne({ name: String(newRoleName).toLowerCase().trim() });
    if (!newRole) return res.status(404).json({ message: 'Role not found' });

    // Dynamic role assignment logic based on current user's role level
    const currentUserLevel = req.user.level || 999;
    const newRoleLevel = newRole.level || 999;

    // Superadmin can assign any role
    if (currentUserLevel === 1) {
      // Allow assignment
    }
    // Project owner can assign roles at their level or lower
    else if (isOwner) {
      if (newRoleLevel < currentUserLevel) {
        return res.status(403).json({ 
          message: `As project owner (level ${currentUserLevel}), you can only assign roles at level ${currentUserLevel} or lower. Cannot assign role '${newRoleName}' (level ${newRoleLevel})` 
        });
      }
    }
    // Managers can assign roles at their level or lower
    else if (isManager) {
      if (newRoleLevel < currentUserLevel) {
        return res.status(403).json({ 
          message: `As a project manager (level ${currentUserLevel}), you can only assign roles at level ${currentUserLevel} or lower. Cannot assign role '${newRoleName}' (level ${newRoleLevel})` 
        });
      }
    }
    // Regular members can only assign roles at their level or lower
    else {
      if (newRoleLevel < currentUserLevel) {
        return res.status(403).json({ 
          message: `As a project member (level ${currentUserLevel}), you can only assign roles at level ${currentUserLevel} or lower. Cannot assign role '${newRoleName}' (level ${newRoleLevel})` 
        });
      }
    }

    // Prevent assigning superadmin role to regular users
    if (newRoleLevel === 1 && currentUserLevel !== 1) {
      return res.status(403).json({ message: 'Only superadmin can assign superadmin role' });
    }

    // Process each user
    const results = [];
    const errors = [];
    const updatedUsers = [];

    for (const userId of userIds) {
      try {
        // Find the target user
        const targetUser = await User.findById(userId);
        if (!targetUser) {
          errors.push({ userId, error: 'User not found' });
          continue;
        }

        // Check if target user is in the project
        if (!project.members.some(id => String(id) === String(userId))) {
          errors.push({ userId, userName: targetUser.name, error: 'User is not a project member' });
          continue;
        }

        // Store old role info
        const oldRole = targetUser.role;
        const oldLevel = targetUser.level;

        // Update user's role
        targetUser.role = newRole.name;
        targetUser.roleRef = newRole._id;
        targetUser.level = newRole.level;
        await targetUser.save();

        updatedUsers.push(targetUser._id);
        results.push({
          userId: targetUser._id,
          userName: targetUser.name,
          oldRole,
          oldLevel,
          newRole: newRole.name,
          newLevel: newRole.level,
          status: 'success'
        });

      } catch (userError) {
        errors.push({ userId, error: userError.message });
      }
    }

    // Only recompute project managers if we have successful updates
    if (updatedUsers.length > 0) {
      project.managers = await computeManagersArray(project);
      await project.save();
    }

    // Return updated project
    const populated = await Project.findById(project._id)
      .populate('owner', 'name email role level mobile companyName')
      .populate('members', 'name email role level mobile companyName')
      .populate('managers', 'name email role level mobile companyName');
    const rolePermsMap = await buildRolePermsMapForProjects(populated);

    res.json({ 
      message: `Bulk role assignment completed. ${results.length} users updated to ${newRole.name}`,
      summary: {
        totalRequested: userIds.length,
        successful: results.length,
        failed: errors.length,
        newRole: newRole.name,
        newLevel: newRole.level
      },
      results,
      errors,
      project: shapeProject(populated, rolePermsMap),
      roleAssignment: {
        assignedBy: req.user.name,
        assignedByRole: req.user.role,
        assignedByLevel: req.user.level,
        newRole: newRole.name,
        newLevel: newRole.level
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

module.exports = {
  createProject,
  getProjects,
  addMember,
  bulkAddMembers,
  removeMember,
  bulkRemoveMembers,
  checkProjectPermission,
  createUserAndAddToProject,
  assignRoleInProject,
  bulkAssignRoleInProject,
  getAssignableRolesInProject,
};
