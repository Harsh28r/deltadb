const mongoose = require('mongoose');
const Joi = require('joi');
const Lead = require('../models/Lead');
const ChannelPartner = require('../models/ChannelPartner');
const CPSourcing = require('../models/CPSourcing');
const { logLeadActivity } = require('./leadActivityController');
const LeadActivity = require('../models/LeadActivity');
const UserReporting = require('../models/UserReporting');
const LeadService = require('../services/leadService');
const cacheManager = require('../utils/cacheManager');

// Initialize lead service (leadService is exported as instance)
const leadService = LeadService;

// Connect notification service when available
if (global.notificationService) {
  leadService.setNotificationService(global.notificationService);
}

const createLeadSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  project: Joi.string().hex().length(24).optional(),
  projectId: Joi.string().hex().length(24).optional(),
  channelPartnerId: Joi.string().hex().length(24).optional(),
  channelPartner: Joi.string().hex().length(24).optional(),
  leadSourceId: Joi.string().hex().length(24).optional(),
  leadSource: Joi.string().hex().length(24).optional(),
  currentStatusId: Joi.string().hex().length(24).optional(),
  currentStatus: Joi.string().hex().length(24).optional(),
  customData: Joi.object().optional(),
  cpSourcingId: Joi.string().hex().length(24).optional()
}).or('project', 'projectId');

const editLeadSchema = Joi.object({
  projectId: Joi.string().hex().length(24).optional(),
  project: Joi.string().hex().length(24).optional(),
  channelPartnerId: Joi.string().hex().length(24).optional(),
  channelPartner: Joi.string().hex().length(24).optional(),
  leadSourceId: Joi.string().hex().length(24).optional(),
  leadSource: Joi.string().hex().length(24).optional(),
  customData: Joi.object().optional(),
  cpSourcingId: Joi.string().hex().length(24).optional()
});

const changeStatusSchema = Joi.object({
  newStatus: Joi.string().hex().length(24).optional(),
  newStatusId: Joi.string().hex().length(24).optional(),
  statusId: Joi.string().hex().length(24).optional(),
  currentStatus: Joi.string().hex().length(24).optional(),
  newData: Joi.object().optional(),
  customData: Joi.object().optional()
}).or('newStatus', 'newStatusId', 'statusId', 'currentStatus');

const bulkTransferLeadsSchema = Joi.object({
  fromUser: Joi.string().hex().length(24).required(),
  toUser: Joi.string().hex().length(24).required(),
  leadIds: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
  projectId: Joi.string().hex().length(24).optional(),
  oldProjectId: Joi.string().hex().length(24).optional()
});

