const LeadActivity = require('../models/LeadActivity');
const mongoose = require('mongoose');

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
    const query = leadId ? { lead: leadId } : {};
    let activities = await LeadActivity.find(query)
      .sort({ timestamp: -1 })
      .populate('user', 'name email')
      .populate('lead', 'currentStatus');

    // Populate foreign keys in details
    activities = await Promise.all(activities.map(async (activity) => {
      const populatedDetails = { ...activity.details };

      // Populate user IDs (e.g., fromUser, toUser in transfer actions)
      if (populatedDetails.fromUser) {
        const fromUser = await mongoose.model('User').findById(populatedDetails.fromUser, 'name email');
        populatedDetails.fromUser = fromUser ? { id: fromUser._id, name: fromUser.name, email: fromUser.email } : null;
      }
      if (populatedDetails.toUser) {
        const toUser = await mongoose.model('User').findById(populatedDetails.toUser, 'name email');
        populatedDetails.toUser = toUser ? { id: toUser._id, name: toUser.name, email: toUser.email } : null;
      }

      // Populate project IDs (e.g., oldProject, newProject in transfer actions)
      if (populatedDetails.oldProject) {
        const oldProject = await mongoose.model('Project').findById(populatedDetails.oldProject, 'name');
        populatedDetails.oldProject = oldProject ? { id: oldProject._id, name: oldProject.name } : null;
      }
      if (populatedDetails.newProject) {
        const newProject = await mongoose.model('Project').findById(populatedDetails.newProject, 'name');
        populatedDetails.newProject = newProject ? { id: newProject._id, name: newProject.name } : null;
      }

      return {
        ...activity.toObject(),
        details: populatedDetails
      };
    }));

    res.json(activities);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLeadHistory = async (req, res) => {
  const { leadId } = req.params;
  try {
    const query = leadId ? { lead: leadId } : {};
    let activities = await LeadActivity.find(query)
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

    // Populate foreign keys in details
    activities = await Promise.all(activities.map(async (activity) => {
      const populatedDetails = { ...activity.details };

      // Populate user IDs
      if (populatedDetails.fromUser) {
        const fromUser = await mongoose.model('User').findById(populatedDetails.fromUser, 'name email');
        populatedDetails.fromUser = fromUser ? { id: fromUser._id, name: fromUser.name, email: fromUser.email } : null;
      }
      if (populatedDetails.toUser) {
        const toUser = await mongoose.model('User').findById(populatedDetails.toUser, 'name email');
        populatedDetails.toUser = toUser ? { id: toUser._id, name: toUser.name, email: toUser.email } : null;
      }

      // Populate project IDs
      if (populatedDetails.oldProject) {
        const oldProject = await mongoose.model('Project').findById(populatedDetails.oldProject, 'name');
        populatedDetails.oldProject = oldProject ? { id: oldProject._id, name: oldProject.name } : null;
      }
      if (populatedDetails.newProject) {
        const newProject = await mongoose.model('Project').findById(populatedDetails.newProject, 'name');
        populatedDetails.newProject = newProject ? { id: newProject._id, name: newProject.name } : null;
      }

      return {
        ...activity.toObject(),
        details: populatedDetails
      };
    }));

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