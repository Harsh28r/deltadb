const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  channelPartner: { type: mongoose.Schema.Types.ObjectId, ref: 'ChannelPartner', default: null },
  leadSource: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadSource', required: true },
  currentStatus: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadStatus', required: true },
  customData: { type: mongoose.Schema.Types.Mixed, default: {} },
  cpSourcingId: { type: mongoose.Schema.Types.ObjectId, ref: 'CPSourcing', default: null },
  followUpDate: { type: Date, default: null },
  reminderDate: { type: Date, default: null },
  statusHistory: [{
    status: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadStatus' },
    data: { type: mongoose.Schema.Types.Mixed },
    changedAt: { type: Date, default: Date.now }
  }],
  isActive: { type: Boolean, default: true }, // Default to false
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Indexes for performance
leadSchema.index({ user: 1, createdAt: -1 });
leadSchema.index({ project: 1 });
leadSchema.index({ currentStatus: 1 });
leadSchema.index({ channelPartner: 1 });
leadSchema.index({ cpSourcingId: 1, createdAt: -1 });

// Update timestamp and set createdBy/updatedBy
leadSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Update CPSourcing isActive on lead creation
leadSchema.post('save', async function (doc, next) {
  try {
    if (this.isNew && this.cpSourcingId) {
      const CPSourcing = mongoose.model('CPSourcing');
      await CPSourcing.updateIsActiveOnLeadCreation(this.cpSourcingId, this.createdBy);
    }
    next();
  } catch (error) {
    console.error('Lead post save - Error:', error.message);
    next(error);
  }
});

// Method to change status and add data
leadSchema.methods.changeStatus = async function (newStatusId, newData, user) {
  try {
    const LeadStatus = mongoose.model('LeadStatus');
    const Role = mongoose.model('Role');

    // Validate new status
    const newStatus = await LeadStatus.findById(newStatusId).lean();
    if (!newStatus) throw new Error('Invalid status');

    // Check if current status is final
    const currentStatus = await LeadStatus.findById(this.currentStatus).lean();
    if (currentStatus?.is_final_status) {
      const role = await Role.findById(user.roleRef).lean();
      if (!role || role.name !== 'superadmin') {
        throw new Error('Only superadmin can change status of a lead with final status');
      }
    }

    // Validate newData against status.formFields
    for (const field of newStatus.formFields || []) {
      if (field.required && !newData[field.name]) {
        throw new Error(`Field ${field.name} is required`);
      }
    }

    // Update status history and lead data
    this.statusHistory.push({
      status: this.currentStatus,
      data: this.customData,
      changedAt: new Date()
    });
    this.currentStatus = newStatusId;
    this.customData = newData;
    this.updatedBy = user._id;
    await this.save();

    // Log activity (non-blocking)
    const { logLeadActivity } = require('../controllers/leadActivityController');
    logLeadActivity(this._id, user._id, 'status_changed', {
      oldStatus: this.statusHistory[this.statusHistory.length - 1].status,
      newStatus: newStatusId,
      oldData: this.statusHistory[this.statusHistory.length - 1].data,
      newData
    }).catch(err => console.error('Activity log error:', err));

    // Send notification (non-blocking)
    if (global.notificationService) {
      setImmediate(() => {
        global.notificationService.sendLeadStatusNotification(
          this,
          currentStatus,
          newStatus,
          user._id
        ).catch(err => console.error('Notification error:', err));
      });
    }

    // Auto-create reminders for date/datetime fields in the status (BLOCKING for debugging)
    console.log('🔔 Attempting to create reminders for status:', newStatus.name);
    console.log('🔔 Status fields:', JSON.stringify(newStatus.formFields));
    console.log('🔔 Form data received:', JSON.stringify(newData));
    try {
      await this.createRemindersFromStatusFields(newStatus, newData, user._id);
      console.log('🔔 Reminder creation completed successfully');
    } catch (err) {
      console.error('🔔 Reminder creation error:', err);
    }

    return this;
  } catch (error) {
    console.error('Lead changeStatus - Error:', error.message);
    throw error;
  }
};

