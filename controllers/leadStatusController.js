const LeadStatus = require('../models/LeadStatus');
const { logLeadActivity } = require('./leadActivityController');
// const { sendNotification } = require('./notificationController');
const Joi = require('joi');

const createLeadStatusSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  formFields: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      type: Joi.string().required(),
      required: Joi.boolean().default(false),
      options: Joi.array().items(Joi.string()).optional()
    })
  ).optional(),
  is_final_status: Joi.boolean().default(false)
});

const updateLeadStatusSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  formFields: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      type: Joi.string().required(),
      required: Joi.boolean().default(false),
      options: Joi.array().items(Joi.string()).optional()
    })
  ).optional(),
  is_final_status: Joi.boolean().optional()
});

const createLeadStatus = async (req, res) => {
  const { error } = createLeadStatusSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const existing = await LeadStatus.findOne({ name: { $regex: `^${req.body.name}$`, $options: 'i' } });
    if (existing) return res.status(409).json({ message: 'Lead status name already exists' });

    const leadStatus = new LeadStatus(req.body);
    await leadStatus.save();

    await logLeadActivity(null, req.user._id, 'leadstatus_created', { data: req.body });
    // await sendNotification(req.user._id, 'in-app', `Lead status ${leadStatus.name} created`, { type: 'leadstatus', id: leadStatus._id });

    res.status(201).json(leadStatus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLeadStatus = async (req, res) => {
  try {
    const leadStatuses = await LeadStatus.find().sort({ name: 1 });
    res.json(leadStatuses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLeadStatusById = async (req, res) => {
  try {
    const leadStatus = await LeadStatus.findById(req.params.id);
    if (!leadStatus) return res.status(404).json({ message: 'Lead Status not found' });
    res.json(leadStatus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateLeadStatus = async (req, res) => {
  const { error } = updateLeadStatusSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const existing = await LeadStatus.findOne({
      name: { $regex: `^${req.body.name}$`, $options: 'i' },
      _id: { $ne: req.params.id }
    });
    if (existing) return res.status(409).json({ message: 'Lead status name already exists' });

    const leadStatus = await LeadStatus.findById(req.params.id);
    if (!leadStatus) return res.status(404).json({ message: 'Lead Status not found' });

    const oldData = { ...leadStatus.toObject() };
    Object.assign(leadStatus, req.body);
    await leadStatus.save();

    await logLeadActivity(null, req.user._id, 'leadstatus_updated', { oldData, newData: req.body });
    // await sendNotification(req.user._id, 'in-app', `Lead status ${leadStatus.name} updated`, { type: 'leadstatus', id: leadStatus._id });

    res.json(leadStatus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteLeadStatus = async (req, res) => {
  try {
    const leadStatus = await LeadStatus.findById(req.params.id);
    if (!leadStatus) return res.status(404).json({ message: 'Lead Status not found' });
    if (leadStatus.is_final_status) {
      return res.status(403).json({ message: 'Cannot delete final status' });
    }

    await logLeadActivity(null, req.user._id, 'leadstatus_deleted', { data: leadStatus.toObject() });
    // await sendNotification(req.user._id, 'in-app', `Lead status ${leadStatus.name} deleted`, { type: 'leadstatus', id: leadStatus._id });
    await leadStatus.deleteOne();

    res.json({ message: 'Lead Status deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createLeadStatus, getLeadStatus, getLeadStatusById, updateLeadStatus, deleteLeadStatus };