const Lead = require('../models/Lead');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });

// CRUD
const createLead = async (req, res) => {
  const lead = new Lead(req.body);
  // Validate customData against initial status form
  await lead.save();
  res.status(201).json(lead);
};

const getLeads = async (req, res) => {
  const leads = await Lead.find().populate('user project channelPartner leadSource currentStatus');
  res.json(leads);
};

// Change status
const changeLeadStatus = async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) return res.status(404).json({ message: 'Lead not found' });
  try {
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
  const { fromUser, toUser, leadIds } = req.body;
  // Check hierarchy or permission
  const result = await Lead.updateMany(
    { _id: { $in: leadIds }, user: fromUser },
    { $set: { user: toUser } }
  );
  res.json({ message: 'Leads transferred', count: result.modifiedCount });
};

// Others: getById, update, delete

module.exports = { createLead, getLeads, changeLeadStatus, bulkUploadLeads: upload.single('file'), transferLeads /* , others */ };