const mongoose = require('mongoose');
const User = require('./models/User');
const Role = require('./models/Role');

// MongoDB connection string
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testPermissions() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority'
    });
    console.log('Connected to MongoDB');

    // Test 1: Check if superadmin role exists and has correct permissions
    console.log('\n🧪 Test 1: Superadmin Role Permissions');
    const superadminRole = await Role.findOne({ name: 'superadmin' });
    if (!superadminRole) {
      console.log('❌ Superadmin role not found!');
      return;
    }

    console.log(`✅ Superadmin role found with ${superadminRole.permissions.length} permissions`);
    console.log(`📊 Role level: ${superadminRole.level}`);

    // Test 2: Check if superadmin user exists
    console.log('\n🧪 Test 2: Superadmin User');
    const superadminUser = await User.findOne({ role: 'superadmin' });
    if (!superadminUser) {
      console.log('❌ Superadmin user not found!');
      return;
    }

    console.log(`✅ Superadmin user found: ${superadminUser.email}`);
    console.log(`📊 User level: ${superadminUser.level}`);
    console.log(`📊 User active: ${superadminUser.isActive}`);

    // Test 3: Test getEffectivePermissions method
    console.log('\n🧪 Test 3: Effective Permissions');
    try {
      const effectivePermissions = await superadminUser.getEffectivePermissions();
      console.log(`✅ getEffectivePermissions() works: ${effectivePermissions.length} permissions`);
      
      // Check if all route permissions are covered
      const routePermissions = [
        'leads:create', 'leads:read', 'leads:update', 'leads:delete', 'leads:bulk', 'leads:transfer', 'leads:bulk-delete',
        'leadssource:create', 'leadssource:read_all', 'leadssource:read', 'leadssource:update', 'leadssource:delete',
        'leadsstatus:create', 'leadsstatus:read_all', 'leadsstatus:read', 'leadsstatus:update', 'leadsstatus:delete',
        'lead-activities:read', 'lead-activities:bulk-update', 'lead-activities:bulk-delete',
        'channel-partner:create', 'channel-partner:read_all', 'channel-partner:read', 'channel-partner:update', 'channel-partner:delete',
        'channel-partner:bulk-create', 'channel-partner:bulk-update', 'channel-partner:bulk-delete',
        'cp-sourcing:create', 'cp-sourcing:read', 'cp-sourcing:update', 'cp-sourcing:delete',
        'cp-sourcing:bulk-create', 'cp-sourcing:bulk-update', 'cp-sourcing:bulk-delete',
        'user-projects:assign', 'user-projects:read', 'user-projects:remove', 'user-projects:bulk-update', 'user-projects:bulk-delete',
        'user-reporting:create', 'user-reporting:read', 'user-reporting:update', 'user-reporting:delete',
        'user-reporting:bulk-update', 'user-reporting:bulk-delete',
        'notifications:read', 'notifications:update', 'notifications:bulk-update', 'notifications:bulk-delete',
        'reporting:read', 'role:manage', 'users:manage', 'projects:manage'
      ];

      const missingPermissions = routePermissions.filter(perm => !effectivePermissions.includes(perm));
      if (missingPermissions.length === 0) {
        console.log('✅ All route permissions are covered!');
      } else {
        console.log(`❌ Missing permissions: ${missingPermissions.join(', ')}`);
      }

    } catch (error) {
      console.log('❌ getEffectivePermissions() failed:', error.message);
    }

    // Test 4: Test hasPermission method
    console.log('\n🧪 Test 4: hasPermission Method');
    const testPermissions = ['leads:create', 'leads:read', 'role:manage', 'nonexistent:permission'];
    
    for (const permission of testPermissions) {
      try {
        const hasPermission = await superadminUser.hasPermission(permission);
        console.log(`  ${hasPermission ? '✅' : '❌'} ${permission}: ${hasPermission}`);
      } catch (error) {
        console.log(`  ❌ ${permission}: Error - ${error.message}`);
      }
    }

    // Test 5: Check permission categories
    console.log('\n🧪 Test 5: Permission Categories');
    const effectivePermissions = await superadminUser.getEffectivePermissions();
    
    const categories = {
      'Lead Management': effectivePermissions.filter(p => p.includes('leads') && !p.includes('source') && !p.includes('status')),
      'Lead Sources': effectivePermissions.filter(p => p.includes('leadssource')),
      'Lead Statuses': effectivePermissions.filter(p => p.includes('leadsstatus')),
      'Lead Activities': effectivePermissions.filter(p => p.includes('lead-activities')),
      'Channel Partners': effectivePermissions.filter(p => p.includes('channel-partner')),
      'CP Sourcing': effectivePermissions.filter(p => p.includes('cp-sourcing')),
      'User Projects': effectivePermissions.filter(p => p.includes('user-projects')),
      'User Reporting': effectivePermissions.filter(p => p.includes('user-reporting')),
      'Notifications': effectivePermissions.filter(p => p.includes('notifications')),
      'Role/User Management': effectivePermissions.filter(p => p.includes('role') || p.includes('users')),
      'General': effectivePermissions.filter(p => p.includes('projects') || p.includes('reporting'))
    };

    for (const [category, permissions] of Object.entries(categories)) {
      console.log(`  📂 ${category}: ${permissions.length} permissions`);
    }

    console.log('\n🎉 Permission system test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the test
testPermissions();
