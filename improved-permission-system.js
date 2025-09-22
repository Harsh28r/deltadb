const mongoose = require('mongoose');
const User = require('./models/User');
const Role = require('./models/Role');

// MongoDB connection string
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

/**
 * IMPROVED PERMISSION SYSTEM DESIGN
 * 
 * 1. ROLES: Define base permissions for each role level
 * 2. CUSTOM PERMISSIONS: Only store what's different from role
 * 3. EFFECTIVE PERMISSIONS: Role + Custom (allowed) - Custom (denied)
 * 
 * Example:
 * - HR Role: ["users:read", "users:create", "leads:read"]
 * - User Custom Allowed: ["leads:update"] (adds to role)
 * - User Custom Denied: ["users:delete"] (removes from role)
 * - Final Effective: ["users:read", "users:create", "leads:read", "leads:update"] (no users:delete)
 */

async function createProperRoleStructure() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority'
    });
    console.log('Connected to MongoDB');

    // 1. CREATE PROPER ROLES WITH MEANINGFUL PERMISSIONS
    const roles = [
      {
        name: 'superadmin',
        level: 1,
        permissions: [
          // Full system access
          'system:manage', 'users:manage', 'roles:manage', 'projects:manage',
          'leads:manage', 'leadssource:manage', 'leadsstatus:manage',
          'channel-partner:manage', 'cp-sourcing:manage',
          'notifications:manage', 'reporting:manage'
        ]
      },
      {
        name: 'admin',
        level: 2,
        permissions: [
          // High-level management
          'users:read', 'users:create', 'users:update',
          'leads:manage', 'leadssource:manage', 'leadsstatus:manage',
          'projects:read', 'projects:create', 'projects:update',
          'notifications:manage', 'reporting:read'
        ]
      },
      {
        name: 'manager',
        level: 3,
        permissions: [
          // Team management
          'leads:read', 'leads:create', 'leads:update',
          'leadssource:read', 'leadssource:create',
          'leadsstatus:read', 'leadsstatus:create',
          'projects:read', 'projects:create',
          'notifications:read', 'notifications:update',
          'reporting:read'
        ]
      },
      {
        name: 'hr',
        level: 4,
        permissions: [
          // HR specific
          'users:read', 'users:create', 'users:update',
          'leads:read', 'leads:update',
          'projects:read', 'notifications:read'
        ]
      },
      {
        name: 'sales',
        level: 5,
        permissions: [
          // Sales specific
          'leads:read', 'leads:create', 'leads:update',
          'leadssource:read', 'leadsstatus:read',
          'notifications:read'
        ]
      },
      {
        name: 'user',
        level: 6,
        permissions: [
          // Basic user
          'leads:read', 'notifications:read'
        ]
      }
    ];

    console.log('🏗️ Creating/Updating roles...');
    for (const roleData of roles) {
      const existingRole = await Role.findOne({ name: roleData.name });
      if (existingRole) {
        existingRole.permissions = roleData.permissions;
        existingRole.level = roleData.level;
        await existingRole.save();
        console.log(`✅ Updated ${roleData.name} role with ${roleData.permissions.length} permissions`);
      } else {
        await Role.create(roleData);
        console.log(`✅ Created ${roleData.name} role with ${roleData.permissions.length} permissions`);
      }
    }

    // 2. DEMONSTRATE PROPER CUSTOM PERMISSION USAGE
    console.log('\n📋 Example: How custom permissions should work:');
    
    // Example: HR user with some additional permissions
    const hrUser = await User.findOne({ email: 'anshu1@deltayards.com' });
    if (hrUser) {
      // Get HR role permissions
      const hrRole = await Role.findOne({ name: 'hr' });
      console.log(`\n👤 HR Role permissions: ${hrRole.permissions.join(', ')}`);
      
      // Set proper custom permissions (only what's different from role)
      hrUser.customPermissions = {
        allowed: [
          'leads:delete', // Add delete permission that HR role doesn't have
          'projects:create' // Add project creation that HR role doesn't have
        ],
        denied: [
          'users:create' // Remove user creation from HR role
        ]
      };
      
      await hrUser.save();
      
      // Calculate effective permissions
      const effectivePermissions = await hrUser.getEffectivePermissions();
      console.log(`\n📊 Effective permissions for HR user: ${effectivePermissions.length} permissions`);
      console.log(`   ${effectivePermissions.join(', ')}`);
      
      // Show what was added/removed
      const roleSet = new Set(hrRole.permissions);
      const effectiveSet = new Set(effectivePermissions);
      
      const added = [...effectiveSet].filter(p => !roleSet.has(p));
      const removed = [...roleSet].filter(p => !effectiveSet.has(p));
      
      console.log(`\n➕ Added via custom allowed: ${added.join(', ') || 'none'}`);
      console.log(`➖ Removed via custom denied: ${removed.join(', ') || 'none'}`);
    }

    console.log('\n🎯 BETTER APPROACH SUMMARY:');
    console.log('1. ✅ Roles define base permissions for each level');
    console.log('2. ✅ Custom permissions only store differences (additions/removals)');
    console.log('3. ✅ No duplication - effective = role + allowed - denied');
    console.log('4. ✅ Clear hierarchy: superadmin > admin > manager > hr > sales > user');
    console.log('5. ✅ Easy to understand and maintain');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the improvement
createProperRoleStructure();
