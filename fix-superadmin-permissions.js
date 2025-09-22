const mongoose = require('mongoose');
const User = require('./models/User');

// MongoDB connection string
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function fixSuperadminPermissions() {
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

    // Find superadmin user
    const superadminUser = await User.findOne({ role: 'superadmin' });
    if (!superadminUser) {
      console.log('❌ Superadmin user not found!');
      return;
    }

    console.log('🔍 Before fix:');
    console.log('  Custom allowed:', superadminUser.customPermissions?.allowed || []);
    console.log('  Custom denied:', superadminUser.customPermissions?.denied || []);

    // Clear custom permissions for superadmin - they should have ALL role permissions
    superadminUser.customPermissions = {
      allowed: [],
      denied: []
    };

    await superadminUser.save();

    console.log('✅ After fix:');
    console.log('  Custom allowed:', superadminUser.customPermissions.allowed);
    console.log('  Custom denied:', superadminUser.customPermissions.denied);

    // Test the permissions now
    const effectivePermissions = await superadminUser.getEffectivePermissions();
    console.log(`\n📊 Effective permissions count: ${effectivePermissions.length}`);

    // Test specific permissions
    const testPermissions = ['leads:delete', 'users:manage', 'leads:create', 'role:manage'];
    console.log('\n🧪 Testing permissions:');
    for (const permission of testPermissions) {
      const hasPermission = await superadminUser.hasPermission(permission);
      console.log(`  ${hasPermission ? '✅' : '❌'} ${permission}: ${hasPermission}`);
    }

    console.log('\n🎉 Superadmin permissions fixed!');

  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the fix
fixSuperadminPermissions();
