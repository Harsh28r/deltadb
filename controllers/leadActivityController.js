const LeadActivity = require('../models/LeadActivity');

const logLeadActivity = async (leadId, userId, action, details) => {
  try {
    const activity = new LeadActivity({ lead: leadId, user: userId, action, details });
    await activity.save();
  } catch (err) {
    console.error('Error logging lead activity:', err.message);
  }
};

const getLeadActivities = async (req, res) => {
  const { leadId } = req.params;
  try {
    const activities = await LeadActivity.find({ lead: leadId })
      .sort({ timestamp: -1 })
      .populate('user', 'name email')
      .populate('lead', 'currentStatus');
    res.json(activities);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLeadHistory = async (req, res) => {
  const { leadId } = req.params;
  try {
    const activities = await LeadActivity.find({ lead: leadId })
      .sort({ timestamp: -1 })
      .populate('user', 'name email')
      .populate({
        path: 'lead',
        populate: [
          { path: 'currentStatus', select: 'name formFields is_final_status' },
          { path: 'project', select: 'name' },
          { path: 'channelPartner', select: 'name' },
          { path: 'leadSource', select: 'name' }
        ]
      });
    res.json(activities);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bulkUpdateLeadActivities = async (req, res) => {
  const { query, update } = req.body;
  try {
    const result = await LeadActivity.updateMany(query, update);
    res.json({ message: 'Bulk update successful', modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bulkDeleteLeadActivities = async (req, res) => {
  const { query } = req.body;
  try {
    const result = await LeadActivity.deleteMany(query);
    res.json({ message: 'Bulk delete successful', deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { logLeadActivity, getLeadActivities, getLeadHistory, bulkUpdateLeadActivities, bulkDeleteLeadActivities };