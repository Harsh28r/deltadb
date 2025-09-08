const mongoose = require('mongoose');

const reportingRelationshipSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teamType: { type: String, enum: ['project', 'global', 'superadmin', 'custom'], required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  context: { type: String, default: '' },
  path: { type: String, required: true }
});

const userReportingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reportsTo: [reportingRelationshipSchema],
  level: { type: Number, required: true }
}, { timestamps: true });

userReportingSchema.index({ user: 1 }, { unique: true });
userReportingSchema.index({ 'reportsTo.user': 1 });
userReportingSchema.index({ 'reportsTo.path': 1 });

userReportingSchema.pre('save', async function(next) {
  try {
    const User = mongoose.model('User');
    const user = await User.findById(this.user);
    if (!user) throw new Error('User not found');
    this.level = user.level;

    // Skip validation if reportsTo is empty
    if (this.reportsTo.length === 0) {
      console.log(`No reportsTo for user ${this.user}, skipping validation`);
      return next();
    }

    for (const relation of this.reportsTo) {
      if (relation.teamType === 'project' && !relation.project) {
        throw new Error('Project ID required for project teamType');
      }
      if (relation.user.equals(this.user)) {
        throw new Error('User cannot report to themselves');
      }
      if (!relation.path || !relation.path.match(/^\/[0-9a-f]{24}\//)) {
        throw new Error(`Invalid path for user ${relation.user}: ${relation.path}`);
      }
      const parent = await User.findById(relation.user);
      if (!parent) throw new Error(`Parent user ${relation.user} not found`);
      if (parent.level >= this.level) throw new Error(`Parent level must be lower than ${this.level}`);

      // Cycle detection
      let currentPath = relation.path;
      let visited = new Set();
      while (currentPath) {
        if (currentPath.includes(`/${this.user}/`)) throw new Error('Cycle detected in hierarchy');
        const parentId = currentPath.split('/').slice(-2, -1)[0];
        if (!parentId || visited.has(parentId)) break;
        visited.add(parentId);
        const grandParent = await mongoose.model('UserReporting').findOne({ user: parentId });
        currentPath = grandParent?.reportsTo[0]?.path || '';
      }
    }
    next();
  } catch (err) {
    console.error('Error in UserReporting pre-save:', err.message);
    next(err);
  }
});

userReportingSchema.post('save', async function(doc) {
  try {
    const Role = mongoose.model('Role');
    const User = mongoose.model('User');
    const superadminRole = await Role.findOne({ name: 'superadmin' });
    if (superadminRole && this.level > superadminRole.level) {
      const superadmin = await User.findOne({ role: superadminRole._id });
      if (superadmin && !this.reportsTo.some(r => r.user.equals(superadmin._id))) {
        const superadminPath = await mongoose.model('UserReporting').findOne({ user: superadmin._id })
          .then(pr => pr && pr.reportsTo.length > 0 && pr.reportsTo[0].path
            ? `${pr.reportsTo[0].path}${superadmin._id}/`
            : `/${superadmin._id}/`);
        this.reportsTo.push({
          user: superadmin._id,
          teamType: 'superadmin',
          path: superadminPath,
          context: 'Superadmin oversight'
        });
        await this.save();
      }
    }
  } catch (err) {
    console.error('Error in UserReporting post-save:', err.message);
  }
});

module.exports = mongoose.model('UserReporting', userReportingSchema);