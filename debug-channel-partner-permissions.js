const mongoose = require('mongoose');
const User = require('./models/User');
const Role = require('./models/Role');

// Connect to database
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/deltadb', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function debugPermissions() {
  try {
    console.log('🔍 Debugging Channel Partner Permissions...\n');

    // 1. Check all users and their roleRef
    console.log('1. Checking all users and their roleRef:');
    const users = await User.find({}).populate('roleRef').lean();
    
    users.forEach(user => {
      console.log(`   User: ${user.name} (${user.email})`);
      console.log(`   - Role: ${user.role}`);
      console.log(`   - Level: ${user.level}`);
      console.log(`   - roleRef: ${user.roleRef ? user.roleRef._id : 'NULL'}`);
      console.log(`   - roleRef populated: ${user.roleRef ? 'YES' : 'NO'}`);
      if (user.roleRef) {
        console.log(`   - Role permissions: ${user.roleRef.permissions?.length || 0} permissions`);
        console.log(`   - Has channel-partner permissions: ${user.roleRef.permissions?.includes('channel-partner:read_all') ? 'YES' : 'NO'}`);
      }
      console.log(`   - Custom permissions allowed: ${user.customPermissions?.allowed?.length || 0}`);
      console.log(`   - Custom permissions denied: ${user.customPermissions?.denied?.length || 0}`);
      console.log('   ---');
    });

    // 2. Check all roles
    console.log('\n2. Checking all roles:');
    const roles = await Role.find({}).lean();
    roles.forEach(role => {
      console.log(`   Role: ${role.name}`);
      console.log(`   - Permissions: ${role.permissions?.length || 0}`);
      const channelPartnerPerms = role.permissions?.filter(p => p.includes('channel-partner')) || [];
      console.log(`   - Channel Partner permissions: ${channelPartnerPerms.length > 0 ? channelPartnerPerms.join(', ') : 'NONE'}`);
      console.log('   ---');
    });

    // 3. Test permission checking logic
    console.log('\n3. Testing permission checking logic:');
    for (const user of users) {
      if (user.roleRef) {
        const hasChannelPartnerRead = user.roleRef.permissions?.includes('channel-partner:read_all');
        console.log(`   ${user.name}: channel-partner:read_all = ${hasChannelPartnerRead ? 'YES' : 'NO'}`);
        
        // Test the rbacMiddleware logic
        const isSuperadmin = user.role === 'superadmin' || user.level === 1;
        console.log(`   ${user.name}: Superadmin bypass = ${isSuperadmin ? 'YES' : 'NO'}`);
        
        if (!isSuperadmin) {
          console.log(`   ${user.name}: Would be denied access = ${!hasChannelPartnerRead ? 'YES' : 'NO'}`);
        }
      } else {
        console.log(`   ${user.name}: NO ROLE REF - Would be denied access`);
      }
      console.log('   ---');
    }

    // 4. Check for users with missing roleRef
    console.log('\n4. Users with missing roleRef:');
    const usersWithoutRoleRef = users.filter(u => !u.roleRef);
    if (usersWithoutRoleRef.length > 0) {
      console.log('   Found users without roleRef:');
      usersWithoutRoleRef.forEach(user => {
        console.log(`   - ${user.name} (${user.email}) - Role: ${user.role}`);
      });
    } else {
      console.log('   All users have roleRef populated');
    }

    // 5. Check Role collection for channel-partner permissions
    console.log('\n5. Role permissions summary:');
    roles.forEach(role => {
      const channelPartnerPerms = role.permissions?.filter(p => p.includes('channel-partner')) || [];
      if (channelPartnerPerms.length > 0) {
        console.log(`   ${role.name}: ${channelPartnerPerms.join(', ')}`);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    mongoose.disconnect();
  }
}

// Run the debug
debugPermissions();

