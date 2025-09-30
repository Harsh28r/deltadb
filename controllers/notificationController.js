const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const Joi = require('joi');

const sendNotificationSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  type: Joi.string().valid('in-app', 'email', 'push').required(),
  message: Joi.string().required().trim(),
  relatedEntity: Joi.object({
    type: Joi.string().trim().optional(),
    id: Joi.string().hex().length(24).optional()
  }).optional()
});

const getNotificationsSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  type: Joi.string().valid('in-app', 'email', 'push').optional(),
  status: Joi.string().valid('sent', 'read', 'failed').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

const markNotificationReadSchema = Joi.object({
  id: Joi.string().hex().length(24).required()
});

const bulkUpdateNotificationsSchema = Joi.object({
  query: Joi.object().required(),
  update: Joi.object().required()
});

const bulkDeleteNotificationsSchema = Joi.object({
  query: Joi.object().required()
});

const sendNotification = async (userId, type, message, relatedEntity, createdBy) => {
  const { error } = sendNotificationSchema.validate({ userId, type, message, relatedEntity });
  if (error) throw new Error(error.details[0].message);

  try {
    const notification = new Notification({
      user: userId,
      type,
      message,
      relatedEntity,
      createdBy,
      updatedBy: createdBy
    });
    await notification.save();
    // Implement email/push delivery logic here (e.g., Nodemailer, Firebase)
    return notification;
  } catch (error) {
    console.error('sendNotification - Error:', error.message);
    throw new Error('Failed to send notification');
  }
};

const getNotifications = async (req, res) => {
  const { error, value } = getNotificationsSchema.validate({ ...req.params, ...req.query });
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const { userId, type, status, page, limit } = value;
    const query = { user: userId };
    if (type) query.type = type;
    if (status) query.status = status;

    console.log('getNotifications - query:', JSON.stringify(query));
    const totalItems = await Notification.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);
    const notifications = await Notification.find(query)
      .select('user recipient type title message data priority read readAt status relatedEntity timestamp createdAt updatedAt createdBy')
      .populate('user', 'name email _id role')
      .populate('recipient', 'name email _id role')
      .populate('createdBy', 'name email _id role')
      .populate('relatedEntity.id', 'name _id')
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    if (!notifications.length) {
      return res.status(200).json({ message: 'No notifications found', data: [], pagination: { currentPage: page, totalPages: 0, totalItems: 0, limit } });
    }

    res.json({
      notifications,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        limit
      }
    });
  } catch (error) {
    console.error('getNotifications - Error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const markNotificationRead = async (req, res) => {
  const { error } = markNotificationReadSchema.validate(req.params);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const { id } = req.params;
    const notification = await Notification.findByIdAndUpdate(
      id,
      { status: 'read', updatedBy: req.user._id },
      { new: true }
    ).lean();

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    console.error('markNotificationRead - Error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const bulkUpdateNotifications = async (req, res) => {
  const { error } = bulkUpdateNotificationsSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const { query, update } = req.body;
    const result = await Notification.updateMany(query, { $set: { ...update, updatedBy: req.user._id } });
    res.json({ message: 'Bulk update successful', modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('bulkUpdateNotifications - Error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

const bulkDeleteNotifications = async (req, res) => {
  const { error } = bulkDeleteNotificationsSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const { query } = req.body;
    const result = await Notification.deleteMany(query);
    res.json({ message: 'Bulk delete successful', deletedCount: result.deletedCount });
  } catch (error) {
    console.error('bulkDeleteNotifications - Error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { sendNotification, getNotifications, markNotificationRead, bulkUpdateNotifications, bulkDeleteNotifications };