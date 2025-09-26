const mongoose = require('mongoose');
const Joi = require('joi');
const Task = require('../models/Task');
const UserReporting = require('../models/UserReporting');
const { logLeadActivity } = require('./leadActivityController');
const { logNotification } = require('./notificationController');

// Helper function to check user hierarchy access
const checkUserHierarchy = async (requestingUserId, targetUserId) => {
  try {
    // Users can always assign tasks to themselves
    if (requestingUserId.toString() === targetUserId.toString()) {
      return true;
    }

    // Check if target user reports to requesting user
    const targetUserReporting = await UserReporting.findOne({ user: targetUserId });
    if (!targetUserReporting) return false;

    // Check if requesting user is in the target user's reporting hierarchy
    const hasAccess = targetUserReporting.reportsTo.some(report =>
      report.path && report.path.includes(`/${requestingUserId}/`)
    );

    return hasAccess;
  } catch (error) {
    console.error('Error checking user hierarchy:', error);
    return false;
  }
};

// Helper function to check task access permissions
const checkTaskAccess = async (requestingUser, task) => {
  try {
    // Superadmin and level 1 users have full access
    if (requestingUser.role === 'superadmin' || requestingUser.level === 1) {
      return true;
    }

    // Users can access their own tasks
    if (task.assignedTo.toString() === requestingUser._id.toString()) {
      return true;
    }

    // Users can access tasks of users in their hierarchy
    return await checkUserHierarchy(requestingUser._id, task.assignedTo);
  } catch (error) {
    console.error('Error checking task access:', error);
    return false;
  }
};

