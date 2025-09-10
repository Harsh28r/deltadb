const LeadStatus = require('../models/LeadStatus');
const { logLeadActivity } = require('./leadActivityController');
// const { sendNotification } = require('./notificationController');
const Joi = require('joi');
const mongoose = require('mongoose');

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
  is_final_status: Joi.boolean().default(false),
  is_default_status: Joi.boolean().default(false)
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
  is_final_status: Joi.boolean().optional(),
  is_default_status: Joi.boolean().default(false)
});

const idSchema = Joi.string().hex().length(24).required();

const createLeadStatus = async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ message: 'Request body is missing' });
  }

  const { error } = createLeadStatusSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    console.log('createLeadStatus - req.body:', JSON.stringify(req.body));
    console.log('createLeadStatus - req.user:', JSON.stringify(req.user));
    // Check for duplicate name
    const existing = await LeadStatus.findOne({ name: { $regex: `^${req.body.name}$`, $options: 'i' } });
    if (existing) return res.status(409).json({ message: 'Lead status name already exists' });

    // Check for unique default status
    if (req.body.is_default_status) {
      const existingDefault = await LeadStatus.findOne({ is_default_status: true });
      if (existingDefault) return res.status(409).json({ message: 'Another default status already exists' });
    }

    // Check formFields uniqueness
    const formFieldNames = req.body.formFields?.map(field => field.name) || [];
    if (new Set(formFieldNames).size !== formFieldNames.length) {
      return res.status(400).json({ message: 'Form field names must be unique' });
    }

    const leadStatus = new LeadStatus(req.body);
    await leadStatus.save();

    if (!req.user?._id) {
      console.warn('createLeadStatus - No user ID, skipping activity logging');
    } else {
      await logLeadActivity(null, req.user._id, 'leadstatus_created', { data: leadStatus.toObject() });
    }

    res.status(201).json(leadStatus.toObject());
  } catch (err) {
    console.error('createLeadStatus - Error:', err);
    res.status(500).json({ message: err.message });
  }
};

const getLeadStatus = async (req, res) => {
  try {
    const leadStatuses = await LeadStatus.find().sort({ name: 1 });
    res.json(leadStatuses.map(status => status.toObject()));
  } catch (err) {
    console.error('getLeadStatus - Error:', err);
    res.status(500).json({ message: err.message });
  }
};

const getLeadStatusById = async (req, res) => {
  const { error } = idSchema.validate(req.params.id);
  if (error) return res.status(400).json({ message: 'Invalid ID format' });

  try {
    const leadStatus = await LeadStatus.findById(req.params.id);
    if (!leadStatus) return res.status(404).json({ message: 'Lead Status not found' });
    res.json(leadStatus.toObject());
  } catch (err) {
    console.error('getLeadStatusById - Error:', err);
    res.status(500).json({ message: err.message });
  }
};

const updateLeadStatus = async (req, res) => {
  const { error: idError } = idSchema.validate(req.params.id);
  if (idError) return res.status(400).json({ message: 'Invalid ID format' });

  if (!req.body) {
    return res.status(400).json({ message: 'Request body is missing' });
  }

  const { error } = updateLeadStatusSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    console.log('updateLeadStatus - req.body:', JSON.stringify(req.body));
    console.log('updateLeadStatus - req.user:', JSON.stringify(req.user));
    console.log('updateLeadStatus - params.id:', req.params.id);

    // Validate req.user
    if (!req.user?._id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Check for duplicate name only if name is provided
    if (req.body.name) {
      const existing = await LeadStatus.findOne({
        name: { $regex: `^${req.body.name}$`, $options: 'i' },
        _id: { $ne: req.params.id }
      });
      if (existing) return res.status(409).json({ message: 'Lead status name already exists' });
    }

    // Check for unique default status
    if (req.body.is_default_status) {
      const existingDefault = await LeadStatus.findOne({ is_default_status: true, _id: { $ne: req.params.id } });
      if (existingDefault) return res.status(409).json({ message: 'Another default status already exists' });
    }

    // Check formFields uniqueness
    const formFieldNames = req.body.formFields?.map(field => field.name) || [];
    if (new Set(formFieldNames).size !== formFieldNames.length) {
      return res.status(400).json({ message: 'Form field names must be unique' });
    }

    // Prevent is_final_status change if used by leads
    if (req.body.is_final_status !== undefined) {
      const leadCount = await mongoose.model('Lead').countDocuments({ currentStatus: req.params.id });
      if (leadCount > 0) {
        return res.status(403).json({ message: 'Cannot change is_final_status for status used by leads' });
      }
    }

    const leadStatus = await LeadStatus.findById(req.params.id);
    if (!leadStatus) return res.status(404).json({ message: 'Lead Status not found' });

    console.log('updateLeadStatus - leadStatus before update:', JSON.stringify(leadStatus.toObject()));

    const oldData = { ...leadStatus.toObject() };
    Object.assign(leadStatus, req.body);
    await leadStatus.save();

    console.log('updateLeadStatus - leadStatus after update:', JSON.stringify(leadStatus.toObject()));

    await logLeadActivity(null, req.user._id, 'leadstatus_updated', { 
      oldData, 
      newData: { ...req.body } 
    });

    res.json(leadStatus.toObject());
  } catch (err) {
    console.error('updateLeadStatus - Error:', err);
    res.status(500).json({ message: err.message });
  }
};

const deleteLeadStatus = async (req, res) => {
  const { error } = idSchema.validate(req.params.id);
  if (error) return res.status(400).json({ message: 'Invalid ID format' });

  try {
    console.log('deleteLeadStatus - req.user:', JSON.stringify(req.user));
    const leadStatus = await LeadStatus.findById(req.params.id);
    if (!leadStatus) return res.status(404).json({ message: 'Lead Status not found' });

    if (leadStatus.is_final_status) {
      return res.status(403).json({ message: 'Cannot delete final status' });
    }
    if (leadStatus.is_default_status) {
      return res.status(403).json({ message: 'Cannot delete default status' });
    }

    const leadCount = await mongoose.model('Lead').countDocuments({ currentStatus: req.params.id });
    if (leadCount > 0) {
      return res.status(403).json({ message: 'Cannot delete status used by leads' });
    }

    if (!req.user?._id) {
      console.warn('deleteLeadStatus - No user ID, skipping activity logging');
    } else {
      await logLeadActivity(null, req.user._id, 'leadstatus_deleted', { data: leadStatus.toObject() });
    }

    await leadStatus.deleteOne();

    res.json({ message: 'Lead Status deleted' });
  } catch (err) {
    console.error('deleteLeadStatus - Error:', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createLeadStatus, getLeadStatus, getLeadStatusById, updateLeadStatus, deleteLeadStatus };