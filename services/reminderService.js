const Reminder = require('../models/Reminder');
const Task = require('../models/Task');
const cron = require('node-cron');

class ReminderService {
  constructor(notificationService = null) {
    this.notificationService = notificationService;
    this.cronJobs = new Map();
    this.isProcessingReminders = false;

    // Initialize cron jobs
    this.initializeCronJobs();
  }

  setNotificationService(notificationService) {
    this.notificationService = notificationService;
  }

  /**
   * Initialize cron jobs for reminder processing
   */
  initializeCronJobs() {
    // Check for due reminders every minute
    const reminderJob = cron.schedule('* * * * *', async () => {
      if (!this.isProcessingReminders) {
        await this.processDueReminders();
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    this.cronJobs.set('reminders', reminderJob);

    // Process recurring reminders daily at midnight
    const recurringJob = cron.schedule('0 0 * * *', async () => {
      await this.processRecurringReminders();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    this.cronJobs.set('recurring', recurringJob);

    // Cleanup completed reminders weekly
    const cleanupJob = cron.schedule('0 0 * * 0', async () => {
      await this.cleanupCompletedReminders();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    this.cronJobs.set('cleanup', cleanupJob);

    console.log('✅ Reminder service cron jobs initialized');
  }

  /**
   * Create a new reminder
   * @param {Object} reminderData - Reminder data
   */
  async createReminder(reminderData) {
    try {
      const reminder = new Reminder({
        user: reminderData.user,
        task: reminderData.task,
        title: reminderData.title,
        description: reminderData.description,
        reminderDate: new Date(reminderData.reminderDate),
        isRecurring: reminderData.isRecurring || false,
        recurrencePattern: reminderData.recurrencePattern,
        isActive: true,
        isCompleted: false,
        createdBy: reminderData.createdBy
      });

      await reminder.save();

      console.log(`✅ Reminder created for user ${reminderData.user} at ${reminderData.reminderDate}`);

      return reminder;
    } catch (error) {
      console.error('Error creating reminder:', error);
      throw error;
    }
  }

  /**
   * Create reminder from task
   * @param {Object} task - Task object
   * @param {Date} reminderDate - When to remind
   * @param {String} createdBy - User creating the reminder
   */
  async createTaskReminder(task, reminderDate, createdBy) {
    try {
      const reminderData = {
        user: task.assignedTo,
        task: task._id,
        title: `Task Due Soon: ${task.title}`,
        description: `Task "${task.title}" is due on ${task.dueDate}`,
        reminderDate,
        createdBy
      };

      return await this.createReminder(reminderData);
    } catch (error) {
      console.error('Error creating task reminder:', error);
      throw error;
    }
  }

  /**
   * Create multiple reminders for a task (e.g., 1 day, 1 hour before)
   * @param {Object} task - Task object
   * @param {Array} reminderOffsets - Array of minutes before due date
   * @param {String} createdBy - User creating reminders
   */
  async createMultipleTaskReminders(task, reminderOffsets = [1440, 60], createdBy) {
    try {
      const reminders = [];
      const dueDate = new Date(task.dueDate);

      for (const offsetMinutes of reminderOffsets) {
        const reminderDate = new Date(dueDate.getTime() - (offsetMinutes * 60 * 1000));

        // Only create reminder if it's in the future
        if (reminderDate > new Date()) {
          const timeLabel = offsetMinutes >= 1440 ?
            `${Math.floor(offsetMinutes / 1440)} day(s)` :
            `${Math.floor(offsetMinutes / 60)} hour(s)`;

          const reminderData = {
            user: task.assignedTo,
            task: task._id,
            title: `Task Due in ${timeLabel}: ${task.title}`,
            description: `Task "${task.title}" is due in ${timeLabel}`,
            reminderDate,
            createdBy
          };

          const reminder = await this.createReminder(reminderData);
          reminders.push(reminder);
        }
      }

      console.log(`✅ Created ${reminders.length} reminders for task ${task._id}`);
      return reminders;
    } catch (error) {
      console.error('Error creating multiple task reminders:', error);
      throw error;
    }
  }

  /**
   * Process due reminders
   */
  async processDueReminders() {
    this.isProcessingReminders = true;

    try {
      const now = new Date();

      // Find reminders that are due (within the last minute to account for processing time)
      const dueReminders = await Reminder.find({
        dateTime: { $lte: now },
        status: 'pending'
      })
      .populate('userId', 'email name')
      .populate({
        path: 'relatedId',
        select: 'title dueDate priority currentStatus customData'
      })
      .lean();

      console.log(`📅 Processing ${dueReminders.length} due reminders`);

      for (const reminder of dueReminders) {
        try {
          await this.sendReminderNotification(reminder);

          // Mark as sent
          await Reminder.updateOne(
            { _id: reminder._id },
            {
              status: 'sent',
              updatedAt: now
            }
          );

          console.log(`✅ Sent reminder ${reminder._id} to user ${reminder.userId?.email || 'unknown'}`);

        } catch (error) {
          console.error(`❌ Error sending reminder ${reminder._id}:`, error);

          // Keep as pending if failed (will retry next time)
          console.error(`Reminder ${reminder._id} will be retried`);
        }
      }

    } catch (error) {
      console.error('Error processing due reminders:', error);
    } finally {
      this.isProcessingReminders = false;
    }
  }

  /**
   * Send reminder notification
   * @param {Object} reminder - Reminder object
   */
  async sendReminderNotification(reminder) {
    if (!this.notificationService) {
      console.warn('Notification service not available for reminder');
      return;
    }

    try {
      // Different notification based on reminder type
      if (reminder.relatedType === 'lead') {
        await this.notificationService.sendLeadReminderNotification(reminder);
      } else if (reminder.relatedType === 'task') {
        await this.notificationService.sendTaskReminderNotification(reminder);
      } else {
        await this.notificationService.sendReminderNotification(reminder);
      }
    } catch (error) {
      console.error('Error sending reminder notification:', error);
      throw error;
    }
  }

  /**
   * Process recurring reminders
   */
  async processRecurringReminders() {
    try {
      console.log('🔄 Processing recurring reminders...');

      const recurringReminders = await Reminder.find({
        isRecurring: true,
        isActive: true,
        isSent: true,
        isCompleted: false
      }).lean();

      for (const reminder of recurringReminders) {
        try {
          const nextReminderDate = this.calculateNextRecurrence(
            reminder.reminderDate,
            reminder.recurrencePattern
          );

          if (nextReminderDate) {
            // Create new reminder for next occurrence
            const newReminderData = {
              ...reminder,
              _id: undefined,
              reminderDate: nextReminderDate,
              isSent: false,
              sentAt: null,
              notificationCount: 0,
              failureCount: 0,
              createdAt: new Date()
            };

            delete newReminderData._id;
            const newReminder = new Reminder(newReminderData);
            await newReminder.save();

            console.log(`✅ Created recurring reminder ${newReminder._id} for ${nextReminderDate}`);
          }

        } catch (error) {
          console.error(`Error processing recurring reminder ${reminder._id}:`, error);
        }
      }

    } catch (error) {
      console.error('Error processing recurring reminders:', error);
    }
  }

  /**
   * Calculate next recurrence date
   * @param {Date} lastDate - Last reminder date
   * @param {Object} pattern - Recurrence pattern
   * @returns {Date|null} Next reminder date or null if no more recurrences
   */
  calculateNextRecurrence(lastDate, pattern) {
    if (!pattern || !pattern.type) {
      return null;
    }

    const date = new Date(lastDate);

    switch (pattern.type) {
      case 'daily':
        date.setDate(date.getDate() + (pattern.interval || 1));
        break;

      case 'weekly':
        date.setDate(date.getDate() + (7 * (pattern.interval || 1)));
        break;

      case 'monthly':
        date.setMonth(date.getMonth() + (pattern.interval || 1));
        break;

      case 'yearly':
        date.setFullYear(date.getFullYear() + (pattern.interval || 1));
        break;

      default:
        return null;
    }

    // Check if we've exceeded the end date
    if (pattern.endDate && date > new Date(pattern.endDate)) {
      return null;
    }

    // Check if we've exceeded max occurrences
    if (pattern.maxOccurrences && pattern.currentOccurrences >= pattern.maxOccurrences) {
      return null;
    }

    return date;
  }

  /**
   * Update reminder
   * @param {String} reminderId - Reminder ID
   * @param {Object} updateData - Data to update
   * @param {String} updatedBy - User making the update
   */
  async updateReminder(reminderId, updateData, updatedBy) {
    try {
      const allowedFields = [
        'title',
        'description',
        'reminderDate',
        'isRecurring',
        'recurrencePattern',
        'isActive'
      ];

      const updateFields = {};
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          updateFields[key] = updateData[key];
        }
      });

      updateFields.updatedBy = updatedBy;
      updateFields.updatedAt = new Date();

      const reminder = await Reminder.findByIdAndUpdate(
        reminderId,
        updateFields,
        { new: true, runValidators: true }
      );

      if (!reminder) {
        throw new Error('Reminder not found');
      }

      console.log(`✅ Reminder ${reminderId} updated by ${updatedBy}`);
      return reminder;

    } catch (error) {
      console.error('Error updating reminder:', error);
      throw error;
    }
  }

  /**
   * Complete a reminder
   * @param {String} reminderId - Reminder ID
   * @param {String} completedBy - User completing the reminder
   */
  async completeReminder(reminderId, completedBy) {
    try {
      const reminder = await Reminder.findByIdAndUpdate(
        reminderId,
        {
          isCompleted: true,
          completedAt: new Date(),
          completedBy
        },
        { new: true }
      );

      if (!reminder) {
        throw new Error('Reminder not found');
      }

      console.log(`✅ Reminder ${reminderId} completed by ${completedBy}`);
      return reminder;

    } catch (error) {
      console.error('Error completing reminder:', error);
      throw error;
    }
  }

  /**
   * Delete a reminder
   * @param {String} reminderId - Reminder ID
   * @param {String} deletedBy - User deleting the reminder
   */
  async deleteReminder(reminderId, deletedBy) {
    try {
      const reminder = await Reminder.findByIdAndUpdate(
        reminderId,
        {
          isActive: false,
          deletedAt: new Date(),
          deletedBy
        },
        { new: true }
      );

      if (!reminder) {
        throw new Error('Reminder not found');
      }

      console.log(`✅ Reminder ${reminderId} deleted by ${deletedBy}`);
      return reminder;

    } catch (error) {
      console.error('Error deleting reminder:', error);
      throw error;
    }
  }

  /**
   * Get user's reminders with pagination
   * @param {String} userId - User ID
   * @param {Object} options - Query options
   */
  async getUserReminders(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        includeCompleted = false,
        includeInactive = false
      } = options;

      const filter = { user: userId };

      if (!includeCompleted) {
        filter.isCompleted = false;
      }

      if (!includeInactive) {
        filter.isActive = true;
      }

      const reminders = await Reminder.find(filter)
        .populate('task', 'title dueDate priority status')
        .sort({ reminderDate: 1 })
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
      console.error('Error getting user reminders:', error);
      throw error;
    }
  }

  /**
   * Get upcoming reminders for a user
   * @param {String} userId - User ID
   * @param {Number} hours - Hours ahead to look (default 24)
   */
  async getUpcomingReminders(userId, hours = 24) {
    try {
      const now = new Date();
      const futureDate = new Date(now.getTime() + (hours * 60 * 60 * 1000));

      const reminders = await Reminder.find({
        user: userId,
        reminderDate: { $gte: now, $lte: futureDate },
        isActive: true,
        isCompleted: false
      })
      .populate('task', 'title dueDate priority')
      .sort({ reminderDate: 1 })
      .lean();

      return reminders;

    } catch (error) {
      console.error('Error getting upcoming reminders:', error);
      throw error;
    }
  }

  /**
   * Clean up completed reminders older than specified days
   * @param {Number} daysOld - Days to keep completed reminders (default 30)
   */
  async cleanupCompletedReminders(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await Reminder.deleteMany({
        isCompleted: true,
        completedAt: { $lt: cutoffDate }
      });

      console.log(`🧹 Cleaned up ${result.deletedCount} completed reminders`);
      return result.deletedCount;

    } catch (error) {
      console.error('Error cleaning up completed reminders:', error);
      return 0;
    }
  }

  /**
   * Get reminder statistics for monitoring
   */
  async getReminderStats() {
    try {
      const stats = await Reminder.aggregate([
        {
          $group: {
            _id: null,
            totalReminders: { $sum: 1 },
            activeReminders: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
            },
            completedReminders: {
              $sum: { $cond: [{ $eq: ['$isCompleted', true] }, 1, 0] }
            },
            pendingReminders: {
              $sum: {
                $cond: [
                  { $and: [
                    { $eq: ['$isActive', true] },
                    { $eq: ['$isCompleted', false] },
                    { $lte: ['$reminderDate', new Date()] }
                  ]},
                  1,
                  0
                ]
              }
            },
            recurringReminders: {
              $sum: { $cond: [{ $eq: ['$isRecurring', true] }, 1, 0] }
            }
          }
        }
      ]);

      return stats[0] || {
        totalReminders: 0,
        activeReminders: 0,
        completedReminders: 0,
        pendingReminders: 0,
        recurringReminders: 0
      };

    } catch (error) {
      console.error('Error getting reminder stats:', error);
      return {};
    }
  }

  /**
   * Stop all cron jobs
   */
  stopCronJobs() {
    this.cronJobs.forEach((job, name) => {
      job.stop();
      console.log(`✅ Stopped cron job: ${name}`);
    });
  }

  /**
   * Start all cron jobs
   */
  startCronJobs() {
    this.cronJobs.forEach((job, name) => {
      job.start();
      console.log(`✅ Started cron job: ${name}`);
    });
  }
}

module.exports = ReminderService;