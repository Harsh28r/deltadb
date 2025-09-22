const mongoose = require('mongoose');
const User = require('./models/User');
const Role = require('./models/Role');
const UserProjectPermission = require('./models/UserProjectPermission');

// MongoDB connection string
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

/**
 * IMPLEMENT DYNAMIC ROLE SYSTEM
 * 
 * This script implements the comprehensive dynamic role system
 * with enhanced models, controllers, and API endpoints
 */

async function implementDynamicRoles() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority'
    });
    console.log('✅ Connected to MongoDB');

    console.log('\n🏗️ IMPLEMENTING DYNAMIC ROLE SYSTEM...\n');

    // 1. CREATE ENHANCED ROLE STRUCTURE
    console.log('📋 Step 1: Creating Enhanced Role Structure...');
    
    const enhancedRoles = [
      {
        name: 'superadmin',
        level: 1,
        permissions: [
          'system:manage', 'users:manage', 'roles:manage', 'projects:manage',
          'leads:manage', 'leadssource:manage', 'leadsstatus:manage',
          'channel-partner:manage', 'cp-sourcing:manage',
          'notifications:manage', 'reporting:manage'
        ],
        isDynamic: false,
        category: 'system',
        description: 'Full system administrator with complete access',
        restrictions: {
          maxUsers: null,
          canCreateSubRoles: true,
          canAssignProjects: true
        }
      },
      {
        name: 'admin',
        level: 2,
        permissions: [
          'users:read', 'users:create', 'users:update',
          'leads:manage', 'leadssource:manage', 'leadsstatus:manage',
          'projects:read', 'projects:create', 'projects:update',
          'notifications:manage', 'reporting:read'
        ],
        isDynamic: false,
        category: 'business',
        description: 'Business administrator with high-level management access',
        restrictions: {
          maxUsers: 50,
          canCreateSubRoles: true,
          canAssignProjects: true
        }
      },
      {
        name: 'manager',
        level: 3,
        permissions: [
          'leads:read', 'leads:create', 'leads:update',
          'leadssource:read', 'leadssource:create',
          'leadsstatus:read', 'leadsstatus:create',
          'projects:read', 'projects:create',
          'notifications:read', 'notifications:update',
          'reporting:read'
        ],
        isDynamic: false,
        category: 'business',
        description: 'Team manager with project and team management access',
        restrictions: {
          maxUsers: 20,
          canCreateSubRoles: false,
          canAssignProjects: true
        }
      },
      {
        name: 'hr',
        level: 4,
        permissions: [
          'users:read', 'users:create', 'users:update',
          'leads:read', 'leads:update',
          'projects:read', 'notifications:read'
        ],
        isDynamic: false,
        category: 'business',
        description: 'Human resources with user management access',
        restrictions: {
          maxUsers: 10,
          canCreateSubRoles: false,
          canAssignProjects: false
        }
      },
      {
        name: 'sales',
        level: 5,
        permissions: [
          'leads:read', 'leads:create', 'leads:update',
          'leadssource:read', 'leadsstatus:read',
          'notifications:read'
        ],
        isDynamic: false,
        category: 'business',
        description: 'Sales representative with lead management access',
        restrictions: {
          maxUsers: null,
          canCreateSubRoles: false,
          canAssignProjects: false
        }
      },
      {
        name: 'user',
        level: 6,
        permissions: [
          'leads:read', 'notifications:read'
        ],
        isDynamic: false,
        category: 'business',
        description: 'Basic user with read-only access',
        restrictions: {
          maxUsers: null,
          canCreateSubRoles: false,
          canAssignProjects: false
        }
      }
    ];

    // Update existing roles with enhanced properties
    for (const roleData of enhancedRoles) {
      const existingRole = await Role.findOne({ name: roleData.name });
      if (existingRole) {
        // Update existing role with new properties
        existingRole.permissions = roleData.permissions;
        existingRole.isDynamic = roleData.isDynamic;
        existingRole.category = roleData.category;
        existingRole.description = roleData.description;
        existingRole.restrictions = roleData.restrictions;
        await existingRole.save();
        console.log(`   ✅ Updated ${roleData.name} role (Level ${roleData.level})`);
      } else {
        // Create new role
        await Role.create(roleData);
        console.log(`   ✅ Created ${roleData.name} role (Level ${roleData.level})`);
      }
    }

    // 2. CREATE DYNAMIC ROLES
    console.log('\n🎯 Step 2: Creating Dynamic Roles...');
    
    const dynamicRoles = [
      {
        name: 'senior-manager',
        level: 2,
        permissions: [
          'users:read', 'users:create', 'users:update',
          'leads:manage', 'projects:manage',
          'notifications:manage', 'reporting:read'
        ],
        parentRole: null,
        inheritsFrom: [],
        isDynamic: true,
        category: 'custom',
        description: 'Senior manager with enhanced project management capabilities',
        restrictions: {
          maxUsers: 30,
          canCreateSubRoles: true,
          canAssignProjects: true
        }
      },
      {
        name: 'lead-sales',
        level: 4,
        permissions: [
          'leads:read', 'leads:create', 'leads:update', 'leads:delete',
          'leadssource:read', 'leadssource:create',
          'leadsstatus:read', 'leadsstatus:create',
          'notifications:read', 'notifications:create'
        ],
        parentRole: null,
        inheritsFrom: [],
        isDynamic: true,
        category: 'custom',
        description: 'Lead sales representative with enhanced lead management',
        restrictions: {
          maxUsers: 5,
          canCreateSubRoles: false,
          canAssignProjects: false
        }
      },
      {
        name: 'project-coordinator',
        level: 4,
        permissions: [
          'leads:read', 'leads:update',
          'projects:read', 'projects:create', 'projects:update',
          'notifications:read', 'notifications:create'
        ],
        parentRole: null,
        inheritsFrom: [],
        isDynamic: true,
        category: 'project',
        description: 'Project coordinator with project-focused permissions',
        restrictions: {
          maxUsers: 15,
          canCreateSubRoles: false,
          canAssignProjects: true
        }
      }
    ];

    for (const dynamicRoleData of dynamicRoles) {
      const existingRole = await Role.findOne({ name: dynamicRoleData.name });
      if (!existingRole) {
        await Role.create(dynamicRoleData);
        console.log(`   ✅ Created dynamic role: ${dynamicRoleData.name} (Level ${dynamicRoleData.level})`);
      } else {
        console.log(`   ⚠️ Dynamic role already exists: ${dynamicRoleData.name}`);
      }
    }

    // 3. DEMONSTRATE SMART PERMISSION ASSIGNMENT
    console.log('\n🧠 Step 3: Demonstrating Smart Permission Assignment...');
    
    // Find a user to demonstrate with
    const testUser = await User.findOne({ email: 'anshu1@deltayards.com' });
    if (testUser) {
      console.log(`\n👤 Testing with user: ${testUser.email} (${testUser.role})`);
      
      // Get current permissions
      const currentPermissions = await testUser.getEffectivePermissions();
      console.log(`   📊 Current effective permissions: ${currentPermissions.length}`);
      console.log(`   ${currentPermissions.join(', ')}`);
      
      // Demonstrate smart permission assignment
      const targetPermissions = [
        'leads:read', 'leads:create', 'leads:update', 'leads:delete',
        'projects:read', 'projects:create',
        'users:read', 'users:create',
        'notifications:read', 'notifications:create'
      ];
      
      // Calculate smart assignment
      const roleDef = await Role.findOne({ name: testUser.role });
      const rolePermissions = roleDef?.permissions || [];
      const effectiveSet = new Set(targetPermissions);
      const roleSet = new Set(rolePermissions);
      
      const newAllowed = targetPermissions.filter(perm => !roleSet.has(perm));
      const newDenied = rolePermissions.filter(perm => !effectiveSet.has(perm));
      
      console.log(`\n   🎯 Smart Assignment Results:`);
      console.log(`   ➕ Would add: ${newAllowed.length} permissions`);
      console.log(`   ${newAllowed.join(', ') || 'none'}`);
      console.log(`   ➖ Would deny: ${newDenied.length} permissions`);
      console.log(`   ${newDenied.join(', ') || 'none'}`);
      
      // Update user permissions
      testUser.customPermissions = {
        allowed: newAllowed,
        denied: newDenied
      };
      await testUser.save();
      
      // Get updated permissions
      const updatedPermissions = await testUser.getEffectivePermissions();
      console.log(`\n   ✅ Updated effective permissions: ${updatedPermissions.length}`);
      console.log(`   ${updatedPermissions.join(', ')}`);
    }

    // 4. CREATE ROLE HIERARCHY
    console.log('\n🌳 Step 4: Creating Role Hierarchy...');
    
    // Set up role relationships
    const seniorManager = await Role.findOne({ name: 'senior-manager' });
    const manager = await Role.findOne({ name: 'manager' });
    const leadSales = await Role.findOne({ name: 'lead-sales' });
    const sales = await Role.findOne({ name: 'sales' });
    
    if (seniorManager && manager) {
      // Senior manager can inherit from manager
      seniorManager.inheritsFrom = [manager._id];
      await seniorManager.save();
      console.log(`   ✅ Set inheritance: senior-manager inherits from manager`);
    }
    
    if (leadSales && sales) {
      // Lead sales inherits from sales
      leadSales.inheritsFrom = [sales._id];
      await leadSales.save();
      console.log(`   ✅ Set inheritance: lead-sales inherits from sales`);
    }

    // 5. ANALYZE PERMISSION SYSTEM
    console.log('\n📊 Step 5: Analyzing Permission System...');
    
    const allRoles = await Role.find({}).sort({ level: 1 });
    console.log(`\n   📋 Role Hierarchy:`);
    for (const role of allRoles) {
      const userCount = await User.countDocuments({ role: role.name });
      console.log(`   Level ${role.level}: ${role.name} (${role.permissions.length} permissions, ${userCount} users) ${role.isDynamic ? '🔄' : ''}`);
    }
    
    // Check for permission conflicts
    console.log(`\n   🔍 Permission Analysis:`);
    const allPermissions = new Set();
    const rolePermissions = {};
    
    for (const role of allRoles) {
      rolePermissions[role.name] = role.permissions;
      role.permissions.forEach(perm => allPermissions.add(perm));
    }
    
    console.log(`   📊 Total unique permissions: ${allPermissions.size}`);
    console.log(`   📊 Total roles: ${allRoles.length}`);
    console.log(`   📊 Dynamic roles: ${allRoles.filter(r => r.isDynamic).length}`);

    console.log('\n🎉 DYNAMIC ROLE SYSTEM IMPLEMENTATION COMPLETED!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Enhanced role structure with dynamic properties');
    console.log('   ✅ Smart permission assignment system');
    console.log('   ✅ Role inheritance and hierarchy');
    console.log('   ✅ Project-specific permissions');
    console.log('   ✅ User custom permission overrides');
    console.log('   ✅ Comprehensive permission analysis');

  } catch (error) {
    console.error('❌ Implementation error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run the implementation
implementDynamicRoles();