// Method to auto-create reminders from status form fields
leadSchema.methods.createRemindersFromStatusFields = async function (status, formData, user) {
  try {
    // Safety checks
    if (!status || !formData || !user) {
      console.log('⚠️ Skipping reminder creation - missing required parameters');
      return;
    }

    const userId = typeof user === 'string' ? user : user._id;

    const Reminder = mongoose.model('Reminder');
    const { formatDateTime } = require('../utils/dateFormatter');

    // Find all date/datetime fields in the status
    console.log('🔍 Checking form fields:', JSON.stringify(status.formFields, null, 2));

    // Function to check if a field name suggests it's a date field
    const isDateFieldName = (name) => {
      const lowerName = name.toLowerCase();
      return lowerName.includes('date') ||
             lowerName.includes('time') ||
             lowerName.includes('meeting') ||
             lowerName.includes('visit') ||
             lowerName.includes('schedule') ||
             lowerName.includes('follow') ||
             lowerName.includes('appointment');
    };

    // Function to check if a value looks like a date
    const isDateValue = (value) => {
      if (!value) return false;

      // Convert to string if it's not already
      const strValue = String(value);

      // Check if it's a valid date string (various formats)
      const dateRegex = /^\d{4}-\d{2}-\d{2}|^\d{2}\/\d{2}\/\d{4}|^\d{2}-\d{2}-\d{4}|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
      if (dateRegex.test(strValue)) return true;

      // Check if it can be parsed as a date
      const parsed = new Date(value);
      return !isNaN(parsed.getTime()) && parsed.getTime() > 0;
    };

    // Find date fields by type OR by name pattern
    const dateFields = (status.formFields || []).filter(field => {
      const fieldType = field.type?.toLowerCase();
      const isDateType = ['date', 'datetime', 'datetime-local', 'time'].includes(fieldType);
      const hasDateName = isDateFieldName(field.name);

      console.log(`  Field "${field.name}" - type: "${fieldType}", hasDateName: ${hasDateName}, isDateType: ${isDateType}`);

      return isDateType || hasDateName;
    });

    console.log('📅 Found potential date fields:', dateFields.map(f => `${f.name} (${f.type})`).join(', '));

    if (dateFields.length === 0) {
      console.log('⚠️ No date fields found in status, skipping reminder creation');
      return;
    }

    const remindersToCreate = [];

    console.log('📦 Form data keys:', Object.keys(formData).join(', '));

    for (const field of dateFields) {
      const fieldValue = formData[field.name];

      console.log(`  📌 Processing field "${field.name}": value = "${fieldValue}"`);
      console.log(`     Looking for key "${field.name}" in formData:`, formData.hasOwnProperty(field.name));

      if (!fieldValue) {
        console.log(`    ⏭️ Skipping - no value provided for "${field.name}"`);
        continue;
      }

      // Validate if the value is actually a date
      if (!isDateValue(fieldValue)) {
        console.log(`    ⏭️ Skipping - value "${fieldValue}" doesn't look like a date`);
        continue;
      }

      let reminderDateTime;

      // Parse the date/datetime value
      const fieldType = field.type?.toLowerCase() || '';

      if (fieldType === 'time') {
        // If it's just time, use today's date with that time
        const today = new Date();
        const [hours, minutes] = fieldValue.split(':');
        today.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        reminderDateTime = today;
      } else {
        // Try to parse as date or datetime
        reminderDateTime = new Date(fieldValue);

        // If no time specified (date only), set to 9 AM
        if (fieldType === 'date' || String(fieldValue).match(/^\d{4}-\d{2}-\d{2}$/)) {
          reminderDateTime.setHours(9, 0, 0, 0);
        }

        // For datetime-local, the value is already in correct format
        // Just ensure it's parsed correctly
        if (fieldType === 'datetime-local' || fieldType === 'datetime') {
          console.log(`    ✅ Parsed datetime: ${reminderDateTime.toISOString()}`);
        }
      }

      // Validate the parsed date
      if (isNaN(reminderDateTime.getTime())) {
        console.log(`    ⏭️ Skipping - could not parse "${fieldValue}" as valid date`);
        continue;
      }

      // Only create reminder if the date is in the future
      const now = new Date();
      if (reminderDateTime && reminderDateTime > now) {
        const reminderData = {
          title: `${status.name} Follow-up: ${field.name}`,
          description: `Follow-up for lead regarding ${field.name} scheduled on ${formatDateTime(reminderDateTime)}`,
          dateTime: reminderDateTime,
          relatedType: 'lead',
          relatedId: this._id,
          relatedModel: 'Lead', // Required field for refPath
          userId: this.user, // Assigned user for the lead
          status: 'pending',
          createdBy: userId,
          updatedBy: userId
        };

        console.log(`    ✅ Adding reminder for "${field.name}" at ${reminderDateTime.toISOString()}`);
        remindersToCreate.push(reminderData);
      } else if (reminderDateTime) {
        console.log(`    ⏭️ Skipping - date ${reminderDateTime.toISOString()} is in the past (now: ${now.toISOString()})`);
      }
    }

    // Check for existing reminders and create/update accordingly
    if (remindersToCreate.length > 0) {
      const createdReminders = [];
      const updatedReminders = [];

      for (const reminderData of remindersToCreate) {
        // Check if a similar reminder already exists for this lead
        // A "similar" reminder is one with the same lead, user, and date field (based on title)
        const existingReminder = await Reminder.findOne({
          relatedId: this._id,
          relatedType: 'lead',
          userId: this.user,
          title: reminderData.title,
          status: 'pending' // Only check pending reminders
        });

        if (existingReminder) {
          // Update existing reminder if the date is different
          if (existingReminder.dateTime.getTime() !== reminderData.dateTime.getTime()) {
            existingReminder.dateTime = reminderData.dateTime;
            existingReminder.description = reminderData.description;
            existingReminder.updatedBy = userId;
            await existingReminder.save();
            updatedReminders.push(existingReminder);
            console.log(`    🔄 Updated existing reminder "${reminderData.title}" - new date: ${reminderData.dateTime.toISOString()}`);
          } else {
            console.log(`    ⏭️ Skipping duplicate reminder "${reminderData.title}" - already exists with same date`);
          }
        } else {
          // Create new reminder
          const newReminder = await Reminder.create(reminderData);
          createdReminders.push(newReminder);
          console.log(`    ✅ Created new reminder "${reminderData.title}" at ${reminderData.dateTime.toISOString()}`);
        }
      }

      if (createdReminders.length > 0) {
        console.log(`✅ Created ${createdReminders.length} new auto-reminders for lead ${this._id}`);
      }
      if (updatedReminders.length > 0) {
        console.log(`🔄 Updated ${updatedReminders.length} existing reminders for lead ${this._id}`);
      }
    } else {
      console.log('⚠️ No reminders created - no valid date fields found');
    }

  } catch (error) {
    console.error('Lead createRemindersFromStatusFields - Error:', error.message);
    // Don't throw - reminder creation failure shouldn't block status change
  }
};

// Validate edits for final status
leadSchema.pre('findOneAndUpdate', async function (next) {
  try {
    const lead = await mongoose.model('Lead').findById(this.getQuery()._id).lean();
    if (!lead) throw new Error('Lead not found');

    const userId = this.options.context?.userId;
    if (!userId) throw new Error('User context required for update');

    // Check final status
    const currentStatus = await mongoose.model('LeadStatus').findById(lead.currentStatus).lean();
    if (currentStatus?.is_final_status) {
      const Role = mongoose.model('Role');
      const role = await Role.findById(userId.roleRef).lean();
      if (!role || role.name !== 'superadmin') {
        throw new Error('Only superadmin can edit a lead with final status');
      }
    }

    // Update user tracking
    this.set('updatedBy', userId);
    next();
  } catch (error) {
    console.error('Lead pre findOneAndUpdate - Error:', error.message);
    next(error);
  }
});

module.exports = mongoose.model('Lead', leadSchema);