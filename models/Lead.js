const mongoose = require('mongoose');
const Role = require('./Role');

const leadSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true},
  channelPartner: { type: mongoose.Schema.Types.ObjectId, ref: 'CpSource' },
  leadSource: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadSource', required: true },
  currentStatus: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadStatus', required: true },
  customData: { type: mongoose.Schema.Types.Mixed, default: {} },
  statusHistory: [{
    status: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadStatus' },
    data: { type: mongoose.Schema.Types.Mixed },
    changedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Indexes for performance
leadSchema.index({ user: 1 });
leadSchema.index({ project: 1 });
leadSchema.index({ currentStatus: 1 });
leadSchema.index({ createdAt: -1 });

// Method to change status and add data
leadSchema.methods.changeStatus = async function(newStatusId, newData, userId) {
  const LeadStatus = mongoose.model('LeadStatus');
  const Role = mongoose.model('Role');

  // Check if current status is final
  const currentStatus = await LeadStatus.findById(this.currentStatus);
  if (currentStatus && currentStatus.is_final_status) {
    const role = await Role.findById(userId.roleRef);
    if (!role || role.name.toLowerCase() !== 'superadmin') {
      throw new Error('Only superadmin can change status of a lead with final status');
    }
  }

  // Validate new status
  const newStatus = await LeadStatus.findById(newStatusId);
  if (!newStatus) throw new Error('Invalid status');

  // Validate newData against status.formFields
  for (const field of newStatus.formFields) {
    if (field.required && !newData[field.name]) {
      throw new Error(`Field ${field.name} is required`);
    }
  }

  this.statusHistory.push({
    status: this.currentStatus,
    data: this.customData,
    changedAt: new Date()
  });
  this.currentStatus = newStatusId;
  this.customData = newData;
  await this.save();

  // Log activity
  const { logLeadActivity } = require('../controllers/leadActivityController');
  await logLeadActivity(this._id, userId, 'status_changed', {
    oldStatus: this.statusHistory[this.statusHistory.length - 1].status,
    newStatus: newStatusId,
    oldData: this.statusHistory[this.statusHistory.length - 1].data,
    newData
  });
};

// Validate edits for final status
leadSchema.pre('findOneAndUpdate', async function (next) {
  const lead = await mongoose.model('Lead').findById(this.getQuery()._id);
  if (!lead) throw new Error('Lead not found');

  const currentStatus = await mongoose.model('LeadStatus').findById(lead.currentStatus);
  if (currentStatus && currentStatus.is_final_status) {
    const userId = this.options.context?.userId;
    if (!userId) throw new Error('User context required for update');
    const role = await Role.findById(userId.roleRef);
    if (!role || role.name.toLowerCase() !== 'superadmin') {
      throw new Error('Only superadmin can edit a lead with final status');
    }
  }
  next();
});

module.exports = mongoose.model('Lead', leadSchema);