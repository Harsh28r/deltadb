/**
 * Integration Script for DeltaYards CRM Optimizations
 * This script integrates all the optimized components with the existing system
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import optimization components
const databaseOptimizer = require('../utils/databaseOptimizer');
const cacheManager = require('../utils/cacheManager');
const logger = require('../utils/logger');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const Reminder = require('../models/Reminder');
const LeadActivity = require('../models/LeadActivity');
const UserReporting = require('../models/UserReporting');


class OptimizationIntegrator {
  constructor() {
    this.integrationSteps = [
      'Database Connection',
      'Password Security Fix',
      'Database Optimization',
      'Cache System Integration',
      'Middleware Integration',
      'Service Layer Integration',
      'WebSocket Integration',
      'Validation System Integration',
      'Logging System Integration',
      'Rate Limiting Integration'
    ];
    this.completedSteps = [];
  }

  /**
   * Run full integration process
   */
  async runIntegration() {
    try {
      console.log('🚀 Starting DeltaYards CRM Optimization Integration...\n');

      await this.connectDatabase();
      await this.fixPasswordSecurity();
      await this.optimizeDatabase();
      await this.integrateCaching();
      await this.integrateMiddleware();
      await this.integrateServices();
      await this.integrateWebSocket();
      await this.integrateValidation();
      await this.integrateLogging();
      await this.integrateRateLimiting();

      console.log('\n✅ Integration Complete!');
      this.printSummary();

    } catch (error) {
      console.error('❌ Integration failed:', error);
      throw error;
    }
  }

  /**
   * Connect to database
   */
  async connectDatabase() {
    console.log('📡 Connecting to database...');

    try {
      const MONGO_URI = 'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0' || process.env.MONGO_URI;

      await mongoose.connect(MONGO_URI, {
        maxPoolSize: 50,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        retryWrites: true,
        w: 'majority'
      });

      console.log('✅ Database connected successfully');
      this.completedSteps.push('Database Connection');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  /**
   * Fix password security
   */
  async fixPasswordSecurity() {
    console.log('🔒 Fixing password security...');

    try {
      // Update User model to use proper password hashing
      const userModelPath = require('path').join(__dirname, '../models/User.js');
      const fs = require('fs');

      let userModelContent = fs.readFileSync(userModelPath, 'utf8');

      // Replace insecure password comparison
      const securePasswordMethod = `
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password || !enteredPassword) return false;

  // Handle both hashed and plain text passwords (for migration)
  if (this.password.length > 20 && this.password.startsWith('$2')) {
    const bcrypt = require('bcryptjs');
    return await bcrypt.compare(enteredPassword, this.password);
  } else {
    // Fallback for plain text passwords during migration
    return this.password === enteredPassword;
  }
};`;

      // Add password hashing pre-save hook
      const passwordHashHook = `
// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password') || this.password.length > 20) return next();

  try {
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});`;

      userModelContent = userModelContent.replace(
        /userSchema\.methods\.matchPassword[\s\S]*?};/,
        securePasswordMethod
      );

      // Add the pre-save hook before the module.exports
      userModelContent = userModelContent.replace(
        'module.exports = mongoose.model(\'User\', userSchema);',
        passwordHashHook + '\n\nmodule.exports = mongoose.model(\'User\', userSchema);'
      );

      fs.writeFileSync(userModelPath, userModelContent);

      console.log('✅ Password security implemented');
      this.completedSteps.push('Password Security Fix');
    } catch (error) {
      console.error('❌ Password security fix failed:', error);
      throw error;
    }
  }

  /**
   * Optimize database
   */
  async optimizeDatabase() {
    console.log('📊 Optimizing database...');

    try {
      await databaseOptimizer.createOptimizedIndexes();
      await databaseOptimizer.setupCollectionPartitioning();

      console.log('✅ Database optimization complete');
      this.completedSteps.push('Database Optimization');
    } catch (error) {
      console.error('❌ Database optimization failed:', error);
      throw error;
    }
  }

  /**
   * Integrate caching system
   */
  async integrateCaching() {
    console.log('🚀 Integrating caching system...');

    try {
      // Test cache functionality
      cacheManager.setUser('test', { name: 'Test User' });
      const testUser = cacheManager.getUser('test');

      if (testUser && testUser.name === 'Test User') {
        console.log('✅ Cache system working correctly');
        this.completedSteps.push('Cache System Integration');
      } else {
        throw new Error('Cache system test failed');
      }
    } catch (error) {
      console.error('❌ Cache integration failed:', error);
      throw error;
    }
  }

  /**
   * Integrate middleware
   */
  async integrateMiddleware() {
    console.log('🛡️ Integrating middleware...');

    try {
      // Create middleware integration file
      const middlewareIntegration = `
// Enhanced middleware integration for DeltaYards CRM
const { smartRateLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');
const validator = require('../utils/validator');

// Middleware functions
const enhancedMiddleware = {
  // Rate limiting middleware
  rateLimiting: smartRateLimiter,

  // Request logging middleware
  requestLogging: logger.createRequestMiddleware(),

  // Error handling middleware
  errorHandling: logger.createErrorMiddleware(),

  // Validation middleware factory
  validation: (schema, source = 'body') => validator.createValidationMiddleware(schema, source)
};

module.exports = enhancedMiddleware;
`;

      const fs = require('fs');
      const middlewarePath = require('path').join(__dirname, '../middleware/enhanced.js');
      fs.writeFileSync(middlewarePath, middlewareIntegration);

      console.log('✅ Middleware integration files created');
      this.completedSteps.push('Middleware Integration');
    } catch (error) {
      console.error('❌ Middleware integration failed:', error);
      throw error;
    }
  }

  /**
   * Integrate service layer
   */
  async integrateServices() {
    console.log('⚙️ Integrating service layer...');

    try {
      // Create service integration example
      const serviceIntegration = `
// Service Integration Guide for Controllers
// Replace existing controller logic with service calls

const userService = require('../services/userService');
const leadService = require('../services/leadService');
const notificationService = require('../services/notificationService');
const reminderService = require('../services/reminderService');

// Example: Enhanced User Controller with Service Integration
const enhancedUserController = {

  // Create user using service
  async createUser(req, res) {
    try {
      const { user, token } = await userService.registerUser(req.body);
      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: { user, token }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  // Get users with advanced filtering
  async getUsers(req, res) {
    try {
      const result = await userService.getUsers(req.query);
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
};

// Example: Enhanced Lead Controller with Service Integration
const enhancedLeadController = {

  // Create lead using service
  async createLead(req, res) {
    try {
      const lead = await leadService.createLead(req.body, req.user.id);
      res.status(201).json({
        success: true,
        message: 'Lead created successfully',
        data: lead
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  // Get leads with advanced filtering and caching
  async getLeads(req, res) {
    try {
      const result = await leadService.getLeads(req.query, req.user.id);
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
};

module.exports = {
  enhancedUserController,
  enhancedLeadController
};
`;

      const fs = require('fs');
      const servicePath = require('path').join(__dirname, '../controllers/enhanced.js');
      fs.writeFileSync(servicePath, serviceIntegration);

      console.log('✅ Service integration examples created');
      this.completedSteps.push('Service Layer Integration');
    } catch (error) {
      console.error('❌ Service integration failed:', error);
      throw error;
    }
  }

  /**
   * Integrate WebSocket
   */
  async integrateWebSocket() {
    console.log('🔌 Integrating WebSocket system...');

    try {
      // Create WebSocket integration guide
      const webSocketIntegration = `
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
`;

      const fs = require('fs');
      const webSocketPath = require('path').join(__dirname, '../websocket/integration.js');
      fs.writeFileSync(webSocketPath, webSocketIntegration);

      console.log('✅ WebSocket integration guide created');
      this.completedSteps.push('WebSocket Integration');
    } catch (error) {
      console.error('❌ WebSocket integration failed:', error);
      throw error;
    }
  }

  /**
   * Integrate validation system
   */
  async integrateValidation() {
    console.log('✅ Integrating validation system...');

    try {
      // Test validation system
      const validator = require('../utils/validator');

      const testData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };

      const result = validator.validateUserRegistration(testData);

      if (result.isValid) {
        console.log('✅ Validation system working correctly');
        this.completedSteps.push('Validation System Integration');
      } else {
        throw new Error('Validation system test failed');
      }
    } catch (error) {
      console.error('❌ Validation integration failed:', error);
      throw error;
    }
  }

  /**
   * Integrate logging system
   */
  async integrateLogging() {
    console.log('📝 Integrating logging system...');

    try {
      // Test logging system
      logger.info('Integration test log message');
      logger.performance('test_operation', 150, { testData: true });

      console.log('✅ Logging system integrated');
      this.completedSteps.push('Logging System Integration');
    } catch (error) {
      console.error('❌ Logging integration failed:', error);
      throw error;
    }
  }

  /**
   * Integrate rate limiting
   */
  async integrateRateLimiting() {
    console.log('🚦 Integrating rate limiting...');

    try {
      // Create rate limiting integration instructions
      const rateLimitingGuide = `
// Rate Limiting Integration
// Add this to your server.js file before route definitions

const { smartRateLimiter, rateLimiters } = require('./middleware/rateLimiter');

// Apply smart rate limiting globally
app.use(smartRateLimiter);

// Or apply specific rate limiters to specific routes
app.use('/api/superadmin', rateLimiters.admin);
app.use('/api/leads', rateLimiters.leads);
app.use('/api/upload', rateLimiters.upload);

console.log('✅ Rate limiting applied');
`;

      const fs = require('fs');
      const rateLimitPath = require('path').join(__dirname, '../middleware/rateLimitingGuide.js');
      fs.writeFileSync(rateLimitPath, rateLimitingGuide);

      console.log('✅ Rate limiting integration guide created');
      this.completedSteps.push('Rate Limiting Integration');
    } catch (error) {
      console.error('❌ Rate limiting integration failed:', error);
      throw error;
    }
  }

  /**
   * Print integration summary
   */
  printSummary() {
    console.log('\n📋 Integration Summary:');
    console.log('========================');

    this.integrationSteps.forEach(step => {
      const status = this.completedSteps.includes(step) ? '✅' : '❌';
      console.log(`${status} ${step}`);
    });

    console.log('\n📊 Integration Statistics:');
    console.log(`Completed: ${this.completedSteps.length}/${this.integrationSteps.length}`);
    console.log(`Success Rate: ${Math.round(this.completedSteps.length / this.integrationSteps.length * 100)}%`);

    if (this.completedSteps.length === this.integrationSteps.length) {
      console.log('\n🎉 All optimizations successfully integrated!');
      console.log('\n📝 Next Steps:');
      console.log('1. Update server.js with WebSocket integration');
      console.log('2. Replace controller methods with service calls');
      console.log('3. Apply middleware to routes');
      console.log('4. Test all API endpoints');
      console.log('5. Monitor performance improvements');
    } else {
      console.log('\n⚠️  Some integrations failed. Please review errors above.');
    }
  }
}

// Run integration if called directly
if (require.main === module) {
  const integrator = new OptimizationIntegrator();
  integrator.runIntegration()
    .then(() => {
      console.log('Integration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Integration failed:', error);
      process.exit(1);
    });
}

module.exports = OptimizationIntegrator;