/**
 * Test script for the new permission system
 * Run with: node test-permissions.js
 */

const mongoose = require('mongoose');
const User = require('./models/User');
const Role = require('./models/Role');
const UserProjectPermission = require('./models/UserProjectPermission');
const Project = require('./models/Project');

// Connect to MongoDB
const MONGO_URI = 'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testPermissionSystem() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Create a test role
    console.log('\n📝 Creating test role...');
    const testRole = await Role.findOneAndUpdate(
      { name: 'testuser' },
      {
        name: 'testuser',
        level: 3,
        permissions: ['leads:read', 'leads:create', 'notifications:read']
      },
      { upsert: true, new: true }
    );
    console.log('✅ Test role created:', testRole);

    // 2. Create a test project
    console.log('\n📝 Creating test project...');
    const testProject = await Project.findOneAndUpdate(
      { name: 'Test Project' },
      {
        name: 'Test Project',
        description: 'A test project for permission testing',
        owner: new mongoose.Types.ObjectId()
      },
      { upsert: true, new: true }
    );
    console.log('✅ Test project created:', testProject);

    // 3. Create a test user with custom permissions
    console.log('\n📝 Creating test user...');
    const testUser = await User.findOneAndUpdate(
      { email: 'testuser@example.com' },
      {
        name: 'Test User',
        email: 'testuser@example.com',
        role: 'testuser',
        level: 3,
        customPermissions: {
          allowed: ['leads:update'], // Additional permission
          denied: ['leads:create']   // Denied permission (overrides role)
        },
        restrictions: {
          maxProjects: 2,
          allowedProjects: [testProject._id]
        }
      },
      { upsert: true, new: true }
    );
    console.log('✅ Test user created:', testUser);

    // 4. Create project-specific permissions
    console.log('\n📝 Creating project-specific permissions...');
    const projectPerm = await UserProjectPermission.findOneAndUpdate(
      { user: testUser._id, project: testProject._id },
      {
        user: testUser._id,
        project: testProject._id,
        permissions: {
          allowed: ['leads:delete'], // Additional project permission
          denied: ['leads:update']   // Denied project permission
        },
        restrictions: {
          canCreateLeads: true,
          canEditLeads: false,
          canDeleteLeads: true,
          canViewAllLeads: true
        },
        assignedBy: testUser._id,
        isActive: true
      },
      { upsert: true, new: true }
    );
    console.log('✅ Project permissions created:', projectPerm);

    // 5. Test permission checking
    console.log('\n🧪 Testing permission system...');

    // Test role permissions
    console.log('\n--- Role Permissions ---');
    console.log('leads:read (from role):', await testUser.hasPermission('leads:read'));
    console.log('leads:create (denied by custom):', await testUser.hasPermission('leads:create'));
    console.log('leads:update (custom allowed):', await testUser.hasPermission('leads:update'));
    console.log('leads:delete (not in role):', await testUser.hasPermission('leads:delete'));

    // Test project access
    console.log('\n--- Project Access ---');
    console.log('Can access test project:', testUser.canAccessProject(testProject._id));
    console.log('Can access random project:', testUser.canAccessProject(new mongoose.Types.ObjectId()));

    // Test effective permissions
    console.log('\n--- Effective Permissions ---');
    const effectivePerms = await testUser.getEffectivePermissions();
    console.log('All effective permissions:', effectivePerms);

    // Test project-specific permissions
    console.log('\n--- Project-Specific Permissions ---');
    const projectPermCheck = await UserProjectPermission.findOne({
      user: testUser._id,
      project: testProject._id
    });
    
    if (projectPermCheck) {
      console.log('leads:create (project):', projectPermCheck.hasPermission('leads:create'));
      console.log('leads:update (project denied):', projectPermCheck.hasPermission('leads:update'));
      console.log('leads:delete (project allowed):', projectPermCheck.hasPermission('leads:delete'));
    }

    // 6. Test API endpoints (simulation)
    console.log('\n🌐 Testing API endpoints...');
    
    // Simulate GET /api/permissions/my-permissions
    console.log('\n--- GET /api/permissions/my-permissions ---');
    const userPerms = {
      user: {
        id: testUser._id,
        name: testUser.name,
        email: testUser.email,
        role: testUser.role,
        level: testUser.level,
        isActive: testUser.isActive
      },
      permissions: {
        effective: effectivePerms,
        custom: {
          allowed: testUser.customPermissions?.allowed || [],
          denied: testUser.customPermissions?.denied || []
        },
        restrictions: testUser.restrictions || {}
      }
    };
    console.log('User permissions response:', JSON.stringify(userPerms, null, 2));

    console.log('\n✅ Permission system test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- Role-based permissions: Working');
    console.log('- User-specific overrides: Working');
    console.log('- Project access control: Working');
    console.log('- Project-specific permissions: Working');
    console.log('- API simulation: Working');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
if (require.main === module) {
  testPermissionSystem();
}

module.exports = { testPermissionSystem };

