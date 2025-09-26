const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Notification = require('../models/Notification');

class SocketManager {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map();
    this.userRooms = new Map();
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const user = await User.findById(decoded.id);

        if (!user) {
          return next(new Error('Authentication error: User not found'));
        }

        socket.userId = user._id.toString();
        socket.userEmail = user.email;
        socket.userRole = user.role;
        socket.userLevel = user.level;

        next();
      } catch (error) {
        next(new Error('Authentication error: Invalid token'));
      }
    });

    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  handleConnection(socket) {
    const userId = socket.userId;
    console.log(`🔌 User ${socket.userEmail} connected (Socket: ${socket.id})`);

    // Store connection
    this.connectedUsers.set(userId, {
      socketId: socket.id,
      email: socket.userEmail,
      role: socket.userRole,
      level: socket.userLevel,
      connectedAt: new Date()
    });

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Join role-based rooms
    socket.join(`role:${socket.userRole}`);

    // Join level-based rooms
    socket.join(`level:${socket.userLevel}`);

    // Handle project-specific rooms
    socket.on('join-project', async (projectId) => {
      try {
        const user = await User.findById(userId);
        if (user.canAccessProject(projectId)) {
          socket.join(`project:${projectId}`);
          this.addUserToRoom(userId, `project:${projectId}`);
          socket.emit('joined-project', { projectId, success: true });
        } else {
          socket.emit('joined-project', { projectId, success: false, error: 'Access denied' });
        }
      } catch (error) {
        socket.emit('joined-project', { projectId, success: false, error: error.message });
      }
    });

    socket.on('leave-project', (projectId) => {
      socket.leave(`project:${projectId}`);
      this.removeUserFromRoom(userId, `project:${projectId}`);
      socket.emit('left-project', { projectId });
    });

    // Handle lead-specific subscriptions
    socket.on('subscribe-lead', (leadId) => {
      socket.join(`lead:${leadId}`);
      socket.emit('subscribed-lead', { leadId });
    });

    socket.on('unsubscribe-lead', (leadId) => {
      socket.leave(`lead:${leadId}`);
      socket.emit('unsubscribed-lead', { leadId });
    });

    // Handle task subscriptions
    socket.on('subscribe-task', (taskId) => {
      socket.join(`task:${taskId}`);
      socket.emit('subscribed-task', { taskId });
    });

    // Handle reminder subscriptions
    socket.on('subscribe-reminders', () => {
      socket.join(`reminders:${userId}`);
      socket.emit('subscribed-reminders', { success: true });
    });

    // Mark user as online
    socket.on('user-status', (status) => {
      this.updateUserStatus(userId, status);
      socket.broadcast.emit('user-status-changed', {
        userId,
        status,
        timestamp: new Date()
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`🔌 User ${socket.userEmail} disconnected (Socket: ${socket.id})`);
      this.handleDisconnection(userId);
    });

    // Send initial data
    this.sendInitialData(socket);
  }

  async sendInitialData(socket) {
    try {
      // Send unread notifications count
      const unreadCount = await Notification.countDocuments({
        recipient: socket.userId,
        read: false
      });

      socket.emit('initial-data', {
        unreadNotifications: unreadCount,
        connectedAt: new Date()
      });
    } catch (error) {
      console.error('Error sending initial data:', error);
    }
  }

  // Notification methods
  async sendNotification(userId, notification) {
    const userSocket = this.connectedUsers.get(userId);
    if (userSocket) {
      this.io.to(`user:${userId}`).emit('notification', {
        ...notification,
        timestamp: new Date()
      });
    }

    // Store notification in database
    try {
      const notificationDoc = new Notification({
        recipient: userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        read: false
      });
      await notificationDoc.save();
    } catch (error) {
      console.error('Error saving notification:', error);
    }
  }

  // Broadcast to project members
  broadcastToProject(projectId, event, data) {
    this.io.to(`project:${projectId}`).emit(event, {
      ...data,
      timestamp: new Date()
    });
  }

  // Broadcast to role-based groups
  broadcastToRole(role, event, data) {
    this.io.to(`role:${role}`).emit(event, {
      ...data,
      timestamp: new Date()
    });
  }

  // Lead updates
  broadcastLeadUpdate(leadId, update) {
    this.io.to(`lead:${leadId}`).emit('lead-updated', {
      leadId,
      update,
      timestamp: new Date()
    });
  }

  // Task updates
  broadcastTaskUpdate(taskId, update) {
    this.io.to(`task:${taskId}`).emit('task-updated', {
      taskId,
      update,
      timestamp: new Date()
    });
  }

  // Reminder notifications
  sendReminder(userId, reminder) {
    this.io.to(`reminders:${userId}`).emit('reminder', {
      ...reminder,
      timestamp: new Date()
    });
  }

  // System announcements
  broadcastSystemMessage(message, level = 'info') {
    this.io.emit('system-message', {
      level,
      message,
      timestamp: new Date()
    });
  }

  // User management methods
  addUserToRoom(userId, room) {
    if (!this.userRooms.has(userId)) {
      this.userRooms.set(userId, new Set());
    }
    this.userRooms.get(userId).add(room);
  }

  removeUserFromRoom(userId, room) {
    if (this.userRooms.has(userId)) {
      this.userRooms.get(userId).delete(room);
    }
  }

  updateUserStatus(userId, status) {
    const userConnection = this.connectedUsers.get(userId);
    if (userConnection) {
      userConnection.status = status;
      userConnection.lastSeen = new Date();
    }
  }

  handleDisconnection(userId) {
    this.connectedUsers.delete(userId);
    this.userRooms.delete(userId);
  }

  // Analytics and monitoring
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  getConnectedUsersByRole() {
    const roleCount = {};
    this.connectedUsers.forEach(user => {
      roleCount[user.role] = (roleCount[user.role] || 0) + 1;
    });
    return roleCount;
  }

  getUserRooms(userId) {
    return Array.from(this.userRooms.get(userId) || []);
  }

  // Bulk operations
  broadcastToMultipleUsers(userIds, event, data) {
    userIds.forEach(userId => {
      this.io.to(`user:${userId}`).emit(event, data);
    });
  }

  // Emergency broadcast
  emergencyBroadcast(message) {
    this.io.emit('emergency', {
      message,
      timestamp: new Date(),
      level: 'critical'
    });
  }
}

module.exports = SocketManager;