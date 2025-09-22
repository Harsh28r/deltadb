const mongoose = require('mongoose');
const Joi = require('joi');
const Lead = require('../models/Lead');
const ChannelPartner = require('../models/ChannelPartner');
const CPSourcing = require('../models/CPSourcing');
const { logLeadActivity } = require('./leadActivityController');
const LeadActivity = require('../models/LeadActivity');
const UserReporting = require('../models/UserReporting');

const createLeadSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  projectId: Joi.string().hex().length(24).required(),
  channelPartnerId: Joi.string().hex().length(24).optional(),
  leadSourceId: Joi.string().hex().length(24).required(),
  currentStatusId: Joi.string().hex().length(24).optional(),
  customData: Joi.object().optional(),
  cpSourcingId: Joi.string().hex().length(24).optional()
});

const editLeadSchema = Joi.object({
  projectId: Joi.string().hex().length(24).optional(),
  channelPartnerId: Joi.string().hex().length(24).optional(),
  leadSourceId: Joi.string().hex().length(24).optional(),
  customData: Joi.object().optional(),
  cpSourcingId: Joi.string().hex().length(24).optional()
});

const changeStatusSchema = Joi.object({
  newStatusId: Joi.string().hex().length(24).required(),
  newData: Joi.object().optional()
});

const bulkTransferLeadsSchema = Joi.object({
  fromUserId: Joi.string().hex().length(24).required(),
  toUserId: Joi.string().hex().length(24).required(),
  leadIds: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
  projectId: Joi.string().hex().length(24).optional()
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

    if (req.body.currentStatusId && req.body.currentStatusId !== defaultStatus._id.toString()) {
      return res.status(400).json({ message: 'Provided status must be the default status' });
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
          projectId: req.body.projectId
        }).lean();
        if (!cpSourcing) {
          return res.status(400).json({ message: 'No matching CPSourcing found for selected sourcing person, channel partner, and project' });
        }
        cpSourcingId = cpSourcing._id;
      }
    }

    const lead = new Lead({
      user: req.body.userId,
      project: req.body.projectId,
      channelPartner: req.body.channelPartnerId || null,
      leadSource: req.body.leadSourceId,
      currentStatus: defaultStatus._id,
      customData: req.body.customData || {},
      cpSourcingId,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await lead.save({ context: { userId: req.user._id } });

    if (req.body.channelPartnerId) {
      await ChannelPartner.findByIdAndUpdate(req.body.channelPartnerId, { isActive: true });
    }

    if (cpSourcingId) {
      await CPSourcing.findByIdAndUpdate(cpSourcingId, { isActive: true });
    }

    await logLeadActivity(lead._id, req.user._id, 'created', {
      data: { ...req.body, currentStatusId: defaultStatus._id.toString(), cpSourcingId }
    });

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
      .select('user project channelPartner leadSource currentStatus customData createdAt')
      .populate('user', 'name email')
      .populate('project', 'name')
      .populate('channelPartner', 'name phone')
      .populate('leadSource', 'name')
      .populate('currentStatus', 'name formFields is_final_status')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    console.log('getLeads - Found leads:', leads.length);

    res.json({
      leads,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        limit
      }
    });
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

    await lead.changeStatus(req.body.newStatusId, req.body.newData || {}, req.user._id);

    res.json(lead);
  } catch (err) {
    console.error('changeLeadStatus - Error:', err.message);
    res.status(400).json({ message: err.message });
  }
};

const bulkTransferLeads = async (req, res) => {
  const { error } = bulkTransferLeadsSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { fromUserId, toUserId, leadIds, projectId } = req.body;

  try {
    if (projectId) {
      const project = await mongoose.model('Project').findById(projectId).lean();
      if (!project) return res.status(400).json({ message: 'Invalid projectId' });
    }

    const leads = await Lead.find({ _id: { $in: leadIds }, user: fromUserId }).populate('currentStatus').lean();
    if (leads.length === 0) return res.status(404).json({ message: 'No matching leads found' });

    const role = await mongoose.model('Role').findById(req.user.roleRef).lean();
    for (const lead of leads) {
      if (lead.currentStatus.is_final_status && (!role || role.name !== 'superadmin')) {
        return res.status(403).json({ message: `Only superadmin can transfer lead ${lead._id} with final status` });
      }
    }

    const update = { $set: { user: toUserId, updatedBy: req.user._id } };
    if (projectId) update.$set.project = projectId;

    const result = await Lead.updateMany(
      { _id: { $in: leadIds }, user: fromUserId },
      update,
      { context: { userId: req.user._id } }
    );

    for (const lead of leads) {
      await logLeadActivity(lead._id, req.user._id, 'transferred', {
        fromUser: fromUserId,
        toUser: toUserId,
        oldProject: lead.project?.toString(),
        newProject: projectId
      });
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