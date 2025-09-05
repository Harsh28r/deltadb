/**
 * Check permissions for each individual user in the system
 * Run with: node check-each-user-permissions.js
 */

const mongoose = require('mongoose');
const User = require('./models/User');
const Role = require('./models/Role');
const UserProjectPermission = require('./models/UserProjectPermission');

// Connect to MongoDB
const MONGO_URI = 'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function checkEachUserPermissions() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get all users
    const users = await User.find({}).populate('roleRef').select('-password');
    console.log(`\n👥 Found ${users.length} users in the system\n`);

    if (users.length === 0) {
      console.log('❌ No users found in the system');
      return;
    }

    // Check permissions for each user
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`👤 USER ${i + 1}: ${user.name} (${user.email})`);
      console.log(`${'='.repeat(60)}`);
      
      console.log(`📧 Email: ${user.email}`);
      console.log(`👔 Role: ${user.role}`);
      console.log(`📊 Level: ${user.level}`);
      console.log(`✅ Active: ${user.isActive ? 'Yes' : 'No'}`);
      console.log(`🏢 Company: ${user.companyName || 'Not specified'}`);
      console.log(`📱 Mobile: ${user.mobile || 'Not specified'}`);

      // Get effective permissions
      try {
        const effectivePermissions = await user.getEffectivePermissions();
        console.log(`\n🔑 EFFECTIVE PERMISSIONS (${effectivePermissions.length}):`);
        if (effectivePermissions.length > 0) {
          effectivePermissions.forEach(perm => {
            console.log(`   ✅ ${perm}`);
          });
        } else {
          console.log('   ❌ No permissions found');
        }
      } catch (error) {
        console.log(`   ❌ Error getting permissions: ${error.message}`);
      }

      // Show custom permissions
      console.log(`\n🎯 CUSTOM PERMISSIONS:`);
      const allowed = user.customPermissions?.allowed || [];
      const denied = user.customPermissions?.denied || [];
      
      if (allowed.length > 0) {
        console.log(`   ➕ ALLOWED (${allowed.length}):`);
        allowed.forEach(perm => console.log(`      ✅ ${perm}`));
      } else {
        console.log('   ➕ ALLOWED: None');
      }
      
      if (denied.length > 0) {
        console.log(`   ➖ DENIED (${denied.length}):`);
        denied.forEach(perm => console.log(`      ❌ ${perm}`));
      } else {
        console.log('   ➖ DENIED: None');
      }

      // Show restrictions
      console.log(`\n🚫 RESTRICTIONS:`);
      const restrictions = user.restrictions || {};
      console.log(`   📊 Max Projects: ${restrictions.maxProjects || 'No limit'}`);
      console.log(`   ✅ Allowed Projects: ${restrictions.allowedProjects?.length || 0}`);
      console.log(`   ❌ Denied Projects: ${restrictions.deniedProjects?.length || 0}`);

      // Test specific permissions
      console.log(`\n🧪 PERMISSION TESTS:`);
      const testPermissions = [
        'leads:read',
        'leads:create', 
        'leads:update',
        'leads:delete',
        'users:manage',
        'projects:manage',
        'notifications:read'
      ];

      for (const permission of testPermissions) {
        try {
          const hasPermission = await user.hasPermission(permission);
          const status = hasPermission ? '✅' : '❌';
          console.log(`   ${permission.padEnd(20)} : ${status}`);
        } catch (error) {
          console.log(`   ${permission.padEnd(20)} : ❌ ERROR`);
        }
      }

      // Check project-specific permissions
      try {
        const projectPermissions = await UserProjectPermission.find({ 
          user: user._id, 
          isActive: true 
        }).populate('project', 'name');
        
        if (projectPermissions.length > 0) {
          console.log(`\n🏗️ PROJECT-SPECIFIC PERMISSIONS (${projectPermissions.length}):`);
          projectPermissions.forEach(pp => {
            console.log(`   📁 Project: ${pp.project?.name || 'Unknown'}`);
            if (pp.permissions?.allowed?.length > 0) {
              console.log(`      ➕ Allowed: ${pp.permissions.allowed.join(', ')}`);
            }
            if (pp.permissions?.denied?.length > 0) {
              console.log(`      ➖ Denied: ${pp.permissions.denied.join(', ')}`);
            }
          });
        } else {
          console.log(`\n🏗️ PROJECT-SPECIFIC PERMISSIONS: None`);
        }
      } catch (error) {
        console.log(`\n🏗️ PROJECT-SPECIFIC PERMISSIONS: Error - ${error.message}`);
      }

      console.log(`\n${'='.repeat(60)}`);
    }

    console.log(`\n✅ Completed checking permissions for ${users.length} users`);
    console.log(`\n📊 SUMMARY:`);
    console.log(`   👥 Total Users: ${users.length}`);
    console.log(`   ✅ Active Users: ${users.filter(u => u.isActive).length}`);
    console.log(`   ❌ Inactive Users: ${users.filter(u => !u.isActive).length}`);
    console.log(`   👑 Superadmins: ${users.filter(u => u.role === 'superadmin').length}`);
    console.log(`   👔 Managers: ${users.filter(u => u.role === 'manager').length}`);
    console.log(`   👤 Regular Users: ${users.filter(u => u.role === 'user').length}`);

  } catch (error) {
    console.error('❌ Error checking user permissions:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the check
if (require.main === module) {
  checkEachUserPermissions();
}

module.exports = { checkEachUserPermissions };
