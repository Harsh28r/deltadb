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
   * Get all superadmin user IDs
   * @returns {Array} Array of superadmin user IDs
   */
  async getSuperadminIds() {
    try {
      // Check cache first
      const cacheKey = 'superadmin:ids';
      let superadminIds = cacheManager.getQueryResult(cacheKey);

      if (!superadminIds) {
        console.log('🔍 Looking for superadmin users...');
        // Find all users with superadmin role
        const Role = require('../models/Role');
        const superadminRole = await Role.findOne({ name: 'superadmin' }).lean();

        if (superadminRole) {
          console.log('✅ Found superadmin role:', superadminRole._id);
          const superadmins = await User.find({
            roleRef: superadminRole._id,
            isActive: true
          }).select('_id name email').lean();

          superadminIds = superadmins.map(u => u._id.toString());
          console.log(`✅ Found ${superadminIds.length} superadmins by roleRef:`, superadminIds);
        } else {
          console.log('⚠️ No superadmin role found, trying direct role field...');
          // Fallback: Find by role field directly
          const superadmins = await User.find({
            role: 'superadmin',
            isActive: true
          }).select('_id name email').lean();

          superadminIds = superadmins.map(u => u._id.toString());
          console.log(`✅ Found ${superadminIds.length} superadmins by role field:`, superadminIds);
        }

        // Cache for 5 minutes
        cacheManager.setQueryResult(cacheKey, superadminIds, 300);
      } else {
        console.log(`📋 Using cached superadmin IDs: ${superadminIds.length} users`);
      }

      return superadminIds || [];
    } catch (error) {
      console.error('❌ Error getting superadmin IDs:', error);
      return [];
    }
  }

  /**
   * Get all users in the reporting chain above a user (managers, superiors, etc.)
   * @param {String} userId - User ID
   * @returns {Array} Array of user IDs in reporting chain
   */
  async getReportingChain(userId) {
    try {
      const cacheKey = `reporting:chain:${userId}`;
      let reportingChain = cacheManager.getQueryResult(cacheKey);

      if (!reportingChain) {
        const UserReporting = require('../models/UserReporting');
        reportingChain = [];

        // Get user's reporting structure
        const userReporting = await UserReporting.findOne({ user: userId }).lean();

        if (userReporting && userReporting.reportsTo && userReporting.reportsTo.length > 0) {
          for (const report of userReporting.reportsTo) {
            if (report.path) {
              // Path format: "/(userId1)/(userId2)/(userId3)/"
              // Extract all user IDs from the path
              const pathRegex = /\/\(([^)]+)\)\//g;
              let match;
              while ((match = pathRegex.exec(report.path)) !== null) {
                const superiorId = match[1];
                if (superiorId && superiorId !== userId) {
                  reportingChain.push(superiorId);
                }
              }
            }

            // Also add the direct manager
            if (report.manager && report.manager.toString() !== userId) {
              reportingChain.push(report.manager.toString());
            }
          }
        }

        // Remove duplicates
        reportingChain = [...new Set(reportingChain)];

        // Cache for 5 minutes
        cacheManager.setQueryResult(cacheKey, reportingChain, 300);
      }

      return reportingChain || [];
    } catch (error) {
      console.error('Error getting reporting chain:', error);
      return [];
    }
  }

  /**
   * Send notification to user, their reporting chain, and superadmins
   * @param {String} userId - Target user ID
   * @param {Object} notification - Notification data
   * @param {Object} hierarchyNotification - Custom notification for hierarchy (managers, superadmins)
   */
  async sendNotificationWithSuperadmin(userId, notification, hierarchyNotification = null) {
    try {
      // Send to primary user
      await this.sendNotification(userId, notification);

      // Get all users who should be notified (reporting chain + superadmins)
      const reportingChain = await this.getReportingChain(userId);
      const superadminIds = await this.getSuperadminIds();

      // Combine and deduplicate
      const allSuperiors = [...new Set([...reportingChain, ...superadminIds])];

      console.log(`📢 Sending hierarchical notification from user ${userId} to ${allSuperiors.length} superiors`);
      console.log(`📋 Reporting chain: ${reportingChain.length} users, Superadmins: ${superadminIds.length} users`);

      if (allSuperiors.length > 0) {
        const hierarchyNotif = hierarchyNotification || {
          ...notification,
          title: `[Team Activity] ${notification.title}`,
          message: `${notification.message} (User: ${userId})`,
          data: {
            ...notification.data,
            originUserId: userId,
            isHierarchyNotification: true
          },
          priority: notification.priority || 'normal'
        };

        for (const superiorId of allSuperiors) {
          // Don't send duplicate if superior is the same as target user
          if (superiorId !== userId) {
            try {
              await this.sendNotification(superiorId, hierarchyNotif);
              console.log(`✅ Sent hierarchy notification to user ${superiorId}`);
            } catch (error) {
              console.error(`❌ Failed to send hierarchy notification to user ${superiorId}:`, error.message);
              // Continue with other notifications even if one fails
            }
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Error sending notification with hierarchy:', error);
      throw error;
    }
  }

  /**
   * Send notification UP the hierarchy (when lower user does activity)
   * Activity flows: User → Manager → Manager's Manager → Superadmin
   * @param {String} actorUserId - User who performed the action
   * @param {Object} notification - Notification for hierarchy
   */
  async sendHierarchyNotification(actorUserId, notification) {
    try {
      // Get all users in reporting chain + superadmins
      const reportingChain = await this.getReportingChain(actorUserId);
      const superadminIds = await this.getSuperadminIds();

      // Combine and deduplicate
      const allSuperiors = [...new Set([...reportingChain, ...superadminIds])];

      console.log(`⬆️ Activity by user ${actorUserId} notifying ${allSuperiors.length} superiors in hierarchy`);

      const hierarchyNotif = {
        ...notification,
        title: `[Team Activity] ${notification.title}`,
        data: {
          ...notification.data,
          actorUserId
        }
      };

      for (const superiorId of allSuperiors) {
        if (superiorId !== actorUserId) {
          await this.sendNotification(superiorId, hierarchyNotif);
        }
      }

      return allSuperiors.length;
    } catch (error) {
      console.error('Error sending hierarchy notification:', error);
      return 0;
    }
  }

  /**
   * Send notification to a single user
   * @param {String} userId - Target user ID
   * @param {Object} notification - Notification data
   */
  async sendNotification(userId, notification) {
    try {
      console.log(`🔔 NotificationService: Sending notification to user ${userId}`, {
        type: notification.type,
        title: notification.title
      });

      const notificationData = {
        recipient: userId,
        user: userId, // Add user field for compatibility
        type: notification.type || 'info',
        title: notification.title,
        message: notification.message,
        data: notification.data || {},
        priority: notification.priority || 'normal',
        read: false,
        createdAt: new Date(),
        createdBy: notification.createdBy || notification.data?.actorUserId || notification.data?.changedBy || null
      };

      // Add to batch queue for database operations
      this.notificationQueue.push(notificationData);
      console.log(`📦 Added to queue. Queue size: ${this.notificationQueue.length}`);

      // Send immediately via WebSocket if available
      if (this.socketManager) {
        await this.socketManager.sendNotification(userId, notificationData);
      } else {
        console.log('⚠️ SocketManager not available');
      }

      // Process batch if it's full
      if (this.notificationQueue.length >= this.batchSize) {
        console.log(`🚀 Queue full, processing batch now...`);
        await this.processBatch();
      }

      return true;
    } catch (error) {
      console.error('❌ Error sending notification:', error);
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
        priority: newStatus.is_final_status ? 'high' : 'normal',
        createdBy: changedBy
      };

      // Get user info for better notification context
      const User = require('../models/User');
      const changedByUser = await User.findById(changedBy).select('name email').lean();
      const changedByName = changedByUser ? changedByUser.name : 'Unknown User';

      // Notify lead owner and their hierarchy (including superadmins)
      const hierarchyNotif = {
        ...notification,
        title: '[Team Activity] Lead Status Updated',
        message: `Lead status changed from "${oldStatus.name}" to "${newStatus.name}" by ${changedByName}`,
        data: {
          ...notification.data,
          changedByName,
          changedByEmail: changedByUser?.email
        },
        createdBy: changedBy
      };

      // Send to lead owner and their reporting chain + superadmins
      await this.sendNotificationWithSuperadmin(lead.user.toString(), notification, hierarchyNotif);

      // Also notify the person who made the change and their hierarchy
      if (changedBy !== lead.user.toString()) {
        await this.sendHierarchyNotification(changedBy, {
          type: 'lead_status_change',
          title: '[Action] Lead Status Updated',
          message: `You updated a lead status from "${oldStatus.name}" to "${newStatus.name}"`,
          data: {
            leadId: lead._id,
            projectId: lead.project,
            oldStatusId: oldStatus._id,
            newStatusId: newStatus._id,
            leadOwner: lead.user.toString()
          },
          priority: 'normal'
        });
      }

      // Notify project stakeholders
      await this.sendProjectNotification(lead.project.toString(), {
        ...notification,
        title: 'Project Lead Updated',
        message: `A lead in your project has been updated: ${notification.message}`,
        data: {
          ...notification.data,
          changedByName
        }
      });

      // Send real-time update via WebSocket
      if (this.socketManager) {
        this.socketManager.broadcastLeadUpdate(lead._id.toString(), {
          type: 'status_change',
          oldStatus,
          newStatus,
          changedBy,
          changedByName
        });
      }

      console.log(`✅ Lead status notification sent for lead ${lead._id} by user ${changedBy}`);

    } catch (error) {
      console.error('Error sending lead status notification:', error);
    }
  }

  /**
   * Send lead assignment notification
   * @param {Object} lead - Lead object
   * @param {String} assignedTo - User ID lead is assigned to
   * @param {String} assignedBy - User ID who assigned the lead
   */
  async sendLeadAssignmentNotification(lead, assignedTo, assignedBy) {
    try {
      const User = require('../models/User');
      const assignedByUser = await User.findById(assignedBy).select('name email').lean();
      const assignedByName = assignedByUser ? assignedByUser.name : 'System';

      const notification = {
        type: 'lead_assigned',
        title: 'New Lead Assigned',
        message: `A new lead has been assigned to you by ${assignedByName}`,
        data: {
          leadId: lead._id,
          projectId: lead.project,
          assignedBy,
          assignedByName,
          assignedByEmail: assignedByUser?.email,
          leadSource: lead.leadSource,
          currentStatus: lead.currentStatus
        },
        priority: 'high'
      };

      // Notify assigned user and their hierarchy (including superadmins)
      const hierarchyNotif = {
        ...notification,
        title: '[Team Activity] Lead Assigned',
        message: `New lead assigned to team member by ${assignedByName}`,
        data: {
          ...notification.data,
          assignedTo
        }
      };

      await this.sendNotificationWithSuperadmin(assignedTo, notification, hierarchyNotif);

      // Also notify the person who assigned the lead and their hierarchy
      if (assignedBy !== assignedTo) {
        await this.sendHierarchyNotification(assignedBy, {
          type: 'lead_assigned',
          title: '[Action] Lead Assigned',
          message: `You assigned a new lead to a team member`,
          data: {
            leadId: lead._id,
            projectId: lead.project,
            assignedTo,
            leadSource: lead.leadSource
          },
          priority: 'normal'
        });
      }

      // Send real-time update via WebSocket
      if (this.socketManager) {
        this.socketManager.broadcastLeadUpdate(lead._id.toString(), {
          type: 'assignment',
          assignedTo,
          assignedBy,
          assignedByName
        });
      }

      console.log(`✅ Lead assignment notification sent for lead ${lead._id} to user ${assignedTo}`);

    } catch (error) {
      console.error('Error sending lead assignment notification:', error);
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

      // Send to assignee and superadmins
      const superadminNotif = {
        ...notification,
        title: '[Admin] Task Assigned',
        message: `Task "${task.title}" assigned to ${assignedTo} by ${assignedBy}`
      };
      await this.sendNotificationWithSuperadmin(assignedTo, notification, superadminNotif);

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

      // Send to user and superadmins
      const superadminNotif = {
        ...notification,
        title: '[Admin] Reminder',
        message: `Reminder for user ${reminder.user}: ${reminder.description || 'You have a reminder'}`
      };
      await this.sendNotificationWithSuperadmin(reminder.user.toString(), notification, superadminNotif);

      // Send WebSocket reminder
      if (this.socketManager) {
        this.socketManager.sendReminder(reminder.user.toString(), notification);
      }

    } catch (error) {
      console.error('Error sending reminder notification:', error);
    }
  }

  /**
   * Send user activity notification to their hierarchy
   * This ensures superadmins and upper-level users are notified of all activities
   * @param {String} userId - User who performed the activity
   * @param {String} activityType - Type of activity (e.g., 'lead_created', 'task_completed')
   * @param {Object} activityData - Data about the activity
   * @param {String} message - Human-readable message about the activity
   */
  async sendUserActivityNotification(userId, activityType, activityData, message) {
    try {
      const User = require('../models/User');
      const user = await User.findById(userId).select('name email role').lean();
      const userName = user ? user.name : 'Unknown User';

      const notification = {
        type: `user_${activityType}`,
        title: `[Team Activity] ${userName} Activity`,
        message: `${userName}: ${message}`,
        data: {
          ...activityData,
          actorUserId: userId,
          actorName: userName,
          actorEmail: user?.email,
          actorRole: user?.role,
          activityType
        },
        priority: 'normal'
      };

      // Send to user's reporting chain and superadmins
      await this.sendHierarchyNotification(userId, notification);

      console.log(`✅ User activity notification sent for user ${userId} (${userName}) - ${activityType}`);

    } catch (error) {
      console.error('Error sending user activity notification:', error);
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
        console.log(`💾 Saving ${batch.length} notifications to database...`);
        const result = await Notification.insertMany(batch, { ordered: false });
        console.log(`✅ Successfully saved ${result.length} notifications to database`);

        // Show sample notification
        if (result.length > 0) {
          console.log(`📝 Sample: ${result[0].title} → ${result[0].recipient}`);
        }
      }
    } catch (error) {
      console.error('❌ Error processing notification batch:', error);
      console.error('Batch data:', JSON.stringify(batch, null, 2));
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