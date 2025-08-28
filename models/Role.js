const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, lowercase: true, trim: true },
  level: { type: Number, required: true, min: 1 },
  // Global permissions for this role, used across all projects
  permissions: [{ type: String, trim: true, lowercase: true }],
  createdAt: { type: Date, default: Date.now },
});


module.exports = mongoose.model('Role', roleSchema);
