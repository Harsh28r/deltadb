const LeadSource = require('../models/LeadSource');
const { logLeadActivity } = require('./leadActivityController');
// const { sendNotification } = require('./notificationController');
const Joi = require('joi');

const createLeadSourceSchema = Joi.object({
  name: Joi.string().required().min(1).max(100)
});

const updateLeadSourceSchema = Joi.object({
  name: Joi.string().required().min(1).max(100)
});

const createLeadSource = async (req, res) => {
  const { error } = createLeadSourceSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const existing = await LeadSource.findOne({ name: { $regex: `^${req.body.name}$`, $options: 'i' } });
    if (existing) return res.status(409).json({ message: 'Lead source name already exists' });

    const leadSource = new LeadSource(req.body);
    await leadSource.save();

    await logLeadActivity(null, req.user._id, 'leadsource_created', { data: req.body });
    // await sendNotification(req.user._id, 'in-app', `Lead source ${leadSource.name} created`, { type: 'leadsource', id: leadSource._id });

    res.status(201).json(leadSource);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLeadSources = async (req, res) => {
  try {
    const leadSources = await LeadSource.find().sort({ name: 1 });
    res.json(leadSources);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLeadSourceById = async (req, res) => {
  try {
    const leadSource = await LeadSource.findById(req.params.id);
    if (!leadSource) return res.status(404).json({ message: 'Lead Source not found' });
    res.json(leadSource);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateLeadSource = async (req, res) => {
  const { error } = updateLeadSourceSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const existing = await LeadSource.findOne({
      name: { $regex: `^${req.body.name}$`, $options: 'i' },
      _id: { $ne: req.params.id }
    });
    if (existing) return res.status(409).json({ message: 'Lead source name already exists' });

    const leadSource = await LeadSource.findById(req.params.id);
    if (!leadSource) return res.status(404).json({ message: 'Lead Source not found' });

    const oldData = { ...leadSource.toObject() };
    Object.assign(leadSource, req.body);
    await leadSource.save();

    await logLeadActivity(null, req.user._id, 'leadsource_updated', { oldData, newData: req.body });
    // await sendNotification(req.user._id, 'in-app', `Lead source ${leadSource.name} updated`, { type: 'leadsource', id: leadSource._id });

    res.json(leadSource);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteLeadSource = async (req, res) => {
  try {
    const leadSource = await LeadSource.findById(req.params.id);
    if (!leadSource) return res.status(404).json({ message: 'Lead Source not found' });
    if (leadSource.name.toLowerCase() === 'channel partner') {
      return res.status(403).json({ message: 'Cannot delete default Channel Partner source' });
    }

    await logLeadActivity(null, req.user._id, 'leadsource_deleted', { data: leadSource.toObject() });
    // await sendNotification(req.user._id, 'in-app', `Lead source ${leadSource.name} deleted`, { type: 'leadsource', id: leadSource._id });
    await leadSource.deleteOne();

    res.json({ message: 'Lead Source deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createLeadSource, getLeadSources, getLeadSourceById, updateLeadSource, deleteLeadSource };