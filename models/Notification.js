const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['in-app', 'email', 'push'], required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['sent', 'read', 'failed'], default: 'sent' },
  relatedEntity: {
    type: { type: String, enum: ['lead', 'task', 'target', 'other'] },
    id: { type: mongoose.Schema.Types.ObjectId }
  },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);