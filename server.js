require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
// const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { corsOptions, adminLoginCorsOptions, corsDebug } = require('./middleware/cors');

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('🚨 UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  
  // Log the error but don't exit in production to prevent downtime
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 UNHANDLED REJECTION! 💥');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  
  // Log the error but don't exit in production
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('📡 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('📡 SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });
});

// const userRoutes = require('./routes/userRoutes');
const projectRoutes = require('./routes/projectRoutes');
// const taskRoutes = require('./routes/taskRoutes');
const superadminRoutes = require('./routes/superadminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const leadSourceRoutes = require('./routes/leadSourceRoutes');
const leadStatusRoutes = require('./routes/leadStatusRoutes');
const leadRoutes = require('./routes/leadRoutes');
const leadActivityRoutes = require('./routes/leadActivityRoutes');
const userReportingRoutes = require('./routes/userReportingRoutes');
const userProjectRoutes = require('./routes/userProjectRoutes');
const userDashboardRoutes = require('./routes/userDashboardRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
const cpSourcingRoutes = require('./routes/cpSourcingRoutes');
const channelPartnerRouters = require('./routes/channelPartnerRoutes');
const initLeadSource = require('./scripts/initLeadSource');
const imageRoutes = require('./routes/images'); // Adjust path
const dashBoardRoutes = require('./routes/dashBoardRoutes');
const taskRoutes = require('./routes/taskRoutes');
const reminderRoutes = require('./routes/reminderRoutes');
const followUpRoutes = require('./routes/followUpRoutes');
const testNotificationRoutes = require('./routes/testNotificationRoutes');
const testReminderRoutes = require('./routes/testReminderRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
// const { smartRateLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');
const { globalErrorHandler } = require('./middleware/errorHandler');

// Initialize cron jobs
require('./cron/deactivation');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // Adjust for production
});

// Import WebSocket components
const SocketManager = require('./websocket/socketManager');
const NotificationService = require('./services/notificationService');
const ReminderService = require('./services/reminderService');

// Import Redis cache
const redisCache = require('./utils/redisCache');

// Initialize WebSocket system
let socketManager, notificationService, reminderService;

const initializeRealTime = (io) => {
  socketManager = new SocketManager(io);
  notificationService = new NotificationService(socketManager);
  reminderService = new ReminderService(notificationService);

  // Make services available globally
  global.socketManager = socketManager;
  global.notificationService = notificationService;
  global.reminderService = reminderService;

  console.log('✅ Real-time system initialized');
};

// Call after creating io (around line 40)
initializeRealTime(io);

// Middleware
// CORS configuration using dedicated middleware
app.use(cors(corsOptions));
app.use(corsDebug);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve uploaded files (selfies, etc.)
app.use('/uploads', express.static('uploads'));

// Apply rate limiting
// app.use(smartRateLimiter);

// Apply request logging
app.use(logger.createRequestMiddleware());

// Global rate limiter - disabled for Vercel compatibility
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // Limit each IP to 100 requests per window
//   message: 'Too many requests, please try again later.'
// });
// app.use(limiter);

// MongoDB connection string from environment variables
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/deltacrm?retryWrites=true&w=majority&appName=Cluster0';

if (!MONGO_URI) {
  console.error('❌ FATAL ERROR: MONGO_URI environment variable is not set');
  process.exit(1);
}

// Log MongoDB URI
console.log('MONGO_URI:', MONGO_URI);

// Global variable to track connection status
let isMongoConnected = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;

// Connect to MongoDB
const connectToMongoDB = async () => {
  try {
    if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
      console.error('Max connection attempts reached. Starting server without MongoDB...');
      startServer();
      return;
    }

    connectionAttempts++;
    console.log(`MongoDB connection attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS}`);
    
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000, // 30 second timeout for deployment
      socketTimeoutMS: 45000, // 45 second timeout
      maxPoolSize: 10, // Connection pool size
      retryWrites: true,
      w: 'majority'
    });

    console.log('MongoDB connected successfully');
    isMongoConnected = true;

    // Initialize Redis cache
    await redisCache.connect();

    startServer();
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    console.error('Full error:', JSON.stringify(err, null, 2));
    isMongoConnected = false;
    
    // Retry connection after 5 seconds
    setTimeout(connectToMongoDB, 5000);
  }
};

// Listen for connection events
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
  isMongoConnected = true;
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
  isMongoConnected = false;
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected from MongoDB');
  isMongoConnected = false;
});

// Database connection check middleware
app.use((req, res, next) => {
  if (!isMongoConnected) {
    return res.status(503).json({ 
      error: 'Service temporarily unavailable',
      message: 'Database connection not ready. Please try again in a few seconds.',
      timestamp: new Date().toISOString(),
      details: 'MongoDB connection is being established. This is normal during deployment startup.'
    });
  }
  next();
});

