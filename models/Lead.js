const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  channelPartner: { type: mongoose.Schema.Types.ObjectId, ref: 'CpSource' },
  leadSource: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadSource', required: true },
  currentStatus: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadStatus', required: true },
  customData: { type: mongoose.Schema.Types.Mixed, default: {} }, // Dynamic fields data
  statusHistory: [{
    status: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadStatus' },
    data: { type: mongoose.Schema.Types.Mixed },
    changedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Method to change status and add data
leadSchema.methods.changeStatus = async function(newStatusId, newData) {
  const LeadStatus = mongoose.model('LeadStatus');
  const status = await LeadStatus.findById(newStatusId);
  if (!status) throw new Error('Invalid status');

  // Validate newData against status.formFields
  for (const field of status.formFields) {
    if (field.required && !newData[field.name]) {
      throw new Error(`Field ${field.name} is required`);
    }
    // Add type validation as needed
  }

  this.statusHistory.push({
    status: this.currentStatus,
    data: this.customData
  });
  this.currentStatus = newStatusId;
  this.customData = newData; // Or merge, depending on req
  await this.save();
};

module.exports = mongoose.model('Lead', leadSchema);