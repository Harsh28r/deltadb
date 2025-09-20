const mongoose = require('mongoose');
const LeadActivity = require('../models/LeadActivity');
const UserReporting = require('../models/UserReporting');
const Joi = require('joi');

const getLeadActivitiesSchema = Joi.object({
  leadId: Joi.string().hex().length(24).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

const logLeadActivity = async (leadId, userId, action, details) => {
  try {
    const activity = new LeadActivity({ lead: leadId, user: userId, action, details });
    await activity.save();
  } catch (err) {
    console.error('logLeadActivity - Error:', err.message);
  }
};

const getLeadActivities = async (req, res) => {
  const { error, value } = getLeadActivitiesSchema.validate(req.query);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const { leadId, page, limit } = value;
    let query = leadId ? { lead: leadId } : {};

    // Hierarchy check for non-superadmin users
    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      const userReportings = await UserReporting.find({
        'reportsTo.path': { $regex: `/(${req.user.id})/` }
      }).lean();
      const allowedUserIds = [...userReportings.map(ur => ur.user.toString()), req.user.id];
      query.user = { $in: allowedUserIds };
      console.log('getLeadActivities: Filtered to userIds:', allowedUserIds);
    }

    const totalItems = await LeadActivity.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);
    let activities = await LeadActivity.find(query)
      .select('lead user action details timestamp')
      .populate('user', 'name email')
      .populate('lead', 'currentStatus')
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Batch fetch users and projects for details population
    const userIds = [...new Set(activities.flatMap(activity => [
      activity.details.fromUser,
      activity.details.toUser
    ].filter(id => id && mongoose.isValidObjectId(id))))];
    const projectIds = [...new Set(activities.flatMap(activity => [
      activity.details.oldProject,
      activity.details.newProject
    ].filter(id => id && mongoose.isValidObjectId(id))))];

    const users = await mongoose.model('User').find(
      { _id: { $in: userIds } },
      'name email'
    ).lean();
    const projects = await mongoose.model('Project').find(
      { _id: { $in: projectIds } },
      'name'
    ).lean();

    const userMap = new Map(users.map(u => [u._id.toString(), { id: u._id, name: u.name, email: u.email }]));
    const projectMap = new Map(projects.map(p => [p._id.toString(), { id: p._id, name: p.name }]));

    activities = activities.map(activity => {
      const populatedDetails = { ...activity.details };
      if (populatedDetails.fromUser) {
        populatedDetails.fromUser = userMap.get(populatedDetails.fromUser) || null;
      }
      if (populatedDetails.toUser) {
        populatedDetails.toUser = userMap.get(populatedDetails.toUser) || null;
      }
      if (populatedDetails.oldProject) {
        populatedDetails.oldProject = projectMap.get(populatedDetails.oldProject) || null;
      }
      if (populatedDetails.newProject) {
        populatedDetails.newProject = projectMap.get(populatedDetails.newProject) || null;
      }
      return { ...activity, details: populatedDetails };
    });

    res.json({
      activities,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        limit
      }
    });
  } catch (err) {
    console.error('getLeadActivities - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const getLeadHistory = async (req, res) => {
  const { error, value } = getLeadActivitiesSchema.validate(req.query);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const { leadId, page, limit } = value;
    let query = leadId ? { lead: leadId } : {};

    // Hierarchy check for non-superadmin users
    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      const userReportings = await UserReporting.find({
        'reportsTo.path': { $regex: `/(${req.user.id})/` }
      }).lean();
      const allowedUserIds = [...userReportings.map(ur => ur.user.toString()), req.user.id];
      query.user = { $in: allowedUserIds };
      console.log('getLeadHistory: Filtered to userIds:', allowedUserIds);
    }

    const totalItems = await LeadActivity.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);
    let activities = await LeadActivity.find(query)
      .select('lead user action details timestamp')
      .populate('user', 'name email')
      .populate({
        path: 'lead',
        populate: [
          { path: 'currentStatus', select: 'name formFields is_final_status' },
          { path: 'project', select: 'name' },
          { path: 'channelPartner', select: 'name' },
          { path: 'leadSource', select: 'name' }
        ]
      })
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Batch fetch users and projects for details population
    const userIds = [...new Set(activities.flatMap(activity => [
      activity.details.fromUser,
      activity.details.toUser
    ].filter(id => id && mongoose.isValidObjectId(id))))];
    const projectIds = [...new Set(activities.flatMap(activity => [
      activity.details.oldProject,
      activity.details.newProject
    ].filter(id => id && mongoose.isValidObjectId(id))))];

    const users = await mongoose.model('User').find(
      { _id: { $in: userIds } },
      'name email'
    ).lean();
    const projects = await mongoose.model('Project').find(
      { _id: { $in: projectIds } },
      'name'
    ).lean();

    const userMap = new Map(users.map(u => [u._id.toString(), { id: u._id, name: u.name, email: u.email }]));
    const projectMap = new Map(projects.map(p => [p._id.toString(), { id: p._id, name: p.name }]));

    activities = activities.map(activity => {
      const populatedDetails = { ...activity.details };
      if (populatedDetails.fromUser) {
        populatedDetails.fromUser = userMap.get(populatedDetails.fromUser) || null;
      }
      if (populatedDetails.toUser) {
        populatedDetails.toUser = userMap.get(populatedDetails.toUser) || null;
      }
      if (populatedDetails.oldProject) {
        populatedDetails.oldProject = projectMap.get(populatedDetails.oldProject) || null;
      }
      if (populatedDetails.newProject) {
        populatedDetails.newProject = projectMap.get(populatedDetails.newProject) || null;
      }
      return { ...activity, details: populatedDetails };
    });

    res.json({
      activities,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        limit
      }
    });
  } catch (err) {
    console.error('getLeadHistory - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const bulkUpdateLeadActivitiesSchema = Joi.object({
  query: Joi.object().required(),
  update: Joi.object().required()
});

const bulkDeleteLeadActivitiesSchema = Joi.object({
  query: Joi.object().required()
});

const bulkUpdateLeadActivities = async (req, res) => {
  const { error } = bulkUpdateLeadActivitiesSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    // Hierarchy check handled by checkHierarchy middleware
    const result = await LeadActivity.updateMany(req.body.query, req.body.update);
    res.json({ message: 'Bulk update successful', modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('bulkUpdateLeadActivities - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const bulkDeleteLeadActivities = async (req, res) => {
  const { error } = bulkDeleteLeadActivitiesSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    // Hierarchy check handled by checkHierarchy middleware
    const result = await LeadActivity.deleteMany(req.body.query);
    res.json({ message: 'Bulk delete successful', deletedCount: result.deletedCount });
  } catch (err) {
    console.error('bulkDeleteLeadActivities - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  logLeadActivity,
  getLeadActivities,
  getLeadHistory,
  bulkUpdateLeadActivities,
  bulkDeleteLeadActivities
};