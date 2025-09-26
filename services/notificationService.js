const Notification = require('../models/Notification');
const User = require('../models/User');
const cacheManager = require('../utils/cacheManager');

class NotificationService {
  constructor(socketManager = null) {
    this.socketManager = socketManager;
    this.notificationQueue = [];
    this.batchSize = 50;
    this.batchTimeout = 5000; // 5 seconds
    this.processingBatch = false;

    // Start batch processing
    this.startBatchProcessor();
  }

  setSocketManager(socketManager) {
    this.socketManager = socketManager;
  }

  /**
   * Send notification to a single user
   * @param {String} userId - Target user ID
   * @param {Object} notification - Notification data
   */
  async sendNotification(userId, notification) {
    try {
      const notificationData = {
        recipient: userId,
        type: notification.type || 'info',
        title: notification.title,
        message: notification.message,
        data: notification.data || {},
        priority: notification.priority || 'normal',
        read: false,
        createdAt: new Date()
      };

      // Add to batch queue for database operations
      this.notificationQueue.push(notificationData);

      // Send immediately via WebSocket if available
      if (this.socketManager) {
        await this.socketManager.sendNotification(userId, notificationData);
      }

      // Process batch if it's full
      if (this.notificationQueue.length >= this.batchSize) {
        await this.processBatch();
      }

      return true;
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Send notifications to multiple users
   * @param {Array} userIds - Array of user IDs
   * @param {Object} notification - Notification data
   */
  async sendBulkNotification(userIds, notification) {
    try {
      const notifications = userIds.map(userId => ({
        recipient: userId,
        type: notification.type || 'info',
        title: notification.title,
        message: notification.message,
        data: notification.data || {},
        priority: notification.priority || 'normal',
        read: false,
        createdAt: new Date()
      }));

      // Add to batch queue
      this.notificationQueue.push(...notifications);

      // Send via WebSocket if available
      if (this.socketManager) {
        userIds.forEach(userId => {
          this.socketManager.sendNotification(userId, notification);
        });
      }

      // Process batch if it's getting large
      if (this.notificationQueue.length >= this.batchSize) {
        await this.processBatch();
      }

      return notifications.length;
    } catch (error) {
      console.error('Error sending bulk notifications:', error);
      throw error;
    }
  }

  /**
   * Send notification to all users with a specific role
   * @param {String} role - User role
   * @param {Object} notification - Notification data
   */
  async sendRoleNotification(role, notification) {
    try {
      // Get users with the specified role (with caching)
      const cacheKey = `users:role:${role}`;
      let users = cacheManager.getQueryResult(cacheKey);

      if (!users) {
        users = await User.find({ role, isActive: true }).select('_id').lean();
        cacheManager.setQueryResult(cacheKey, users);
      }

      const userIds = users.map(user => user._id.toString());

      // Send via WebSocket broadcast
      if (this.socketManager) {
        this.socketManager.broadcastToRole(role, 'notification', notification);
      }

      // Create database notifications
      return await this.sendBulkNotification(userIds, notification);
    } catch (error) {
      console.error('Error sending role notification:', error);
      throw error;
    }
  }

  /**
   * Send notification to all project members
   * @param {String} projectId - Project ID
   * @param {Object} notification - Notification data
   */
  async sendProjectNotification(projectId, notification) {
    try {
      // Get project members (with caching)
      const cacheKey = `project:members:${projectId}`;
      let project = cacheManager.getProject(projectId);

      if (!project) {
        const Project = require('../models/Project');
        project = await Project.findById(projectId)
          .select('members managers owner')
          .populate('members managers owner', '_id')
          .lean();

        if (project) {
          cacheManager.setProject(projectId, project);
        }
      }

      if (!project) {
        throw new Error('Project not found');
      }

      // Collect all project participants
      const userIds = new Set();

      // Add owner
      if (project.owner) {
        userIds.add(project.owner._id ? project.owner._id.toString() : project.owner.toString());
      }

      // Add members
      project.members?.forEach(member => {
        userIds.add(member._id ? member._id.toString() : member.toString());
      });

      // Add managers
      project.managers?.forEach(manager => {
        userIds.add(manager._id ? manager._id.toString() : manager.toString());
      });

      // Send via WebSocket broadcast
      if (this.socketManager) {
        this.socketManager.broadcastToProject(projectId, 'notification', notification);
      }

      // Create database notifications
      return await this.sendBulkNotification(Array.from(userIds), notification);
    } catch (error) {
      console.error('Error sending project notification:', error);
      throw error;
    }
  }

  /**
   * Send lead status change notification
   * @param {Object} lead - Lead object
   * @param {Object} oldStatus - Old status
   * @param {Object} newStatus - New status
   * @param {String} changedBy - User who changed the status
   */
  async sendLeadStatusNotification(lead, oldStatus, newStatus, changedBy) {
    try {
      const notification = {
        type: 'lead_status_change',
        title: 'Lead Status Updated',
        message: `Lead status changed from "${oldStatus.name}" to "${newStatus.name}"`,
        data: {
          leadId: lead._id,
          projectId: lead.project,
          oldStatusId: oldStatus._id,
          newStatusId: newStatus._id,
          changedBy
        },
        priority: newStatus.is_final_status ? 'high' : 'normal'
      };

      // Notify lead owner
      await this.sendNotification(lead.user.toString(), notification);

      // Notify project stakeholders
      await this.sendProjectNotification(lead.project.toString(), {
        ...notification,
        title: 'Project Lead Updated',
        message: `A lead in your project has been updated: ${notification.message}`
      });

      // Send real-time update via WebSocket
      if (this.socketManager) {
        this.socketManager.broadcastLeadUpdate(lead._id.toString(), {
          type: 'status_change',
          oldStatus,
          newStatus,
          changedBy
        });
      }

    } catch (error) {
      console.error('Error sending lead status notification:', error);
    }
  }

  /**
   * Send task assignment notification
   * @param {Object} task - Task object
   * @param {String} assignedTo - User ID task is assigned to
   * @param {String} assignedBy - User ID who assigned the task
   */
  async sendTaskAssignmentNotification(task, assignedTo, assignedBy) {
    try {
      const notification = {
        type: 'task_assignment',
        title: 'New Task Assigned',
        message: `You have been assigned a new task: "${task.title}"`,
        data: {
          taskId: task._id,
          projectId: task.project,
          assignedBy,
          dueDate: task.dueDate,
          priority: task.priority
        },
        priority: task.priority === 'high' ? 'high' : 'normal'
      };

      await this.sendNotification(assignedTo, notification);

      // Send WebSocket update
      if (this.socketManager) {
        this.socketManager.broadcastTaskUpdate(task._id.toString(), {
          type: 'assignment',
          assignedTo,
          assignedBy
        });
      }

    } catch (error) {
      console.error('Error sending task assignment notification:', error);
    }
  }

  /**
   * Send reminder notification
   * @param {Object} reminder - Reminder object
   */
  async sendReminderNotification(reminder) {
    try {
      const notification = {
        type: 'reminder',
        title: 'Reminder',
        message: reminder.description || 'You have a reminder',
        data: {
          reminderId: reminder._id,
          taskId: reminder.task,
          reminderDate: reminder.reminderDate
        },
        priority: 'high'
      };

      await this.sendNotification(reminder.user.toString(), notification);

      // Send WebSocket reminder
      if (this.socketManager) {
        this.socketManager.sendReminder(reminder.user.toString(), notification);
      }

    } catch (error) {
      console.error('Error sending reminder notification:', error);
    }
  }

  /**
   * Send system announcement
   * @param {String} message - Announcement message
   * @param {String} level - Announcement level (info, warning, error)
   * @param {Array} targetRoles - Roles to send to (optional, defaults to all)
   */
  async sendSystemAnnouncement(message, level = 'info', targetRoles = null) {
    try {
      const notification = {
        type: 'system_announcement',
        title: 'System Announcement',
        message,
        data: { level },
        priority: level === 'error' ? 'high' : 'normal'
      };

      if (targetRoles && targetRoles.length > 0) {
        // Send to specific roles
        for (const role of targetRoles) {
          await this.sendRoleNotification(role, notification);
        }
      } else {
        // Send to all active users
        const users = await User.find({ isActive: true }).select('_id').lean();
        const userIds = users.map(user => user._id.toString());
        await this.sendBulkNotification(userIds, notification);
      }

      // Send WebSocket broadcast
      if (this.socketManager) {
        this.socketManager.broadcastSystemMessage(message, level);
      }

    } catch (error) {
      console.error('Error sending system announcement:', error);
    }
  }

  /**
   * Mark notification as read
   * @param {String} notificationId - Notification ID
   * @param {String} userId - User ID
   */
  async markAsRead(notificationId, userId) {
    try {
      const result = await Notification.updateOne(
        { _id: notificationId, recipient: userId },
        { read: true, readAt: new Date() }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param {String} userId - User ID
   */
  async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany(
        { recipient: userId, read: false },
        { read: true, readAt: new Date() }
      );

      return result.modifiedCount;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return 0;
    }
  }

  /**
   * Get notifications for a user with pagination
   * @param {String} userId - User ID
   * @param {Object} options - Pagination and filter options
   */
  async getUserNotifications(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        unreadOnly = false,
        type = null
      } = options;

      const filter = { recipient: userId };

      if (unreadOnly) {
        filter.read = false;
      }

      if (type) {
        filter.type = type;
      }

      const notifications = await Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const total = await Notification.countDocuments(filter);

      return {
        notifications,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      };
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count for a user
   * @param {String} userId - User ID
   */
  async getUnreadCount(userId) {
    try {
      return await Notification.countDocuments({
        recipient: userId,
        read: false
      });
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Process notification batch
   */
  async processBatch() {
    if (this.processingBatch || this.notificationQueue.length === 0) {
      return;
    }

    this.processingBatch = true;

    try {
      const batch = this.notificationQueue.splice(0, this.batchSize);

      if (batch.length > 0) {
        await Notification.insertMany(batch, { ordered: false });
        console.log(`✅ Processed ${batch.length} notifications`);
      }
    } catch (error) {
      console.error('Error processing notification batch:', error);
    } finally {
      this.processingBatch = false;
    }
  }

  /**
   * Start batch processor
   */
  startBatchProcessor() {
    setInterval(async () => {
      if (this.notificationQueue.length > 0) {
        await this.processBatch();
      }
    }, this.batchTimeout);
  }

  /**
   * Clean up old notifications
   * @param {Number} daysOld - Days to keep notifications (default 90)
   */
  async cleanupOldNotifications(daysOld = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await Notification.deleteMany({
        createdAt: { $lt: cutoffDate },
        read: true // Only delete read notifications
      });

      console.log(`🧹 Cleaned up ${result.deletedCount} old notifications`);
      return result.deletedCount;
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
      return 0;
    }
  }
}

module.exports = NotificationService;