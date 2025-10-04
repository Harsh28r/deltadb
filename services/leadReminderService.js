const Reminder = require('../models/Reminder');
const Lead = require('../models/Lead');

class LeadReminderService {
  constructor(notificationService = null) {
    this.notificationService = notificationService;
  }

  setNotificationService(notificationService) {
    this.notificationService = notificationService;
  }

  /**
   * Create a lead follow-up reminder
   * @param {Object} lead - Lead object or lead ID
   * @param {Date} reminderDateTime - When to send reminder
   * @param {String} title - Reminder title
   * @param {String} description - Reminder description
   * @param {String} createdBy - User creating the reminder
   */
  async createLeadReminder(lead, reminderDateTime, title, description, createdBy) {
    try {
      const leadId = typeof lead === 'string' ? lead : lead._id;
      const userId = typeof lead === 'string' ? null : lead.user;

      if (!userId) {
        const leadDoc = await Lead.findById(leadId).select('user').lean();
        if (!leadDoc) throw new Error('Lead not found');
        userId = leadDoc.user;
      }

      const reminder = new Reminder({
        title,
        description,
        dateTime: new Date(reminderDateTime),
        relatedType: 'lead',
        relatedId: leadId,
        userId,
        status: 'pending',
        createdBy,
        updatedBy: createdBy
      });

      await reminder.save();

      console.log(`✅ Lead reminder created for lead ${leadId} at ${reminderDateTime}`);
      return reminder;

    } catch (error) {
      console.error('Error creating lead reminder:', error);
      throw error;
    }
  }

  /**
   * Create multiple reminders for a lead (before the scheduled date)
   * @param {Object} lead - Lead object
   * @param {Date} scheduledDate - The scheduled follow-up date
   * @param {Array} reminderOffsets - Minutes before scheduled date (e.g., [1440, 60] for 1 day and 1 hour)
   * @param {String} fieldName - Name of the field from status
   * @param {String} createdBy - User creating reminders
   */
  async createMultipleLeadReminders(lead, scheduledDate, reminderOffsets = [1440, 60], fieldName, createdBy) {
    try {
      const reminders = [];
      const dueDate = new Date(scheduledDate);

      for (const offsetMinutes of reminderOffsets) {
        const reminderDate = new Date(dueDate.getTime() - (offsetMinutes * 60 * 1000));

        // Only create reminder if it's in the future
        if (reminderDate > new Date()) {
          const timeLabel = offsetMinutes >= 1440 ?
            `${Math.floor(offsetMinutes / 1440)} day(s)` :
            offsetMinutes >= 60 ?
            `${Math.floor(offsetMinutes / 60)} hour(s)` :
            `${offsetMinutes} minute(s)`;

          const { formatDateTime } = require('../utils/dateFormatter');

          const title = `Lead Follow-up in ${timeLabel}: ${fieldName}`;
          const description = `Reminder: Lead follow-up for "${fieldName}" is scheduled in ${timeLabel} on ${formatDateTime(dueDate)}`;

          const reminder = await this.createLeadReminder(
            lead,
            reminderDate,
            title,
            description,
            createdBy
          );

          reminders.push(reminder);
        }
      }

      console.log(`✅ Created ${reminders.length} lead reminders for lead ${lead._id}`);
      return reminders;

    } catch (error) {
      console.error('Error creating multiple lead reminders:', error);
      throw error;
    }
  }

