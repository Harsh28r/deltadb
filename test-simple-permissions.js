/**
 * Simple test to debug permission issues
 * Run with: node test-simple-permissions.js
 */

const mongoose = require('mongoose');
const User = require('./models/User');
const Role = require('./models/Role');

const MONGO_URI = 'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testSimplePermissions() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Test 1: Count users
    const userCount = await User.countDocuments();
    console.log(`📊 Total users: ${userCount}`);

    // Test 2: Count roles
    const roleCount = await Role.countDocuments();
    console.log(`📊 Total roles: ${roleCount}`);

    // Test 3: Get first user
    const user = await User.findOne({}).select('-password');
    if (!user) {
      console.log('❌ No users found');
      return;
    }

    console.log(`👤 Testing user: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Level: ${user.level}`);
    console.log(`   Active: ${user.isActive}`);

    // Test 4: Try getEffectivePermissions
    try {
      console.log('🧪 Testing getEffectivePermissions...');
      const permissions = await user.getEffectivePermissions();
      console.log(`✅ getEffectivePermissions worked: ${permissions.length} permissions`);
      console.log('   Permissions:', permissions);
    } catch (error) {
      console.error('❌ getEffectivePermissions failed:', error.message);
    }

    // Test 5: Try hasPermission
    try {
      console.log('🧪 Testing hasPermission...');
      const hasRead = await user.hasPermission('leads:read');
      console.log(`✅ hasPermission worked: ${hasRead}`);
    } catch (error) {
      console.error('❌ hasPermission failed:', error.message);
    }

    // Test 6: Check role
    try {
      console.log('🧪 Testing role lookup...');
      const role = await Role.findOne({ name: user.role });
      console.log(`✅ Role lookup worked: ${role ? 'Found' : 'Not found'}`);
      if (role) {
        console.log(`   Role permissions: ${role.permissions?.length || 0}`);
      }
    } catch (error) {
      console.error('❌ Role lookup failed:', error.message);
    }

    console.log('\n✅ Simple test completed');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  testSimplePermissions();
}

module.exports = { testSimplePermissions };
