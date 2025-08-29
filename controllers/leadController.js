const Lead = require('../models/Lead');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });

// CRUD
const createLead = async (req, res) => {
   try {
    const lead = new Lead(req.body);
    // Validate customData against initial status form
    await lead.save();
    res.status(201).json(lead);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getLeads = async (req, res) => {
  try {
    const { projectId } = req.query;
    let query = {};
    
    if (projectId) {
      query.project = projectId;
    }
    
    const leads = await Lead.find(query).populate('user project channelPartner leadSource currentStatus');
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).populate('user project channelPartner leadSource currentStatus');
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    res.json(lead);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Change status
const changeLeadStatus = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    
    await lead.changeStatus(req.body.newStatus, req.body.newData);
    res.json(lead);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Bulk upload
const bulkUploadLeads = async (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        const leads = await Lead.insertMany(results.map(row => ({
          // Map CSV columns to lead fields, parse customData if JSON
          user: row.userId,
          // etc.
        })));
        fs.unlinkSync(req.file.path);
        res.json({ message: 'Bulk upload successful', count: leads.length });
      } catch (err) {
        res.status(400).json({ message: err.message });
      }
    });
};

// Bulk transfer
const transferLeads = async (req, res) => {
  try {
    const { fromUser, toUser, leadIds } = req.body;
    // Check hierarchy or permission
    const result = await Lead.updateMany(
      { _id: { $in: leadIds }, user: fromUser },
      { $set: { user: toUser } }
    );
    res.json({ message: 'Leads transferred', count: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update lead
const updateLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true }
    ).populate('user project channelPartner leadSource currentStatus');
    
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    
    res.json(lead);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete lead
const deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { 
  createLead, 
  getLeads, 
  getLeadById,
  changeLeadStatus, 
  bulkUploadLeads: upload.single('file'), 
  transferLeads,
  updateLead,
  deleteLead
};