  /**
   * Get all reminders for a specific lead
   * @param {String} leadId - Lead ID
   * @param {Object} options - Query options
   */
  async getLeadReminders(leadId, options = {}) {
    try {
      const {
        status = null,
        includeCompleted = false,
        page = 1,
        limit = 20
      } = options;

      const filter = {
        relatedType: 'lead',
        relatedId: leadId
      };

      if (status) {
        filter.status = status;
      }

      if (!includeCompleted) {
        filter.status = { $ne: 'dismissed' };
      }

      const reminders = await Reminder.find(filter)
        .populate('userId', 'name email')
        .populate('relatedId', 'currentStatus customData')
        .sort({ dateTime: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const total = await Reminder.countDocuments(filter);

      return {
        reminders,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      };

    } catch (error) {
      console.error('Error getting lead reminders:', error);
      throw error;
    }
  }

  /**
   * Get upcoming lead reminders for a user
   * @param {String} userId - User ID
   * @param {Number} hours - Hours ahead to look (default 24)
   */
  async getUpcomingLeadReminders(userId, hours = 24) {
    try {
      const now = new Date();
      const futureDate = new Date(now.getTime() + (hours * 60 * 60 * 1000));

      const reminders = await Reminder.find({
        userId,
        relatedType: 'lead',
        dateTime: { $gte: now, $lte: futureDate },
        status: 'pending'
      })
      .populate('relatedId', 'currentStatus customData')
      .populate({
        path: 'relatedId',
        populate: [
          { path: 'currentStatus', select: 'name' },
          { path: 'user', select: 'name email' }
        ]
      })
      .sort({ dateTime: 1 })
      .lean();

      return reminders;

    } catch (error) {
      console.error('Error getting upcoming lead reminders:', error);
      throw error;
    }
  }

  /**
   * Update lead reminder status
   * @param {String} reminderId - Reminder ID
   * @param {String} status - New status (pending, sent, dismissed)
   * @param {String} updatedBy - User updating the reminder
   */
  async updateReminderStatus(reminderId, status, updatedBy) {
    try {
      const reminder = await Reminder.findByIdAndUpdate(
        reminderId,
        {
          status,
          updatedBy,
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      );

      if (!reminder) {
        throw new Error('Reminder not found');
      }

      console.log(`✅ Lead reminder ${reminderId} status updated to ${status}`);
      return reminder;

    } catch (error) {
      console.error('Error updating lead reminder status:', error);
      throw error;
    }
  }

  /**
   * Delete/dismiss a lead reminder
   * @param {String} reminderId - Reminder ID
   * @param {String} userId - User dismissing the reminder
   */
  async dismissReminder(reminderId, userId) {
    try {
      return await this.updateReminderStatus(reminderId, 'dismissed', userId);
    } catch (error) {
      console.error('Error dismissing lead reminder:', error);
      throw error;
    }
  }

  /**
   * Get overdue lead reminders
   * @param {String} userId - User ID (optional, if not provided gets all)
   */
  async getOverdueLeadReminders(userId = null) {
    try {
      const filter = {
        relatedType: 'lead',
        dateTime: { $lt: new Date() },
        status: 'pending'
      };

      if (userId) {
        filter.userId = userId;
      }

      const reminders = await Reminder.find(filter)
        .populate('userId', 'name email')
        .populate({
          path: 'relatedId',
          populate: [
            { path: 'currentStatus', select: 'name' },
            { path: 'user', select: 'name email' }
          ]
        })
        .sort({ dateTime: -1 })
        .lean();

      return reminders;

    } catch (error) {
      console.error('Error getting overdue lead reminders:', error);
      throw error;
    }
  }

  /**
   * Snooze a reminder (reschedule it)
   * @param {String} reminderId - Reminder ID
   * @param {Number} minutes - Minutes to snooze
   * @param {String} userId - User snoozing the reminder
   */
  async snoozeReminder(reminderId, minutes, userId) {
    try {
      const reminder = await Reminder.findById(reminderId);
      if (!reminder) throw new Error('Reminder not found');

      const newDateTime = new Date(reminder.dateTime.getTime() + (minutes * 60 * 1000));

      reminder.dateTime = newDateTime;
      reminder.status = 'pending';
      reminder.updatedBy = userId;
      await reminder.save();

      console.log(`✅ Reminder ${reminderId} snoozed for ${minutes} minutes`);
      return reminder;

    } catch (error) {
      console.error('Error snoozing reminder:', error);
      throw error;
    }
  }
}

module.exports = LeadReminderService;
