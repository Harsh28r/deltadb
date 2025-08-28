const LeadSource = require('../models/LeadSource');

// CRUD similar to above
const createLeadSource = async (req, res) => {
  const leadSource = new LeadSource(req.body);
  await leadSource.save();
  res.status(201).json(leadSource);
};

// Others...

const getLeadSources = async (req, res) => {
  const leadSources = await LeadSource.find();
  res.json(leadSources);
};

const getLeadSourcesById = async (req, res) => {
    const leadSource = await LeadSource.findById(req.params.id);
    if (!leadSource) return res.status(404).json({ message: 'Lead Source not found' });
    res.json(leadSource);
};

const updateLeadSource = async (req, res) => {
    const leadSource = await LeadSource.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!leadSource) return res.status(404).json({ message: 'Lead Source not found' });
    res.json(leadSource);
};

const deleteLeadSource = async (req, res) => {
    const leadSource = await LeadSource.findByIdAndDelete(req.params.id);
    if (!leadSource) return res.status(404).json({ message: 'Lead Source not found' });
    res.json({ message: 'Lead Source deleted' });
};

module.exports = { createLeadSource, getLeadSources, getLeadSourcesById, updateLeadSource, deleteLeadSource };