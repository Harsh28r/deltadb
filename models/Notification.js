const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['in-app', 'email', 'push'], required: true },
  message: { type: String, required: true, trim: true },
  status: { type: String, enum: ['sent', 'read', 'failed'], default: 'sent' },
  relatedEntity: {
    type: { type: String, trim: true },
    id: { type: mongoose.Schema.Types.ObjectId }
  },
  timestamp: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Indexes for performance
notificationSchema.index({ user: 1, timestamp: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ status: 1 });
notificationSchema.index({ 'relatedEntity.id': 1 });

// Update timestamp on save
notificationSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Notification', notificationSchema);