const User = require('../models/User');
const Role = require('../models/Role');
const Project = require('../models/Project');
const jwt = require('jsonwebtoken');

// Superadmin-only login configuration
const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || 'superadmin@deltayards.com').trim().toLowerCase();
const EXPECTED_ADMIN_PASS = String(process.env.SUPERADMIN_ADMIN_PASS || '123456');

const setTokenHeaders = (res, token) => {
  res.set('Authorization', `Bearer ${token}`);
  res.set('x-auth-token', token);
  res.set('Access-Control-Expose-Headers', 'Authorization, x-auth-token');
  res.cookie('auth_token', token, {
    httpOnly: false,         // set true if you don't want JS to read it
    sameSite: 'lax',
    secure: false,           // set true on HTTPS in production
    maxAge: 60 * 60 * 1000,  // 1 hour
  });
};

const registerUser = async (req, res) => {
  const { name, email, password, mobile, companyName } = req.body || {};
  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    let user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (user) return res.status(400).json({ message: 'User already exists' });

    // Ensure default roles exist
    let superadminRole = await Role.findOne({ name: 'superadmin' });
    if (!superadminRole) {
      superadminRole = await Role.create({
        name: 'superadmin',
        level: 1,
        permissions: ['manage_project', 'view_team_dashboard', 'view_sales_data', 'edit_sales_data'],
      });
    }

    user = new User({
      name,
      email: String(email).trim().toLowerCase(),
      password,
      mobile,
      companyName,
      role: 'superadmin',
      roleRef: superadminRole._id,
      level: superadminRole.level,
    });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    setTokenHeaders(res, token);
    res.status(201).json({
      token,
      user: { id: user._id, name, email, mobile, companyName, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

const registerManager = async (req, res) => {
  const { name, email, password, mobile, companyName } = req.body || {};
  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    let user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (user) return res.status(400).json({ message: 'User already exists' });

    let role = await Role.findOne({ name: 'manager' });
    if (!role) {
      role = await Role.create({
        name: 'manager',
        level: 2,
        permissions: ['manage_project', 'view_team_dashboard', 'view_sales_data'],
      });
    }

    user = new User({
      name,
      email: String(email).trim().toLowerCase(),
      password,
      mobile,
      companyName,
      role: 'manager',
      roleRef: role._id,
      level: role.level,
    });
    await user.save();

    res.status(201).json({ user: { id: user._id, name, email, mobile, companyName, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

const registerSales = async (req, res) => {
  const { name, email, password, mobile, companyName } = req.body || {};
  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    let user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (user) return res.status(400).json({ message: 'User already exists' });

    let role = await Role.findOne({ name: 'sales' });
    if (!role) {
      role = await Role.create({ name: 'sales', level: 3, permissions: ['view_sales_data'] });
    }

    user = new User({
      name,
      email: String(email).trim().toLowerCase(),
      password,
      mobile,
      companyName,
      role: 'sales',
      roleRef: role._id,
      level: role.level,
    });
    await user.save();

    res.status(201).json({ user: { id: user._id, name, email, mobile, companyName, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

const initSuperadmin = async (req, res) => {
  const { name, email, mobile, companyName, password } = req.body || {};
  try {
    const existingSuperadmins = await User.countDocuments({ role: 'superadmin' });
    if (existingSuperadmins > 0) {
      return res.status(403).json({ message: 'Superadmin already initialized' });
    }

    if (!name || !email || !mobile || !companyName || !password) {
      return res.status(400).json({ message: 'All fields are required for superadmin' });
    }

    let user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (user) return res.status(400).json({ message: 'User already exists' });

    let role = await Role.findOne({ name: 'superadmin' });
    if (!role) role = await Role.create({ name: 'superadmin', level: 1 });

    user = new User({
      name,
      email: String(email).trim().toLowerCase(),
      mobile,
      companyName,
      password,
      role: 'superadmin',
      roleRef: role._id,
      level: role.level,
    });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    setTokenHeaders(res, token);
    res.status(201).json({
      token,
      user: { id: user._id, name, email, mobile, companyName, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

const loginUser = async (req, res) => {
  const email = (req.body?.email ?? req.query?.email);
  const password = (req.body?.password ?? req.query?.password);
  const projectId = (req.body?.projectId ?? req.query?.projectId);
  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (normalizedEmail !== SUPERADMIN_EMAIL) {
      return res.status(403).json({ message: 'Only superadmin login is allowed' });
    }
    if (String(password) !== EXPECTED_ADMIN_PASS) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Ensure superadmin role exists
    let superadminRole = await Role.findOne({ name: 'superadmin' });
    if (!superadminRole) {
      superadminRole = await Role.create({
        name: 'superadmin',
        level: 1,
        permissions: ['manage_project', 'view_team_dashboard', 'view_sales_data', 'edit_sales_data'],
      });
    }

    // Ensure the single superadmin user exists
    let user = await User.findOne({ email: SUPERADMIN_EMAIL });
    if (!user) {
      user = new User({
        name: 'Super Admin',
        email: SUPERADMIN_EMAIL,
        password: EXPECTED_ADMIN_PASS,
        companyName: 'DeltaYards',
        role: 'superadmin',
        roleRef: superadminRole._id,
        level: superadminRole.level,
      });
      await user.save();
    }

    // Optional memberships
    let projectMemberships = [];
    let activeProject = null;
    const userRoleName = 'superadmin';
    const globalPermissions = (superadminRole?.permissions || []).map((p) => String(p).toLowerCase());

    if (projectId) {
      const project = await Project.findById(projectId).select('name members');
      if (project && (project.members || []).map(String).includes(String(user._id))) {
        activeProject = {
          projectId: String(project._id),
          projectName: project.name,
          roleName: userRoleName,
          permissions: globalPermissions,
        };
      }
    } else {
      const projects = await Project.find({ members: user._id })
        .select('name members')
        .populate('members', 'name email role');
      projectMemberships = projects.map((p) => ({
        projectId: String(p._id),
        projectName: p.name,
        roleName: userRoleName,
        permissions: globalPermissions,
        members: (p.members || []).map((m) => ({ id: m._id, name: m.name, email: m.email, role: m.role })),
      }));
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    setTokenHeaders(res, token);
    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: SUPERADMIN_EMAIL,
        mobile: user.mobile,
        companyName: user.companyName,
        role: user.role,
        projectMemberships,
        activeProject,
      },
      redirect: '/',
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
};

const adminLogin = async (req, res) => {
  try {
    console.log('=== ADMIN LOGIN ATTEMPT ===');
    console.log('Request body:', req.body);
    console.log('Request query:', req.query);
    
    const providedEmail = (req.body?.email ?? req.query?.email ?? SUPERADMIN_EMAIL).trim().toLowerCase();
    const adminPassFromRequest = (req.body?.adminPass ?? req.query?.adminPass ?? req.body?.password ?? req.query?.password);

    console.log('Provided email:', providedEmail);
    console.log('Expected email:', SUPERADMIN_EMAIL);
    console.log('Admin pass provided:', !!adminPassFromRequest);

    if (providedEmail !== SUPERADMIN_EMAIL) {
      return res.status(403).json({ message: 'Only superadmin account is allowed' });
    }
    if (!adminPassFromRequest) {
      return res.status(400).json({ message: 'adminPass is required' });
    }
    if (String(adminPassFromRequest) !== EXPECTED_ADMIN_PASS) {
      return res.status(403).json({ message: 'Invalid admin pass' });
    }

    console.log('Credentials validated, checking database connection...');
    
    // Check MongoDB connection status
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected. Ready state:', mongoose.connection.readyState);
      return res.status(500).json({ 
        message: 'Database connection not ready',
        readyState: mongoose.connection.readyState
      });
    }

    console.log('MongoDB connected, looking for superadmin role...');
    
    // Ensure superadmin role exists
    let superadminRole;
    try {
      superadminRole = await Role.findOne({ name: 'superadmin' }).maxTimeMS(5000); // 5 second timeout
      console.log('Superadmin role found:', !!superadminRole);
    } catch (roleError) {
      console.error('Error finding superadmin role:', roleError);
      return res.status(500).json({ 
        message: 'Database operation failed',
        error: roleError.message 
      });
    }
    
    if (!superadminRole) {
      console.log('Creating superadmin role...');
      try {
        superadminRole = await Role.create({
          name: 'superadmin',
          level: 1,
          permissions: ['manage_project', 'view_team_dashboard', 'view_sales_data', 'edit_sales_data'],
        });
        console.log('Superadmin role created successfully');
      } catch (createRoleError) {
        console.error('Error creating superadmin role:', createRoleError);
        return res.status(500).json({ 
          message: 'Failed to create superadmin role',
          error: createRoleError.message 
        });
      }
    }

    console.log('Checking if superadmin user exists...');
    
    // Ensure user exists
    let user;
    try {
      user = await User.findOne({ email: SUPERADMIN_EMAIL }).maxTimeMS(5000); // 5 second timeout
      console.log('Superadmin user found:', !!user);
    } catch (userFindError) {
      console.error('Error finding superadmin user:', userFindError);
      return res.status(500).json({ 
        message: 'Failed to find superadmin user',
        error: userFindError.message 
      });
    }
    
    if (!user) {
      console.log('Creating superadmin user...');
      try {
        user = new User({
          name: 'Super Admin',
          email: SUPERADMIN_EMAIL,
          password: EXPECTED_ADMIN_PASS,
          companyName: 'DeltaYards',
          mobile: '',
          role: 'superadmin',
          roleRef: superadminRole._id,
          level: superadminRole.level,
        });
        await user.save();
        console.log('Superadmin user created successfully');
      } catch (createUserError) {
        console.error('Error creating superadmin user:', createUserError);
        return res.status(500).json({ 
          message: 'Failed to create superadmin user',
          error: createUserError.message 
        });
      }
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    setTokenHeaders(res, token);
    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: SUPERADMIN_EMAIL,
        mobile: user.mobile,
        companyName: user.companyName,
        role: user.role,
      },
      redirect: '/',
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error' });
  }
};

const currentUser = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    return res.json({
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      mobile: req.user.mobile,
      companyName: req.user.companyName,
      role: req.user.role,
      level: req.user.level,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error' });
  }
};

const createRole = async (req, res) => {
  const { name, level } = req.body || {};
  try {
    if (!name) return res.status(400).json({ message: 'Role name is required' });
    
    // Set default level if not provided
    const roleLevel = level || 3;

    const normalized = String(name).toLowerCase().trim();
    let role = await Role.findOne({ name: normalized });
    if (role) return res.status(400).json({ message: 'Role already exists', role });

    role = await Role.create({ name: normalized, level: roleLevel });
    res.status(201).json(role);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

const editRole = async (req, res) => {
  const { id } = req.params;
  const { name, level, permissions } = req.body || {};
  
  try {
    if (!id) return res.status(400).json({ message: 'Role ID is required' });
    if (!name && level === undefined && !permissions) {
      return res.status(400).json({ message: 'At least one field (name, level, or permissions) is required' });
    }

    const role = await Role.findById(id);
    if (!role) return res.status(404).json({ message: 'Role not found' });

    // Check if trying to edit superadmin role (level 1) - prevent downgrading
    if (role.level === 1 && level !== undefined && level > 1) {
      return res.status(403).json({ message: 'Cannot downgrade superadmin role level' });
    }

    // Update fields if provided
    if (name) {
      const normalized = String(name).toLowerCase().trim();
      // Check if new name conflicts with existing role (excluding current role)
      const existingRole = await Role.findOne({ name: normalized, _id: { $ne: id } });
      if (existingRole) return res.status(400).json({ message: 'Role name already exists' });
      role.name = normalized;
    }
    
    if (level !== undefined) {
      if (level < 1) return res.status(400).json({ message: 'Level must be >= 1' });
      role.level = level;
    }
    
    if (permissions) {
      role.permissions = Array.isArray(permissions) ? permissions : [permissions];
    }

    await role.save();
    res.json({ message: 'Role updated successfully', role });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

const deleteRole = async (req, res) => {
  const { id } = req.params;
  
  try {
    if (!id) return res.status(400).json({ message: 'Role ID is required' });

    const role = await Role.findById(id);
    if (!role) return res.status(404).json({ message: 'Role not found' });

    // Prevent deletion of superadmin role (level 1)
    if (role.level === 1) {
      return res.status(403).json({ message: 'Cannot delete superadmin role' });
    }

    // Check if any users are using this role
    const usersWithRole = await User.countDocuments({ roleRef: id });
    if (usersWithRole > 0) {
      return res.status(400).json({ 
        message: `Cannot delete role. ${usersWithRole} user(s) are currently using this role.` 
      });
    }

    await Role.findByIdAndDelete(id);
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

const listRoles = async (_req, res) => {
  try {
    const roles = await Role.find().sort({ level: 1, name: 1 });
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

const createUserWithRole = async (req, res) => {
  const { name, email, password, mobile, companyName, roleName } = req.body || {};
  try {
    if (!name || !email || !password || !roleName) {
      return res.status(400).json({ message: 'Name, email, password, and roleName are required' });
    }

    let existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const role = await Role.findOne({ name: String(roleName).toLowerCase().trim() });
    if (!role) return res.status(400).json({ message: 'Role not found' });

    const user = new User({
      name,
      email,
      password,
      mobile,
      companyName,
      role: role.name,
      roleRef: role._id,
      level: role.level,
    });
    await user.save();

    res.status(201).json({
      user: { id: user._id, name, email, mobile, companyName, role: user.role, level: user.level },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Get users by role - for role-based user filtering
const getUsersByRole = async (req, res) => {
  const { roleName } = req.params;
  
  try {
    if (!roleName) {
      return res.status(400).json({ message: 'Role name is required' });
    }

    // Find the role first to validate it exists
    const role = await Role.findOne({ name: String(roleName).toLowerCase().trim() });
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Get all users with this role
    const users = await User.find({ 
      role: role.name 
    }).select('-password').sort({ createdAt: -1 });

    res.json({
      role: {
        name: role.name,
        level: role.level,
        permissions: role.permissions
      },
      users: users,
      totalCount: users.length
    });

  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Get all users grouped by role - for comprehensive user management
const getAllUsersGroupedByRole = async (req, res) => {
  try {
    // Get all roles
    const roles = await Role.find().sort({ level: 1 });
    
    // Get users grouped by role
    const usersByRole = {};
    
    for (const role of roles) {
      const users = await User.find({ role: role.name })
        .select('-password')
        .sort({ createdAt: -1 });
      
      usersByRole[role.name] = {
        role: {
          name: role.name,
          level: role.level,
          permissions: role.permissions
        },
        users: users,
        count: users.length
      };
    }

    res.json({
      usersByRole,
      totalRoles: roles.length,
      totalUsers: Object.values(usersByRole).reduce((sum, group) => sum + group.count, 0)
    });

  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  registerManager,
  registerSales,
  initSuperadmin,
  createRole,
  editRole,
  deleteRole,
  listRoles,
  createUserWithRole,
  adminLogin,
  currentUser,
  getUsersByRole,
  getAllUsersGroupedByRole,
};
