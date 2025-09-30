const mongoose = require('mongoose');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const Reminder = require('../models/Reminder');
const LeadActivity = require('../models/LeadActivity');
const UserReporting = require('../models/UserReporting');


class DatabaseOptimizer {
  constructor() {
    this.indexCreationQueue = [];
    this.optimizationStats = {
      indexesCreated: 0,
      schemasOptimized: 0,
      queryOptimizations: 0
    };
  }

  /**
   * Create optimized indexes for all models
   */
  async createOptimizedIndexes() {
    console.log('🚀 Creating optimized database indexes for large datasets...');

    try {
      // User model indexes
      await this.optimizeUserIndexes();

      // Lead model indexes
      await this.optimizeLeadIndexes();

      // Project model indexes
      await this.optimizeProjectIndexes();

      // Task model indexes
      await this.optimizeTaskIndexes();

      // Notification model indexes
      await this.optimizeNotificationIndexes();

      // Reminder model indexes
      await this.optimizeReminderIndexes();

      // Lead Activity indexes
      await this.optimizeLeadActivityIndexes();

      // User Reporting indexes
      await this.optimizeUserReportingIndexes();

      console.log('✅ Database optimization completed');
      this.logOptimizationStats();

    } catch (error) {
      console.error('❌ Database optimization failed:', error.message);
      console.error('Stack trace:', error.stack);
      
      // Log optimization stats even if there were errors
      this.logOptimizationStats();
      
      // Re-throw the error but with better logging
      throw new Error(`Database optimization failed: ${error.message}`);
    }
  }

  /**
   * Optimize User model indexes
   */
  async optimizeUserIndexes() {
    try {
      const User = mongoose.model('User');

      const indexes = [
        // Authentication queries
        { email: 1 }, // Login queries
        { email: 1, isActive: 1 }, // Active user login

        // Role-based queries
        { role: 1, level: 1 }, // Hierarchical queries
        { level: 1, isActive: 1 }, // Active users by level

        // Permission queries
        { role: 1, isActive: 1 }, // Role-based access

        // Project assignment queries
        { 'restrictions.allowedProjects': 1 }, // Project access
        { 'restrictions.deniedProjects': 1 }, // Project restrictions

        // Compound indexes for complex queries
        { role: 1, level: 1, isActive: 1, createdAt: -1 }, // User management queries
        { email: 1, role: 1, isActive: 1 }, // Admin user searches

        // Text search index for names
        { name: 'text', email: 'text' }
      ];

      await this.createIndexes(User, indexes, 'User');
    } catch (error) {
      console.error('❌ Error optimizing User indexes:', error.message);
      // Don't re-throw, continue with other optimizations
    }
  }

  /**
   * Optimize Lead model indexes
   */
  async optimizeLeadIndexes() {
    try {
      const Lead = mongoose.model('Lead');

    const indexes = [
      // Basic queries
      { user: 1, createdAt: -1 }, // User's leads
      { project: 1, createdAt: -1 }, // Project leads
      { currentStatus: 1 }, // Status-based queries

      // Performance critical indexes
      { user: 1, project: 1 }, // User project leads
      { project: 1, currentStatus: 1 }, // Project status leads
      { channelPartner: 1, createdAt: -1 }, // CP leads
      { cpSourcingId: 1, createdAt: -1 }, // CP sourcing leads

      // Activity tracking
      { isActive: 1, createdAt: -1 }, // Active leads
      { createdBy: 1, createdAt: -1 }, // Created by user
      { updatedBy: 1, updatedAt: -1 }, // Last updated

      // Complex business queries
      { project: 1, currentStatus: 1, isActive: 1, createdAt: -1 },
      { user: 1, currentStatus: 1, isActive: 1 },
      { channelPartner: 1, currentStatus: 1, isActive: 1 },

      // Status history queries (sparse index for efficiency)
      { 'statusHistory.changedAt': -1 },

      // Lead source analytics
      { leadSource: 1, createdAt: -1 },
      { leadSource: 1, currentStatus: 1 }
    ];

      await this.createIndexes(Lead, indexes, 'Lead');
    } catch (error) {
      console.error('❌ Error optimizing Lead indexes:', error.message);
      // Don't re-throw, continue with other optimizations
    }
  }

