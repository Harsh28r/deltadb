const Lead = require('../models/Lead');
const { logLeadActivity } = require('./leadActivityController');
// const { sendNotification } = require('./notificationController');
const Joi = require('joi');
const mongoose = require('mongoose');

const createLeadSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  project: Joi.string().hex().length(24).optional(),
  channelPartner: Joi.string().hex().length(24).optional(),
  leadSource: Joi.string().hex().length(24).required(),
  currentStatus: Joi.string().hex().length(24).required(),
  customData: Joi.object().optional()
});

const editLeadSchema = Joi.object({
  project: Joi.string().hex().length(24).optional(),
  channelPartner: Joi.string().hex().length(24).optional(),
  leadSource: Joi.string().hex().length(24).optional(),
  customData: Joi.object().optional()
});

const changeStatusSchema = Joi.object({
  newStatus: Joi.string().hex().length(24).required(),
  newData: Joi.object().optional()
});

const bulkTransferLeadsSchema = Joi.object({
  fromUser: Joi.string().hex().length(24).required(),
  toUser: Joi.string().hex().length(24).required(),
  leadIds: Joi.array().items(Joi.string().hex().length(24)).required(),
  projectId: Joi.string().hex().length(24).optional()
});

const createLead = async (req, res) => {
  const { error } = createLeadSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const lead = new Lead({
      user: req.body.userId,
      project: req.body.project,
      channelPartner: req.body.channelPartner,
      leadSource: req.body.leadSource,
      currentStatus: req.body.currentStatus,
      customData: req.body.customData || {}
    });
    await lead.save();

    await logLeadActivity(lead._id, req.user._id, 'created', { data: req.body });
    // await sendNotification(lead.user, 'in-app', `New lead assigned: ${lead._id}`, { type: 'lead', id: lead._id });

    const leadScore = new LeadScore({ lead: lead._id, rules: [] });
    await leadScore.save();

    res.status(201).json(lead);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLeads = async (req, res) => {
  try {
    const query = {};
    if (req.query.userId) query.user = req.query.userId;
    if (req.query.projectId) query.project = req.query.projectId;
    if (req.query.statusId) query.currentStatus = req.query.statusId;

    const leads = await Lead.find(query)
      .populate('user', 'name email')
      .populate('project', 'name')
      .populate('channelPartner', 'name')
      .populate('leadSource', 'name')
      .populate('currentStatus', 'name formFields is_final_status');
    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const editLead = async (req, res) => {
  const { id } = req.params;
  const { error } = editLeadSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const lead = await Lead.findById(id).populate('currentStatus');
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const role = await mongoose.model('Role').findById(req.user.roleRef);
    if (lead.currentStatus.is_final_status && (!role || role.name.toLowerCase() !== 'superadmin')) {
      return res.status(403).json({ message: 'Only superadmin can edit a lead with final status' });
    }

    const oldData = { ...lead.toObject() };
    Object.assign(lead, req.body);
    await lead.save({ context: { userId: req.user } });

    await logLeadActivity(lead._id, req.user._id, 'updated', { oldData, newData: req.body });
    // await sendNotification(lead.user, 'in-app', `Lead ${lead._id} updated`, { type: 'lead', id: lead._id });

    res.json(lead);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteLead = async (req, res) => {
  const { id } = req.params;
  try {
    const lead = await Lead.findById(id).populate('currentStatus');
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const role = await mongoose.model('Role').findById(req.user.roleRef);
    if (lead.currentStatus.is_final_status && (!role || role.name.toLowerCase() !== 'superadmin')) {
      return res.status(403).json({ message: 'Only superadmin can delete a lead with final status' });
    }

    await logLeadActivity(lead._id, req.user._id, 'deleted', { data: lead.toObject() });
    // await sendNotification(lead.user, 'in-app', `Lead ${lead._id} deleted`, { type: 'lead', id: lead._id });
    await lead.deleteOne();

    res.json({ message: 'Lead deleted' });
  } catch (err) {
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

    await lead.changeStatus(req.body.newStatus, req.body.newData || {}, req.user);
    // await sendNotification(lead.user, 'in-app', `Lead ${lead._id} status changed`, { type: 'lead', id: lead._id });

    res.json(lead);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const bulkTransferLeads = async (req, res) => {
  const { error } = bulkTransferLeadsSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { fromUser, toUser, leadIds, projectId } = req.body;
  if (fromUser === toUser) return res.status(400).json({ message: 'Cannot transfer to the same user' });

  const query = { _id: { $in: leadIds }, user: fromUser };
  if (projectId) query.project = projectId;

  try {
    const leads = await Lead.find(query).populate('currentStatus');
    if (leads.length === 0) return res.status(404).json({ message: 'No matching leads found' });

    const role = await mongoose.model('Role').findById(req.user.roleRef);
    for (const lead of leads) {
      if (lead.currentStatus.is_final_status && (!role || role.name.toLowerCase() !== 'superadmin')) {
        return res.status(403).json({ message: `Only superadmin can transfer lead ${lead._id} with final status` });
      }
    }

    const result = await Lead.updateMany(query, { $set: { user: toUser } });
    for (const lead of leads) {
      await logLeadActivity(lead._id, req.user._id, 'transferred', { fromUser, toUser, projectId });
      // await sendNotification(toUser, 'in-app', `Lead ${lead._id} transferred to you`, { type: 'lead', id: lead._id });
    }

    res.json({ message: 'Leads transferred', modifiedCount: result.modifiedCount });
  } catch (err) {
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
          const leads = await Lead.insertMany(results.map(row => ({
            user: row.userId,
            project: row.projectId || undefined,
            channelPartner: row.channelPartnerId || undefined,
            leadSource: row.leadSourceId,
            currentStatus: row.currentStatusId,
            customData: row.customData ? JSON.parse(row.customData) : {}
          })));
          for (const lead of leads) {
            await logLeadActivity(lead._id, req.user._id, 'created', { data: lead.toObject() });
            // await sendNotification(lead.user, 'in-app', `New lead assigned: ${lead._id}`, { type: 'lead', id: lead._id });
            const leadScore = new LeadScore({ lead: lead._id, rules: [] });
            await leadScore.save();
          }
          fs.unlinkSync(req.file.path);
          res.json({ message: 'Bulk upload successful', count: leads.length });
        } catch (err) {
          res.status(400).json({ message: err.message });
        }
      });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bulkDeleteLeads = async (req, res) => {
  const { query } = req.body;
  try {
    const leads = await Lead.find(query).populate('currentStatus');
    const role = await mongoose.model('Role').findById(req.user.roleRef);
    for (const lead of leads) {
      if (lead.currentStatus.is_final_status && (!role || role.name.toLowerCase() !== 'superadmin')) {
        return res.status(403).json({ message: `Only superadmin can delete lead ${lead._id} with final status` });
      }
    }

    for (const lead of leads) {
      await logLeadActivity(lead._id, req.user._id, 'deleted', { data: lead.toObject() });
      // await sendNotification(lead.user, 'in-app', `Lead ${lead._id} deleted`, { type: 'lead', id: lead._id });
    }
    const result = await Lead.deleteMany(query);
    res.json({ message: 'Bulk delete successful', deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createLead,
  getLeads,
  editLead,
  deleteLead,
  changeLeadStatus,
  bulkUploadLeads: require('multer')({ dest: 'uploads/' }).single('file'),
  bulkTransferLeads,
  bulkDeleteLeads
};