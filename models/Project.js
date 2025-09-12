const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  logo: { type: String },
  developBy: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  managers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

// Indexes for performance
projectSchema.index({ owner: 1 });
projectSchema.index({ members: 1 });
projectSchema.index({ managers: 1 });

module.exports = mongoose.model('Project', projectSchema);