// Routes
// app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
// app.use('/api/tasks', taskRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/notifications', notificationRoutes);

app.use('/api/lead-sources', leadSourceRoutes);
app.use('/api/lead-statuses', leadStatusRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/lead-activities', leadActivityRoutes);
app.use('/api/user-reporting', userReportingRoutes);
// app.use('/api/user-projects', userProjectRoutes);
app.use('/api/user', userDashboardRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/follow-ups', followUpRoutes);

app.use('/api/cp-sourcing', cpSourcingRoutes);
app.use('/api/channel-partner', channelPartnerRouters);
app.use('/', imageRoutes);
app.use('/api/dashboard', dashBoardRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/reminder', reminderRoutes);
app.use('/api/follow-ups', followUpRoutes);
app.use('/api/test', testNotificationRoutes);
app.use('/api/test-reminder', testReminderRoutes);
app.use('/api/attendance', attendanceRoutes);

// Basic route
app.get('/', (req, res) => {
  res.send('DeltaYards CRM API');
});

// Socket.io for real-time location updates
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

// Debug route to test CORS
app.get('/api/test-cors', (req, res) => {
  console.log('CORS test request received');
  console.log('Origin:', req.headers.origin);
  console.log('User-Agent:', req.headers['user-agent']);
  res.json({ 
    message: 'CORS test successful',
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

// CORS test endpoint specifically for realtechmktg.com
app.get('/api/cors-test-realtech', (req, res) => {
  console.log('🔍 RealTech CORS test request:');
  console.log('  Origin:', req.headers.origin);
  console.log('  Method:', req.method);
  console.log('  Headers:', req.headers);
  
  res.json({ 
    message: 'RealTech CORS test successful',
    origin: req.headers.origin,
    allowed: true,
    timestamp: new Date().toISOString()
  });
});

// Admin login CORS test endpoint
app.get('/api/admin-login-test', (req, res) => {
  console.log('🔍 Admin Login CORS test request:');
  console.log('  Origin:', req.headers.origin);
  console.log('  Method:', req.method);
  console.log('  Headers:', req.headers);
  
  res.json({ 
    message: 'Admin Login CORS test successful',
    origin: req.headers.origin,
    allowed: true,
    timestamp: new Date().toISOString(),
    corsHeaders: {
      'Access-Control-Allow-Origin': req.headers.origin,
      'Access-Control-Allow-Credentials': 'true'
    }
  });
});

// Database health check route fjf
app.get('/api/health', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const connectionState = mongoose.connection.readyState;
    const stateNames = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    res.json({
      status: 'ok',
      database: {
        connected: isMongoConnected,
        mongooseState: stateNames[connectionState] || 'unknown',
        readyState: connectionState,
        globalStatus: isMongoConnected
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Global error handling middleware
app.use(globalErrorHandler);

// Start server
const PORT = process.env.PORT || 5000;

// const startServer = () => {
//   if (isMongoConnected) {
//     server.listen(PORT, () => {
//       console.log(`Server running on port ${PORT}`);
//       console.log('MongoDB connection status:', isMongoConnected);
//       initLeadSource();
//     });
//   } else {
//     console.log('Waiting for MongoDB connection...');
//     setTimeout(startServer, 2000);
//   }
// };

const startServer = async () => {
  if (isMongoConnected) {
    // Initialize database optimizations
    try {
      const databaseOptimizer = require('./utils/databaseOptimizer');
      await databaseOptimizer.createOptimizedIndexes();
      console.log('✅ Database optimizations applied');
    } catch (error) {
      console.warn('⚠️ Database optimization failed:', error.message);
      console.warn('Stack trace:', error.stack);
      // Don't let optimization failure prevent server startup
    }

    try {
      server.listen(PORT, async () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log('MongoDB connection status:', isMongoConnected);
        
        try {
          await initLeadSource();
          console.log('✅ Lead source initialization completed');
        } catch (error) {
          console.error('⚠️ Lead source initialization failed:', error.message);
          console.error('Stack trace:', error.stack);
          // Don't let lead source initialization failure crash the server
        }
        
        console.log('🎉 Application startup completed successfully!');
      });
    } catch (error) {
      console.error('❌ Failed to start server:', error.message);
      console.error('Stack trace:', error.stack);
      // Retry after 5 seconds
      setTimeout(startServer, 5000);
    }
  } else {
    console.log('⏳ Waiting for MongoDB connection...');
    setTimeout(startServer, 2000);
  }
};

// Start MongoDB connection
console.log('Starting MongoDB connection...');
connectToMongoDB();

// CORS preflight handler for all routes
app.options('*', cors(corsOptions));

// Special CORS preflight handler for admin-login endpoint
app.options('/api/superadmin/admin-login', cors(adminLoginCorsOptions));

// Export for Vercel
module.exports = app;

