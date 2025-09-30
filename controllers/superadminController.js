const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const User = require('../models/User');
const Role = require('../models/Role');
const UserReporting = require('../models/UserReporting');
const UserService = require('../services/userService');
// const { getAvailableRolesForLevel } = require('../middleware/roleLevelAuth');

// Initialize user service (userService is exported as instance)
const userService = UserService;

// Joi validation schemas
const registerUserSchema = Joi.object({
  name: Joi.string().required().min(2).max(100).trim(),
  email: Joi.string().email().required().lowercase(),
  password: Joi.string().required().min(6).max(128),
  mobile: Joi.string().pattern(/^\d{10}$/).optional(),
  companyName: Joi.string().min(2).max(100).trim().optional()
});

const loginUserSchema = Joi.object({
  email: Joi.string().email().required().lowercase(),
  password: Joi.string().required().min(1).max(128)
});

const adminLoginSchema = Joi.object({
  email: Joi.string().email().required().lowercase(),
  password: Joi.string().required().min(1).max(128)
});

const createRoleSchema = Joi.object({
  name: Joi.string().required().min(2).max(50).lowercase().trim(),
  permissions: Joi.array().items(Joi.string().lowercase().trim()).default([]),
  level: Joi.number().integer().min(1).max(10).required()
});

const updateRoleSchema = Joi.object({
  name: Joi.string().min(2).max(50).lowercase().trim().optional(),
  permissions: Joi.array().items(Joi.string().lowercase().trim()).optional(),
  level: Joi.number().integer().min(1).max(10).optional()
});

const createUserWithRoleSchema = Joi.object({
  name: Joi.string().required().min(2).max(100).trim(),
  email: Joi.string().email().required().lowercase(),
  password: Joi.string().required().min(6).max(128),
  mobile: Joi.string().pattern(/^\d{10}$/).optional(),
  roleName: Joi.string().required().min(2).max(50),
  companyName: Joi.string().min(2).max(100).trim().optional()
});

const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().optional(),
  email: Joi.string().email().lowercase().optional(),
  mobile: Joi.string().pattern(/^\d{10}$/).optional(),
  roleName: Joi.string().min(2).max(50).optional(),
  companyName: Joi.string().min(2).max(100).trim().optional(),
  password: Joi.string().min(6).max(128).optional()
});

const userProjectsSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  projects: Joi.array().items(Joi.string().hex().length(24)).required()
});

// Environment variables
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@deltayards.com';
const EXPECTED_ADMIN_PASS = process.env.SUPERADMIN_PASSWORD || '123456';

// Helper function to set JWT token headers
const setTokenHeaders = (res, token) => {
  res.header('Authorization', `Bearer ${token}`);
  res.header('x-auth-token', token);
  res.header('Access-Control-Expose-Headers', 'Authorization, x-auth-token');
};

// Register a new user
const registerUser = async (req, res) => {
  const { error, value } = registerUserSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Validation error',
      details: error.details.map(detail => detail.message)
    });
  }

  const { name, email, password, mobile, companyName } = value;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user with default role (password will be hashed by User model middleware)
    // Get the user role permissions
    const userRole = await Role.findOne({ name: 'user' });
    const userRolePermissions = userRole ? userRole.permissions : [];
    
    const user = new User({
      name,
      email: email.toLowerCase(),
      password: password,
      mobile,
      companyName,
      role: 'user',
      level: 3,
      customPermissions: {
        allowed: userRolePermissions, // Store role permissions in allowed
        denied: []
      }
    });

    await user.save();

    // Generate JWT token
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
      level: user.level
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
    setTokenHeaders(res, token);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level,
        mobile: user.mobile,
        companyName: user.companyName
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// Register a new manager
// const registerManager = async (req, res) => {
//   const { name, email, password, mobile, companyName } = req.body;

//   try {
//     // Check if user already exists
//     const existingUser = await User.findOne({ email: email.toLowerCase() });
//     if (existingUser) {
//       return res.status(400).json({ message: 'User already exists' });
//     }

//     // Create new manager (password will be hashed by User model middleware)
//     const user = new User({
//       name,
//       email: email.toLowerCase(),
//       password: password,
//       mobile,
//       companyName,
//       role: 'manager',
//       level: 2
//     });

//     await user.save();

//     // Generate JWT token
//     const payload = {
//       id: user._id,
//       email: user.email,
//       role: user.role,
//       level: user.level
//     };

//     const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
//     setTokenHeaders(res, token);

//     res.status(201).json({
//       message: 'Manager registered successfully',
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         role: user.role,
//         level: user.level,
//         mobile: user.mobile,
//         companyName: user.companyName
//       },
//       token
//     });

//   } catch (error) {
//     console.error('Manager registration error:', error);
//     res.status(500).json({ message: 'Server error during manager registration' });
//   }
// };

// Register a new sales person
// const registerSales = async (req, res) => {
//   const { name, email, password, mobile, companyName } = req.body;

//   try {
//     // Check if user already exists
//     const existingUser = await User.findOne({ email: email.toLowerCase() });
//     if (existingUser) {
//       return res.status(400).json({ message: 'User already exists' });
//     }

//     // Create new sales person (password will be hashed by User model middleware)
//     const user = new User({
//       name,
//       email: email.toLowerCase(),
//       password: password,
//       mobile,
//       companyName,
//       role: 'sales',
//       level: 4
//     });

//     await user.save();

//     // Generate JWT token
//     const payload = {
//       id: user._id,
//       email: user.email,
//       role: user.role,
//       level: user.level
//     };

//     const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
//     setTokenHeaders(res, token);

//     res.status(201).json({
//       message: 'Sales person registered successfully',
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         role: user.role,
//         level: user.level,
//         mobile: user.mobile,
//         companyName: user.companyName
//       },
//       token
//     });

//   } catch (error) {
//     console.error('Sales registration error:', error);
//     res.status(500).json({ message: 'Server error during sales registration' });
//   }
// };

// Initialize superadmin (first-time setup)
const initSuperadmin = async (req, res) => {
  try {
    // Check if superadmin already exists
    const existingSuperadmin = await User.findOne({ role: 'superadmin' });
    if (existingSuperadmin) {
      return res.status(400).json({ message: 'Superadmin already exists' });
    }

    // Create superadmin role if it doesn't exist
    let superadminRole = await Role.findOne({ name: 'superadmin' });
    if (!superadminRole) {
      superadminRole = await Role.create({
        name: 'superadmin',
        level: 1,
        permissions: [
          // Role and user management
          "role:manage",
          "users:manage",
          
          // Project management
          "projects:manage",
          
          // Lead management
          "leads:create",
          "leads:read",
          "leads:update",
          "leads:delete",
          "leads:bulk",
          "leads:transfer",
          "leads:bulk-delete",
          
          // Lead source management
          "leadssource:create",
          "leadssource:read_all",
          "leadssource:read",
          "leadssource:update",
          "leadssource:delete",
          
          // Lead status management
          "leadsstatus:create",
          "leadsstatus:read_all",
          "leadsstatus:read",
          "leadsstatus:update",
          "leadsstatus:delete",
          
          // Lead activities
          "lead-activities:read",
          "lead-activities:bulk-update",
          "lead-activities:bulk-delete",
          
          // Channel partner management
          "channel-partner:create",
          "channel-partner:read_all",
          "channel-partner:read",
          "channel-partner:update",
          "channel-partner:delete",
          "channel-partner:bulk-create",
          "channel-partner:bulk-update",
          "channel-partner:bulk-delete",
          
          // CP sourcing management
          "cp-sourcing:create",
          "cp-sourcing:read",
          "cp-sourcing:update",
          "cp-sourcing:delete",
          "cp-sourcing:bulk-create",
          "cp-sourcing:bulk-update",
          "cp-sourcing:bulk-delete",
          
          // User project management
          "user-projects:assign",
          "user-projects:read",
          "user-projects:remove",
          "user-projects:bulk-update",
          "user-projects:bulk-delete",
          
          // User reporting
          "user-reporting:create",
          "user-reporting:read",
          "user-reporting:update",
          "user-reporting:delete",
          "user-reporting:bulk-update",
          "user-reporting:bulk-delete",
          
          // Notifications
          "notifications:read",
          "notifications:update",
          "notifications:bulk-update",
          "notifications:bulk-delete",
          
          // General reporting
          "reporting:read"
        ],
      });
    }

    // Create superadmin user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(EXPECTED_ADMIN_PASS, salt);

    const superadmin = new User({
      name: 'Super Admin',
      email: SUPERADMIN_EMAIL,
      password: hashedPassword,
      companyName: 'DeltaYards',
      mobile: '',
      role: 'superadmin',
      roleRef: superadminRole._id,
      level: superadminRole.level,
    });

    await superadmin.save();

    res.status(201).json({
      message: 'Superadmin initialized successfully',
      user: {
        id: superadmin._id,
        name: superadmin.name,
        email: superadmin.email,
        role: superadmin.role,
        level: superadmin.level
      }
    });

  } catch (error) {
    console.error('Superadmin initialization error:', error);
    res.status(500).json({ message: 'Server error during superadmin initialization' });
  }
};

