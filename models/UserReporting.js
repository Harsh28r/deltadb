const mongoose = require('mongoose');

const reportingRelationshipSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teamType: { type: String, enum: ['project', 'global', 'superadmin', 'custom'], required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' }, // Optional, required for 'project' teamType
  context: { type: String, default: '' }, // Descriptive context, e.g., 'Team Lead for Project X'
  path: { type: String, required: true } // Materialized path for this relationship, e.g., '/superadminId/userId/'
});

const userReportingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reportsTo: [reportingRelationshipSchema],
  level: { type: Number, required: true } // Derived from role level
}, { timestamps: true });

// Indexes for efficient queries
userReportingSchema.index({ user: 1 }, { unique: true });
userReportingSchema.index({ 'reportsTo.user': 1 });
userReportingSchema.index({ 'reportsTo.path': 1 });

// Validate project for project teamType
userReportingSchema.pre('save', async function(next) {
  const User = mongoose.model('User');
  const user = await User.findById(this.user);
  if (!user) throw new Error('User not found');
  this.level = user.level;

  for (const relation of this.reportsTo) {
    if (relation.teamType === 'project' && !relation.project) {
      throw new Error('Project ID required for project teamType');
    }
    if (relation.user.equals(this.user)) {
      throw new Error('User cannot report to themselves');
    }
    const parent = await User.findById(relation.user);
    if (!parent) throw new Error(`Parent user ${relation.user} not found`);
    if (parent.level >= this.level) throw new Error(`Parent level must be lower than ${this.level}`);

    // Set path
    const parentReporting = await mongoose.model('UserReporting').findOne({ user: relation.user });
    relation.path = parentReporting
      ? `${parentReporting.reportsTo.find(r => r.user.equals(relation.user))?.path || `/${relation.user}/`}/${relation.user}/`
      : `/${relation.user}/`;

    // Cycle detection
    let currentPath = relation.path;
    while (currentPath) {
      if (currentPath.includes(`/${this.user}/`)) throw new Error('Cycle detected in hierarchy');
      const parentId = currentPath.split('/').slice(-2, -1)[0];
      if (!parentId) break;
      const grandParent = await mongoose.model('UserReporting').findOne({ user: parentId });
      currentPath = grandParent?.reportsTo.find(r => r.user.equals(parentId))?.path || '';
    }
  }
  next();
});

// Auto-assign superadmin reporting
userReportingSchema.post('save', async function(doc) {
  const Role = mongoose.model('Role');
  const User = mongoose.model('User');
  const superadminRole = await Role.findOne({ name: 'superadmin' });
  if (superadminRole && this.level > superadminRole.level) {
    const superadmin = await User.findOne({ role: superadminRole._id });
    if (superadmin && !this.reportsTo.some(r => r.user.equals(superadmin._id))) {
      this.reportsTo.push({
        user: superadmin._id,
        teamType: 'superadmin',
        path: `/${superadmin._id}/`
      });
      await this.save();
    }
  }
});

module.exports = mongoose.model('UserReporting', userReportingSchema);