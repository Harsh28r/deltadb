const mongoose = require('mongoose');
const Joi = require('joi');
const Reminder = require('../models/Reminder');
const UserReporting = require('../models/UserReporting');
// const { logNotification } = require('./notificationController'); // For sending reminders

const createReminderSchema = Joi.object({
  title: Joi.string().required().trim(),
  description: Joi.string().optional().trim(),
  dateTime: Joi.date().required(),
  relatedType: Joi.string().valid('task', 'lead', 'project', 'cp-sourcing').required(),
  relatedId: Joi.string().hex().length(24).required(),
  userId: Joi.string().hex().length(24).required()
});

const updateReminderSchema = Joi.object({
  title: Joi.string().trim().optional(),
  description: Joi.string().trim().optional(),
  dateTime: Joi.date().optional(),
  status: Joi.string().valid('pending', 'sent', 'dismissed').optional()
});

const getRemindersSchema = Joi.object({
  userId: Joi.string().hex().length(24).optional(),
  relatedType: Joi.string().valid('task', 'lead', 'project', 'cp-sourcing').optional(),
  status: Joi.string().valid('pending', 'sent', 'dismissed').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

const createReminder = async (req, res) => {
  const { error } = createReminderSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const { title, description, dateTime, relatedType, relatedId, userId } = req.body;

    const user = await mongoose.model('User').findById(userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const reminder = new Reminder({
      title,
      description,
      dateTime,
      relatedType,
      relatedId,
      userId,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await reminder.save({ context: { userId: req.user._id } });

    // Send notification to user
    // await logNotification(userId, 'in-app', `Reminder: ${title}`, { type: 'reminder', id: reminder._id });

    res.status(201).json(reminder);
  } catch (err) {
    console.error('createReminder - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const getReminders = async (req, res) => {
  const { error, value } = getRemindersSchema.validate(req.query);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const { userId, relatedType, status, page, limit } = value;
    let query = {};

    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      const userReportings = await UserReporting.find({
        'reportsTo.path': { $regex: `/(${req.user._id})/` },
        'reportsTo.teamType': 'project'
      }).lean();

      const allowedUserIds = [...new Set([...userReportings.map(ur => ur.user.toString()), req.user._id.toString()])];
      query.userId = { $in: allowedUserIds };
      console.log('getReminders - Filtered to userIds:', allowedUserIds);
    } else {
      console.log('getReminders - Superadmin or level 1 access, no user filter');
    }

    if (userId) query.userId = userId;
    if (relatedType) query.relatedType = relatedType;
    if (status) query.status = status;

    const totalItems = await Reminder.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);
    const reminders = await Reminder.find(query)
      .select('title description dateTime relatedType relatedId userId status createdAt')
      .populate('userId', 'name email')
      .populate('relatedId', 'name title') // Dynamic based on relatedType
      .sort({ dateTime: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({
      reminders,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        limit
      }
    });
  } catch (err) {
    console.error('getReminders - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const getReminderById = async (req, res) => {
  const { id } = req.params;
  try {
    const reminder = await Reminder.findById(id)
      .select('title description dateTime relatedType relatedId userId status createdAt')
      .populate('userId', 'name email')
      .populate('relatedId', 'name title') // Dynamic based on relatedType
      .lean();

    if (!reminder) return res.status(404).json({ message: 'Reminder not found' });

    res.json(reminder);
  } catch (err) {
    console.error('getReminderById - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const updateReminder = async (req, res) => {
  const { id } = req.params;
  const { error } = updateReminderSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const reminder = await Reminder.findById(id);
    if (!reminder) return res.status(404).json({ message: 'Reminder not found' });

    const { title, description, dateTime, status } = req.body;

    if (title) reminder.title = title;
    if (description) reminder.description = description;
    if (dateTime) reminder.dateTime = dateTime;
    if (status) reminder.status = status;
    reminder.updatedBy = req.user._id;

    await reminder.save({ context: { userId: req.user._id } });

    res.json(reminder);
  } catch (err) {
    console.error('updateReminder - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const deleteReminder = async (req, res) => {
  const { id } = req.params;
  try {
    const reminder = await Reminder.findById(id);
    if (!reminder) return res.status(404).json({ message: 'Reminder not found' });

    await reminder.deleteOne();

    res.json({ message: 'Reminder deleted' });
  } catch (err) {
    console.error('deleteReminder - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const bulkUpdateReminders = async (req, res) => {
  const { query, update } = req.body;
  try {
    const result = await Reminder.updateMany(query, { $set: { ...update, updatedBy: req.user._id } });
    res.json({ message: 'Bulk update successful', modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('bulkUpdateReminders - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const bulkDeleteReminders = async (req, res) => {
  const { query } = req.body;
  try {
    const result = await Reminder.deleteMany(query);
    res.json({ message: 'Bulk delete successful', deletedCount: result.deletedCount });
  } catch (err) {
    console.error('bulkDeleteReminders - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createReminder,
  getReminders,
  getReminderById,
  updateReminder,
  deleteReminder,
  bulkUpdateReminders,
  bulkDeleteReminders
};