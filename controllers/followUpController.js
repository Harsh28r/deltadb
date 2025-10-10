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
  type: Joi.string().valid('pending', 'today', 'tomorrow', 'upcoming', 'all').default('all'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

/**
 * Get all follow-ups/meetings across the system
 * Supports filtering by user, project, date range, status, and time-based categorization
 * ?type=pending|today|tomorrow|upcoming|all (default: all)
 */
const getAllFollowUps = async (req, res) => {
  const { error, value } = getFollowUpsSchema.validate(req.query);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const { userId, projectId, statusId, startDate, endDate, status, type, page, limit } = value;

    // Build base filter
    let baseFilter = {
      relatedType: 'lead'
    };

    // Apply user hierarchy filter
    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      const userReportings = await UserReporting.find({
        'reportsTo.path': { $regex: `/(${req.user._id})/` },
        'reportsTo.teamType': 'project'
      }).lean();

      const allowedUserIds = [...new Set([...userReportings.map(ur => ur.user.toString()), req.user._id.toString()])];
      baseFilter.userId = { $in: allowedUserIds };
    }

    if (userId) baseFilter.userId = userId;
    if (status) baseFilter.status = status;

    // Define time boundaries
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const tomorrowStart = new Date(todayEnd.getTime() + 1);
    const tomorrowEnd = new Date(tomorrowStart.getFullYear(), tomorrowStart.getMonth(), tomorrowStart.getDate(), 23, 59, 59, 999);

    // If type is 'all', return categorized results
    if (type === 'all') {
      const [pendingReminders, todayReminders, tomorrowReminders, upcomingReminders] = await Promise.all([
        // Pending (Overdue)
        Reminder.find({
          ...baseFilter,
          dateTime: { $lt: now },
          status: 'pending'
        })
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
          .lean(),

        // Today
        Reminder.find({
          ...baseFilter,
          dateTime: { $gte: now, $lte: todayEnd },
          status: 'pending'
        })
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
          .lean(),

        // Tomorrow
        Reminder.find({
          ...baseFilter,
          dateTime: { $gte: tomorrowStart, $lte: tomorrowEnd },
          status: 'pending'
        })
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
          .lean(),

        // Upcoming
        Reminder.find({
          ...baseFilter,
          dateTime: { $gt: tomorrowEnd },
          status: 'pending'
        })
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
          .lean()
      ]);

      // Apply project and status filters
      const filterByProjectStatus = (reminders) => {
        if (!projectId && !statusId) return reminders;
        return reminders.filter(reminder => {
          if (!reminder.relatedId) return false;
          if (projectId && reminder.relatedId.project?._id?.toString() !== projectId) return false;
          if (statusId && reminder.relatedId.currentStatus?._id?.toString() !== statusId) return false;
          return true;
        });
      };

      const formatReminder = (reminder) => ({
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
      });

      const categorized = {
        pending: filterByProjectStatus(pendingReminders).map(formatReminder),
        today: filterByProjectStatus(todayReminders).map(formatReminder),
        tomorrow: filterByProjectStatus(tomorrowReminders).map(formatReminder),
        upcoming: filterByProjectStatus(upcomingReminders).map(formatReminder)
      };

      return res.json({
        followUps: categorized,
        summary: {
          pending: categorized.pending.length,
          today: categorized.today.length,
          tomorrow: categorized.tomorrow.length,
          upcoming: categorized.upcoming.length,
          total: categorized.pending.length + categorized.today.length +
                 categorized.tomorrow.length + categorized.upcoming.length
        },
        timestamp: now.toISOString()
      });
    }

    // Single type filter
    let filter = { ...baseFilter };

    if (type === 'pending') {
      filter.dateTime = { $lt: now };
      filter.status = 'pending';
    } else if (type === 'today') {
      filter.dateTime = { $gte: todayStart, $lte: todayEnd };
      filter.status = 'pending';
    } else if (type === 'tomorrow') {
      filter.dateTime = { $gte: tomorrowStart, $lte: tomorrowEnd };
      filter.status = 'pending';
    } else if (type === 'upcoming') {
      filter.dateTime = { $gt: tomorrowEnd };
      filter.status = 'pending';
    }

    // Apply custom date range if provided
    if (startDate && endDate) {
      filter.dateTime = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else if (startDate) {
      filter.dateTime = { ...filter.dateTime, $gte: new Date(startDate) };
    } else if (endDate) {
      filter.dateTime = { ...filter.dateTime, $lte: new Date(endDate) };
    }

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

    // Apply project and status filters
    if (projectId || statusId) {
      reminders = reminders.filter(reminder => {
        if (!reminder.relatedId) return false;
        if (projectId && reminder.relatedId.project?._id?.toString() !== projectId) return false;
        if (statusId && reminder.relatedId.currentStatus?._id?.toString() !== statusId) return false;
        return true;
      });
    }

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

    console.log('📅 getTodayFollowUps - Date range:', { todayStart, todayEnd });
    console.log('📅 getTodayFollowUps - User:', { id: req.user._id, role: req.user.role, level: req.user.level });

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
      console.log('📅 getTodayFollowUps - Allowed user IDs:', allowedUserIds);
    } else {
      console.log('📅 getTodayFollowUps - Superadmin/Level1 access - no user filter');
    }

    console.log('📅 getTodayFollowUps - Query filter:', JSON.stringify(filter));

    // First check total reminders
    const totalReminders = await Reminder.countDocuments({ relatedType: 'lead' });
    console.log('📅 getTodayFollowUps - Total lead reminders in DB:', totalReminders);

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

    console.log('📅 getTodayFollowUps - Found reminders:', reminders.length);
    if (reminders.length > 0) {
      console.log('📅 getTodayFollowUps - Sample reminder:', {
        id: reminders[0]._id,
        dateTime: reminders[0].dateTime,
        userId: reminders[0].userId?._id,
        relatedId: reminders[0].relatedId?._id
      });
    }

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

/**
 * Get follow-ups categorized by time period (Today, Tomorrow, Upcoming, Pending)
 */
const getCategorizedFollowUps = async (req, res) => {
  try {
    const userId = req.query.userId || req.user._id.toString();

    console.log('📅 getCategorizedFollowUps - User:', { id: userId, role: req.user.role });

    let baseFilter = {
      relatedType: 'lead'
    };

    // Apply user hierarchy filter
    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      const userReportings = await UserReporting.find({
        'reportsTo.path': { $regex: `/(${req.user._id})/` },
        'reportsTo.teamType': 'project'
      }).lean();

      const allowedUserIds = [...new Set([...userReportings.map(ur => ur.user.toString()), req.user._id.toString()])];
      baseFilter.userId = { $in: allowedUserIds };
    }

    if (userId) baseFilter.userId = userId;

    // Define time boundaries
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const tomorrowStart = new Date(todayEnd.getTime() + 1);
    const tomorrowEnd = new Date(tomorrowStart.getFullYear(), tomorrowStart.getMonth(), tomorrowStart.getDate(), 23, 59, 59, 999);

    console.log('📅 Time boundaries:', {
      now: now.toISOString(),
      todayStart: todayStart.toISOString(),
      todayEnd: todayEnd.toISOString(),
      tomorrowStart: tomorrowStart.toISOString(),
      tomorrowEnd: tomorrowEnd.toISOString()
    });

    // Query for each category
    const [pendingReminders, todayReminders, tomorrowReminders, upcomingReminders] = await Promise.all([
      // Pending (Overdue) - dateTime is in the past and status is still pending
      Reminder.find({
        ...baseFilter,
        dateTime: { $lt: now },
        status: 'pending'
      })
        .populate('userId', 'name email phone')
        .populate({
          path: 'relatedId',
          populate: [
            { path: 'currentStatus', select: 'name' },
            { path: 'project', select: 'name' },
            { path: 'user', select: 'name email' },
            { path: 'channelPartner', select: 'name phone' },
            { path: 'leadSource', select: 'name' }
          ]
        })
        .sort({ dateTime: 1 })
        .lean(),

      // Today - dateTime is today (but not in the past)
      Reminder.find({
        ...baseFilter,
        dateTime: { $gte: now, $lte: todayEnd },
        status: 'pending'
      })
        .populate('userId', 'name email phone')
        .populate({
          path: 'relatedId',
          populate: [
            { path: 'currentStatus', select: 'name' },
            { path: 'project', select: 'name' },
            { path: 'user', select: 'name email' },
            { path: 'channelPartner', select: 'name phone' },
            { path: 'leadSource', select: 'name' }
          ]
        })
        .sort({ dateTime: 1 })
        .lean(),

      // Tomorrow
      Reminder.find({
        ...baseFilter,
        dateTime: { $gte: tomorrowStart, $lte: tomorrowEnd },
        status: 'pending'
      })
        .populate('userId', 'name email phone')
        .populate({
          path: 'relatedId',
          populate: [
            { path: 'currentStatus', select: 'name' },
            { path: 'project', select: 'name' },
            { path: 'user', select: 'name email' },
            { path: 'channelPartner', select: 'name phone' },
            { path: 'leadSource', select: 'name' }
          ]
        })
        .sort({ dateTime: 1 })
        .lean(),

      // Upcoming (after tomorrow)
      Reminder.find({
        ...baseFilter,
        dateTime: { $gt: tomorrowEnd },
        status: 'pending'
      })
        .populate('userId', 'name email phone')
        .populate({
          path: 'relatedId',
          populate: [
            { path: 'currentStatus', select: 'name' },
            { path: 'project', select: 'name' },
            { path: 'user', select: 'name email' },
            { path: 'channelPartner', select: 'name phone' },
            { path: 'leadSource', select: 'name' }
          ]
        })
        .sort({ dateTime: 1 })
        .lean()
    ]);

    // Format reminders
    const formatReminder = (reminder) => ({
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
    });

    const categorized = {
      pending: pendingReminders.map(formatReminder),
      today: todayReminders.map(formatReminder),
      tomorrow: tomorrowReminders.map(formatReminder),
      upcoming: upcomingReminders.map(formatReminder)
    };

    console.log('📅 Categorized counts:', {
      pending: categorized.pending.length,
      today: categorized.today.length,
      tomorrow: categorized.tomorrow.length,
      upcoming: categorized.upcoming.length
    });

    res.json({
      followUps: categorized,
      summary: {
        pending: categorized.pending.length,
        today: categorized.today.length,
        tomorrow: categorized.tomorrow.length,
        upcoming: categorized.upcoming.length,
        total: categorized.pending.length + categorized.today.length +
               categorized.tomorrow.length + categorized.upcoming.length
      },
      timestamp: now.toISOString()
    });

  } catch (err) {
    console.error('getCategorizedFollowUps - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get pending (overdue) follow-ups
 */
const getPendingFollowUps = async (req, res) => {
  try {
    const userId = req.query.userId;

    let filter = {
      relatedType: 'lead',
      dateTime: { $lt: new Date() },
      status: 'pending'
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

    if (userId) filter.userId = userId;

    const reminders = await Reminder.find(filter)
      .populate('userId', 'name email phone')
      .populate({
        path: 'relatedId',
        populate: [
          { path: 'currentStatus', select: 'name' },
          { path: 'project', select: 'name' },
          { path: 'user', select: 'name email' },
          { path: 'channelPartner', select: 'name phone' },
          { path: 'leadSource', select: 'name' }
        ]
      })
      .sort({ dateTime: 1 })
      .lean();

    const formatReminder = (reminder) => ({
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
    });

    const followUps = reminders.map(formatReminder);

    res.json({
      followUps,
      count: followUps.length,
      type: 'pending'
    });

  } catch (err) {
    console.error('getPendingFollowUps - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get tomorrow's follow-ups
 */
const getTomorrowFollowUps = async (req, res) => {
  try {
    const userId = req.query.userId;

    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const tomorrowStart = new Date(todayEnd.getTime() + 1);
    const tomorrowEnd = new Date(tomorrowStart.getFullYear(), tomorrowStart.getMonth(), tomorrowStart.getDate(), 23, 59, 59, 999);

    let filter = {
      relatedType: 'lead',
      dateTime: { $gte: tomorrowStart, $lte: tomorrowEnd },
      status: 'pending'
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

    if (userId) filter.userId = userId;

    const reminders = await Reminder.find(filter)
      .populate('userId', 'name email phone')
      .populate({
        path: 'relatedId',
        populate: [
          { path: 'currentStatus', select: 'name' },
          { path: 'project', select: 'name' },
          { path: 'user', select: 'name email' },
          { path: 'channelPartner', select: 'name phone' },
          { path: 'leadSource', select: 'name' }
        ]
      })
      .sort({ dateTime: 1 })
      .lean();

    const formatReminder = (reminder) => ({
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
    });

    const followUps = reminders.map(formatReminder);

    res.json({
      followUps,
      count: followUps.length,
      type: 'tomorrow'
    });

  } catch (err) {
    console.error('getTomorrowFollowUps - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get upcoming follow-ups (after tomorrow)
 */
const getUpcomingFollowUps = async (req, res) => {
  try {
    const userId = req.query.userId;

    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const tomorrowStart = new Date(todayEnd.getTime() + 1);
    const tomorrowEnd = new Date(tomorrowStart.getFullYear(), tomorrowStart.getMonth(), tomorrowStart.getDate(), 23, 59, 59, 999);

    let filter = {
      relatedType: 'lead',
      dateTime: { $gt: tomorrowEnd },
      status: 'pending'
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

    if (userId) filter.userId = userId;

    const reminders = await Reminder.find(filter)
      .populate('userId', 'name email phone')
      .populate({
        path: 'relatedId',
        populate: [
          { path: 'currentStatus', select: 'name' },
          { path: 'project', select: 'name' },
          { path: 'user', select: 'name email' },
          { path: 'channelPartner', select: 'name phone' },
          { path: 'leadSource', select: 'name' }
        ]
      })
      .sort({ dateTime: 1 })
      .lean();

    const formatReminder = (reminder) => ({
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
    });

    const followUps = reminders.map(formatReminder);

    res.json({
      followUps,
      count: followUps.length,
      type: 'upcoming'
    });

  } catch (err) {
    console.error('getUpcomingFollowUps - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Clean up duplicate reminders
 * Removes duplicate reminders for the same lead with same title and date
 */
const cleanupDuplicateReminders = async (req, res) => {
  try {
    console.log('🧹 Starting duplicate reminder cleanup...');

    // Find all reminders grouped by lead, title, and dateTime
    const duplicates = await Reminder.aggregate([
      {
        $match: {
          relatedType: 'lead',
          status: 'pending'
        }
      },
      {
        $group: {
          _id: {
            relatedId: '$relatedId',
            title: '$title',
            dateTime: '$dateTime'
          },
          ids: { $push: '$_id' },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 } // Only groups with duplicates
        }
      }
    ]);

    console.log(`🧹 Found ${duplicates.length} groups of duplicate reminders`);

    let deletedCount = 0;

    for (const group of duplicates) {
      // Keep the first one (oldest), delete the rest
      const idsToDelete = group.ids.slice(1);

      const result = await Reminder.deleteMany({
        _id: { $in: idsToDelete }
      });

      deletedCount += result.deletedCount;
      console.log(`  🗑️ Deleted ${result.deletedCount} duplicates for group:`, {
        relatedId: group._id.relatedId,
        title: group._id.title,
        kept: group.ids[0],
        deleted: idsToDelete
      });
    }

    console.log(`✅ Cleanup complete - removed ${deletedCount} duplicate reminders`);

    res.json({
      message: 'Duplicate cleanup completed',
      duplicateGroups: duplicates.length,
      remindersDeleted: deletedCount,
      details: duplicates.map(d => ({
        lead: d._id.relatedId,
        title: d._id.title,
        dateTime: d._id.dateTime,
        duplicateCount: d.count,
        keptReminder: d.ids[0],
        deletedCount: d.count - 1
      }))
    });

  } catch (err) {
    console.error('cleanupDuplicateReminders - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getAllFollowUps,
  getFollowUpStats,
  getTodayFollowUps,
  getFollowUpsByProject,
  getCategorizedFollowUps,
  getPendingFollowUps,
  getTomorrowFollowUps,
  getUpcomingFollowUps,
  cleanupDuplicateReminders
};
