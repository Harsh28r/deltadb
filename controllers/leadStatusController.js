const LeadStatus = require('../models/LeadStatus');

// CRUD, with dynamic formFields
const createLeadStatus = async (req, res) => {
  const leadStatus = new LeadStatus(req.body);
  await leadStatus.save();
  res.status(201).json(leadStatus);
};

const getLeadStatus = async (req, res) => {
    const leadStatuses = await LeadStatus.find();
    res.json(leadStatuses);
  };

const getLeadStatusById = async (req, res) => {
    const leadStatus = await LeadStatus.findById(req.params.id);
    if (!leadStatus) return res.status(404).json({ message: 'Lead Status not found' });
    res.json(leadStatus);
};

const updateLeadStatus = async (req, res) => {
    const leadStatus = await LeadStatus.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!leadStatus) return res.status(404).json({ message: 'Lead Status not found' });
    res.json(leadStatus);
};

const deleteLeadStatus = async (req, res) => {
    const leadStatus = await LeadStatus.findByIdAndDelete(req.params.id);
    if (!leadStatus) return res.status(404).json({ message: 'Lead Status not found' });
    res.json({ message: 'Lead Status deleted' });
};

module.exports = { createLeadStatus, getLeadStatus, getLeadStatusById, updateLeadStatus, deleteLeadStatus};