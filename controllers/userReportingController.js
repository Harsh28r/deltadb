const mongoose = require('mongoose');
const UserReporting = require('../models/UserReporting');
const User = require('../models/User');
const Joi = require('joi');

const relationshipSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  teamType: Joi.string().valid('project', 'global', 'superadmin', 'custom').required(),
  projectId: Joi.string().hex().length(24).when('teamType', { is: 'project', then: Joi.required() }),
  context: Joi.string().allow('').optional()
});

const createReportingSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  reportsTo: Joi.array().items(relationshipSchema).optional()
});

const updateReportingSchema = Joi.object({
  reportsTo: Joi.array().items(relationshipSchema).optional()
});

const getAllReportingSchema = Joi.object({
  level: Joi.number().integer().min(0).optional(),
  teamType: Joi.string().valid('project', 'global', 'superadmin', 'custom').optional(),
  userId: Joi.string().hex().length(24).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

const getHierarchySchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

const generatePath = async (userId) => {
  const parentReporting = await UserReporting.findOne({ user: userId }).lean();
  return parentReporting && parentReporting.reportsTo.length > 0 && parentReporting.reportsTo[0].path
    ? `${parentReporting.reportsTo[0].path}${userId}/`
    : `/${userId}/`;
};

// Helper function to create or update reporting relationship by user ID
const createOrUpdateReportingByUserId = async (req, res) => {
  const { userId } = req.params;
  const { error } = updateReportingSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Find existing reporting relationship
    let reporting = await UserReporting.findOne({ user: userId });
    
    if (reporting) {
      // Update existing
      reporting.reportsTo = req.body.reportsTo ? await Promise.all(req.body.reportsTo.map(async r => ({
        user: r.userId,
        teamType: r.teamType,
        project: r.projectId,
        context: r.context || '',
        path: await generatePath(r.userId)
      }))) : [];
      reporting.level = user.level;
      await reporting.save();

      // Send notification about reporting relationship update
      if (global.notificationService) {
        try {
          const updatedByUser = await User.findById(req.user._id).select('name email').lean();
          const updatedByName = updatedByUser ? updatedByUser.name : 'System';
          const targetUser = await User.findById(userId).select('name email').lean();

          // Notify the user whose reporting was updated
          await global.notificationService.sendNotification(userId, {
            type: 'reporting_updated',
            title: 'Reporting Structure Updated',
            message: `Your reporting structure has been updated by ${updatedByName}`,
            data: {
              userId: userId,
              userName: targetUser?.name,
              updatedBy: req.user._id,
              updatedByName: updatedByName,
              reportsToCount: reporting.reportsTo.length
            },
            priority: 'normal'
          });

          // Notify superadmins about the reporting change
          await global.notificationService.sendHierarchyNotification(req.user._id.toString(), {
            type: 'user_reporting_updated',
            title: '[Admin Activity] User Reporting Updated',
            message: `User "${targetUser?.name || userId}" reporting structure updated by ${updatedByName}`,
            data: {
              targetUserId: userId,
              targetUserName: targetUser?.name,
              targetUserEmail: targetUser?.email,
              updatedBy: req.user._id,
              updatedByName: updatedByName,
              updatedByEmail: updatedByUser?.email,
              reportsToCount: reporting.reportsTo.length
            },
            priority: 'normal'
          });
        } catch (notificationError) {
          console.error('Failed to send reporting update notification:', notificationError);
        }
      }

      return res.json({
        message: 'Reporting relationship updated successfully',
        reporting
      });
    } else {
      // Create new
      reporting = new UserReporting({
        user: userId,
        reportsTo: req.body.reportsTo ? await Promise.all(req.body.reportsTo.map(async r => ({
          user: r.userId,
          teamType: r.teamType,
          project: r.projectId,
          context: r.context || '',
          path: await generatePath(r.userId)
        }))) : [],
        level: user.level
      });
      await reporting.save();

      // Send notification about new reporting relationship
      if (global.notificationService) {
        try {
          const createdByUser = await User.findById(req.user._id).select('name email').lean();
          const createdByName = createdByUser ? createdByUser.name : 'System';
          const targetUser = await User.findById(userId).select('name email').lean();

          // Notify the user who got new reporting structure
          await global.notificationService.sendNotification(userId, {
            type: 'reporting_assigned',
            title: 'Reporting Structure Assigned',
            message: `You have been assigned a new reporting structure by ${createdByName}`,
            data: {
              userId: userId,
              userName: targetUser?.name,
              assignedBy: req.user._id,
              assignedByName: createdByName,
              reportsToCount: reporting.reportsTo.length
            },
            priority: 'normal'
          });

          // Notify superadmins about the new reporting assignment
          await global.notificationService.sendHierarchyNotification(req.user._id.toString(), {
            type: 'user_reporting_assigned',
            title: '[Admin Activity] User Reporting Assigned',
            message: `User "${targetUser?.name || userId}" assigned new reporting structure by ${createdByName}`,
            data: {
              targetUserId: userId,
              targetUserName: targetUser?.name,
              targetUserEmail: targetUser?.email,
              assignedBy: req.user._id,
              assignedByName: createdByName,
              assignedByEmail: createdByUser?.email,
              reportsToCount: reporting.reportsTo.length
            },
            priority: 'normal'
          });
        } catch (notificationError) {
          console.error('Failed to send reporting assignment notification:', notificationError);
        }
      }

      return res.status(201).json({
        message: 'Reporting relationship created successfully',
        reporting
      });
    }
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ 
        message: 'Duplicate reporting relationship detected',
        error: 'Please ensure no duplicate relationships exist'
      });
    }
    console.error('createOrUpdateReportingByUserId - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const createReporting = async (req, res) => {
  const { error } = createReportingSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const user = await User.findById(req.body.userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Check if UserReporting already exists for this user
    let reporting = await UserReporting.findOne({ user: req.body.userId });
    
    if (reporting) {
      // Update existing reporting relationship
      reporting.reportsTo = req.body.reportsTo ? await Promise.all(req.body.reportsTo.map(async r => ({
        user: r.userId,
        teamType: r.teamType,
        project: r.projectId,
        context: r.context || '',
        path: await generatePath(r.userId)
      }))) : [];
      reporting.level = user.level; // Update level in case it changed
      await reporting.save();

      // Send notification about reporting relationship update
      if (global.notificationService) {
        try {
          const updatedByUser = await User.findById(req.user._id).select('name email').lean();
          const updatedByName = updatedByUser ? updatedByUser.name : 'System';

          // Notify the user whose reporting was updated
          await global.notificationService.sendNotification(req.body.userId, {
            type: 'reporting_updated',
            title: 'Reporting Structure Updated',
            message: `Your reporting structure has been updated by ${updatedByName}`,
            data: {
              userId: req.body.userId,
              userName: user.name,
              updatedBy: req.user._id,
              updatedByName: updatedByName,
              reportsToCount: reporting.reportsTo.length
            },
            priority: 'normal'
          });

          // Notify superadmins about the reporting change
          await global.notificationService.sendHierarchyNotification(req.user._id.toString(), {
            type: 'user_reporting_updated',
            title: '[Admin Activity] User Reporting Updated',
            message: `User "${user.name}" reporting structure updated by ${updatedByName}`,
            data: {
              targetUserId: req.body.userId,
              targetUserName: user.name,
              targetUserEmail: user.email,
              updatedBy: req.user._id,
              updatedByName: updatedByName,
              updatedByEmail: updatedByUser?.email,
              reportsToCount: reporting.reportsTo.length
            },
            priority: 'normal'
          });
        } catch (notificationError) {
          console.error('Failed to send reporting update notification:', notificationError);
        }
      }

      return res.status(200).json({
        message: 'Reporting relationship updated successfully',
        reporting
      });
    } else {
      // Create new reporting relationship
      reporting = new UserReporting({
        user: req.body.userId,
        reportsTo: req.body.reportsTo ? await Promise.all(req.body.reportsTo.map(async r => ({
          user: r.userId,
          teamType: r.teamType,
          project: r.projectId,
          context: r.context || '',
          path: await generatePath(r.userId)
        }))) : [],
        level: user.level
      });
      await reporting.save();

      // Send notification about new reporting relationship
      if (global.notificationService) {
        try {
          const createdByUser = await User.findById(req.user._id).select('name email').lean();
          const createdByName = createdByUser ? createdByUser.name : 'System';

          // Notify the user who got new reporting structure
          await global.notificationService.sendNotification(req.body.userId, {
            type: 'reporting_assigned',
            title: 'Reporting Structure Assigned',
            message: `You have been assigned a new reporting structure by ${createdByName}`,
            data: {
              userId: req.body.userId,
              userName: user.name,
              assignedBy: req.user._id,
              assignedByName: createdByName,
              reportsToCount: reporting.reportsTo.length
            },
            priority: 'normal'
          });

          // Notify superadmins about the new reporting assignment
          await global.notificationService.sendHierarchyNotification(req.user._id.toString(), {
            type: 'user_reporting_assigned',
            title: '[Admin Activity] User Reporting Assigned',
            message: `User "${user.name}" assigned new reporting structure by ${createdByName}`,
            data: {
              targetUserId: req.body.userId,
              targetUserName: user.name,
              targetUserEmail: user.email,
              assignedBy: req.user._id,
              assignedByName: createdByName,
              assignedByEmail: createdByUser?.email,
              reportsToCount: reporting.reportsTo.length
            },
            priority: 'normal'
          });
        } catch (notificationError) {
          console.error('Failed to send reporting assignment notification:', notificationError);
        }
      }

      return res.status(201).json({
        message: 'Reporting relationship created successfully',
        reporting
      });
    }
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ 
        message: 'Duplicate reporting relationship - please use update endpoint instead',
        error: 'Use PUT /api/user-reporting/:id to update existing relationships'
      });
    }
    console.error('createReporting - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const getHierarchy = async (req, res) => {
  const { error, value } = getHierarchySchema.validate({ ...req.params, ...req.query });
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const { userId, page, limit } = value;
    const query = { 'reportsTo.path': { $regex: `/(${userId})/` } };

    const totalItems = await UserReporting.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);
    const subordinates = await UserReporting.find(query)
      .select('user reportsTo level createdAt updatedAt')
      .populate('user', 'name email _id')
      .populate('reportsTo.user', 'name email _id')
      .populate('reportsTo.project', 'name _id')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    console.log(`getHierarchy - userId: ${userId}, page: ${page}, limit: ${limit}, total: ${totalItems}`);

    res.json({
      subordinates,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        limit
      }
    });
  } catch (err) {
    console.error('getHierarchy - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const getAllUserReportings = async (req, res) => {
  const { error, value } = getAllReportingSchema.validate({ ...req.query });
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const { level, teamType, userId, page, limit } = value;
    const query = {};
    if (level) query.level = parseInt(level);
    if (teamType) query['reportsTo.teamType'] = teamType;
    if (userId) query.user = userId;

    console.log('getAllUserReportings - query:', query);
    const totalItems = await UserReporting.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);
    const reportings = await UserReporting.find(query)
      .select('user reportsTo level createdAt updatedAt')
      .populate('user', 'name email _id')
      .populate('reportsTo.user', 'name email _id')
      .populate('reportsTo.project', 'name _id')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({
      reportings,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        limit
      }
    });
  } catch (err) {
    console.error('getAllUserReportings - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const updateReporting = async (req, res) => {
  const { id } = req.params;
  const { error } = updateReportingSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const reporting = await UserReporting.findById(id);
    if (!reporting) return res.status(404).json({ message: 'Reporting not found' });

    // Validate that the user still exists
    const user = await User.findById(reporting.user);
    if (!user) return res.status(404).json({ message: 'User not found' });

    reporting.reportsTo = req.body.reportsTo ? await Promise.all(req.body.reportsTo.map(async r => ({
      user: r.userId,
      teamType: r.teamType,
      project: r.projectId,
      context: r.context || '',
      path: await generatePath(r.userId)
    }))) : [];
    reporting.level = user.level; // Update level in case it changed
    await reporting.save();

    // Send notification about reporting relationship update
    if (global.notificationService) {
      try {
        const updatedByUser = await User.findById(req.user._id).select('name email').lean();
        const updatedByName = updatedByUser ? updatedByUser.name : 'System';

        // Notify the user whose reporting was updated
        await global.notificationService.sendNotification(reporting.user.toString(), {
          type: 'reporting_updated',
          title: 'Reporting Structure Updated',
          message: `Your reporting structure has been updated by ${updatedByName}`,
          data: {
            userId: reporting.user,
            userName: user.name,
            updatedBy: req.user._id,
            updatedByName: updatedByName,
            reportsToCount: reporting.reportsTo.length
          },
          priority: 'normal'
        });

        // Notify superadmins about the reporting change
        await global.notificationService.sendHierarchyNotification(req.user._id.toString(), {
          type: 'user_reporting_updated',
          title: '[Admin Activity] User Reporting Updated',
          message: `User "${user.name}" reporting structure updated by ${updatedByName}`,
          data: {
            targetUserId: reporting.user,
            targetUserName: user.name,
            targetUserEmail: user.email,
            updatedBy: req.user._id,
            updatedByName: updatedByName,
            updatedByEmail: updatedByUser?.email,
            reportsToCount: reporting.reportsTo.length
          },
          priority: 'normal'
        });
      } catch (notificationError) {
        console.error('Failed to send reporting update notification:', notificationError);
      }
    }

    res.json({
      message: 'Reporting relationship updated successfully',
      reporting
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ 
        message: 'Duplicate reporting relationship detected',
        error: 'Please ensure no duplicate relationships exist'
      });
    }
    console.error('updateReporting - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const deleteReporting = async (req, res) => {
  const { id } = req.params;
  try {
    await UserReporting.deleteOne({ _id: id });
    res.json({ message: 'Reporting deleted' });
  } catch (err) {
    console.error('deleteReporting - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const bulkUpdateUserReportings = async (req, res) => {
  const { query, update } = req.body;
  try {
    const result = await UserReporting.updateMany(query, update);
    res.json({ message: 'Bulk update successful', modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('bulkUpdateUserReportings - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const bulkDeleteUserReportings = async (req, res) => {
  const { query } = req.body;
  try {
    const result = await UserReporting.deleteMany(query);
    res.json({ message: 'Bulk delete successful', deletedCount: result.deletedCount });
  } catch (err) {
    console.error('bulkDeleteUserReportings - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createReporting,
  getHierarchy,
  getAllUserReportings,
  updateReporting,
  deleteReporting,
  bulkUpdateUserReportings,
  createOrUpdateReportingByUserId,
  bulkDeleteUserReportings
};