  /**
   * Optimize Project model indexes
   */
  async optimizeProjectIndexes() {
    try {
      const Project = mongoose.model('Project');

    const indexes = [
      // Basic queries
      { name: 1 }, // Project search
      { owner: 1 }, // Owner's projects
      { 'members': 1 }, // Member projects
      { 'managers': 1 }, // Manager projects

      // Location-based queries
      { location: 1 }, // Location filtering
      { developBy: 1 }, // Developer filtering

      // Compound indexes for complex queries
      { owner: 1, createdAt: -1 }, // Owner's projects by date
      { location: 1, createdAt: -1 }, // Location projects by date

      // Text search
      { name: 'text', location: 'text', developBy: 'text' }
    ];

      await this.createIndexes(Project, indexes, 'Project');
    } catch (error) {
      console.error('❌ Error optimizing Project indexes:', error.message);
      // Don't re-throw, continue with other optimizations
    }
  }

  /**
   * Optimize Task model indexes
   */
  async optimizeTaskIndexes() {
    try {
      const Task = mongoose.model('Task');

    const indexes = [
      // Assignment queries
      { assignedTo: 1, createdAt: -1 },
      { createdBy: 1, createdAt: -1 },

      // Project tasks
      { project: 1, createdAt: -1 },
      { project: 1, status: 1 },

      // Priority and status
      { priority: 1, status: 1 },
      { status: 1, dueDate: 1 },

      // Due date queries
      { dueDate: 1, status: 1 },
      { dueDate: 1, assignedTo: 1 },

      // Complex queries
      { assignedTo: 1, status: 1, priority: 1 },
      { project: 1, assignedTo: 1, status: 1 }
    ];

      await this.createIndexes(Task, indexes, 'Task');
    } catch (error) {
      console.error('❌ Error optimizing Task indexes:', error.message);
      // Don't re-throw, continue with other optimizations
    }
  }

  /**
   * Optimize Notification model indexes
   */
  async optimizeNotificationIndexes() {
    try {
      const Notification = mongoose.model('Notification');

    const indexes = [
      // User notifications
      { recipient: 1, createdAt: -1 },
      { recipient: 1, read: 1, createdAt: -1 },

      // Unread notifications
      { recipient: 1, read: 1 },

      // Notification type queries
      { type: 1, createdAt: -1 },
      { recipient: 1, type: 1 },

      // TTL index for auto-deletion of old notifications
      { createdAt: 1 }, // Will be configured with expireAfterSeconds

      // Priority notifications
      { recipient: 1, priority: 1, read: 1 }
    ];

      await this.createIndexes(Notification, indexes, 'Notification');

      // Create TTL index for auto-cleanup (delete after 90 days)
      await this.createTTLIndex(Notification, 'createdAt', 90 * 24 * 60 * 60);
    } catch (error) {
      console.error('❌ Error optimizing Notification indexes:', error.message);
      // Don't re-throw, continue with other optimizations
    }
  }

  /**
   * Optimize Reminder model indexes
   */
  async optimizeReminderIndexes() {
    try {
      const Reminder = mongoose.model('Reminder');

    const indexes = [
      // User reminders
      { user: 1, reminderDate: 1 },
      { user: 1, isCompleted: 1 },

      // Active reminders
      { reminderDate: 1, isCompleted: 1 },

      // Task reminders
      { task: 1, reminderDate: 1 },

      // Due reminders (for processing)
      { reminderDate: 1, isCompleted: 1, isActive: 1 },

      // Recurring reminders
      { isRecurring: 1, reminderDate: 1 }
    ];

      await this.createIndexes(Reminder, indexes, 'Reminder');
    } catch (error) {
      console.error('❌ Error optimizing Reminder indexes:', error.message);
      // Don't re-throw, continue with other optimizations
    }
  }

