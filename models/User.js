const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function (v) {
        // Enforce @deltayards.com for superadmins
        if (this.role === 'superadmin' && !v.endsWith('@deltayards.com')) {
          return false;
        }
        return /\S+@\S+\.\S+/.test(v); // Basic email format check
      },
      message: props =>
        props.value.endsWith('@deltayards.com')
          ? 'Invalid email format'
          : 'Superadmin email must end with @deltayards.com',
    },
  },
  mobile: { type: String, required: false, unique: true, trim: true },
  // companyName: { type: String, required: false },
  password: { type: String, required: false }, // Temporarily not required
  role: { type: String, required: true },
  roleRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  level: { type: Number, required: true },
  // User-specific permission overrides (overrides role permissions)
  customPermissions: {
    allowed: [{ type: String, trim: true, lowercase: true }], // Additional permissions
    denied: [{ type: String, trim: true, lowercase: true }]   // Denied permissions (overrides role)
  },
  // User status and restrictions
  isActive: { type: Boolean, default: true },
  restrictions: {
    maxProjects: { type: Number, default: null }, // null = no limit
    allowedProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }], // Specific projects only
    deniedProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }]   // Blocked projects
  },
  createdAt: { type: Date, default: Date.now },
});

// Password hashing removed for testing

userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password || !enteredPassword) return false;
  return this.password === enteredPassword; // Direct string comparison for testing
};

// Check if user has a specific permission (considers role + custom permissions)
userSchema.methods.hasPermission = async function (permission) {
  const Role = require('./Role');
  
  // Get role permissions first
  const roleDef = await Role.findOne({ name: this.role });
  const rolePermissions = roleDef?.permissions || [];
  
  // Superadmin has all role permissions (unless explicitly denied)
  if (this.role === 'superadmin' || this.level === 1) {
    // Check if permission is explicitly denied
    if (this.customPermissions?.denied?.includes(permission.toLowerCase())) {
      return false;
    }
    // Check if permission is in role permissions
    return rolePermissions.includes(permission.toLowerCase());
  }
  
  // Check if permission is explicitly denied
  if (this.customPermissions?.denied?.includes(permission.toLowerCase())) {
    return false;
  }
  
  // Check if permission is explicitly allowed
  if (this.customPermissions?.allowed?.includes(permission.toLowerCase())) {
    return true;
  }
  
  // Check role permissions
  if (roleDef?.permissions?.includes(permission.toLowerCase())) {
    return true;
  }
  
  return false;
};

// Check if user can access a specific project
userSchema.methods.canAccessProject = function (projectId) {
  // Superadmin can access all projects
  if (this.role === 'superadmin' || this.level === 1) {
    return true;
  }
  
  // Check if project is explicitly denied
  if (this.restrictions?.deniedProjects?.some(id => String(id) === String(projectId))) {
    return false;
  }
  
  // Check if user has project restrictions
  if (this.restrictions?.allowedProjects?.length > 0) {
    return this.restrictions.allowedProjects.some(id => String(id) === String(projectId));
  }
  
  // No restrictions, allow access
  return true;
};

// Get all effective permissions for this user
userSchema.methods.getEffectivePermissions = async function () {
  try {
    const Role = require('./Role');
    
    // Get role permissions first
    const roleDef = await Role.findOne({ name: this.role });
    const rolePermissions = roleDef?.permissions || [];
    
    // Superadmin gets all role permissions plus any custom ones
    if (this.role === 'superadmin' || this.level === 1) {
      // Start with role permissions
      let effectivePermissions = [...rolePermissions];
      
      // Add custom allowed permissions
      if (this.customPermissions?.allowed && Array.isArray(this.customPermissions.allowed)) {
        effectivePermissions = [...effectivePermissions, ...this.customPermissions.allowed];
      }
      
      // Remove denied permissions
      if (this.customPermissions?.denied && Array.isArray(this.customPermissions.denied)) {
        effectivePermissions = effectivePermissions.filter(
          perm => !this.customPermissions.denied.includes(perm)
        );
      }
      
      // Remove duplicates and filter out any undefined/null values
      return [...new Set(effectivePermissions.filter(perm => perm && typeof perm === 'string'))];
    }
    
    // Start with role permissions
    let effectivePermissions = [...rolePermissions];
    
    // Add custom allowed permissions
    if (this.customPermissions?.allowed && Array.isArray(this.customPermissions.allowed)) {
      effectivePermissions = [...effectivePermissions, ...this.customPermissions.allowed];
    }
    
    // Remove denied permissions
    if (this.customPermissions?.denied && Array.isArray(this.customPermissions.denied)) {
      effectivePermissions = effectivePermissions.filter(
        perm => !this.customPermissions.denied.includes(perm)
      );
    }
    
    // Remove duplicates and filter out any undefined/null values
    return [...new Set(effectivePermissions.filter(perm => perm && typeof perm === 'string'))];
  } catch (error) {
    console.error('Error getting effective permissions for user:', this.email, error);
    return []; // Return empty array on error
  }
};

// Post-update hook to revalidate UserReporting on level change
userSchema.post('findOneAndUpdate', async function(doc, next) {
  if (doc && doc.level && this.getUpdate().level !== undefined && doc.level !== this.getUpdate().level) {
    console.log(`User level changed from ${doc.level} to ${this.getUpdate().level} for user ${doc._id}`);
    await revalidateUserReporting(doc._id, this.getUpdate().level);
  }
  next();
});

// Function to revalidate and fix UserReporting
const revalidateUserReporting = async (userId, newLevel) => {
  try {
    const userReporting = await UserReporting.findOne({ user: userId });
    if (!userReporting) {
      console.log(`No UserReporting found for user ${userId}, creating default`);
      const superadmin = await mongoose.model('User').findOne({ role: 'superadmin', level: 1 });
      if (superadmin) {
        const reporting = new UserReporting({
          user: userId,
          reportsTo: [
            {
              user: superadmin._id,
              teamType: 'superadmin',
              path: `/${superadmin._id}/`,
              context: 'Superadmin oversight'
            }
          ],
          level: newLevel
        });
        await reporting.save();
      }
      return;
    }

    userReporting.level = newLevel;
    const invalidRelations = [];

    for (const relation of userReporting.reportsTo) {
      const parent = await mongoose.model('User').findById(relation.user);
      if (!parent || parent.level >= newLevel) {
        invalidRelations.push(relation.user);
        console.log(`Invalid parent ${relation.user} for user ${userId}: level ${parent.level} >= ${newLevel}`);
      }
    }

    // Remove invalid relations or log for manual review
    if (invalidRelations.length > 0) {
      userReporting.reportsTo = userReporting.reportsTo.filter(r => !invalidRelations.includes(r.user));
      console.log(`Removed ${invalidRelations.length} invalid relations for user ${userId}`);
      await userReporting.save();
    }

    // Ensure superadmin oversight
    const superadmin = await mongoose.model('User').findOne({ role: 'superadmin', level: 1 });
    if (superadmin && newLevel > 1 && !userReporting.reportsTo.some(r => r.user.equals(superadmin._id))) {
      const superadminPath = `/${superadmin._id}/`;
      userReporting.reportsTo.push({
        user: superadmin._id,
        teamType: 'superadmin',
        path: superadminPath,
        context: 'Superadmin oversight'
      });
      console.log(`Added superadmin oversight for user ${userId}`);
    }

    await userReporting.save();
    console.log(`UserReporting revalidated for user ${userId}, level: ${newLevel}`);
  } catch (err) {
    console.error(`Error revalidating UserReporting for user ${userId}:`, err.message);
  }
};

module.exports = mongoose.model('User', userSchema);