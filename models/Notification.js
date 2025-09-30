const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Alias for user
  type: { type: String, required: true },
  title: { type: String, trim: true },
  message: { type: String, required: true, trim: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
  read: { type: Boolean, default: false },
  readAt: { type: Date },
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

// Sync user and recipient fields
notificationSchema.pre('save', function (next) {
  // Ensure user and recipient are synced
  if (this.recipient && !this.user) {
    this.user = this.recipient;
  } else if (this.user && !this.recipient) {
    this.recipient = this.user;
  }

  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Notification', notificationSchema);