  /**
   * Optimize Lead Activity indexes
   */
  async optimizeLeadActivityIndexes() {
    try {
      const LeadActivity = mongoose.model('LeadActivity');

    const indexes = [
      // Lead activity timeline
      { lead: 1, createdAt: -1 },

      // User activity tracking
      { user: 1, createdAt: -1 },

      // Activity type queries
      { activityType: 1, createdAt: -1 },

      // Combined queries
      { lead: 1, activityType: 1, createdAt: -1 },
      { user: 1, activityType: 1, createdAt: -1 },

      // TTL index for cleanup (keep for 1 year)
      { createdAt: 1 }
    ];

      await this.createIndexes(LeadActivity, indexes, 'LeadActivity');

      // Create TTL index for auto-cleanup (delete after 365 days)
      await this.createTTLIndex(LeadActivity, 'createdAt', 365 * 24 * 60 * 60);
    } catch (error) {
      console.error('❌ Error optimizing LeadActivity indexes:', error.message);
      // Don't re-throw, continue with other optimizations
    }
  }

  /**
   * Optimize User Reporting indexes
   */
  async optimizeUserReportingIndexes() {
    try {
      const UserReporting = mongoose.model('UserReporting');

    const indexes = [
      // User reporting queries
      { user: 1 },
      { level: 1 },

      // Reporting hierarchy
      { 'reportsTo.user': 1 },
      { 'reportsTo.teamType': 1 },

      // Complex hierarchy queries
      { user: 1, level: 1 },
      { level: 1, 'reportsTo.user': 1 }
    ];

      await this.createIndexes(UserReporting, indexes, 'UserReporting');
    } catch (error) {
      console.error('❌ Error optimizing UserReporting indexes:', error.message);
      // Don't re-throw, continue with other optimizations
    }
  }

  /**
   * Create indexes for a model
   */
  async createIndexes(Model, indexes, modelName) {
    console.log(`📊 Creating indexes for ${modelName}...`);

    for (const index of indexes) {
      try {
        const options = {
          background: true, // Create in background for production
          name: this.generateIndexName(index)
        };

        // Use the collection's createIndex method instead of Model.createIndex
        await Model.collection.createIndex(index, options);
        this.optimizationStats.indexesCreated++;

        console.log(`✅ Created index for ${modelName}:`, index);
      } catch (error) {
        // Index might already exist, which is fine
        if (error.code !== 11000 && !error.message.includes('already exists') && !error.message.includes('Index with name')) {
          console.warn(`⚠️ Warning creating index for ${modelName}:`, error.message);
        } else {
          console.log(`ℹ️ Index already exists for ${modelName}:`, Object.keys(index).join('_'));
        }
      }
    }
  }

  /**
   * Create TTL index for automatic document expiration
   */
  async createTTLIndex(Model, field, expireAfterSeconds) {
    try {
      const options = {
        expireAfterSeconds,
        background: true,
        name: `ttl_${field}_${expireAfterSeconds}`
      };

      // Use the collection's createIndex method
      await Model.collection.createIndex({ [field]: 1 }, options);
      console.log(`✅ Created TTL index for ${Model.modelName} (expires after ${expireAfterSeconds} seconds)`);
    } catch (error) {
      if (!error.message.includes('already exists') && !error.message.includes('Index with name')) {
        console.warn(`⚠️ Warning creating TTL index for ${Model.modelName}:`, error.message);
      } else {
        console.log(`ℹ️ TTL index already exists for ${Model.modelName}`);
      }
    }
  }