// Login user
const loginUser = async (req, res) => {
  const { error, value } = loginUserSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Validation error',
      details: error.details.map(detail => detail.message)
    });
  }

  const { email, password } = value;

  try {
    console.log('=== LOGIN ATTEMPT ===');
    console.log('Email:', email);
    console.log('Password provided:', !!password);
    
    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log('User not found');
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    console.log('User found:', user.email);
    console.log('User password in DB:', user.password);
    console.log('Password match attempt...');

    // Check password using User model's matchPassword method
    const isMatch = user.matchPassword(password);
    console.log('Password match result:', isMatch);
    
    if (!isMatch) {
      console.log('Password mismatch');
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
      level: user.level
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
    setTokenHeaders(res, token);

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level,
        mobile: user.mobile,
        companyName: user.companyName
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// Admin login (special login for superadmin)
const adminLogin = async (req, res) => {
  // Validate request body
  const { error, value } = adminLoginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Validation error',
      details: error.details.map(detail => detail.message)
    });
  }

  try {
    console.log('=== ADMIN LOGIN ATTEMPT ===');
    console.log('Request body:', req.body);
    console.log('Request query:', req.query);

    const providedEmail = (value.email ?? req.query?.email ?? SUPERADMIN_EMAIL).trim().toLowerCase();
    const adminPassFromRequest = (value.password ?? req.query?.adminPass ?? req.query?.password);

    console.log('Provided email:', providedEmail);
    console.log('Expected email:', SUPERADMIN_EMAIL);
    console.log('Admin pass provided:', !!adminPassFromRequest);

    // Validate credentials
    if (providedEmail !== SUPERADMIN_EMAIL || adminPassFromRequest !== EXPECTED_ADMIN_PASS) {
      console.log('Invalid admin credentials');
      return res.status(401).json({ message: 'Invalid admin credentials' });
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
          permissions: [
          // Role and user management
          "role:manage",
          "users:manage",
          
          // Project management
          "projects:manage",
          
          // Lead management
          "leads:create",
          "leads:read",
          "leads:update",
          "leads:delete",
          "leads:bulk",
          "leads:transfer",
          "leads:bulk-delete",
          
          // Lead source management
          "leadssource:create",
          "leadssource:read_all",
          "leadssource:read",
          "leadssource:update",
          "leadssource:delete",
          
          // Lead status management
          "leadsstatus:create",
          "leadsstatus:read_all",
          "leadsstatus:read",
          "leadsstatus:update",
          "leadsstatus:delete",
          
          // Lead activities
          "lead-activities:read",
          "lead-activities:bulk-update",
          "lead-activities:bulk-delete",
          
          // Channel partner management
          "channel-partner:create",
          "channel-partner:read_all",
          "channel-partner:read",
          "channel-partner:update",
          "channel-partner:delete",
          "channel-partner:bulk-create",
          "channel-partner:bulk-update",
          "channel-partner:bulk-delete",
          
          // CP sourcing management
          "cp-sourcing:create",
          "cp-sourcing:read",
          "cp-sourcing:update",
          "cp-sourcing:delete",
          "cp-sourcing:bulk-create",
          "cp-sourcing:bulk-update",
          "cp-sourcing:bulk-delete",
          
          // User project management
          "user-projects:assign",
          "user-projects:read",
          "user-projects:remove",
          "user-projects:bulk-update",
          "user-projects:bulk-delete",
          
          // User reporting
          "user-reporting:create",
          "user-reporting:read",
          "user-reporting:update",
          "user-reporting:delete",
          "user-reporting:bulk-update",
          "user-reporting:bulk-delete",
          
          // Notifications
          "notifications:read",
          "notifications:update",
          "notifications:bulk-update",
          "notifications:bulk-delete",
          
          // General reporting
          "reporting:read"
        ],
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

    // Generate JWT token
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
      level: user.level
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
    setTokenHeaders(res, token);

    console.log('Admin login successful, returning response');
    res.json({
      message: 'Admin login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level,
        companyName: user.companyName
      },
      token,
      systemInfo: {
        mongoConnected: mongoose.connection.readyState === 1,
        superadminRoleExists: !!superadminRole,
        superadminUserExists: !!user,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ 
      message: 'Server error during admin login',
      error: error.message 
    });
  }
};

