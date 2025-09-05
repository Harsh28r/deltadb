const mongoose = require('mongoose');

const userProjectPermissionSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  project: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Project', 
    required: true 
  },
  // Project-specific permissions (overrides role permissions for this project)
  permissions: {
    allowed: [{ type: String, trim: true, lowercase: true }], // Additional permissions
    denied: [{ type: String, trim: true, lowercase: true }]   // Denied permissions
  },
  // Project-specific restrictions
  restrictions: {
    canCreateLeads: { type: Boolean, default: true },
    canEditLeads: { type: Boolean, default: true },
    canDeleteLeads: { type: Boolean, default: false },
    canViewAllLeads: { type: Boolean, default: true },
    canManageUsers: { type: Boolean, default: false },
    canViewReports: { type: Boolean, default: true },
    canExportData: { type: Boolean, default: false }
  },
  // Assignment details
  assignedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  assignedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null }, // null = never expires
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Ensure unique user-project combination
userProjectPermissionSchema.index({ user: 1, project: 1 }, { unique: true });

// Check if user has permission for specific project
userProjectPermissionSchema.methods.hasPermission = function (permission) {
  if (!this.isActive) return false;
  
  // Check if permission is explicitly denied for this project
  if (this.permissions?.denied?.includes(permission.toLowerCase())) {
    return false;
  }
  
  // Check if permission is explicitly allowed for this project
  if (this.permissions?.allowed?.includes(permission.toLowerCase())) {
    return true;
  }
  
  // No project-specific permission, will fall back to role permissions
  return null;
};

// Check if user has specific restriction for this project
userProjectPermissionSchema.methods.hasRestriction = function (restriction) {
  if (!this.isActive) return false;
  return this.restrictions?.[restriction] === false;
};

module.exports = mongoose.model('UserProjectPermission', userProjectPermissionSchema);