const createTaskSchema = Joi.object({
  title: Joi.string().required().trim(),
  description: Joi.string().optional().trim(),
  assignedTo: Joi.string().hex().length(24).required(),
  taskType: Joi.string().valid('lead', 'project', 'cp-sourcing', 'target', 'general').required(),
  relatedId: Joi.string().hex().length(24).when('taskType', {
    is: 'general',
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  dueDate: Joi.date().required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
  customData: Joi.object().optional()
});

const updateTaskSchema = Joi.object({
  title: Joi.string().trim().optional(),
  description: Joi.string().trim().optional(),
  dueDate: Joi.date().optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  customData: Joi.object().optional()
});

const changeTaskStatusSchema = Joi.object({
  newStatus: Joi.string().valid('pending', 'in-progress', 'completed', 'overdue').required(),
  newData: Joi.object().optional()
});

const bulkTransferTasksSchema = Joi.object({
  fromUserId: Joi.string().hex().length(24).required(),
  toUserId: Joi.string().hex().length(24).required(),
  taskIds: Joi.array().items(Joi.string().hex().length(24)).min(1).required()
});

const getTasksSchema = Joi.object({
  assignedTo: Joi.string().hex().length(24).optional(),
  taskType: Joi.string().valid('lead', 'project', 'cp-sourcing', 'target', 'general').optional(),
  status: Joi.string().valid('pending', 'in-progress', 'completed', 'overdue').optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

const createTask = async (req, res) => {
  const { error } = createTaskSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const { title, description, assignedTo, taskType, relatedId, dueDate, priority, customData } = req.body;

    // Authorization Check: Verify user can create tasks
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Authorization Check: Verify user can assign tasks to the specified user
    const canAssignToUser = await checkUserHierarchy(req.user._id, assignedTo);
    if (!canAssignToUser && req.user.role !== 'superadmin' && req.user.level !== 1) {
      return res.status(403).json({
        message: 'You can only assign tasks to users in your hierarchy or yourself'
      });
    }

    const user = await mongoose.model('User').findById(assignedTo).lean();
    if (!user) return res.status(404).json({ message: 'Assigned user not found' });

    if (taskType !== 'general' && relatedId) {
      const modelMap = {
        lead: 'Lead',
        project: 'Project',
        'cp-sourcing': 'CPSourcing',
        target: 'Target'
      };
      const Model = mongoose.model(modelMap[taskType]);
      const relatedDoc = await Model.findById(relatedId).lean();
      if (!relatedDoc) return res.status(404).json({ message: `${taskType} not found` });
    }

    const task = new Task({
      title,
      description,
      assignedTo,
      taskType,
      relatedId: taskType === 'general' ? null : relatedId,
      dueDate,
      priority,
      customData,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await task.save({ context: { userId: req.user._id } });

    // Create reminder for task
    const reminder = new (mongoose.model('Reminder'))({
      title: `Task: ${title}`,
      description: `Reminder for task due on ${dueDate}`,
      dateTime: new Date(dueDate),
      relatedType: 'task',
      relatedId: task._id,
      userId: assignedTo,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });
    await reminder.save({ context: { userId: req.user._id } });
    // await logNotification(assignedTo, 'in-app', `Reminder: ${title}`, { type: 'reminder', id: reminder._id });

    res.status(201).json(task);
  } catch (err) {
    console.error('createTask - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const getTasks = async (req, res) => {
  const { error, value } = getTasksSchema.validate(req.query);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const { assignedTo, taskType, status, priority, page, limit } = value;
    let query = {};

    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      const userReportings = await UserReporting.find({
        'reportsTo.path': { $regex: `/(${req.user._id})/` },
        'reportsTo.teamType': 'project'
      }).lean();

      const projectFilteredUsers = [];
      for (const ur of userReportings) {
        for (const report of ur.reportsTo) {
          if (report.teamType === 'project') {
            projectFilteredUsers.push({
              userId: ur.user,
              projectId: report.project ? report.project : null
            });
          }
        }
      }
      projectFilteredUsers.push({ userId: req.user._id, projectId: null });

      if (projectFilteredUsers.length === 0) {
        console.log('getTasks - No subordinates found, filtering to self:', { userId: req.user._id });
        query.assignedTo = req.user._id;
      } else {
        query.$or = projectFilteredUsers.map(pf => ({
          assignedTo: pf.userId,
          ...(pf.projectId && taskType !== 'general' ? { relatedId: pf.projectId } : {})
        }));
      }

      console.log('getTasks - Filtered query:', JSON.stringify(query));
    } else {
      console.log('getTasks - Superadmin or level 1 access, no user filter');
    }

    if (assignedTo) query.assignedTo = assignedTo;
    if (taskType) query.taskType = taskType;
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const totalItems = await Task.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);
    const tasks = await Task.find(query)
      .select('title description assignedTo taskType relatedId dueDate priority status createdBy customData createdAt')
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate({
        path: 'relatedId',
        select: 'name title',
        match: { _id: { $exists: true } } // Only populate if relatedId exists
      })
      .sort({ dueDate: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({
      tasks,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        limit
      }
    });
  } catch (err) {
    console.error('getTasks - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const getTaskById = async (req, res) => {
  const { id } = req.params;
  try {
    const task = await Task.findById(id)
      .select('title description assignedTo taskType relatedId dueDate priority status statusHistory createdBy customData createdAt')
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('statusHistory.changedBy', 'name email')
      .populate({
        path: 'relatedId',
        select: 'name title',
        match: { _id: { $exists: true } }
      })
      .lean();

    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Authorization Check: Verify user can view this task
    const hasAccess = await checkTaskAccess(req.user, task);
    if (!hasAccess) {
      return res.status(403).json({
        message: 'You do not have permission to view this task'
      });
    }

    res.json(task);
  } catch (err) {
    console.error('getTaskById - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const updateTask = async (req, res) => {
  const { id } = req.params;
  const { error } = updateTaskSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Authorization Check: Verify user can update this task
    const hasAccess = await checkTaskAccess(req.user, task);
    if (!hasAccess) {
      return res.status(403).json({
        message: 'You do not have permission to update this task'
      });
    }

    const { title, description, dueDate, priority, customData } = req.body;

    if (title) task.title = title;
    if (description) task.description = description;
    if (dueDate) task.dueDate = dueDate;
    if (priority) task.priority = priority;
    if (customData) task.customData = customData;
    task.updatedBy = req.user._id;

    await task.save({ context: { userId: req.user._id } });

    res.json(task);
  } catch (err) {
    console.error('updateTask - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const changeTaskStatus = async (req, res) => {
  const { id } = req.params;
  const { error } = changeTaskStatusSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const { newStatus, newData } = req.body;

    await task.updateStatus(newStatus, newData, req.user._id);

    await logLeadActivity(task._id, req.user._id, 'task_status_changed', {
      oldStatus: task.status,
      newStatus,
      newData
    });

    res.json(task);
  } catch (err) {
    console.error('changeTaskStatus - Error:', err.message);
    res.status(400).json({ message: err.message });
  }
};

const deleteTask = async (req, res) => {
  const { id } = req.params;
  try {
    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Authorization Check: Verify user can delete this task
    const hasAccess = await checkTaskAccess(req.user, task);
    if (!hasAccess) {
      return res.status(403).json({
        message: 'You do not have permission to delete this task'
      });
    }

    await task.deleteOne();

    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('deleteTask - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const bulkTransferTasks = async (req, res) => {
  const { error } = bulkTransferTasksSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const { fromUserId, toUserId, taskIds } = req.body;

    const tasks = await Task.find({ _id: { $in: taskIds }, assignedTo: fromUserId }).lean();
    if (tasks.length === 0) return res.status(404).json({ message: 'No matching tasks found' });

    const result = await Task.updateMany(
      { _id: { $in: taskIds }, assignedTo: fromUserId },
      { $set: { assignedTo: toUserId, updatedBy: req.user._id } }
    );

    for (const task of tasks) {
      await logLeadActivity(task._id, req.user._id, 'task_transferred', {
        fromUser: fromUserId,
        toUser: toUserId,
        taskType: task.taskType,
        relatedId: task.relatedId
      });
    }

    res.json({ message: 'Tasks transferred', modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('bulkTransferTasks - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const bulkUpdateTasks = async (req, res) => {
  const { query, update } = req.body;
  try {
    const result = await Task.updateMany(query, { $set: { ...update, updatedBy: req.user._id } });
    res.json({ message: 'Bulk update successful', modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('bulkUpdateTasks - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const bulkDeleteTasks = async (req, res) => {
  const { query } = req.body;
  try {
    const result = await Task.deleteMany(query);
    res.json({ message: 'Bulk delete successful', deletedCount: result.deletedCount });
  } catch (err) {
    console.error('bulkDeleteTasks - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  changeTaskStatus,
  deleteTask,
  bulkTransferTasks,
  bulkUpdateTasks,
  bulkDeleteTasks
};