const getLeadsSchema = Joi.object({
  userId: Joi.string().hex().length(24).optional(),
  projectId: Joi.string().hex().length(24).optional(),
  statusId: Joi.string().hex().length(24).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

const createLead = async (req, res) => {
  const { error } = createLeadSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    console.log('createLead - Request body:', JSON.stringify(req.body));
    const defaultStatus = await mongoose.model('LeadStatus').findOne({ is_default_status: true }).lean();
    if (!defaultStatus) return res.status(400).json({ message: 'No default lead status found' });

    const providedStatusId = req.body.currentStatusId || req.body.currentStatus;
    if (providedStatusId && providedStatusId !== defaultStatus._id.toString()) {
      return res.status(400).json({ message: 'Provided status must be the default status' });
    }

    // Resolve project from either project or projectId
    const resolvedProjectId = req.body.project || req.body.projectId;
    if (!resolvedProjectId) {
      return res.status(400).json({ message: 'project or projectId is required' });
    }

    // Resolve channel partner from either channelPartnerId or channelPartner
    const resolvedChannelPartnerId = req.body.channelPartnerId || req.body.channelPartner || null;

    let cpSourcingId = null;
    if (resolvedChannelPartnerId) {
      const channelPartner = await ChannelPartner.findById(resolvedChannelPartnerId).lean();
      if (!channelPartner) {
        return res.status(400).json({ message: 'Invalid channel partner' });
      }

      if (req.body.cpSourcingId) {
        if (!mongoose.isValidObjectId(req.body.cpSourcingId)) {
          return res.status(400).json({ message: 'Invalid cpSourcingId' });
        }
        const cpSourcing = await CPSourcing.findOne({
          userId: req.body.cpSourcingId,
          channelPartnerId: resolvedChannelPartnerId,
          projectId: resolvedProjectId
        }).lean();
        if (!cpSourcing) {
          return res.status(400).json({ message: 'No matching CPSourcing found for selected sourcing person, channel partner, and project' });
        }
        cpSourcingId = cpSourcing._id;
      }
    }

    // Resolve lead source
    let resolvedLeadSourceId = req.body.leadSourceId;
    if (!resolvedLeadSourceId) {
      if (req.body.leadSource) {
        const providedName = String(req.body.leadSource || '').trim();
        const byName = await mongoose.model('LeadSource')
          .findOne({ name: providedName })
          .collation({ locale: 'en', strength: 2 })
          .lean();
        if (byName) {
          resolvedLeadSourceId = byName._id;
        } else {
          const fallback = await mongoose.model('LeadSource')
            .findOne({ name: 'Channel Partner' })
            .collation({ locale: 'en', strength: 2 })
            .lean();
          if (!fallback) return res.status(400).json({ message: 'LeadSource not configured. Please initialize Lead Sources.' });
          resolvedLeadSourceId = fallback._id;
        }
      } else {
        const fallback = await mongoose.model('LeadSource')
          .findOne({ name: 'Channel Partner' })
          .collation({ locale: 'en', strength: 2 })
          .lean();
        if (!fallback) return res.status(400).json({ message: 'LeadSource not configured. Please initialize Lead Sources.' });
        resolvedLeadSourceId = fallback._id;
      }
    }

    const lead = new Lead({
      user: req.body.userId,
      project: resolvedProjectId,
      channelPartner: resolvedChannelPartnerId || null,
      leadSource: resolvedLeadSourceId,
      currentStatus: defaultStatus._id,
      customData: req.body.customData || {},
      cpSourcingId,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await lead.save({ context: { userId: req.user._id } });

    if (resolvedChannelPartnerId) {
      await ChannelPartner.findByIdAndUpdate(resolvedChannelPartnerId, { isActive: true });
    }

    if (cpSourcingId) {
      await CPSourcing.findByIdAndUpdate(cpSourcingId, { isActive: true });
    }

    await logLeadActivity(lead._id, req.user._id, 'created', {
      data: { ...req.body, currentStatusId: defaultStatus._id.toString(), cpSourcingId }
    });

    // Send notification to lead owner and superadmins
    if (global.notificationService) {
      if (req.body.userId !== req.user._id.toString()) {
        // Lead assigned to another user - notify them + hierarchy
        const notification = {
          type: 'lead_created',
          title: 'New Lead Assigned',
          message: `A new lead has been assigned to you`,
          data: {
            leadId: lead._id,
            projectId: resolvedProjectId,
            createdBy: req.user._id
          },
          priority: 'normal'
        };

        const hierarchyNotif = {
          ...notification,
          title: '[Team] New Lead Created & Assigned',
          message: `Lead ${lead._id} created and assigned to user ${req.body.userId}`
        };

        await global.notificationService.sendNotificationWithSuperadmin(req.body.userId, notification, hierarchyNotif);
      } else {
        // User created lead for themselves - notify hierarchy
        await global.notificationService.sendHierarchyNotification(req.user._id.toString(), {
          type: 'lead_created',
          title: 'Lead Created',
          message: `User created new lead ${lead._id}`,
          data: {
            leadId: lead._id,
            projectId: resolvedProjectId,
            createdBy: req.user._id
          },
          priority: 'normal'
        });
      }

      // Also notify creator's hierarchy about the creation activity
      if (req.body.userId !== req.user._id.toString()) {
        await global.notificationService.sendHierarchyNotification(req.user._id.toString(), {
          type: 'lead_created',
          title: 'Lead Created',
          message: `User created and assigned lead ${lead._id} to ${req.body.userId}`,
          data: {
            leadId: lead._id,
            projectId: resolvedProjectId,
            assignedTo: req.body.userId,
            createdBy: req.user._id
          },
          priority: 'normal'
        });
      }
    }

    res.status(201).json(lead);
  } catch (err) {
    console.error('createLead - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const getLeads = async (req, res) => {
  const { error, value } = getLeadsSchema.validate(req.query);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const { userId, projectId, statusId, page, limit } = value;

    // Create cache key for this query
    // const cacheKey = `leads:${req.user._id}:${JSON.stringify(value)}`;

    // Check cache first
    // const cachedResults = await cacheManager.getQueryResult(cacheKey);
    // if (cachedResults) {
    //   console.log('getLeads - Returning cached results');
    //   return res.json(cachedResults);
    // }

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
            if (projectId) {
              if (report.project && report.project.toString() === projectId) {
                projectFilteredUsers.push({ userId: ur.user, projectId: report.project });
              }
            } else {
              projectFilteredUsers.push({ 
                userId: ur.user, 
                projectId: report.project ? report.project : null 
              });
            }
          }
        }
      }
      projectFilteredUsers.push({ userId: req.user._id, projectId: projectId || null });

      if (projectFilteredUsers.length === 0) {
        console.log('getLeads - No subordinates found, filtering to self:', { userId: req.user._id });
        query.user = req.user._id;
      } else {
        query.$or = projectFilteredUsers.map(pf => ({
          user: pf.userId,
          ...(pf.projectId && { project: pf.projectId })
        }));
      }

      console.log('getLeads - Filtered query:', JSON.stringify(query));
    } else {
      console.log('getLeads - Superadmin or level 1 access, no user filter');
    }

    if (userId) query.user = userId;
    if (projectId) query.project = projectId;
    if (statusId) query.currentStatus = statusId;

    const totalItems = await Lead.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);
    const leads = await Lead.find(query)
      .select('user project channelPartner cpSourcingId leadSource currentStatus customData createdAt ')
      .populate('user', 'name email')
      .populate('project', 'name')
      .populate('channelPartner', 'name phone')
      .populate({
        path: 'cpSourcingId',
        select: 'userId',
        populate: {
          path: 'userId',
          select: 'name phone'
        }
      })
      .populate('leadSource', 'name')
      .populate('currentStatus', 'name formFields is_final_status')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    console.log('getLeads - Found leads:', leads.length);

    const results = {
      leads,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        limit
      }
    };

    // Cache the results for 5 minutes
    // await cacheManager.setQueryResult(cacheKey, results, 10);

    res.json(results);
  } catch (err) {
    console.error('getLeads - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const getLeadById = async (req, res) => {
  const { id } = req.params;
  try {
    const lead = await Lead.findById(id)
      .select('user project channelPartner leadSource currentStatus customData cpSourcingId statusHistory createdAt')
      .populate('user', 'name email')
      .populate('project', 'name')
      .populate('channelPartner', 'name phone')
      .populate('cpSourcingId', 'userId')
      .populate({
        path: 'cpSourcingId.userId',
        select: 'name phone'
      })
      .populate('leadSource', 'name')
      .populate({
        path: 'currentStatus',
        select: 'name formFields is_final_status'
      })
      .populate({
        path: 'statusHistory.status',
        select: 'name formFields is_final_status'
      })
      .lean();

    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const activities = await LeadActivity.find({ lead: id })
      .sort({ timestamp: -1 })
      .populate('user', 'name email')
      .lean();

    res.json({ lead, activities });
  } catch (err) {
    console.error('getLeadById - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const editLead = async (req, res) => {
  const { id } = req.params;
  const { error } = editLeadSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const lead = await Lead.findById(id)
      .populate('currentStatus')
      .populate('leadSource');
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const role = await mongoose.model('Role').findById(req.user.roleRef).lean();
    if (lead.currentStatus.is_final_status && (!role || role.name !== 'superadmin')) {
      return res.status(403).json({ message: 'Only superadmin can edit a lead with final status' });
    }

    let cpSourcingId = null;
    if (req.body.channelPartnerId) {
      const channelPartner = await ChannelPartner.findById(req.body.channelPartnerId).lean();
      if (!channelPartner) {
        return res.status(400).json({ message: 'Invalid channel partner' });
      }

      if (req.body.cpSourcingId) {
        if (!mongoose.isValidObjectId(req.body.cpSourcingId)) {
          return res.status(400).json({ message: 'Invalid cpSourcingId' });
        }
        const cpSourcing = await CPSourcing.findOne({
          userId: req.body.cpSourcingId,
          channelPartnerId: req.body.channelPartnerId,
          projectId: req.body.projectId || lead.project
        }).lean();
        if (!cpSourcing) {
          return res.status(400).json({ message: 'No matching CPSourcing found for selected sourcing person, channel partner, and project' });
        }
        cpSourcingId = cpSourcing._id;
      }
    }

    const oldData = lead.toObject();
    const allowedUpdates = ['project', 'channelPartner', 'leadSource', 'customData', 'cpSourcingId'];
    allowedUpdates.forEach(field => {
      if (req.body[`${field}Id`] !== undefined) {
        lead[field] = req.body[`${field}Id`];
      } else if (req.body[field] !== undefined) {
        lead[field] = req.body[field];
      }
    });
    if (cpSourcingId) lead.cpSourcingId = cpSourcingId;

    await lead.save({ context: { userId: req.user._id } });

    // if (req.body.channelPartnerId) {
    //   await ChannelPartner.findByIdAndUpdate(req.body.channelPartnerId, { isActive: true });
    // }

    await logLeadActivity(lead._id, req.user._id, 'updated', {
      oldData,
      newData: lead.toObject()
    });

    // Notify hierarchy about lead update
    if (global.notificationService) {
      await global.notificationService.sendHierarchyNotification(req.user._id.toString(), {
        type: 'lead_updated',
        title: 'Lead Updated',
        message: `User updated lead ${lead._id}`,
        data: {
          leadId: lead._id,
          projectId: lead.project,
          updatedBy: req.user._id
        },
        priority: 'normal'
      });
    }

    res.json(lead);
  } catch (err) {
    console.error('editLead - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const deleteLead = async (req, res) => {
  const { id } = req.params;
  try {
    const lead = await Lead.findById(id).populate('currentStatus');
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const role = await mongoose.model('Role').findById(req.user.roleRef).lean();
    if (lead.currentStatus.is_final_status && (!role || role.name !== 'superadmin')) {
      return res.status(403).json({ message: 'Only superadmin can delete a lead with final status' });
    }

    await logLeadActivity(lead._id, req.user._id, 'deleted', { data: lead.toObject() });
    await lead.deleteOne();

    // Notify hierarchy about lead deletion
    if (global.notificationService) {
      await global.notificationService.sendHierarchyNotification(req.user._id.toString(), {
        type: 'lead_deleted',
        title: 'Lead Deleted',
        message: `User deleted lead ${lead._id}`,
        data: {
          leadId: lead._id,
          projectId: lead.project,
          deletedBy: req.user._id
        },
        priority: 'normal'
      });
    }

    res.json({ message: 'Lead deleted' });
  } catch (err) {
    console.error('deleteLead - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const changeLeadStatus = async (req, res) => {
  const { id } = req.params;
  const { error } = changeStatusSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    // Support multiple field names for status
    const newStatusId = req.body.newStatus || req.body.newStatusId || req.body.statusId || req.body.currentStatus;

    // Support multiple field names for custom data
    const customData = req.body.newData || req.body.customData || {};

    await lead.changeStatus(newStatusId, customData, req.user);

    res.json(lead);
  } catch (err) {
    console.error('changeLeadStatus - Error:', err.message);
    res.status(400).json({ message: err.message });
  }
};

const bulkTransferLeads = async (req, res) => {
  const { error } = bulkTransferLeadsSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { fromUser, toUser, leadIds, projectId, oldProjectId } = req.body;

  try {
    if (projectId) {
      const project = await mongoose.model('Project').findById(projectId).lean();
      if (!project) return res.status(400).json({ message: 'Invalid projectId' });
    }

    const leadQuery = { _id: { $in: leadIds }, user: fromUser };
    if (oldProjectId) {
      leadQuery.project = oldProjectId;
    }
    const leads = await Lead.find(leadQuery).populate('currentStatus').lean();
    if (leads.length === 0) return res.status(404).json({ message: 'No matching leads found' });

    const role = await mongoose.model('Role').findById(req.user.roleRef).lean();
    for (const lead of leads) {
      if (lead.currentStatus.is_final_status && (!role || role.name !== 'superadmin')) {
        return res.status(403).json({ message: `Only superadmin can transfer lead ${lead._id} with final status` });
      }
    }

    const update = { $set: { user: toUser, updatedBy: req.user._id } };
    if (projectId) update.$set.project = projectId;

    const result = await Lead.updateMany(
      { _id: { $in: leadIds }, user: fromUser },
      update,
      { context: { userId: req.user._id } }
    );

    for (const lead of leads) {
      await logLeadActivity(lead._id, req.user._id, 'transferred', {
        fromUser: fromUser,
        toUser: toUser,
        oldProject: lead.project?.toString(),
        newProject: projectId
      });
    }

    // Send notification to new lead owner and superadmins
    if (global.notificationService && result.modifiedCount > 0) {
      // Get user info for better context
      const User = require('../models/User');
      const transferredByUser = await User.findById(req.user._id).select('name email').lean();
      const transferredByName = transferredByUser ? transferredByUser.name : 'Unknown User';

      const notification = {
        type: 'lead_transferred',
        title: 'Leads Assigned to You',
        message: `${result.modifiedCount} lead(s) have been transferred to you by ${transferredByName}`,
        data: {
          leadIds,
          fromUser,
          projectId,
          transferredBy: req.user._id,
          transferredByName,
          transferredByEmail: transferredByUser?.email
        },
        priority: 'high'
      };

      const hierarchyNotif = {
        ...notification,
        title: '[Team Activity] Leads Transferred',
        message: `${result.modifiedCount} lead(s) transferred from ${fromUser} to ${toUser} by ${transferredByName}`,
        data: {
          ...notification.data,
          toUser
        }
      };

      // Send to new lead owner and their hierarchy (including superadmins)
      await global.notificationService.sendNotificationWithSuperadmin(toUser, notification, hierarchyNotif);

      // Also notify the person who did the transfer (their hierarchy)
      await global.notificationService.sendHierarchyNotification(req.user._id.toString(), {
        type: 'lead_transferred',
        title: '[Action] Leads Transferred',
        message: `You transferred ${result.modifiedCount} lead(s) from ${fromUser} to ${toUser}`,
        data: {
          leadIds,
          fromUser,
          toUser,
          projectId,
          transferredBy: req.user._id,
          transferredByName
        },
        priority: 'high'
      });

      // Send individual notifications for each transferred lead
      for (const lead of leads) {
        try {
          await global.notificationService.sendLeadAssignmentNotification(
            lead,
            toUser,
            req.user._id
          );
        } catch (error) {
          console.error(`Failed to send individual lead assignment notification for lead ${lead._id}:`, error);
        }
      }
    }

    res.json({ message: 'Leads transferred', modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('bulkTransferLeads - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const bulkUploadLeads = async (req, res) => {
  const results = [];
  try {
    const fs = require('fs');
    const csv = require('csv-parser');
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          const defaultStatus = await mongoose.model('LeadStatus').findOne({ is_default_status: true }).lean();
          if (!defaultStatus) {
            return res.status(400).json({ message: 'No default lead status found' });
          }

          const leads = await Lead.insertMany(
            results.map(row => ({
              user: row.userId,
              project: row.projectId || undefined,
              channelPartner: row.channelPartnerId || null,
              leadSource: row.leadSourceId,
              currentStatus: defaultStatus._id,
              customData: row.customData ? JSON.parse(row.customData) : {},
              createdBy: req.user._id,
              updatedBy: req.user._id
            })),
            { context: { userId: req.user._id } }
          );

          for (const lead of leads) {
            await logLeadActivity(lead._id, req.user._id, 'created', { data: lead.toObject() });
          }

          fs.unlinkSync(req.file.path);
          res.json({ message: 'Bulk upload successful', count: leads.length });
        } catch (err) {
          console.error('bulkUploadLeads - Error:', err.message);
          res.status(400).json({ message: err.message });
        }
      });
  } catch (err) {
    console.error('bulkUploadLeads - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const bulkDeleteLeads = async (req, res) => {
  const { error } = Joi.object({ query: Joi.object().required() }).validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const leads = await Lead.find(req.body.query).populate('currentStatus').lean();
    if (leads.length === 0) return res.status(404).json({ message: 'No matching leads found' });

    const role = await mongoose.model('Role').findById(req.user.roleRef).lean();
    for (const lead of leads) {
      if (lead.currentStatus.is_final_status && (!role || role.name !== 'superadmin')) {
        return res.status(403).json({ message: `Only superadmin can delete lead ${lead._id} with final status` });
      }
    }

    for (const lead of leads) {
      await logLeadActivity(lead._id, req.user._id, 'deleted', { data: lead });
    }

    const result = await Lead.deleteMany(req.body.query);
    res.json({ message: 'Bulk delete successful', deletedCount: result.deletedCount });
  } catch (err) {
    console.error('bulkDeleteLeads - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createLead,
  getLeads,
  getLeadById,
  editLead,
  deleteLead,
  changeLeadStatus,
  bulkUploadLeads: require('multer')({ dest: 'uploads/' }).single('file'),
  bulkTransferLeads,
  bulkDeleteLeads
};