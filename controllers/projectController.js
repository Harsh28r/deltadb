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
    level: user.level,
    mobile: user.mobile,
    companyName: user.companyName,
    permissions: rolePermsMap?.get(roleKey) || [],
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
  const { name, location, logo, developBy } = req.body;
  try {
    if (!name || !location || !developBy) {
      return res.status(400).json({ message: 'Name, location, and developBy are required' });
    }

    const project = new Project({
      name,
      location,
      logo,
      developBy,
      owner: req.user._id,
      members: [req.user._id],
      managers: [req.user._id],
    });
    await project.save();
    const populated = await Project.findById(project._id)
      .populate('owner', 'name email role level mobile companyName')
      .populate('members', 'name email role level mobile companyName')
      .populate('managers', 'name email role level mobile companyName');
    const rolePermsMap = await buildRolePermsMapForProjects(populated);
    res.status(201).json(shapeProject(populated, rolePermsMap));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

const getProjects = async (req, res) => {
  try {
    const projects = await Project.find({ members: req.user._id })
      .populate('owner', 'name email role level mobile companyName')
      .populate('members', 'name email role level mobile companyName')
      .populate('managers', 'name email role level mobile companyName');
    const rolePermsMap = await buildRolePermsMapForProjects(projects);
    res.json(projects.map((p) => shapeProject(p, rolePermsMap)));
  } catch (error) {
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

module.exports = {
  createProject,
  getProjects,
  addMember,
  bulkAddMembers,
  removeMember,
  bulkRemoveMembers,
  checkProjectPermission,
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

module.exports.createUserAndAddToProject = createUserAndAddToProject;