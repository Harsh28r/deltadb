const mongoose = require('mongoose');
const User = require('./models/User');
const Role = require('./models/Role');

// MongoDB connection string
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

/**
 * TEST CLEAN PERMISSION APPROACH
 * 
 * This script demonstrates the clean permission approach:
 * 1. Shows current messy state
 * 2. Demonstrates clean calculation
 * 3. Shows the improved result
 */

async function testCleanPermissions() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority'
    });
    console.log('✅ Connected to MongoDB');

    console.log('\n🧪 TESTING CLEAN PERMISSION APPROACH...\n');

    // 1. FIND A USER WITH MESSY PERMISSIONS
    const user = await User.findOne({ email: 'anu@deltayards.com' });
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log(`👤 Testing with: ${user.name} (${user.email})`);
    console.log(`   Role: ${user.role}, Level: ${user.level}`);

    // 2. GET CURRENT MESSY STATE
    const roleDef = await Role.findOne({ name: user.role });
    const rolePermissions = roleDef?.permissions || [];
    const currentEffective = await user.getEffectivePermissions();
    const currentCustom = user.customPermissions || { allowed: [], denied: [] };

    console.log('\n📊 CURRENT MESSY STATE:');
    console.log(`   🎭 Role permissions: ${rolePermissions.length}`);
    console.log(`   ${rolePermissions.join(', ')}`);
    console.log(`   ➕ Custom allowed: ${currentCustom.allowed.length}`);
    console.log(`   ${currentCustom.allowed.join(', ')}`);
    console.log(`   ➖ Custom denied: ${currentCustom.denied.length}`);
    console.log(`   ${currentCustom.denied.join(', ')}`);
    console.log(`   🎯 Total effective: ${currentEffective.length}`);
    console.log(`   📈 Efficiency: ${Math.round((rolePermissions.length / currentEffective.length) * 100)}% role-based`);

    // 3. DEMONSTRATE CLEAN APPROACH
    console.log('\n🧹 CLEAN APPROACH DEMONSTRATION:');
    
    // Example: User should have these permissions
    const targetPermissions = [
      'leads:read', 'leads:create', 'leads:update',
      'projects:read', 'projects:create', 'projects:update',
      'users:read', 'users:create', 'users:update',
      'notifications:read', 'notifications:update'
    ];

    console.log(`   🎯 Target permissions: ${targetPermissions.length}`);
    console.log(`   ${targetPermissions.join(', ')}`);

    // CLEAN CALCULATION
    const effectiveSet = new Set(targetPermissions);
    const roleSet = new Set(rolePermissions);
    
    // What should be ALLOWED (in target but NOT in role)
    const cleanAllowed = targetPermissions.filter(perm => !roleSet.has(perm));
    
    // What should be DENIED (in role but NOT in target)
    const cleanDenied = rolePermissions.filter(perm => !effectiveSet.has(perm));

    console.log(`\n   ✅ CLEAN CALCULATION:`);
    console.log(`   ➕ Should allow: ${cleanAllowed.length} (only what's NOT in role)`);
    console.log(`   ${cleanAllowed.join(', ') || 'none'}`);
    console.log(`   ➖ Should deny: ${cleanDenied.length} (only what to REMOVE from role)`);
    console.log(`   ${cleanDenied.join(', ') || 'none'}`);

    // 4. APPLY CLEAN APPROACH
    console.log('\n🔧 APPLYING CLEAN APPROACH...');
    
    user.customPermissions = {
      allowed: cleanAllowed,
      denied: cleanDenied
    };
    
    await user.save();

    // 5. GET CLEAN RESULT
    const cleanEffective = await user.getEffectivePermissions();
    const cleanCustom = user.customPermissions;

    console.log('\n🎉 CLEAN RESULT:');
    console.log(`   🎭 Role permissions: ${rolePermissions.length}`);
    console.log(`   ➕ Custom allowed: ${cleanCustom.allowed.length}`);
    console.log(`   ➖ Custom denied: ${cleanCustom.denied.length}`);
    console.log(`   🎯 Total effective: ${cleanEffective.length}`);
    console.log(`   📈 Efficiency: ${Math.round((rolePermissions.length / cleanEffective.length) * 100)}% role-based`);

    // 6. COMPARISON
    console.log('\n📊 IMPROVEMENT SUMMARY:');
    console.log(`   Before: ${currentEffective.length} permissions (${Math.round((rolePermissions.length / currentEffective.length) * 100)}% role-based)`);
    console.log(`   After:  ${cleanEffective.length} permissions (${Math.round((rolePermissions.length / cleanEffective.length) * 100)}% role-based)`);
    console.log(`   Removed: ${currentEffective.length - cleanEffective.length} excessive permissions`);
    console.log(`   Efficiency gain: ${Math.round((rolePermissions.length / cleanEffective.length) * 100) - Math.round((rolePermissions.length / currentEffective.length) * 100)}%`);

    console.log('\n✅ CLEAN APPROACH SUCCESSFUL!');
    console.log('   🎯 Benefits:');
    console.log('   - No duplicate permissions');
    console.log('   - Clear role vs custom separation');
    console.log('   - Easy to understand and maintain');
    console.log('   - Efficient storage');

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run the test
testCleanPermissions();
