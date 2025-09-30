const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  channelPartner: { type: mongoose.Schema.Types.ObjectId, ref: 'ChannelPartner', default: null },
  leadSource: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadSource', required: true },
  currentStatus: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadStatus', required: true },
  customData: { type: mongoose.Schema.Types.Mixed, default: {} },
  cpSourcingId: { type: mongoose.Schema.Types.ObjectId, ref: 'CPSourcing', default: null },
  statusHistory: [{
    status: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadStatus' },
    data: { type: mongoose.Schema.Types.Mixed },
    changedAt: { type: Date, default: Date.now }
  }],
  isActive: { type: Boolean, default: true }, // Default to false
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Indexes for performance
leadSchema.index({ user: 1, createdAt: -1 });
leadSchema.index({ project: 1 });
leadSchema.index({ currentStatus: 1 });
leadSchema.index({ channelPartner: 1 });
leadSchema.index({ cpSourcingId: 1, createdAt: -1 });

// Update timestamp and set createdBy/updatedBy
leadSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Update CPSourcing isActive on lead creation
leadSchema.post('save', async function (doc, next) {
  try {
    if (this.isNew && this.cpSourcingId) {
      const CPSourcing = mongoose.model('CPSourcing');
      await CPSourcing.updateIsActiveOnLeadCreation(this.cpSourcingId, this.createdBy);
    }
    next();
  } catch (error) {
    console.error('Lead post save - Error:', error.message);
    next(error);
  }
});

// Method to change status and add data
leadSchema.methods.changeStatus = async function (newStatusId, newData, userId) {
  try {
    const LeadStatus = mongoose.model('LeadStatus');
    const Role = mongoose.model('Role');

    // Validate new status
    const newStatus = await LeadStatus.findById(newStatusId).lean();
    if (!newStatus) throw new Error('Invalid status');

    // Check if current status is final
    const currentStatus = await LeadStatus.findById(this.currentStatus).lean();
    if (currentStatus?.is_final_status) {
      const role = await Role.findById(userId.roleRef).lean();
      if (!role || role.name !== 'superadmin') {
        throw new Error('Only superadmin can change status of a lead with final status');
      }
    }

    // Validate newData against status.formFields
    for (const field of newStatus.formFields || []) {
      if (field.required && !newData[field.name]) {
        throw new Error(`Field ${field.name} is required`);
      }
    }

    // Update status history and lead data
    this.statusHistory.push({
      status: this.currentStatus,
      data: this.customData,
      changedAt: new Date()
    });
    this.currentStatus = newStatusId;
    this.customData = newData;
    this.updatedBy = userId;
    await this.save();

    // Log activity
    const { logLeadActivity } = require('../controllers/leadActivityController');
    await logLeadActivity(this._id, userId, 'status_changed', {
      oldStatus: this.statusHistory[this.statusHistory.length - 1].status,
      newStatus: newStatusId,
      oldData: this.statusHistory[this.statusHistory.length - 1].data,
      newData
    });

    // Send notification
    if (global.notificationService) {
      await global.notificationService.sendLeadStatusNotification(
        this,
        currentStatus,
        newStatus,
        userId
      );
    }

    return this;
  } catch (error) {
    console.error('Lead changeStatus - Error:', error.message);
    throw error;
  }
};

// Validate edits for final status
leadSchema.pre('findOneAndUpdate', async function (next) {
  try {
    const lead = await mongoose.model('Lead').findById(this.getQuery()._id).lean();
    if (!lead) throw new Error('Lead not found');

    const userId = this.options.context?.userId;
    if (!userId) throw new Error('User context required for update');

    // Check final status
    const currentStatus = await mongoose.model('LeadStatus').findById(lead.currentStatus).lean();
    if (currentStatus?.is_final_status) {
      const Role = mongoose.model('Role');
      const role = await Role.findById(userId.roleRef).lean();
      if (!role || role.name !== 'superadmin') {
        throw new Error('Only superadmin can edit a lead with final status');
      }
    }

    // Update user tracking
    this.set('updatedBy', userId);
    next();
  } catch (error) {
    console.error('Lead pre findOneAndUpdate - Error:', error.message);
    next(error);
  }
});

module.exports = mongoose.model('Lead', leadSchema);