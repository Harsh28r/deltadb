const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true }, // e.g., 'text', 'number', 'date'
  required: { type: Boolean, default: false },
  options: [{ type: String }] // For select fields
});

const leadStatusSchema = new mongoose.Schema({
  name: { type: String, required: true },
  formFields: [fieldSchema],
  is_final_status: { type: Boolean, default: false },
  is_default_status: { type: Boolean, default: false }
}, { timestamps: true });

// Case-insensitive unique index for name
leadStatusSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
leadStatusSchema.index({ is_final_status: 1 });

// Ensure only one status has is_final_status: true & is_default_status: true
leadStatusSchema.pre('save', async function (next) {
  if (this.is_final_status) {
    const existingFinal = await mongoose.model('LeadStatus').findOne({ is_final_status: true, _id: { $ne: this._id } });
    if (existingFinal) {
      throw new Error('Another lead status is already marked as final');
    }
  }
  if (this.is_default_status) {
    const existingDefault = await mongoose.model('LeadStatus').findOne({ is_default_status: true, _id: { $ne: this._id } });
    if (existingDefault) {
      throw new Error('Another lead status is already marked as default');
    }
  }
  next();
});

leadStatusSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate();
  if (update.is_final_status) {
    const existingFinal = await mongoose.model('LeadStatus').findOne({ is_final_status: true, _id: { $ne: this.getQuery()._id } });
    if (existingFinal) {
      throw new Error('Another lead status is already marked as final');
    }
  }
  if (update.is_default_status) {
    const existingDefault = await mongoose.model('LeadStatus').findOne({ is_default_status: true, _id: { $ne: this.getQuery()._id } });
    if (existingDefault) {
      throw new Error('Another lead status is already marked as default');
    }
  }
  next();
});

module.exports = mongoose.model('LeadStatus', leadStatusSchema);