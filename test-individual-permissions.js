/**
 * Test script to check individual permissions
 * Run with: node test-individual-permissions.js
 */

const mongoose = require('mongoose');
const User = require('./models/User');
const Role = require('./models/Role');

// Connect to MongoDB
const MONGO_URI = 'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testIndividualPermissions() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find a user to test with
    const user = await User.findOne({ email: 'mji@deltayards.com' });
    if (!user) {
      console.log('❌ No user found. Please create a user first.');
      return;
    }

    console.log(`\n👤 Testing permissions for user: ${user.name} (${user.email})`);
    console.log(`Role: ${user.role}, Level: ${user.level}`);

    // List of permissions to test
    const permissionsToTest = [
      'leads:read',
      'leads:create', 
      'leads:update',
      'leads:delete',
      'users:manage',
      'projects:manage',
      'notifications:read',
      'notifications:update',
      'role:manage'
    ];

    console.log('\n🔍 Testing individual permissions:');
    console.log('=' .repeat(50));

    for (const permission of permissionsToTest) {
      try {
        const hasPermission = await user.hasPermission(permission);
        const status = hasPermission ? '✅ ALLOWED' : '❌ DENIED';
        console.log(`${permission.padEnd(20)} : ${status}`);
      } catch (error) {
        console.log(`${permission.padEnd(20)} : ❌ ERROR - ${error.message}`);
      }
    }

    // Test project access
    console.log('\n🏗️ Testing project access:');
    console.log('=' .repeat(50));
    
    // Test with a sample project ID
    const testProjectId = '68b545969005acb586201485';
    const canAccess = user.canAccessProject(testProjectId);
    console.log(`Project ${testProjectId}: ${canAccess ? '✅ ACCESS' : '❌ NO ACCESS'}`);

    // Get all effective permissions
    console.log('\n📋 All effective permissions:');
    console.log('=' .repeat(50));
    const effectivePermissions = await user.getEffectivePermissions();
    effectivePermissions.forEach(perm => {
      console.log(`✅ ${perm}`);
    });

    // Show custom permissions
    console.log('\n🎯 Custom permissions:');
    console.log('=' .repeat(50));
    console.log('Allowed:', user.customPermissions?.allowed || []);
    console.log('Denied:', user.customPermissions?.denied || []);

    // Show restrictions
    console.log('\n🚫 User restrictions:');
    console.log('=' .repeat(50));
    console.log('Max Projects:', user.restrictions?.maxProjects || 'No limit');
    console.log('Allowed Projects:', user.restrictions?.allowedProjects || []);
    console.log('Denied Projects:', user.restrictions?.deniedProjects || []);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
if (require.main === module) {
  testIndividualPermissions();
}

module.exports = { testIndividualPermissions };



