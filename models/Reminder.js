const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  dateTime: { type: Date, required: true },
  relatedType: { type: String, enum: ['task', 'lead', 'project', 'cp-sourcing'], required: true },
  relatedId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'relatedModel' },
  relatedModel: {
    type: String,
    enum: ['Task', 'Lead', 'Project', 'CPSourcing'],
    required: true
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'sent', 'dismissed'], default: 'pending' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// Indexes for performance
reminderSchema.index({ userId: 1, dateTime: 1 });
reminderSchema.index({ relatedType: 1, relatedId: 1 });
reminderSchema.index({ status: 1, createdAt: -1 });

// Map relatedType to model name
const relatedTypeToModel = {
  'task': 'Task',
  'lead': 'Lead',
  'project': 'Project',
  'cp-sourcing': 'CPSourcing'
};

// Update timestamp and set relatedModel on save
reminderSchema.pre('save', function (next) {
  this.updatedAt = Date.now();

  // Automatically set relatedModel based on relatedType
  if (this.relatedType && !this.relatedModel) {
    this.relatedModel = relatedTypeToModel[this.relatedType];
  }

  next();
});

module.exports = mongoose.model('Reminder', reminderSchema);