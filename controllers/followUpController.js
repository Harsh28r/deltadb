const mongoose = require('mongoose');
const Joi = require('joi');
const Reminder = require('../models/Reminder');
const Lead = require('../models/Lead');
const UserReporting = require('../models/UserReporting');
const { formatDateForAPI } = require('../utils/dateFormatter');

const getFollowUpsSchema = Joi.object({
  userId: Joi.string().hex().length(24).optional(),
  projectId: Joi.string().hex().length(24).optional(),
  statusId: Joi.string().hex().length(24).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  status: Joi.string().valid('pending', 'sent', 'dismissed').optional(),
  type: Joi.string().valid('upcoming', 'overdue', 'today', 'all').default('all'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

/**
 * Get all follow-ups/meetings across the system
 * Supports filtering by user, project, date range, status
 */
const getAllFollowUps = async (req, res) => {
  const { error, value } = getFollowUpsSchema.validate(req.query);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const { userId, projectId, statusId, startDate, endDate, status, type, page, limit } = value;

    // Build filter query
    let filter = {
      relatedType: 'lead'
    };

    // Apply user hierarchy filter
    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      const userReportings = await UserReporting.find({
        'reportsTo.path': { $regex: `/(${req.user._id})/` },
        'reportsTo.teamType': 'project'
      }).lean();

      const allowedUserIds = [...new Set([...userReportings.map(ur => ur.user.toString()), req.user._id.toString()])];
      filter.userId = { $in: allowedUserIds };
    }

    // Apply filters
    if (userId) filter.userId = userId;
    if (status) filter.status = status;

    // Date range filters
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const todayEnd = new Date(now.setHours(23, 59, 59, 999));

    if (type === 'upcoming') {
      filter.dateTime = { $gte: new Date() };
      filter.status = 'pending';
    } else if (type === 'overdue') {
      filter.dateTime = { $lt: new Date() };
      filter.status = 'pending';
    } else if (type === 'today') {
      filter.dateTime = { $gte: todayStart, $lte: todayEnd };
    }

    if (startDate && endDate) {
      filter.dateTime = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else if (startDate) {
      filter.dateTime = { $gte: new Date(startDate) };
    } else if (endDate) {
      filter.dateTime = { $lte: new Date(endDate) };
    }

    // Get reminders with populated lead data
    const totalItems = await Reminder.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limit);

    let reminders = await Reminder.find(filter)
      .populate('userId', 'name email phone')
      .populate({
        path: 'relatedId',
        select: 'currentStatus customData project user channelPartner leadSource',
        populate: [
          { path: 'currentStatus', select: 'name formFields' },
          { path: 'project', select: 'name' },
          { path: 'user', select: 'name email phone' },
          { path: 'channelPartner', select: 'name phone email' },
          { path: 'leadSource', select: 'name' }
        ]
      })
      .sort({ dateTime: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Apply project and status filters on populated data
    if (projectId || statusId) {
      reminders = reminders.filter(reminder => {
        if (!reminder.relatedId) return false;

        let matches = true;
        if (projectId && reminder.relatedId.project?._id?.toString() !== projectId) {
          matches = false;
        }
        if (statusId && reminder.relatedId.currentStatus?._id?.toString() !== statusId) {
          matches = false;
        }
        return matches;
      });
    }

    // Format response
    const followUps = reminders.map(reminder => ({
      id: reminder._id,
      title: reminder.title,
      description: reminder.description,
      dateTime: formatDateForAPI(reminder.dateTime),
      status: reminder.status,
      assignedTo: reminder.userId ? {
        id: reminder.userId._id,
        name: reminder.userId.name,
        email: reminder.userId.email,
        phone: reminder.userId.phone
      } : null,
      lead: reminder.relatedId ? {
        id: reminder.relatedId._id,
        status: reminder.relatedId.currentStatus?.name,
        customData: reminder.relatedId.customData,
        project: reminder.relatedId.project?.name,
        assignedTo: reminder.relatedId.user ? {
          id: reminder.relatedId.user._id,
          name: reminder.relatedId.user.name,
          email: reminder.relatedId.user.email
        } : null,
        channelPartner: reminder.relatedId.channelPartner?.name,
        leadSource: reminder.relatedId.leadSource?.name
      } : null,
      createdAt: formatDateForAPI(reminder.createdAt)
    }));

    res.json({
      followUps,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        limit
      },
      summary: {
        total: totalItems,
        type: type
      }
    });

  } catch (err) {
    console.error('getAllFollowUps - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get follow-up statistics/summary
 */
const getFollowUpStats = async (req, res) => {
  try {
    const userId = req.query.userId;

    // Build base filter
    let userFilter = {};

    // Apply user hierarchy filter
    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      const userReportings = await UserReporting.find({
        'reportsTo.path': { $regex: `/(${req.user._id})/` },
        'reportsTo.teamType': 'project'
      }).lean();

      const allowedUserIds = [...new Set([...userReportings.map(ur => ur.user.toString()), req.user._id.toString()])];
      userFilter = { userId: { $in: allowedUserIds } };
    }

    if (userId) userFilter.userId = userId;

    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const todayEnd = new Date(now.setHours(23, 59, 59, 999));

    const [total, pending, overdue, today, completed] = await Promise.all([
      Reminder.countDocuments({ relatedType: 'lead', ...userFilter }),
      Reminder.countDocuments({ relatedType: 'lead', status: 'pending', ...userFilter }),
      Reminder.countDocuments({
        relatedType: 'lead',
        status: 'pending',
        dateTime: { $lt: now },
        ...userFilter
      }),
      Reminder.countDocuments({
        relatedType: 'lead',
        dateTime: { $gte: todayStart, $lte: todayEnd },
        ...userFilter
      }),
      Reminder.countDocuments({ relatedType: 'lead', status: 'sent', ...userFilter })
    ]);

    // Get upcoming in next 7 days
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcoming = await Reminder.countDocuments({
      relatedType: 'lead',
      status: 'pending',
      dateTime: { $gte: now, $lte: nextWeek },
      ...userFilter
    });

    res.json({
      stats: {
        total,
        pending,
        overdue,
        today,
        upcoming,
        completed
      }
    });

  } catch (err) {
    console.error('getFollowUpStats - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get today's follow-ups
 */
const getTodayFollowUps = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const todayEnd = new Date(now.setHours(23, 59, 59, 999));

    let filter = {
      relatedType: 'lead',
      dateTime: { $gte: todayStart, $lte: todayEnd }
    };

    // Apply user hierarchy filter
    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      const userReportings = await UserReporting.find({
        'reportsTo.path': { $regex: `/(${req.user._id})/` },
        'reportsTo.teamType': 'project'
      }).lean();

      const allowedUserIds = [...new Set([...userReportings.map(ur => ur.user.toString()), req.user._id.toString()])];
      filter.userId = { $in: allowedUserIds };
    }

    const reminders = await Reminder.find(filter)
      .populate('userId', 'name email phone')
      .populate({
        path: 'relatedId',
        populate: [
          { path: 'currentStatus', select: 'name' },
          { path: 'project', select: 'name' },
          { path: 'user', select: 'name email' }
        ]
      })
      .sort({ dateTime: 1 })
      .lean();

    const followUps = reminders.map(reminder => ({
      id: reminder._id,
      title: reminder.title,
      description: reminder.description,
      dateTime: formatDateForAPI(reminder.dateTime),
      status: reminder.status,
      assignedTo: reminder.userId,
      lead: reminder.relatedId ? {
        id: reminder.relatedId._id,
        status: reminder.relatedId.currentStatus?.name,
        project: reminder.relatedId.project?.name,
        assignedTo: reminder.relatedId.user
      } : null
    }));

    res.json({
      followUps,
      count: followUps.length
    });

  } catch (err) {
    console.error('getTodayFollowUps - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get follow-ups by project
 */
const getFollowUpsByProject = async (req, res) => {
  try {
    const projectId = req.params.projectId;

    let filter = {
      relatedType: 'lead'
    };

    // Apply user hierarchy filter
    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      const userReportings = await UserReporting.find({
        'reportsTo.path': { $regex: `/(${req.user._id})/` },
        'reportsTo.teamType': 'project'
      }).lean();

      const allowedUserIds = [...new Set([...userReportings.map(ur => ur.user.toString()), req.user._id.toString()])];
      filter.userId = { $in: allowedUserIds };
    }

    const reminders = await Reminder.find(filter)
      .populate({
        path: 'relatedId',
        match: { project: projectId },
        populate: [
          { path: 'currentStatus', select: 'name' },
          { path: 'project', select: 'name' },
          { path: 'user', select: 'name email' }
        ]
      })
      .populate('userId', 'name email')
      .sort({ dateTime: 1 })
      .lean();

    // Filter out reminders where relatedId is null (didn't match project)
    const filteredReminders = reminders.filter(r => r.relatedId !== null);

    const followUps = filteredReminders.map(reminder => ({
      id: reminder._id,
      title: reminder.title,
      description: reminder.description,
      dateTime: formatDateForAPI(reminder.dateTime),
      status: reminder.status,
      assignedTo: reminder.userId,
      lead: {
        id: reminder.relatedId._id,
        status: reminder.relatedId.currentStatus?.name,
        project: reminder.relatedId.project?.name,
        assignedTo: reminder.relatedId.user
      }
    }));

    res.json({
      followUps,
      count: followUps.length,
      projectId
    });

  } catch (err) {
    console.error('getFollowUpsByProject - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getAllFollowUps,
  getFollowUpStats,
  getTodayFollowUps,
  getFollowUpsByProject
};
