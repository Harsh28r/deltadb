const mongoose = require('mongoose');
const User = require('./models/User');
const Role = require('./models/Role');

// MongoDB connection string
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function debugPermissions() {
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

    // Get superadmin role
    const superadminRole = await Role.findOne({ name: 'superadmin' });
    if (!superadminRole) {
      console.log('❌ Superadmin role not found!');
      return;
    }

    console.log(`📊 Role permissions count: ${superadminRole.permissions.length}`);
    console.log('📋 Role permissions:');
    superadminRole.permissions.forEach((perm, index) => {
      console.log(`  ${index + 1}. ${perm}`);
    });

    // Get superadmin user
    const superadminUser = await User.findOne({ role: 'superadmin' });
    if (!superadminUser) {
      console.log('❌ Superadmin user not found!');
      return;
    }

    console.log('\n📊 User custom permissions:');
    console.log('  Allowed:', superadminUser.customPermissions?.allowed || []);
    console.log('  Denied:', superadminUser.customPermissions?.denied || []);

    // Test getEffectivePermissions
    const effectivePermissions = await superadminUser.getEffectivePermissions();
    console.log(`\n📊 Effective permissions count: ${effectivePermissions.length}`);
    
    // Find differences
    const missingFromEffective = superadminRole.permissions.filter(perm => !effectivePermissions.includes(perm));
    const extraInEffective = effectivePermissions.filter(perm => !superadminRole.permissions.includes(perm));
    
    if (missingFromEffective.length > 0) {
      console.log('\n❌ Missing from effective permissions:');
      missingFromEffective.forEach(perm => console.log(`  - ${perm}`));
    }
    
    if (extraInEffective.length > 0) {
      console.log('\n➕ Extra in effective permissions:');
      extraInEffective.forEach(perm => console.log(`  + ${perm}`));
    }

    // Test specific missing permissions
    console.log('\n🧪 Testing specific permissions:');
    const testPermissions = ['leads:delete', 'users:manage'];
    for (const permission of testPermissions) {
      const hasPermission = await superadminUser.hasPermission(permission);
      const inRole = superadminRole.permissions.includes(permission);
      const inEffective = effectivePermissions.includes(permission);
      
      console.log(`  ${permission}:`);
      console.log(`    In role: ${inRole}`);
      console.log(`    In effective: ${inEffective}`);
      console.log(`    hasPermission(): ${hasPermission}`);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the debug
debugPermissions();

