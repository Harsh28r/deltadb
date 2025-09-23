const mongoose = require('mongoose');
const User = require('./models/User');
const Role = require('./models/Role');

// MongoDB connection string
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

/**
 * QUICK FIX FOR PERMISSION MESS
 * 
 * This script fixes the permission system issues:
 * 1. Clears excessive custom permissions
 * 2. Sets proper role-based permissions
 * 3. Makes the system clean and efficient
 */

async function fixPermissionMess() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority'
    });
    console.log('✅ Connected to MongoDB');

    console.log('\n🔧 FIXING PERMISSION MESS...\n');

    // 1. FIX ROLE PERMISSIONS FIRST
    console.log('📋 Step 1: Fixing Role Permissions...');
    
    const rolePermissions = {
      'superadmin': [
        'system:manage', 'users:manage', 'roles:manage', 'projects:manage',
        'leads:manage', 'leadssource:manage', 'leadsstatus:manage',
        'channel-partner:manage', 'cp-sourcing:manage',
        'notifications:manage', 'reporting:manage'
      ],
      'admin': [
        'users:read', 'users:create', 'users:update',
        'leads:manage', 'leadssource:manage', 'leadsstatus:manage',
        'projects:read', 'projects:create', 'projects:update',
        'notifications:manage', 'reporting:read'
      ],
      'manager': [
        'leads:read', 'leads:create', 'leads:update',
        'leadssource:read', 'leadssource:create',
        'leadsstatus:read', 'leadsstatus:create',
        'projects:read', 'projects:create',
        'notifications:read', 'notifications:update',
        'reporting:read'
      ],
      'team leader': [
        'leads:read', 'leads:create', 'leads:update',
        'leadssource:read', 'leadssource:create',
        'leadsstatus:read', 'leadsstatus:create',
        'projects:read', 'projects:create', 'projects:update',
        'users:read', 'users:create', 'users:update',
        'notifications:read', 'notifications:update',
        'reporting:read'
      ],
      'hr': [
        'users:read', 'users:create', 'users:update',
        'leads:read', 'leads:update',
        'projects:read', 'notifications:read'
      ],
      'sales': [
        'leads:read', 'leads:create', 'leads:update',
        'leadssource:read', 'leadsstatus:read',
        'notifications:read'
      ],
      'user': [
        'leads:read', 'notifications:read'
      ]
    };

    // Update all roles with proper permissions
    for (const [roleName, permissions] of Object.entries(rolePermissions)) {
      const role = await Role.findOne({ name: roleName });
      if (role) {
        role.permissions = permissions;
        await role.save();
        console.log(`   ✅ Fixed ${roleName} role: ${permissions.length} permissions`);
      } else {
        // Create role if it doesn't exist
        await Role.create({
          name: roleName,
          level: getRoleLevel(roleName),
          permissions: permissions
        });
        console.log(`   ✅ Created ${roleName} role: ${permissions.length} permissions`);
      }
    }

    // 2. CLEAN UP USER PERMISSIONS
    console.log('\n🧹 Step 2: Cleaning Up User Permissions...');
    
    const users = await User.find({});
    console.log(`   📊 Found ${users.length} users to clean up`);

    for (const user of users) {
      console.log(`\n👤 Cleaning user: ${user.name} (${user.email}) - Role: ${user.role}`);
      
      // Get role permissions
      const roleDef = await Role.findOne({ name: user.role });
      const rolePermissions = roleDef?.permissions || [];
      
      console.log(`   📋 Role permissions: ${rolePermissions.length}`);
      console.log(`   ${rolePermissions.join(', ')}`);
      
      // Get current effective permissions
      const currentEffective = await user.getEffectivePermissions();
      console.log(`   📊 Current effective: ${currentEffective.length} permissions`);
      
      // Clear custom permissions (start fresh)
      user.customPermissions = {
        allowed: [],
        denied: []
      };
      
      await user.save();
      
      // Get new effective permissions
      const newEffective = await user.getEffectivePermissions();
      console.log(`   ✅ New effective: ${newEffective.length} permissions`);
      console.log(`   ${newEffective.join(', ')}`);
      
      // Show what was removed
      const removed = currentEffective.filter(perm => !newEffective.includes(perm));
      if (removed.length > 0) {
        console.log(`   🗑️ Removed ${removed.length} excessive permissions`);
        console.log(`   ${removed.join(', ')}`);
      }
    }

    // 3. DEMONSTRATE PROPER PERMISSION ASSIGNMENT
    console.log('\n🎯 Step 3: Demonstrating Proper Permission Assignment...');
    
    const testUser = await User.findOne({ email: 'anu@deltayards.com' });
    if (testUser) {
      console.log(`\n👤 Testing with: ${testUser.name} (${testUser.role})`);
      
      // Get role permissions
      const roleDef = await Role.findOne({ name: testUser.role });
      const rolePermissions = roleDef?.permissions || [];
      
      // Example: Add some custom permissions (only what's NOT in role)
      const additionalPermissions = ['leads:delete', 'projects:delete'];
      
      // Calculate what to add (only permissions not in role)
      const roleSet = new Set(rolePermissions);
      const newAllowed = additionalPermissions.filter(perm => !roleSet.has(perm));
      
      // Update user with smart custom permissions
      testUser.customPermissions = {
        allowed: newAllowed,
        denied: [] // No denied permissions for now
      };
      
      await testUser.save();
      
      // Get final effective permissions
      const finalEffective = await testUser.getEffectivePermissions();
      
      console.log(`\n   📊 Final Permission Structure:`);
      console.log(`   🎭 Role permissions: ${rolePermissions.length}`);
      console.log(`   ➕ Custom allowed: ${newAllowed.length}`);
      console.log(`   ➖ Custom denied: 0`);
      console.log(`   ✅ Effective total: ${finalEffective.length}`);
      console.log(`   ${finalEffective.join(', ')}`);
      
      console.log(`\n   🎉 CLEAN PERMISSION STRUCTURE ACHIEVED!`);
    }

    console.log('\n🎉 PERMISSION MESS FIXED!');
    console.log('\n📋 Summary:');
    console.log('   ✅ All roles have proper, clean permissions');
    console.log('   ✅ All users have clean custom permissions');
    console.log('   ✅ No more excessive permission duplication');
    console.log('   ✅ Easy to understand and maintain');

  } catch (error) {
    console.error('❌ Fix error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Helper function to get role level
function getRoleLevel(roleName) {
  const levels = {
    'superadmin': 1,
    'admin': 2,
    'manager': 3,
    'team leader': 3,
    'hr': 4,
    'sales': 5,
    'user': 6
  };
  return levels[roleName] || 6;
}

// Run the fix
fixPermissionMess();

