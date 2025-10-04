const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Reminder = require('../models/Reminder');
const Lead = require('../models/Lead');

// Test endpoint to manually create a reminder
router.post('/create-test-reminder', auth, async (req, res) => {
  try {
    const { leadId } = req.body;

    if (!leadId) {
      return res.status(400).json({ message: 'leadId is required' });
    }

    const lead = await Lead.findById(leadId)
      .populate('currentStatus')
      .populate('user');

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Create a test reminder
    const reminder = new Reminder({
      title: 'Test Follow-up Reminder',
      description: 'This is a test reminder created manually',
      dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      relatedType: 'lead',
      relatedId: lead._id,
      userId: lead.user._id,
      status: 'pending',
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await reminder.save();

    res.json({
      message: 'Test reminder created successfully',
      reminder,
      lead: {
        id: lead._id,
        status: lead.currentStatus?.name,
        customData: lead.customData
      }
    });

  } catch (err) {
    console.error('Test create reminder error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Check if reminders exist
router.get('/check-reminders', auth, async (req, res) => {
  try {
    const count = await Reminder.countDocuments({});
    const leadReminders = await Reminder.countDocuments({ relatedType: 'lead' });

    const sampleReminders = await Reminder.find({ relatedType: 'lead' })
      .limit(5)
      .populate('userId', 'name email')
      .populate('relatedId', 'currentStatus')
      .lean();

    res.json({
      totalReminders: count,
      leadReminders,
      samples: sampleReminders
    });

  } catch (err) {
    console.error('Check reminders error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Debug lead status change
router.post('/debug-status-change', auth, async (req, res) => {
  try {
    const { leadId, statusId, customData } = req.body;

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const LeadStatus = require('../models/LeadStatus');
    const status = await LeadStatus.findById(statusId);
    if (!status) {
      return res.status(404).json({ message: 'Status not found' });
    }

    console.log('=== DEBUG STATUS CHANGE ===');
    console.log('Status:', status.name);
    console.log('Form Fields:', JSON.stringify(status.formFields, null, 2));
    console.log('Custom Data:', JSON.stringify(customData, null, 2));

    // Try to change status
    await lead.changeStatus(statusId, customData, req.user._id);

    // Check if reminders were created
    const reminders = await Reminder.find({
      relatedType: 'lead',
      relatedId: leadId
    }).lean();

    res.json({
      message: 'Status changed',
      lead,
      remindersCreated: reminders.length,
      reminders
    });

  } catch (err) {
    console.error('Debug status change error:', err);
    res.status(500).json({ message: err.message, stack: err.stack });
  }
});

module.exports = router;
