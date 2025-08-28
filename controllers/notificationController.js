const Notification = require('../models/Notification');
const mongoose = require('mongoose');

const sendNotification = async (userId, type, message, relatedEntity) => {
  try {
    const notification = new Notification({ user: userId, type, message, relatedEntity });
    await notification.save();
    // Implement email/push delivery logic here (e.g., Nodemailer, Firebase)
    return notification;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw new Error('Failed to send notification');
  }
};

const getNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }
    const notifications = await Notification.find({ user: userId }).populate('user relatedEntity.id');
    if (!notifications.length) {
      return res.status(200).json({ message: 'No notifications found', data: [] });
    }
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid notification ID' });
    }
    const notification = await Notification.findByIdAndUpdate(
      id,
      { status: 'read' },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(notification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const bulkUpdateNotifications = async (req, res) => {
  const { query, update } = req.body;
  try {
    const result = await Notification.updateMany(query, update);
    res.json({ message: 'Bulk update successful', modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bulkDeleteNotifications = async (req, res) => {
  const { query } = req.body;
  try {
    const result = await Notification.deleteMany(query);
    res.json({ message: 'Bulk delete successful', deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { sendNotification, getNotifications, markNotificationRead, bulkUpdateNotifications, bulkDeleteNotifications};