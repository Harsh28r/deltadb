
// WebSocket Integration for server.js
// Add this to your server.js file

const SocketManager = require('./websocket/socketManager');
const NotificationService = require('./services/notificationService');
const ReminderService = require('./services/reminderService');

// Initialize WebSocket after server creation
let socketManager, notificationService, reminderService;

// In your server.js, after creating the HTTP server and Socket.IO:
const initializeRealTime = (io) => {
  // Initialize socket manager
  socketManager = new SocketManager(io);

  // Initialize services with WebSocket support
  notificationService = new NotificationService(socketManager);
  reminderService = new ReminderService(notificationService);

  // Make services available globally
  global.socketManager = socketManager;
  global.notificationService = notificationService;
  global.reminderService = reminderService;

  console.log('✅ Real-time system initialized');
};

// Call this function in server.js after creating io
// initializeRealTime(io);

module.exports = { initializeRealTime };
