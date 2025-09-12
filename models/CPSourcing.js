const mongoose = require('mongoose');

const sourcingHistorySchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  selfie: { type: String, default: '' },
  location: {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 }
  },
  notes: { type: String, default: '' }
});

const cpSourcingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  channelPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChannelPartner', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  sourcingHistory: [sourcingHistorySchema],
  isActive: { type: Boolean, default: true },
  customData: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Check lead activity for isActive status
cpSourcingSchema.pre('findOneAndUpdate', async function(next) {
  const Lead = mongoose.model('Lead');
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const doc = await this.model.findOne(this.getQuery());
  if (doc) {
    const recentLead = await Lead.findOne({
      cpSourcingId: doc._id,
      updatedAt: { $gte: thirtyDaysAgo }
    });
    const update = this.getUpdate();
    update.$set = update.$set || {};
    update.$set.isActive = !!recentLead; // Active if recent lead exists
  }
  next();
});

// Validate project assignment
cpSourcingSchema.pre('save', async function(next) {
  const Project = mongoose.model('Project');
  const project = await Project.findById(this.projectId);
  if (!project) throw new Error('Invalid project ID');
  if (!project.members.includes(this.userId) && !project.managers.includes(this.userId)) {
    throw new Error('Project not assigned to sourcing person');
  }
  next();
});

// Indexes for performance
cpSourcingSchema.index({ userId: 1, channelPartnerId: 1, projectId: 1 }, { unique: true });
cpSourcingSchema.index({ isActive: 1 });

module.exports = mongoose.model('CPSourcing', cpSourcingSchema);