const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // Adjust path to your user model
const Role = require('./models/Role'); // Adjust path to your role model

async function createSuperAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/deltadb1', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Define superadmin role details
    const superAdminRoleData = {
      name: 'superadmin',
      level: 1,
      permissions: [
        'users:manage',
        'roles:manage',
        'projects:manage',
        'notifications:read',
        'notifications:update',
        'leads:create',
        'leads:read',
        'leads:update',
        'leads:bulk',
        'leads:transfer',
        'leadsSource:create',
        'leadssource:read_all',
        'leadssource:read',
        'leadssource:update',
        'leadssource:delete',
        'leadsStatus:create',
        'leadsstatus:read_all',
        'leadsstatus:read',
        'leadsstatus:update',
        'leadsstatus:delete',
        'user-projects:assign',
        'user-projects:read',
        'user-projects:remove',
        'user-projects:bulk-update',
        'user-projects:bulk-delete',
        'reporting:read',
        'notifications:bulk-update',
        'notifications:bulk-delete'
      ],
    };

    // Check if superadmin role exists, create if it doesn't
    let superAdminRole = await Role.findOne({ name: 'superadmin' });
    if (!superAdminRole) {
      superAdminRole = await Role.create(superAdminRoleData);
      console.log('Superadmin role created');
    } else {
      console.log('Superadmin role already exists');
    }

    // Define superadmin user details
    const superAdminUserData = {
      name: 'Super Admin',
      email: 'hiten.mewada@deltayards.com',
      password: 'abcd@12345!', // Replace with a secure password
      role: 'superadmin',
      roleRef: superAdminRole._id,
      level: 1,
    };

    // Check if superadmin user exists, create if it doesn't
    const existingUser = await User.findOne({ email: superAdminUserData.email });
    if (existingUser) {
      console.log('Superadmin user already exists');
      return;
    }

    // Create superadmin user
    const superAdminUser = await User.create(superAdminUserData);
    console.log('Superadmin user created successfully');

    // Verify the created user
    console.log('Created User Details:', {
      name: superAdminUser.name,
      email: superAdminUser.email,
      role: superAdminUser.role,
      roleRef: superAdminUser.roleRef,
      level: superAdminUser.level,
    });

  } catch (error) {
    console.error('Error creating superadmin:', error.message);
  } finally {
    // Close the MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Execute the function
createSuperAdmin();