  /**
   * Generate consistent index names
   */
  generateIndexName(indexSpec) {
    const fields = Object.keys(indexSpec).join('_');
    const directions = Object.values(indexSpec).join('_');
    return `idx_${fields}_${directions}`.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Analyze slow queries and suggest optimizations
   */
  async analyzeSlowQueries() {
    console.log('🔍 Analyzing slow queries...');

    const db = mongoose.connection.db;

    try {
      // Enable profiling for slow operations (> 100ms)
      await db.admin().command({
        profile: 2,
        slowms: 100,
        sampleRate: 0.1 // Sample 10% of operations
      });

      console.log('✅ Database profiling enabled for slow query analysis');
    } catch (error) {
      console.warn('⚠️ Could not enable profiling:', error.message);
    }
  }

  /**
   * Create compound indexes based on query patterns
   */
  async createCompoundIndexes() {
    console.log('🔧 Creating compound indexes for complex queries...');

    // Define common query patterns and their compound indexes
    const compoundIndexes = [
      // User management compound indexes
      {
        model: 'User',
        indexes: [
          { email: 1, role: 1, isActive: 1 },
          { role: 1, level: 1, isActive: 1, createdAt: -1 }
        ]
      },

      // Lead management compound indexes
      {
        model: 'Lead',
        indexes: [
          { project: 1, user: 1, currentStatus: 1, isActive: 1 },
          { channelPartner: 1, project: 1, currentStatus: 1 },
          { leadSource: 1, project: 1, createdAt: -1 },
          { user: 1, project: 1, currentStatus: 1, createdAt: -1 }
        ]
      },

      // Task compound indexes
      {
        model: 'Task',
        indexes: [
          { project: 1, assignedTo: 1, status: 1, priority: 1 },
          { assignedTo: 1, dueDate: 1, status: 1 },
          { createdBy: 1, project: 1, status: 1 }
        ]
      }
    ];

    for (const { model, indexes } of compoundIndexes) {
      const Model = mongoose.model(model);
      await this.createIndexes(Model, indexes, model);
    }
  }

  /**
   * Optimize collections with partitioning strategy
   */
  async setupCollectionPartitioning() {
    console.log('📦 Setting up collection partitioning strategies...');

    // For very large collections, we can implement time-based partitioning
    // This is more of a strategy recommendation as MongoDB doesn't have built-in partitioning

    const partitioningStrategies = {
      leads: {
        strategy: 'time-based',
        field: 'createdAt',
        interval: 'monthly',
        recommendation: 'Consider archiving leads older than 2 years'
      },
      leadActivities: {
        strategy: 'time-based',
        field: 'createdAt',
        interval: 'monthly',
        recommendation: 'Archive activities older than 1 year, keep only summaries'
      },
      notifications: {
        strategy: 'ttl',
        field: 'createdAt',
        expireAfter: '90 days',
        recommendation: 'Auto-delete notifications after 90 days'
      }
    };

    console.log('📊 Partitioning strategies configured:', partitioningStrategies);
    return partitioningStrategies;
  }

  /**
   * Log optimization statistics
   */
  logOptimizationStats() {
    console.log('📈 Database Optimization Statistics:');
    console.log(`  - Indexes created: ${this.optimizationStats.indexesCreated}`);
    console.log(`  - Schemas optimized: ${this.optimizationStats.schemasOptimized}`);
    console.log(`  - Query optimizations: ${this.optimizationStats.queryOptimizations}`);
  }

  /**
   * Monitor index usage and performance
   */
  async monitorIndexPerformance() {
    console.log('📊 Monitoring index performance...');

    const db = mongoose.connection.db;
    const collections = ['users', 'leads', 'projects', 'tasks', 'notifications'];

    for (const collectionName of collections) {
      try {
        const stats = await db.collection(collectionName).indexStats();
        console.log(`Index stats for ${collectionName}:`, stats);
      } catch (error) {
        console.warn(`Could not get stats for ${collectionName}:`, error.message);
      }
    }
  }

  /**
   * Get recommendations for further optimization
   */
  getOptimizationRecommendations() {
    return {
      indexing: [
        'Monitor index usage with db.collection.indexStats()',
        'Remove unused indexes to improve write performance',
        'Consider partial indexes for frequently filtered queries',
        'Use sparse indexes for optional fields'
      ],
      queries: [
        'Use projection to limit returned fields',
        'Implement pagination for large result sets',
        'Use lean() for read-only queries',
        'Batch operations where possible'
      ],
      schema: [
        'Denormalize frequently accessed data',
        'Use appropriate data types (ObjectId vs String)',
        'Consider subdocuments vs references based on access patterns',
        'Implement proper validation at schema level'
      ],
      performance: [
        'Use connection pooling for high concurrency',
        'Implement caching for frequently accessed data',
        'Monitor and optimize slow queries',
        'Use read preferences for load distribution'
      ]
    };
  }
}

module.exports = new DatabaseOptimizer();