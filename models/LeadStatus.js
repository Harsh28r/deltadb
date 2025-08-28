const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true }, // e.g., 'text', 'number', 'date'
  required: { type: Boolean, default: false },
  options: [{ type: String }] // For select fields
});

const leadStatusSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  formFields: [fieldSchema] // Dynamic form for this status
}, { timestamps: true });

module.exports = mongoose.model('LeadStatus', leadStatusSchema);