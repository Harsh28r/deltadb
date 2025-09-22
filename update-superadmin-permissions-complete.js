const mongoose = require('mongoose');
const Role = require('./models/Role');

// MongoDB connection string
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function updateSuperadminPermissions() {
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

    // Find superadmin role
    const superadminRole = await Role.findOne({ name: 'superadmin' });
    if (!superadminRole) {
      console.log('Superadmin role not found. Creating it...');
      return;
    }

    console.log('Found superadmin role. Current permissions:', superadminRole.permissions.length);

    // Complete list of all permissions used in the system
    const completePermissions = [
      // Role and user management
      "role:manage",
      "users:manage",
      
      // Project management
      "projects:manage",
      
      // Lead management
      "leads:create",
      "leads:read",
      "leads:update",
      "leads:delete",
      "leads:bulk",
      "leads:transfer",
      "leads:bulk-delete",
      
      // Lead source management
      "leadssource:create",
      "leadssource:read_all",
      "leadssource:read",
      "leadssource:update",
      "leadssource:delete",
      
      // Lead status management
      "leadsstatus:create",
      "leadsstatus:read_all",
      "leadsstatus:read",
      "leadsstatus:update",
      "leadsstatus:delete",
      
      // Lead activities
      "lead-activities:read",
      "lead-activities:bulk-update",
      "lead-activities:bulk-delete",
      
      // Channel partner management
      "channel-partner:create",
      "channel-partner:read_all",
      "channel-partner:read",
      "channel-partner:update",
      "channel-partner:delete",
      "channel-partner:bulk-create",
      "channel-partner:bulk-update",
      "channel-partner:bulk-delete",
      
      // CP sourcing management
      "cp-sourcing:create",
      "cp-sourcing:read",
      "cp-sourcing:update",
      "cp-sourcing:delete",
      "cp-sourcing:bulk-create",
      "cp-sourcing:bulk-update",
      "cp-sourcing:bulk-delete",
      
      // User project management
      "user-projects:assign",
      "user-projects:read",
      "user-projects:remove",
      "user-projects:bulk-update",
      "user-projects:bulk-delete",
      
      // User reporting
      "user-reporting:create",
      "user-reporting:read",
      "user-reporting:update",
      "user-reporting:delete",
      "user-reporting:bulk-update",
      "user-reporting:bulk-delete",
      
      // Notifications
      "notifications:read",
      "notifications:update",
      "notifications:bulk-update",
      "notifications:bulk-delete",
      
      // General reporting
      "reporting:read"
    ];

    // Update superadmin role with complete permissions
    superadminRole.permissions = completePermissions;
    await superadminRole.save();

    console.log('✅ Superadmin permissions updated successfully!');
    console.log(`📊 Total permissions: ${completePermissions.length}`);
    console.log('📋 Permission categories:');
    console.log(`  • Role/User Management: ${completePermissions.filter(p => p.includes('role') || p.includes('users')).length}`);
    console.log(`  • Lead Management: ${completePermissions.filter(p => p.includes('leads') && !p.includes('source') && !p.includes('status')).length}`);
    console.log(`  • Lead Sources: ${completePermissions.filter(p => p.includes('leadssource')).length}`);
    console.log(`  • Lead Statuses: ${completePermissions.filter(p => p.includes('leadsstatus')).length}`);
    console.log(`  • Lead Activities: ${completePermissions.filter(p => p.includes('lead-activities')).length}`);
    console.log(`  • Channel Partners: ${completePermissions.filter(p => p.includes('channel-partner')).length}`);
    console.log(`  • CP Sourcing: ${completePermissions.filter(p => p.includes('cp-sourcing')).length}`);
    console.log(`  • User Projects: ${completePermissions.filter(p => p.includes('user-projects')).length}`);
    console.log(`  • User Reporting: ${completePermissions.filter(p => p.includes('user-reporting')).length}`);
    console.log(`  • Notifications: ${completePermissions.filter(p => p.includes('notifications')).length}`);
    console.log(`  • General Reporting: ${completePermissions.filter(p => p.includes('reporting') && !p.includes('user-')).length}`);

  } catch (error) {
    console.error('❌ Error updating superadmin permissions:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the update
updateSuperadminPermissions();
