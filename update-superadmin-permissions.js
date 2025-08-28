#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const Role = require('./models/Role');

const newSuperadminPermissions = [
  "role:manage",
  "projects:manage",
  "notifications:read",
  "notifications:update",
  "leads:create",
  "leads:read",
  "leads:update",
  "leads:bulk",
  "leads:transfer",
  "leadsSource:create",
  "leadssource:read_all",
  "leadssource:read",
  "leadssource:update",
  "leadssource:delete",
  "leadsStatus:create",
  "leadsstatus:read_all",
  "leadsstatus:read",
  "leadsstatus:update",
  "leadsstatus:delete",
  "user-projects:assign",
  "user-projects:read",
  "user-projects:remove",
  "user-projects:bulk-update",
  "user-projects:bulk-delete",
  "reporting:read",
  "notifications:bulk-update",
  "notifications:bulk-delete"
];

async function updateSuperadminPermissions() {
  try {
    console.log('🔧 Updating Superadmin Permissions');
    console.log('==================================\n');

    // Connect to MongoDB
    const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
    
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find superadmin role
    const superadminRole = await Role.findOne({ name: 'superadmin' });
    
    if (!superadminRole) {
      console.log('❌ Superadmin role not found. Creating new one...');
      
      const newRole = new Role({
        name: 'superadmin',
        level: 1,
        permissions: newSuperadminPermissions,
        description: 'Superadmin role with comprehensive permissions'
      });
      
      await newRole.save();
      console.log('✅ Superadmin role created with new permissions\n');
    } else {
      console.log('📋 Found existing superadmin role');
      console.log('📊 Current permissions count:', superadminRole.permissions.length);
      console.log('📝 Current permissions:', superadminRole.permissions);
      
      // Update permissions
      superadminRole.permissions = newSuperadminPermissions;
      await superadminRole.save();
      
      console.log('\n✅ Superadmin permissions updated successfully!');
      console.log('📊 New permissions count:', newSuperadminPermissions.length);
    }

    // Display permission summary
    console.log('\n📋 Permission Summary:');
    console.log('======================');
    
    const categories = {
      'Role Management': newSuperadminPermissions.filter(p => p.startsWith('role:')),
      'Project Management': newSuperadminPermissions.filter(p => p.startsWith('projects:')),
      'Notifications': newSuperadminPermissions.filter(p => p.startsWith('notifications:')),
      'Leads': newSuperadminPermissions.filter(p => p.startsWith('leads')),
      'Lead Sources': newSuperadminPermissions.filter(p => p.startsWith('leadssource:')),
      'Lead Statuses': newSuperadminPermissions.filter(p => p.startsWith('leadsstatus:')),
      'User Projects': newSuperadminPermissions.filter(p => p.startsWith('user-projects:')),
      'Reporting': newSuperadminPermissions.filter(p => p.startsWith('reporting:'))
    };

    Object.entries(categories).forEach(([category, permissions]) => {
      console.log(`${category}: ${permissions.length} permissions`);
    });

    console.log(`\n🎯 Total Permissions: ${newSuperadminPermissions.length}`);
    console.log('✅ Update completed successfully!');

  } catch (error) {
    console.error('❌ Error updating superadmin permissions:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the update
updateSuperadminPermissions();
