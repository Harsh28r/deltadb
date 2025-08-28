const mongoose = require('mongoose');

const userProjectSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  assignedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Unique index to prevent duplicate assignments
userProjectSchema.index({ user: 1, project: 1 }, { unique: true });

module.exports = mongoose.model('UserProject', userProjectSchema);