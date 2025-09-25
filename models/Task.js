const mongoose = require('mongoose');

const taskStatusHistorySchema = new mongoose.Schema({
  status: { type: String, enum: ['pending', 'in-progress', 'completed', 'overdue'], required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  changedAt: { type: Date, default: Date.now },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  taskType: { type: String, enum: ['lead', 'project', 'cp-sourcing', 'target', 'general'], required: true },
  relatedId: { type: mongoose.Schema.Types.ObjectId, required: false }, // Optional for general tasks
  dueDate: { type: Date, required: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  status: { type: String, enum: ['pending', 'in-progress', 'completed', 'overdue'], default: 'pending' },
  statusHistory: [taskStatusHistorySchema],
  customData: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// Indexes for performance
taskSchema.index({ assignedTo: 1, dueDate: 1 });
taskSchema.index({ taskType: 1, relatedId: 1 });
taskSchema.index({ status: 1, createdAt: -1 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ assignee: 1, status: 1 });

// Update timestamp and user tracking
taskSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  if (this.taskType !== 'general' && !this.relatedId) {
    return next(new Error('relatedId is required for non-general tasks'));
  }
  if (this.taskType === 'general' && this.relatedId) {
    this.relatedId = null; // Ensure general tasks have no relatedId
  }
  next();
});

// Method to update status and add history
taskSchema.methods.updateStatus = async function (newStatus, newData, userId) {
  try {
    if (!['pending', 'in-progress', 'completed', 'overdue'].includes(newStatus)) {
      throw new Error('Invalid status');
    }

    if (newStatus !== 'overdue' && this.dueDate < new Date()) {
      newStatus = 'overdue';
    }

    this.statusHistory.push({
      status: this.status,
      data: this.customData,
      changedAt: new Date(),
      changedBy: userId
    });

    this.status = newStatus;
    this.customData = newData || this.customData;
    this.updatedBy = userId;
    await this.save();

    return this;
  } catch (error) {
    console.error('Task updateStatus - Error:', error.message);
    throw error;
  }
};

// Validate edits for overdue status
taskSchema.pre('findOneAndUpdate', async function (next) {
  try {
    const task = await mongoose.model('Task').findById(this.getQuery()._id).lean();
    if (!task) throw new Error('Task not found');

    const userId = this.options.context?.userId;
    if (!userId) throw new Error('User context required for update');

    if (task.dueDate < new Date() && task.status !== 'overdue') {
      this.set({ status: 'overdue', updatedBy: userId });
    }

    this.set('updatedBy', userId);
    next();
  } catch (error) {
    console.error('Task pre findOneAndUpdate - Error:', error.message);
    next(error);
  }
});

module.exports = mongoose.model('Task', taskSchema);