// Get current user
const currentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new role
const createRole = async (req, res) => {
  // Validate request body
  const { error, value } = createRoleSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Validation error',
      details: error.details.map(detail => detail.message)
    });
  }

  const { name, level, permissions } = value;

  try {
    // Normalize role name
    const normalized = String(name).toLowerCase().trim();

    // Check if role already exists
    const existingRole = await Role.findOne({ name: normalized });
    if (existingRole) {
      return res.status(400).json({ message: 'Role already exists' });
    }

    // Create new role
    const role = new Role({
      name: normalized,
      level,
      permissions: permissions.map(p => String(p).toLowerCase())
    });

    await role.save();

    res.status(201).json({
      message: 'Role created successfully',
      role: {
        id: role._id,
        name: role.name,
        level: role.level,
        permissions: role.permissions
      }
    });

  } catch (error) {
    console.error('Role creation error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Edit an existing role
const editRole = async (req, res) => {
  // Validate request body
  const { error, value } = updateRoleSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Validation error',
      details: error.details.map(detail => detail.message)
    });
  }

  const { roleName } = req.params;
  const { name, level, permissions } = value;

  try {
    if (!roleName) return res.status(400).json({ message: 'Role ID is required' });
    if (!name && level === undefined && !permissions) {
      return res.status(400).json({ message: 'At least one field is required for update' });
    }

    const role = await Role.findById(roleName);
    if (!role) return res.status(404).json({ message: 'Role not found' });

    // Prevent editing superadmin role
    if (role.name === 'superadmin') {
      return res.status(403).json({ message: 'Cannot edit superadmin role' });
    }

    // Update fields if provided
    if (name) {
      const normalized = String(name).toLowerCase().trim();
      // Check if new name conflicts with existing role (excluding current role)
      const existingRole = await Role.findOne({ name: normalized, _id: { $ne: roleName } });
      if (existingRole) return res.status(400).json({ message: 'Role name already exists' });
      role.name = normalized;
    }

    if (level !== undefined) {
      if (level < 1 || level > 10) {
        return res.status(400).json({ message: 'Level must be between 1 and 10' });
      }
      // Skip hierarchy validation for superadmin
      if (req.user.level !== 1) {
        // Find users assigned to this role
        const usersWithRole = await User.find({ roleRef: role._id }).lean();
        for (const user of usersWithRole) {
          const validationResult = await validateHierarchyChange(user, level);
          if (validationResult.error) {
            return res.status(400).json({
              message: `Cannot update role level: User ${user.name} (${user._id}) - ${validationResult.error}`
            });
          }
        }
      }
      role.level = level;
    }

    if (permissions) {
      if (!Array.isArray(permissions) || permissions.length === 0) {
        return res.status(400).json({ message: 'Permissions must be a non-empty array' });
      }
      role.permissions = permissions.map(p => String(p).toLowerCase());
    }

    await role.save();

    // Update users with this role to reflect new level and name
    if (name || level !== undefined) {
      await User.updateMany(
        { roleRef: role._id },
        { $set: { role: role.name, level: role.level } }
      );
    }

    res.json({
      message: 'Role updated successfully',
      role: {
        id: role._id,
        name: role.name,
        level: role.level,
        permissions: role.permissions
      }
    });
  } catch (error) {
    console.error('Role update error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Delete a role
const deleteRole = async (req, res) => {
  const { roleName } = req.params;
  
  try {
    if (!roleName) return res.status(400).json({ message: 'Role ID is required' });

    const role = await Role.findById(roleName);
    if (!role) return res.status(404).json({ message: 'Role not found' });

    // Prevent deleting superadmin role
    if (role.name === 'superadmin') {
      return res.status(403).json({ message: 'Cannot delete superadmin role' });
    }

    // Check if any users are using this role
    const usersWithRole = await User.countDocuments({ roleRef: roleName });
    if (usersWithRole > 0) {
      return res.status(400).json({ 
        message: `Cannot delete role. ${usersWithRole} user(s) are currently using this role.` 
      });
    }

    await Role.findByIdAndDelete(roleName);
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Role deletion error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// List all roles
const listRoles = async (_req, res) => {
  try {
    const roles = await Role.find().sort({ level: 1, name: 1 });
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};



const getindividualRoleById = async (req, res) => {
  const { roleId } = req.params;
  
  const role = await Role.findById(roleId);
  res.json(role);
};


const generatePath = async (userId) => {
  const parentReporting = await UserReporting.findOne({ user: userId });
  return parentReporting && parentReporting.reportsTo.length > 0 && parentReporting.reportsTo[0].path
    ? `${parentReporting.reportsTo[0].path}${userId}/`
    : `/${userId}/`;
};

// Create a user with a specific role
const createUserWithRole = async (req, res) => {
  // Validate request body
  const { error, value } = createUserWithRoleSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Validation error',
      details: error.details.map(detail => detail.message)
    });
  }

  const { name, email, password, mobile, companyName, roleName } = value;

  try {

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Find the specified role
    const role = await Role.findOne({ name: String(roleName).toLowerCase().trim() });
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Create new user (password will be hashed by User model middleware)
    const user = new User({
      name,
      email: email.toLowerCase(),
      password: password,
      mobile,
      companyName,
      role: role.name,
      roleRef: role._id,
      level: role.level,
      customPermissions: {
        allowed: role.permissions, // Store role permissions in allowed
        denied: []
      }
    });

    await user.save();

    // Skip UserReporting for superadmin
    if (role !== 'superadmin' && level > 1) {
      const superadmin = await User.findOne({ role: 'superadmin', level: 1 });
      if (!superadmin) {
        await User.deleteOne({ _id: user._id });
        return res.status(500).json({ message: 'Superadmin not found, cannot create reporting' });
      }

      const reporting = new UserReporting({
        user: user._id,
        reportsTo: [
          {
            user: superadmin._id,
            teamType: 'superadmin',
            path: await generatePath(superadmin._id),
            context: 'Superadmin oversight'
          }
        ],
        level: user.level
      });
      await reporting.save();
      console.log(`UserReporting created for user ${user._id} with superadmin ${superadmin._id}`);
    }

    // Get role details for response
    const userRole = await Role.findById(user.roleRef);
    const rolePermissions = userRole ? userRole.permissions : [];
    
    // Calculate allowed permissions: role permissions minus denied permissions
    const allowedPermissions = rolePermissions.filter(permission => 
      !(user.customPermissions?.denied || []).includes(permission)
    );

    // Send notification to new user
    if (global.notificationService) {
      await global.notificationService.sendNotification(user._id.toString(), {
        type: 'user_created',
        title: 'Welcome!',
        message: `Your account has been created with role: ${role.name}`,
        data: {
          userId: user._id,
          role: role.name,
          level: user.level
        },
        priority: 'high'
      });
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level,
        mobile: user.mobile,
        companyName: user.companyName,
        customPermissions: {
          allowed: allowedPermissions, // Role permissions minus denied
          denied: user.customPermissions?.denied || [] // User-specific denied permissions
        }
      },
      summary: {
        rolePermissionsCount: rolePermissions.length,
        totalAllowed: allowedPermissions.length,
        totalDenied: user.customPermissions?.denied?.length || 0
      }
    });

  } catch (error) {
    console.error('User creation error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Edit user with role
const editUserWithRole = async (req, res) => {
  // Validate request body
  const { error, value } = updateUserSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Validation error',
      details: error.details.map(detail => detail.message)
    });
  }

  const { userId } = req.params;
  const { name, email, mobile, companyName, roleName, password } = value;

  try {
    if (!userId) return res.status(400).json({ message: 'User ID is required' });
    if (!name && !email && !mobile && !companyName && !roleName && !password) {
      return res.status(400).json({ message: 'At least one field is required for update' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Prevent editing superadmin user
    if (user.role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot edit superadmin user' });
    }

    // Update fields if provided
    if (name) user.name = name;
    if (mobile) user.mobile = mobile;
    if (companyName) user.companyName = companyName;

    // Handle email update with duplicate check
    if (email) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (normalizedEmail !== user.email) {
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
          return res.status(400).json({ message: 'Email already exists' });
        }
        user.email = normalizedEmail;
      }
    }

    // Handle password update
    if (password) {
      user.password = password;
    }

    // Handle role update
    if (roleName) {
      const newRole = await Role.findOne({ name: String(roleName).toLowerCase().trim() });
      if (!newRole) return res.status(404).json({ message: `Role ${roleName} not found` });

      // Prevent assigning superadmin role to regular users
      if (newRole.level === 1 && req.user.level !== 1) {
        return res.status(403).json({ message: 'Only superadmin can assign superadmin role' });
      }

      // Validate hierarchy before role update (skip for superadmin)
      if (req.user.level !== 1) {
        const validationResult = await validateHierarchyChange(user, newRole.level);
        if (validationResult.error) {
          return res.status(400).json({
            message: `Cannot assign role to ${user.name}: ${validationResult.error}`
          });
        }
      }

      // Update role fields
      user.role = newRole.name;
      user.roleRef = newRole._id;
      user.level = newRole.level;

      // Update customPermissions when role changes
      if (!user.customPermissions) {
        user.customPermissions = { allowed: [], denied: [] };
      }

      // Calculate allowed permissions: role permissions minus denied permissions
      const allowedPermissions = newRole.permissions.filter(permission =>
        !(user.customPermissions.denied || []).includes(permission)
      );

      user.customPermissions.allowed = allowedPermissions;
    }

    await user.save();

    // Send notification to user if role was changed
    if (global.notificationService && roleName) {
      await global.notificationService.sendNotification(user._id.toString(), {
        type: 'role_changed',
        title: 'Role Updated',
        message: `Your role has been updated to: ${user.role}`,
        data: {
          userId: user._id,
          newRole: user.role,
          newLevel: user.level
        },
        priority: 'high'
      });
    }

    res.json({
      message: 'User updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        companyName: user.companyName,
        role: user.role,
        level: user.level
      }
    });
  } catch (error) {
    console.error('User update error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Validation function for hierarchy change
const validateHierarchyChange = async (user, newLevel) => {
  try {
    // Get superiors
    const superiorsReporting = await UserReporting.find({ user: user._id }).lean();
    const superiors = superiorsReporting.flatMap(r => r.reportsTo.map(rt => rt.user));

    // Get subordinates
    const subordinatesReporting = await UserReporting.find({
      'reportsTo.path': { $regex: `/(${user._id})/` }
    }).lean();
    const subordinates = subordinatesReporting.map(r => r.user);

    // Fetch levels for superiors and subordinates
    const superiorLevels = await User.find({ _id: { $in: superiors } }).select('level').lean();
    const subordinateLevels = await User.find({ _id: { $in: subordinates } }).select('level').lean();

    // Check superiors: User's new level should be higher (greater number) than superiors' levels
    for (const superior of superiorLevels) {
      if (newLevel <= superior.level) {
        return { error: 'Cannot assign role: User would have equal or higher rank than superior' };
      }
    }

    // Check subordinates: User's new level should be lower (smaller number) than subordinates' levels
    for (const subordinate of subordinateLevels) {
      if (newLevel >= subordinate.level) {
        return { error: 'Cannot assign role: User would have equal or lower rank than subordinate' };
      }
    }

    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
};

// Delete user with role
const deleteUserWithRole = async (req, res) => {
  const { userId } = req.params;
  
  try {
    if (!userId) return res.status(400).json({ message: 'User ID is required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Prevent deletion of superadmin user
    if (user.role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot delete superadmin user' });
    }

    // Check if user is part of any projects
    const Project = require('../models/Project');
    const userProjects = await Project.find({ members: userId });
    if (userProjects.length > 0) {
      return res.status(400).json({ 
        message: `Cannot delete user. User is a member of ${userProjects.length} project(s).` 
      });
    }

    await User.findByIdAndDelete(userId);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Get single user by ID
const getUserById = async (req, res) => {
  const { userId } = req.params;
  
  try {
    if (!userId) return res.status(400).json({ message: 'User ID is required' });

    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Get role details
    const userRole = await Role.findById(user.roleRef);
    
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        companyName: user.companyName,
        role: user.role,
        level: user.level,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        customPermissions: {
          allowed: user.customPermissions?.allowed || [], // Use stored permissions
          denied: user.customPermissions?.denied || [] // User-specific denied permissions
        }
      },
      role: userRole ? {
        name: userRole.name,
        level: userRole.level,
        permissions: userRole.permissions
      } : null
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Get users by role
const getUsersByRole = async (req, res) => {
  const { roleName } = req.params;
  
  try {
    if (!roleName) return res.status(400).json({ message: 'Role name is required' });

    const role = await Role.findOne({ name: String(roleName).toLowerCase().trim() });
    if (!role) return res.status(404).json({ message: 'Role not found' });

    const users = await User.find({ roleRef: role._id }).select('-password');
    
    res.json({
      role: {
        id: role._id,
        name: role.name,
        level: role.level,
        permissions: role.permissions
      },
      users: users.map(user => {
        return {
          id: user._id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          companyName: user.companyName,
          role: user.role,
          level: user.level,
          createdAt: user.createdAt,
          customPermissions: {
            allowed: user.customPermissions?.allowed || [], // Use stored permissions
            denied: user.customPermissions?.denied || [] // User-specific denied permissions
          }
        };
      }),
      count: users.length
    });

  } catch (error) {
    console.error('Get users by role error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Get all users grouped by role
const getAllUsersGroupedByRole = async (_req, res) => {
  try {
    const roles = await Role.find().sort({ level: 1, name: 1 });
    const users = await User.find().select('-password');
    
    const usersByRole = {};
    
    for (const role of roles) {
      const roleUsers = users.filter(user => String(user.roleRef) === String(role._id));
      usersByRole[role.name] = {
        role: {
          id: role._id,
          name: role.name,
          level: role.level,
          permissions: role.permissions
        },
        users: roleUsers.map(user => {
          return {
            id: user._id,
            name: user.name,
            email: user.email,
            mobile: user.mobile,
            companyName: user.companyName,
            role: user.role,
            level: user.level,
            createdAt: user.createdAt,
            customPermissions: {
              allowed: user.customPermissions?.allowed || [], // Use stored permissions
              denied: user.customPermissions?.denied || [] // User-specific denied permissions
            }
          };
        }),
        count: roleUsers.length
      };
    }

    res.json({
      totalRoles: roles.length,
      totalUsers: users.length,
      usersByRole
    });

  } catch (error) {
    console.error('Get all users grouped by role error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Get comprehensive user history and project assignments
const getUserHistory = async (req, res) => {
  const { userId } = req.params;
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Find the target user
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's current role details
    const currentRole = await Role.findById(targetUser.roleRef);
    
    // Find all projects where user is a member, owner, or manager
    const Project = require('../models/Project');
    const projects = await Project.find({
      $or: [
        { members: userId },
        { owner: userId },
        { managers: userId }
      ]
    }).populate('owner', 'name email role level')
      .populate('members', 'name email role level')
      .populate('managers', 'name email role level');

    // Categorize projects by user's role
    const projectHistory = projects.map(project => {
      const isOwner = String(project.owner._id) === String(userId);
      const isManager = project.managers.some(m => String(m._id) === String(userId));
      const isMember = project.members.some(m => String(m._id) === String(userId));
      
      let roleInProject = 'member';
      if (isOwner) roleInProject = 'owner';
      else if (isManager) roleInProject = 'manager';

      return {
        projectId: project._id,
        projectName: project.name,
        location: project.location,
        developBy: project.developBy,
        roleInProject,
        joinedAt: project.createdAt,
        projectStatus: 'active',
        projectDetails: {
          totalMembers: project.members.length,
          totalManagers: project.managers.length,
          owner: {
            name: project.owner?.name,
            email: project.owner?.email,
            role: project.owner?.role,
            level: project.owner?.level
          }
        }
      };
    });

    // Get role change history (if you want to track this in the future)
    const roleHistory = [
      {
        role: targetUser.role,
        level: targetUser.level,
        assignedAt: targetUser.createdAt,
        assignedBy: 'system', // You can enhance this to track who assigned the role
        current: true
      }
    ];

    // Get user activity summary
    const activitySummary = {
      totalProjects: projects.length,
      ownedProjects: projects.filter(p => String(p.owner._id) === String(userId)).length,
      managedProjects: projects.filter(p => 
        p.managers.some(m => String(m._id) === String(userId)) && 
        String(p.owner._id) !== String(userId)
      ).length,
      memberProjects: projects.filter(p => 
        p.members.some(m => String(m._id) === String(userId)) && 
        !p.managers.some(m => String(m._id) === String(userId)) &&
        String(p.owner._id) !== String(userId)
      ).length,
      firstProject: projects.length > 0 ? Math.min(...projects.map(p => p.createdAt)) : null,
      lastActivity: projects.length > 0 ? Math.max(...projects.map(p => p.createdAt)) : null
    };

    // Get user permissions based on current role
    const userPermissions = currentRole ? currentRole.permissions : [];

    res.json({
      user: {
        _id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        mobile: targetUser.mobile,
        companyName: targetUser.companyName,
        currentRole: {
          name: targetUser.role,
          level: targetUser.level,
          permissions: userPermissions,
          roleId: targetUser.roleRef
        },
        accountCreated: targetUser.createdAt,
        accountStatus: 'active'
      },
      projectHistory,
      roleHistory,
      activitySummary,
      permissions: {
        current: userPermissions,
        description: `User has ${userPermissions.length} permissions based on ${targetUser.role} role (level ${targetUser.level})`
      },
      summary: {
        totalProjects: activitySummary.totalProjects,
        currentRole: targetUser.role,
        roleLevel: targetUser.level,
        memberSince: targetUser.createdAt,
        lastUpdated: new Date()
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Get user timeline - Amazon-style activity tracking
const getUserTimeline = async (req, res) => {
  const { userId } = req.params;
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Find the target user
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's current role details
    const currentRole = await Role.findById(targetUser.roleRef);
    
    // Find all projects where user is a member, owner, or manager
    const Project = require('../models/Project');
    const projects = await Project.find({
      $or: [
        { members: userId },
        { owner: userId },
        { managers: userId }
      ]
    }).populate('owner', 'name email role level')
      .populate('members', 'name email role level')
      .populate('managers', 'name email role level')
      .sort({ createdAt: 1 }); // Sort by creation date

    // Build timeline events
    const timelineEvents = [];

    // 1. Account Creation Event
    timelineEvents.push({
      id: 'account-creation',
      type: 'account_created',
      title: 'Account Created',
      description: `${targetUser.name} joined DeltaYards CRM`,
      status: 'completed',
      timestamp: targetUser.createdAt,
      details: {
        email: targetUser.email,
        mobile: targetUser.mobile,
        companyName: targetUser.companyName,
        initialRole: targetUser.role,
        initialLevel: targetUser.level
      },
      icon: '👤',
      color: 'green'
    });

    // 2. Role Assignment Event
    if (currentRole) {
      timelineEvents.push({
        id: 'role-assignment',
        type: 'role_assigned',
        title: 'Role Assigned',
        description: `Assigned ${currentRole.name} role (Level ${currentRole.level})`,
        status: 'completed',
        timestamp: targetUser.createdAt,
        details: {
          roleName: currentRole.name,
          roleLevel: currentRole.level,
          permissions: currentRole.permissions,
          assignedBy: 'System',
          roleId: currentRole._id
        },
        icon: '🎭',
        color: 'blue'
      });
    }

    // 3. Project Assignment Events
    projects.forEach((project, index) => {
      const isOwner = String(project.owner._id) === String(userId);
      const isManager = project.managers.some(m => String(m._id) === String(userId));
      
      let roleInProject = 'member';
      let eventTitle = 'Added to Project';
      let eventDescription = `Joined ${project.name} as team member`;
      let eventIcon = '➕';
      let eventColor = 'purple';

      if (isOwner) {
        roleInProject = 'owner';
        eventTitle = 'Project Created';
        eventDescription = `Created and owns ${project.name} project`;
        eventIcon = '🚀';
        eventColor = 'orange';
      } else if (isManager) {
        roleInProject = 'manager';
        eventTitle = 'Promoted to Manager';
        eventDescription = `Promoted to manager in ${project.name}`;
        eventIcon = '⭐';
        eventColor = 'gold';
      }

      timelineEvents.push({
        id: `project-${project._id}`,
        type: 'project_assignment',
        title: eventTitle,
        description: eventDescription,
        status: 'completed',
        timestamp: project.createdAt,
        details: {
          projectId: project._id,
          projectName: project.name,
          location: project.location,
          developBy: project.developBy,
          roleInProject,
          projectStatus: 'active',
          teamSize: project.members.length,
          managersCount: project.managers.length
        },
        icon: eventIcon,
        color: eventColor
      });
    });

    // 4. Current Status Event
    const currentPermissions = currentRole ? currentRole.permissions : [];
    timelineEvents.push({
      id: 'current-status',
      type: 'current_status',
      title: 'Current Status',
      description: `Currently active with ${currentPermissions.length} permissions`,
      status: 'active',
      timestamp: new Date(),
      details: {
        currentRole: targetUser.role,
        currentLevel: targetUser.level,
        totalProjects: projects.length,
        activeProjects: projects.length,
        permissions: currentPermissions,
        lastActivity: projects.length > 0 ? Math.max(...projects.map(p => p.createdAt)) : targetUser.createdAt
      },
      icon: '✅',
      color: 'green'
    });

    // Sort timeline by timestamp
    timelineEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Calculate timeline statistics
    const timelineStats = {
      totalEvents: timelineEvents.length,
      accountAge: Math.floor((new Date() - new Date(targetUser.createdAt)) / (1000 * 60 * 60 * 24)), // days
      totalProjects: projects.length,
      currentRole: targetUser.role,
      currentLevel: targetUser.level,
      permissionsCount: currentPermissions.length
    };

    res.json({
      user: {
        _id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        mobile: targetUser.mobile,
        companyName: targetUser.companyName
      },
      timeline: {
        events: timelineEvents,
        stats: timelineStats,
        summary: {
          journey: `${targetUser.name}'s journey from ${new Date(targetUser.createdAt).toLocaleDateString()} to present`,
          totalMilestones: timelineEvents.length,
          currentStatus: `Active ${targetUser.role} with ${projects.length} project(s)`
        }
      },
      currentRole: {
        name: targetUser.role,
        level: targetUser.level,
        permissions: currentPermissions,
        roleId: targetUser.roleRef
      },
      projectSummary: {
        total: projects.length,
        owned: projects.filter(p => String(p.owner._id) === String(userId)).length,
        managed: projects.filter(p => 
          p.managers.some(m => String(m._id) === String(userId)) && 
          String(p.owner._id) !== String(userId)
        ).length,
        member: projects.filter(p => 
          p.members.some(m => String(m._id) === String(userId)) && 
          !p.managers.some(m => String(m._id) === String(userId)) &&
          String(p.owner._id) !== String(userId)
        ).length
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Get all users with their project history summary
const getAllUsersWithHistory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const users = await User.find().select('-password');
    const usersWithHistory = [];

    for (const user of users) {
      // Get user's projects
      const Project = require('../models/Project');
      const projects = await Project.find({
        $or: [
          { members: user._id },
          { owner: user._id },
          { managers: user._id }
        ]
      });

      // Get user's role
      const userRole = await Role.findById(user.roleRef);

      const userHistory = {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        companyName: user.companyName,
        currentRole: {
          name: user.role,
          level: user.level,
          permissions: userRole ? userRole.permissions : []
        },
        customPermissions: {
          allowed: user.customPermissions?.allowed || [], // Use stored permissions
          denied: user.customPermissions?.denied || [] // User-specific denied permissions
        },
        projectSummary: {
          totalProjects: projects.length,
          ownedProjects: projects.filter(p => String(p.owner) === String(user._id)).length,
          managedProjects: projects.filter(p => 
            p.managers.some(m => String(m) === String(user._id)) && 
            String(p.owner) !== String(user._id)
          ).length,
          memberProjects: projects.filter(p => 
            p.members.some(m => String(m) === String(user._id)) && 
            !p.managers.some(m => String(m) === String(user._id)) &&
            String(p.owner) !== String(user._id)
          ).length
        },
        accountCreated: user.createdAt,
        lastActivity: projects.length > 0 ? Math.max(...projects.map(p => p.createdAt)) : user.createdAt
      };

      usersWithHistory.push(userHistory);
    }

    // Sort by most recent activity
    usersWithHistory.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

    res.json({
      totalUsers: usersWithHistory.length,
      users: usersWithHistory,
      summary: {
        totalProjects: usersWithHistory.reduce((sum, u) => sum + u.projectSummary.totalProjects, 0),
        activeUsers: usersWithHistory.filter(u => u.projectSummary.totalProjects > 0).length,
        inactiveUsers: usersWithHistory.filter(u => u.projectSummary.totalProjects === 0).length
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Update superadmin role permissions
const updateSuperadminPermissions = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied. Superadmin role required.' });
    }

    const superadminRole = await Role.findOne({ name: 'superadmin' });
    if (!superadminRole) {
      return res.status(404).json({ message: 'Superadmin role not found' });
    }

    const newPermissions = [
      // Role and user management
      "role:manage",
      "users:manage",
      
      // Project management
      "projects:manage",
      
      // Lead management
      "leads:create",
      "leads:read",
      "leads:update",
      "leads:delete",
      "leads:bulk",
      "leads:transfer",
      "leads:bulk-delete",
      
      // Lead source management
      "leadssource:create",
      "leadssource:read_all",
      "leadssource:read",
      "leadssource:update",
      "leadssource:delete",
      
      // Lead status management
      "leadsstatus:create",
      "leadsstatus:read_all",
      "leadsstatus:read",
      "leadsstatus:update",
      "leadsstatus:delete",
      
      // Lead activities
      "lead-activities:read",
      "lead-activities:bulk-update",
      "lead-activities:bulk-delete",
      
      // Channel partner management
      "channel-partner:create",
      "channel-partner:read_all",
      "channel-partner:read",
      "channel-partner:update",
      "channel-partner:delete",
      "channel-partner:bulk-create",
      "channel-partner:bulk-update",
      "channel-partner:bulk-delete",
      
      // CP sourcing management
      "cp-sourcing:create",
      "cp-sourcing:read",
      "cp-sourcing:update",
      "cp-sourcing:delete",
      "cp-sourcing:bulk-create",
      "cp-sourcing:bulk-update",
      "cp-sourcing:bulk-delete",
      
      // User project management
      "user-projects:assign",
      "user-projects:read",
      "user-projects:remove",
      "user-projects:bulk-update",
      "user-projects:bulk-delete",
      
      // User reporting
      "user-reporting:create",
      "user-reporting:read",
      "user-reporting:update",
      "user-reporting:delete",
      "user-reporting:bulk-update",
      "user-reporting:bulk-delete",
      
      // Notifications
      "notifications:read",
      "notifications:update",
      "notifications:bulk-update",
      "notifications:bulk-delete",
      
      // General reporting
      "reporting:read"
    ];

    // Update permissions
    superadminRole.permissions = newPermissions;
    await superadminRole.save();

    res.json({
      message: 'Superadmin permissions updated successfully',
      role: {
        id: superadminRole._id,
        name: superadminRole.name,
        level: superadminRole.level,
        permissions: superadminRole.permissions,
        updatedAt: superadminRole.updatedAt
      },
      summary: {
        totalPermissions: newPermissions.length,
        permissionCategories: {
          roles: newPermissions.filter(p => p.startsWith('role:')).length,
          projects: newPermissions.filter(p => p.startsWith('projects:')).length,
          notifications: newPermissions.filter(p => p.startsWith('notifications:')).length,
          leads: newPermissions.filter(p => p.startsWith('leads')).length,
          leadSources: newPermissions.filter(p => p.startsWith('leadssource:')).length,
          leadStatuses: newPermissions.filter(p => p.startsWith('leadsstatus:')).length,
          userProjects: newPermissions.filter(p => p.startsWith('user-projects:')).length,
          reporting: newPermissions.filter(p => p.startsWith('reporting:')).length
        }
      }
    });

  } catch (error) {
    console.error('Update superadmin permissions error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Get users with their project assignments
const getUsersWithProjects = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    const usersWithProjects = [];

    for (const user of users) {
      // Get user's projects
      const Project = require('../models/Project');
      const UserProject = require('../models/UserProject');
      
      // Get user-project assignments
      const userProjects = await UserProject.find({ user: user._id })
        .populate('project', 'name location developBy status createdAt')
        .sort({ assignedAt: -1 });

      // Get user's role details
      const userRole = await Role.findById(user.roleRef);

      const userWithProjects = {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        companyName: user.companyName,
        currentRole: {
          name: user.role,
          level: user.level,
          permissions: userRole ? userRole.permissions : [],
          roleId: user.roleRef
        },
        customPermissions: {
          allowed: user.customPermissions?.allowed || [], // Use stored permissions
          denied: user.customPermissions?.denied || [] // User-specific denied permissions
        },
        projectAssignments: userProjects.map(up => ({
          assignmentId: up._id,
          projectId: up.project._id,
          projectName: up.project.name,
          location: up.project.location,
          developBy: up.project.developBy,
          projectStatus: up.project.status,
          assignedAt: up.assignedAt
        })),
        projectSummary: {
          totalProjects: userProjects.length,
          activeProjects: userProjects.filter(up => up.project.status === 'active').length,
          completedProjects: userProjects.filter(up => up.project.status === 'completed').length,
          pendingProjects: userProjects.filter(up => up.project.status === 'pending').length
        },
        accountCreated: user.createdAt,
        lastActivity: userProjects.length > 0 ? Math.max(...userProjects.map(up => up.assignedAt)) : user.createdAt
      };

      usersWithProjects.push(userWithProjects);
    }

    // Sort by most recent activity
    usersWithProjects.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

    res.json({
      totalUsers: usersWithProjects.length,
      users: usersWithProjects,
      summary: {
        totalProjects: usersWithProjects.reduce((sum, u) => sum + u.projectSummary.totalProjects, 0),
        activeUsers: usersWithProjects.filter(u => u.projectSummary.totalProjects > 0).length,
        inactiveUsers: usersWithProjects.filter(u => u.projectSummary.totalProjects === 0).length,
        totalActiveProjects: usersWithProjects.reduce((sum, u) => sum + u.projectSummary.activeProjects, 0),
        totalCompletedProjects: usersWithProjects.reduce((sum, u) => sum + u.projectSummary.completedProjects, 0)
      }
    });

  } catch (error) {
    console.error('Get users with projects error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Create user with optional project assignment
const createUserWithProjects = async (req, res) => {
  const { 
    name, 
    email, 
    password, 
    mobile, 
    companyName, 
    roleName, 
    projects ,
    level
  } = req.body || {};
  
  try {
    if (!name || !email || !password || !roleName) {
      return res.status(400).json({ 
        message: 'name, email, password, and roleName are required' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Find the specified role
    const role = await Role.findOne({ name: String(roleName).toLowerCase().trim() });
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Create new user (password will be hashed by User model middleware)
    const user = new User({
      name,
      email: email.toLowerCase(),
      password: password,
      mobile,
      companyName,
      role: role.name,
      roleRef: role._id,
      level: level,
      customPermissions: {
        allowed: role.permissions, // Store role permissions in allowed
        denied: []
      }
    });

    await user.save();

    let projectAssignments = [];
    
    // If projects are provided, assign user to them
    if (projects && Array.isArray(projects) && projects.length > 0) {
      const Project = require('../models/Project');
      const UserProject = require('../models/UserProject');
      const { Types: { ObjectId } } = require('mongoose');

      // Normalize input to list of string IDs (accept strings or { projectId } objects)
      const normalizedProjectIds = projects
        .map(p => {
          if (typeof p === 'string') return p;
          if (p && typeof p === 'object') return p.projectId || p.id || p._id || null;
          return null;
        })
        .filter(Boolean);

      for (const projectId of normalizedProjectIds) {
        // Validate ObjectId format
        if (!ObjectId.isValid(projectId)) {
          console.warn(`Invalid project id ${projectId}, skipping assignment`);
          continue;
        }

        // Verify project exists
        const project = await Project.findById(projectId);
        if (!project) {
          console.warn(`Project ${projectId} not found, skipping assignment`);
          continue;
        }

        // Create user-project assignment
        try {
          const userProject = new UserProject({
            user: user._id,
            project: project._id,
            assignedAt: new Date()
          });

          await userProject.save();

          // Add user to project members
          if (!project.members.includes(user._id)) {
            project.members.push(user._id);
            await project.save();
          }

          projectAssignments.push({
            projectId: project._id,
            projectName: project.name,
            assignedAt: userProject.assignedAt
          });
        } catch (e) {
          // Ignore duplicate assignment errors
          if (e && e.code === 11000) {
            console.warn(`Duplicate assignment for user ${user._id} and project ${project._id}, skipping`);
            continue;
          }
          throw e;
        }
      }
    }

    // Skip UserReporting for superadmin
    if (roleName !== 'superadmin' && level > 1) {
      const superadmin = await User.findOne({ role: 'superadmin', level: 1 });
      if (!superadmin) {
        await User.deleteOne({ _id: user._id });
        return res.status(500).json({ message: 'Superadmin not found, cannot create reporting' });
      }

      const reporting = new UserReporting({
        user: user._id,
        reportsTo: [
          {
            user: superadmin._id,
            teamType: 'superadmin',
            path: await generatePath(superadmin._id),
            context: 'Superadmin oversight'
          }
        ],
        level: user.level
      });
      await reporting.save();
      console.log(`UserReporting created for user ${user._id} with superadmin ${superadmin._id}`);
    }

    // Get role details for response
    const userRole = await Role.findById(user.roleRef);
    const rolePermissions = userRole ? userRole.permissions : [];
    
    // Calculate allowed permissions: role permissions minus denied permissions
    const allowedPermissions = rolePermissions.filter(permission => 
      !(user.customPermissions?.denied || []).includes(permission)
    );

    res.status(201).json({
      message: 'User created successfully with project assignments',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level,
        mobile: user.mobile,
        companyName: user.companyName,
        customPermissions: {
          allowed: allowedPermissions, // Role permissions minus denied
          denied: user.customPermissions?.denied || [] // User-specific denied permissions
        }
      },
      projectAssignments: projectAssignments,
      summary: {
        userCreated: true,
        projectsAssigned: projectAssignments.length,
        totalProjects: Array.isArray(projects) ? projects.filter(Boolean).length : 0,
        rolePermissionsCount: rolePermissions.length,
        totalAllowed: allowedPermissions.length,
        totalDenied: user.customPermissions?.denied?.length || 0
      }
    });

  } catch (error) {
    console.error('User creation with projects error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Update user's project assignments
const updateUserProjects = async (req, res) => {
  // Validate request body
  const { error, value } = userProjectsSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Validation error',
      details: error.details.map(detail => detail.message)
    });
  }

  const { userId, projects } = value;

  try {

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const Project = require('../models/Project');
    const UserProject = require('../models/UserProject');
    const { ObjectId } = require('mongoose').Types;

    // Normalize project IDs (accept both strings and objects)
    const normalizedProjectIds = projects
      .map(p => typeof p === 'string' ? p : p.projectId)
      .filter(Boolean);

    // Remove existing project assignments
    await UserProject.deleteMany({ user: user._id });

    // Remove user from project members
    const existingAssignments = await UserProject.find({ user: user._id });
    for (const assignment of existingAssignments) {
      const project = await Project.findById(assignment.project);
      if (project && project.members.includes(user._id)) {
        project.members = project.members.filter(memberId => memberId.toString() !== user._id.toString());
        await project.save();
      }
    }

    const updatedAssignments = [];

    // Add new project assignments
    for (const projectId of normalizedProjectIds) {
      // Validate ObjectId format
      if (!ObjectId.isValid(projectId)) {
        console.warn(`Invalid project id ${projectId}, skipping assignment`);
        continue;
      }

      // Verify project exists
      const project = await Project.findById(projectId);
      if (!project) {
        console.warn(`Project ${projectId} not found, skipping assignment`);
        continue;
      }

      // Create user-project assignment
      try {
        const userProject = new UserProject({
          user: user._id,
          project: project._id,
          assignedAt: new Date()
        });

        await userProject.save();

        // Add user to project members
        if (!project.members.includes(user._id)) {
          project.members.push(user._id);
          await project.save();
        }

        updatedAssignments.push({
          projectId: project._id,
          projectName: project.name,
          assignedAt: userProject.assignedAt
        });
      } catch (e) {
        // Ignore duplicate assignment errors
        if (e && e.code === 11000) {
          console.warn(`Duplicate assignment for user ${user._id} and project ${project._id}, skipping`);
          continue;
        }
        throw e;
      }
    }

    res.json({
      message: 'User project assignments updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level
      },
      projectAssignments: updatedAssignments,
      summary: {
        previousAssignments: existingAssignments.length,
        newAssignments: updatedAssignments.length,
        totalProjects: normalizedProjectIds.length
      }
    });

  } catch (error) {
    console.error('Update user projects error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Delete user's project assignments
const deleteUserProjects = async (req, res) => {
  const { userId } = req.params;
  const { projectIds } = req.body || {}; // Optional: specific project IDs to remove

  try {
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const Project = require('../models/Project');
    const UserProject = require('../models/UserProject');
    const { ObjectId } = require('mongoose').Types;

    let query = { user: user._id };
    let removedAssignments = [];

    if (projectIds && Array.isArray(projectIds) && projectIds.length > 0) {
      // Remove specific projects
      const validProjectIds = projectIds.filter(id => ObjectId.isValid(id));
      query.project = { $in: validProjectIds };
      
      // Get assignments before deletion
      removedAssignments = await UserProject.find(query).populate('project', 'name');
    } else {
      // Remove all projects
      removedAssignments = await UserProject.find(query).populate('project', 'name');
    }

    // Delete user-project assignments
    const deleteResult = await UserProject.deleteMany(query);

    // Remove user from project members
    for (const assignment of removedAssignments) {
      if (assignment.project) {
        const project = await Project.findById(assignment.project._id);
        if (project && project.members.includes(user._id)) {
          project.members = project.members.filter(memberId => memberId.toString() !== user._id.toString());
          await project.save();
        }
      }
    }

    res.json({
      message: 'User project assignments deleted successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level
      },
      deletedAssignments: removedAssignments.map(assignment => ({
        projectId: assignment.project._id,
        projectName: assignment.project.name,
        assignedAt: assignment.assignedAt
      })),
      summary: {
        assignmentsRemoved: deleteResult.deletedCount,
        totalRemoved: removedAssignments.length
      }
    });

  } catch (error) {
    console.error('Delete user projects error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Assign projects to existing user
const assignProjectsToUser = async (req, res) => {
  const { userId } = req.params;
  const { projects } = req.body || {};

  try {
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    if (!projects || !Array.isArray(projects) || projects.length === 0) {
      return res.status(400).json({ message: 'Projects array is required and cannot be empty' });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const Project = require('../models/Project');
    const UserProject = require('../models/UserProject');
    const { ObjectId } = require('mongoose').Types;

    // Normalize project IDs (accept both strings and objects)
    const normalizedProjectIds = projects
      .map(p => typeof p === 'string' ? p : p.projectId)
      .filter(Boolean);

    const newAssignments = [];
    const skippedAssignments = [];

    // Assign projects to user
    for (const projectId of normalizedProjectIds) {
      // Validate ObjectId format
      if (!ObjectId.isValid(projectId)) {
        console.warn(`Invalid project id ${projectId}, skipping assignment`);
        skippedAssignments.push({ projectId, reason: 'Invalid project ID format' });
        continue;
      }

      // Verify project exists
      const project = await Project.findById(projectId);
      if (!project) {
        console.warn(`Project ${projectId} not found, skipping assignment`);
        skippedAssignments.push({ projectId, reason: 'Project not found' });
        continue;
      }

      // Check if assignment already exists
      const existingAssignment = await UserProject.findOne({
        user: user._id,
        project: project._id
      });

      if (existingAssignment) {
        console.warn(`User ${user._id} already assigned to project ${project._id}, skipping`);
        skippedAssignments.push({ 
          projectId, 
          projectName: project.name,
          reason: 'User already assigned to this project' 
        });
        continue;
      }

      // Create user-project assignment
      try {
        const userProject = new UserProject({
          user: user._id,
          project: project._id,
          assignedAt: new Date()
        });

        await userProject.save();

        // Add user to project members
        if (!project.members.includes(user._id)) {
          project.members.push(user._id);
          await project.save();
        }

        newAssignments.push({
          projectId: project._id,
          projectName: project.name,
          assignedAt: userProject.assignedAt
        });
      } catch (e) {
        console.error(`Error assigning project ${projectId} to user ${user._id}:`, e);
        skippedAssignments.push({ projectId, reason: 'Database error during assignment' });
      }
    }

    res.json({
      message: 'Project assignments completed',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level
      },
      newAssignments: newAssignments,
      skippedAssignments: skippedAssignments,
      summary: {
        totalRequested: normalizedProjectIds.length,
        successfullyAssigned: newAssignments.length,
        skipped: skippedAssignments.length
      }
    });

  } catch (error) {
    console.error('Assign projects to user error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Update user's custom permissions
const updateUserCustomPermissions = async (req, res) => {
  const { userId } = req.params;
  const { denied } = req.body || {}; // Only handle denied permissions
  
  try {
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent editing superadmin user's permissions
    if (user.role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot modify superadmin permissions' });
    }

    // Initialize customPermissions if it doesn't exist
    if (!user.customPermissions) {
      user.customPermissions = { allowed: [], denied: [] };
    }

    // Only update denied permissions (allowed will always be role permissions)
    if (denied !== undefined) {
      if (!Array.isArray(denied)) {
        return res.status(400).json({ message: 'Denied permissions must be an array' });
      }
      user.customPermissions.denied = denied.map(p => String(p).toLowerCase().trim()).filter(Boolean);
    }

    await user.save();

    // Get role permissions for response
    const userRole = await Role.findById(user.roleRef);
    const rolePermissions = userRole ? userRole.permissions : [];

    res.json({
      message: 'User custom permissions updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level
      },
      customPermissions: {
        allowed: rolePermissions, // Always role permissions
        denied: user.customPermissions.denied // User-specific denied permissions
      },
      summary: {
        rolePermissionsCount: rolePermissions.length,
        totalDenied: user.customPermissions.denied.length
      }
    });

  } catch (error) {
    console.error('Update user custom permissions error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Add custom permission to user
const addUserCustomPermission = async (req, res) => {
  const { userId } = req.params;
  const { permission, type = 'allowed' } = req.body || {};
  
  try {
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    if (!permission) {
      return res.status(400).json({ message: 'Permission is required' });
    }

    if (!['allowed', 'denied'].includes(type)) {
      return res.status(400).json({ message: 'Type must be either "allowed" or "denied"' });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent editing superadmin user's permissions
    if (user.role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot modify superadmin permissions' });
    }

    // Initialize customPermissions if it doesn't exist
    if (!user.customPermissions) {
      user.customPermissions = { allowed: [], denied: [] };
    }

    const normalizedPermission = String(permission).toLowerCase().trim();

    // Check if permission already exists in the opposite type
    const oppositeType = type === 'allowed' ? 'denied' : 'allowed';
    if (user.customPermissions[oppositeType].includes(normalizedPermission)) {
      return res.status(400).json({ 
        message: `Permission "${permission}" already exists in ${oppositeType} permissions. Remove it first.` 
      });
    }

    // Add permission if not already present
    if (!user.customPermissions[type].includes(normalizedPermission)) {
      user.customPermissions[type].push(normalizedPermission);
      await user.save();
    }

    res.json({
      message: `Permission "${permission}" added to ${type} permissions`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level
      },
      customPermissions: {
        allowed: user.customPermissions.allowed,
        denied: user.customPermissions.denied
      },
      addedPermission: {
        permission: normalizedPermission,
        type: type
      }
    });

  } catch (error) {
    console.error('Add user custom permission error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Remove custom permission from user
const removeUserCustomPermission = async (req, res) => {
  const { userId } = req.params;
  const { permission, type = 'allowed' } = req.body || {};
  
  try {
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    if (!permission) {
      return res.status(400).json({ message: 'Permission is required' });
    }

    if (!['allowed', 'denied'].includes(type)) {
      return res.status(400).json({ message: 'Type must be either "allowed" or "denied"' });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent editing superadmin user's permissions
    if (user.role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot modify superadmin permissions' });
    }

    // Initialize customPermissions if it doesn't exist
    if (!user.customPermissions) {
      user.customPermissions = { allowed: [], denied: [] };
    }

    const normalizedPermission = String(permission).toLowerCase().trim();

    // Remove permission if it exists
    const initialLength = user.customPermissions[type].length;
    user.customPermissions[type] = user.customPermissions[type].filter(p => p !== normalizedPermission);
    
    if (user.customPermissions[type].length === initialLength) {
      return res.status(404).json({ 
        message: `Permission "${permission}" not found in ${type} permissions` 
      });
    }

    await user.save();

    res.json({
      message: `Permission "${permission}" removed from ${type} permissions`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level
      },
      customPermissions: {
        allowed: user.customPermissions.allowed,
        denied: user.customPermissions.denied
      },
      removedPermission: {
        permission: normalizedPermission,
        type: type
      }
    });

  } catch (error) {
    console.error('Remove user custom permission error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Get user's effective permissions (role + custom)
const getUserEffectivePermissions = async (req, res) => {
  const { userId } = req.params;
  
  try {
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get role details
    const userRole = await Role.findById(user.roleRef);
    const rolePermissions = userRole ? userRole.permissions : [];
    
    // Get effective permissions
    const effectivePermissions = await user.getEffectivePermissions();

    // Role permissions go directly into allowed (no custom allowed needed)
    const allowedPermissions = rolePermissions; // Only role permissions in allowed

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level
      },
      customPermissions: {
        allowed: allowedPermissions, // Only role permissions
        denied: user.customPermissions?.denied || [] // User-specific denied permissions
      },
      summary: {
        rolePermissionsCount: rolePermissions.length,
        customDeniedCount: user.customPermissions?.denied?.length || 0,
        totalAllowedCount: allowedPermissions.length
      }
    });

  } catch (error) {
    console.error('Get user effective permissions error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Direct update of user custom permissions (simple approach)
const updateUserPermissionsDirect = async (req, res) => {
  const { userId } = req.params;
  const { denied } = req.body || {}; // Only handle denied permissions
  
  try {
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent editing superadmin user's permissions
    if (user.role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot modify superadmin permissions' });
    }

    // Initialize customPermissions if it doesn't exist
    if (!user.customPermissions) {
      user.customPermissions = { allowed: [], denied: [] };
    }

    // Get role details first
    const userRole = await Role.findById(user.roleRef);
    const rolePermissions = userRole ? userRole.permissions : [];

    // Only update denied permissions
    if (denied !== undefined) {
      user.customPermissions.denied = Array.isArray(denied) 
        ? denied.map(p => String(p).toLowerCase().trim()).filter(Boolean)
        : [];
    }

    // Calculate allowed permissions: role permissions minus denied permissions
    const allowedPermissions = rolePermissions.filter(permission => 
      !user.customPermissions.denied.includes(permission)
    );

    // Update the allowed permissions in the database
    user.customPermissions.allowed = allowedPermissions;

    await user.save();

    res.json({
      message: 'User permissions updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level,
        customPermissions: {
          allowed: allowedPermissions, // Role permissions minus denied
          denied: user.customPermissions.denied // User-specific denied permissions
        }
      },
      summary: {
        rolePermissionsCount: rolePermissions.length,
        totalAllowed: allowedPermissions.length,
        totalDenied: user.customPermissions.denied.length
      }
    });

  } catch (error) {
    console.error('Update user permissions direct error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Update all existing users to populate customPermissions.allowed with role permissions
const updateAllUsersWithRolePermissions = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied. Superadmin role required.' });
    }

    const users = await User.find();
    let updatedCount = 0;
    let errors = [];

    for (const user of users) {
      try {
        // Get user's role
        const userRole = await Role.findById(user.roleRef);
        if (!userRole) {
          errors.push(`User ${user.email}: Role not found`);
          continue;
        }

        // Initialize customPermissions if it doesn't exist
        if (!user.customPermissions) {
          user.customPermissions = { allowed: [], denied: [] };
        }

        // Update allowed permissions with role permissions
        user.customPermissions.allowed = userRole.permissions;
        
        await user.save();
        updatedCount++;
        
        console.log(`Updated user ${user.email} with ${userRole.permissions.length} role permissions`);
      } catch (error) {
        errors.push(`User ${user.email}: ${error.message}`);
        console.error(`Error updating user ${user.email}:`, error);
      }
    }

    res.json({
      message: 'User permissions update completed',
      summary: {
        totalUsers: users.length,
        updatedUsers: updatedCount,
        errors: errors.length,
        errorDetails: errors
      }
    });

  } catch (error) {
    console.error('Update all users with role permissions error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Check if user has specific permission
const checkUserPermission = async (req, res) => {
  const { userId } = req.params;
  const { permission } = req.body || {};
  
  try {
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    if (!permission) {
      return res.status(400).json({ message: 'Permission is required' });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check permission
    const hasPermission = await user.hasPermission(permission);

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level
      },
      permission: permission,
      hasPermission: hasPermission,
      explanation: hasPermission 
        ? `User has "${permission}" permission through role or custom permissions`
        : `User does not have "${permission}" permission`
    });

  } catch (error) {
    console.error('Check user permission error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Get all projects with user assignment status and handle assignment
const getUserProjectsAssignment = async (req, res) => {
  const { userId } = req.params;
  const { action } = req.query;
  const projectIds = req.query.projectIds ? req.query.projectIds.split(',') : [];

  try {
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const Project = require('../models/Project');
    const UserProject = require('../models/UserProject');
    const { ObjectId } = require('mongoose').Types;

    // Get all projects
    const allProjects = await Project.find().sort({ name: 1 });
    
    // Get user's current project assignments
    const userAssignments = await UserProject.find({ user: user._id });
    const userProjectIds = userAssignments.map(assignment => assignment.project.toString());

    // Prepare projects with assignment status
    const projectsWithStatus = allProjects.map(project => ({
      _id: project._id,
      name: project.name,
      location: project.location,
      developBy: project.developBy,
      status: project.status,
      createdAt: project.createdAt,
      isAssigned: userProjectIds.includes(project._id.toString()),
      assignedAt: userAssignments.find(assignment => 
        assignment.project.toString() === project._id.toString()
      )?.assignedAt || null
    }));

    // If action is provided, handle project assignment/removal
    if (action && projectIds && Array.isArray(projectIds)) {
      let result = {};

      if (action === 'assign') {
        // Assign new projects
        const newAssignments = [];
        const skippedAssignments = [];

        for (const projectId of projectIds) {
          if (!ObjectId.isValid(projectId)) {
            skippedAssignments.push({ projectId, reason: 'Invalid project ID format' });
            continue;
          }

          const project = await Project.findById(projectId);
          if (!project) {
            skippedAssignments.push({ projectId, reason: 'Project not found' });
            continue;
          }

          // Check if already assigned
          const existingAssignment = await UserProject.findOne({
            user: user._id,
            project: project._id
          });

          if (existingAssignment) {
            skippedAssignments.push({ 
              projectId, 
              projectName: project.name,
              reason: 'User already assigned to this project' 
            });
            continue;
          }

          // Create assignment
          try {
            const userProject = new UserProject({
              user: user._id,
              project: project._id,
              assignedAt: new Date()
            });

            await userProject.save();

            // Add user to project members
            if (!project.members.includes(user._id)) {
              project.members.push(user._id);
              await project.save();
            }

            newAssignments.push({
              projectId: project._id,
              projectName: project.name,
              assignedAt: userProject.assignedAt
            });
          } catch (e) {
            skippedAssignments.push({ projectId, reason: 'Database error during assignment' });
          }
        }

        result = {
          action: 'assign',
          newAssignments,
          skippedAssignments,
          summary: {
            totalRequested: projectIds.length,
            successfullyAssigned: newAssignments.length,
            skipped: skippedAssignments.length
          }
        };

      } else if (action === 'remove') {
        // Remove project assignments
        const removedAssignments = [];
        const skippedRemovals = [];

        for (const projectId of projectIds) {
          if (!ObjectId.isValid(projectId)) {
            skippedRemovals.push({ projectId, reason: 'Invalid project ID format' });
            continue;
          }

          const project = await Project.findById(projectId);
          if (!project) {
            skippedRemovals.push({ projectId, reason: 'Project not found' });
            continue;
          }

          // Check if assigned
          const existingAssignment = await UserProject.findOne({
            user: user._id,
            project: project._id
          });

          if (!existingAssignment) {
            skippedRemovals.push({ 
              projectId, 
              projectName: project.name,
              reason: 'User not assigned to this project' 
            });
            continue;
          }

          // Remove assignment
          try {
            await UserProject.findByIdAndDelete(existingAssignment._id);

            // Remove user from project members
            if (project.members.includes(user._id)) {
              project.members = project.members.filter(memberId => 
                memberId.toString() !== user._id.toString()
              );
              await project.save();
            }

            removedAssignments.push({
              projectId: project._id,
              projectName: project.name,
              assignedAt: existingAssignment.assignedAt
            });
          } catch (e) {
            skippedRemovals.push({ projectId, reason: 'Database error during removal' });
          }
        }

        result = {
          action: 'remove',
          removedAssignments,
          skippedRemovals,
          summary: {
            totalRequested: projectIds.length,
            successfullyRemoved: removedAssignments.length,
            skipped: skippedRemovals.length
          }
        };
      }

      // Return updated project list with action result
      return res.json({
        message: `Project ${action} completed`,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          level: user.level
        },
        projects: projectsWithStatus,
        actionResult: result,
        summary: {
          totalProjects: allProjects.length,
          assignedProjects: projectsWithStatus.filter(p => p.isAssigned).length,
          unassignedProjects: projectsWithStatus.filter(p => !p.isAssigned).length
        }
      });
    }

    // Return just the project list with assignment status
    res.json({
      message: 'User projects assignment data retrieved',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level
      },
      projects: projectsWithStatus,
      summary: {
        totalProjects: allProjects.length,
        assignedProjects: projectsWithStatus.filter(p => p.isAssigned).length,
        unassignedProjects: projectsWithStatus.filter(p => !p.isAssigned).length
      }
    });

  } catch (error) {
    console.error('Get user projects assignment error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  initSuperadmin,
  createRole,
  editRole,
  deleteRole,
  listRoles,
  createUserWithRole,
  createUserWithProjects,
  getUsersWithProjects,
  editUserWithRole,
  deleteUserWithRole,
  getUserById,
  adminLogin,
  currentUser,
  getUsersByRole,
  getAllUsersGroupedByRole,
  getUserHistory,
  getUserTimeline,
  getAllUsersWithHistory,
  updateSuperadminPermissions,
  updateUserProjects,
  deleteUserProjects,
  assignProjectsToUser,
  getindividualRoleById,
  getUserProjectsAssignment,
  // Custom permissions management
  updateUserCustomPermissions,
  addUserCustomPermission,
  removeUserCustomPermission,
  getUserEffectivePermissions,
  checkUserPermission,
  updateUserPermissionsDirect,
  updateAllUsersWithRolePermissions,
};
