const mongoose = require('mongoose');

const leadActivitySchema = new mongoose.Schema({
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null},
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: {
    type: String,
    required: true
  },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

leadActivitySchema.index({ lead: 1, timestamp: -1 });
leadActivitySchema.index({ user: 1 });
leadActivitySchema.index({ action: 1 });
leadActivitySchema.index({ lead: 1 }, { partialFilterExpression: { lead: null } });

module.exports = mongoose.model('LeadActivity', leadActivitySchema);