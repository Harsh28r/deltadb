const Joi = require('joi');
const mongoose = require('mongoose');

class Validator {
  constructor() {
    // Common validation schemas
    this.commonSchemas = {
      objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message('Invalid ObjectId format'),
      email: Joi.string().email().lowercase().trim(),
      password: Joi.string().min(6).max(100),
      phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).message('Invalid phone number format'),
      url: Joi.string().uri(),
      date: Joi.date().iso()
    };

    // Initialize validation schemas
    this.initializeSchemas();
  }

  initializeSchemas() {
    // User validation schemas
    this.userSchemas = {
      register: Joi.object({
        name: Joi.string().min(2).max(100).trim().required(),
        email: this.commonSchemas.email.required(),
        password: this.commonSchemas.password.required(),
        mobile: this.commonSchemas.phone.optional(),
        role: Joi.string().valid('user', 'manager', 'admin', 'superadmin').default('user'),
        level: Joi.number().integer().min(1).max(5).default(3)
      }),

      login: Joi.object({
        email: this.commonSchemas.email.required(),
        password: Joi.string().required()
      }),

      update: Joi.object({
        name: Joi.string().min(2).max(100).trim().optional(),
        email: this.commonSchemas.email.optional(),
        mobile: this.commonSchemas.phone.optional(),
        role: Joi.string().valid('user', 'manager', 'admin', 'superadmin').optional(),
        level: Joi.number().integer().min(1).max(5).optional(),
        isActive: Joi.boolean().optional(),
        customPermissions: Joi.object({
          allowed: Joi.array().items(Joi.string()).optional(),
          denied: Joi.array().items(Joi.string()).optional()
        }).optional(),
        restrictions: Joi.object({
          maxProjects: Joi.number().integer().min(0).optional(),
          allowedProjects: Joi.array().items(this.commonSchemas.objectId).optional(),
          deniedProjects: Joi.array().items(this.commonSchemas.objectId).optional()
        }).optional()
      })
    };

    // Lead validation schemas
    this.leadSchemas = {
      create: Joi.object({
        user: this.commonSchemas.objectId.required(),
        project: this.commonSchemas.objectId.required(),
        leadSource: this.commonSchemas.objectId.required(),
        currentStatus: this.commonSchemas.objectId.required(),
        channelPartner: this.commonSchemas.objectId.optional(),
        cpSourcingId: this.commonSchemas.objectId.optional(),
        customData: Joi.object().optional()
      }),

      update: Joi.object({
        customData: Joi.object().optional(),
        channelPartner: this.commonSchemas.objectId.optional(),
        cpSourcingId: this.commonSchemas.objectId.optional(),
        isActive: Joi.boolean().optional()
      }),

      statusChange: Joi.object({
        newStatusId: this.commonSchemas.objectId.required(),
        newData: Joi.object().required(),
        comment: Joi.string().max(500).optional()
      }),

      query: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20),
        project: this.commonSchemas.objectId.optional(),
        user: this.commonSchemas.objectId.optional(),
        currentStatus: this.commonSchemas.objectId.optional(),
        leadSource: this.commonSchemas.objectId.optional(),
        channelPartner: this.commonSchemas.objectId.optional(),
        startDate: this.commonSchemas.date.optional(),
        endDate: this.commonSchemas.date.optional(),
        sortBy: Joi.string().valid('createdAt', 'updatedAt', 'user', 'project').default('createdAt'),
        sortOrder: Joi.string().valid('asc', 'desc').default('desc')
      })
    };

    // Project validation schemas
    this.projectSchemas = {
      create: Joi.object({
        name: Joi.string().min(2).max(200).trim().required(),
        location: Joi.string().min(2).max(200).trim().required(),
        developBy: Joi.string().min(2).max(200).trim().required(),
        owner: this.commonSchemas.objectId.required(),
        members: Joi.array().items(this.commonSchemas.objectId).optional(),
        managers: Joi.array().items(this.commonSchemas.objectId).optional(),
        logo: Joi.string().uri().optional()
      }),

      update: Joi.object({
        name: Joi.string().min(2).max(200).trim().optional(),
        location: Joi.string().min(2).max(200).trim().optional(),
        developBy: Joi.string().min(2).max(200).trim().optional(),
        logo: Joi.string().uri().optional()
      }),

      members: Joi.object({
        action: Joi.string().valid('add', 'remove').required(),
        userIds: Joi.array().items(this.commonSchemas.objectId).min(1).required(),
        type: Joi.string().valid('members', 'managers').default('members')
      })
    };

    // Task validation schemas
    this.taskSchemas = {
      create: Joi.object({
        title: Joi.string().min(2).max(200).trim().required(),
        description: Joi.string().max(1000).optional(),
        assignedTo: this.commonSchemas.objectId.required(),
        project: this.commonSchemas.objectId.required(),
        dueDate: this.commonSchemas.date.required(),
        priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
        status: Joi.string().valid('todo', 'in_progress', 'review', 'completed').default('todo'),
        tags: Joi.array().items(Joi.string().trim()).optional(),
        attachments: Joi.array().items(Joi.string().uri()).optional()
      }),

      update: Joi.object({
        title: Joi.string().min(2).max(200).trim().optional(),
        description: Joi.string().max(1000).optional(),
        assignedTo: this.commonSchemas.objectId.optional(),
        dueDate: this.commonSchemas.date.optional(),
        priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
        status: Joi.string().valid('todo', 'in_progress', 'review', 'completed').optional(),
        tags: Joi.array().items(Joi.string().trim()).optional(),
        attachments: Joi.array().items(Joi.string().uri()).optional()
      })
    };

    // Reminder validation schemas
    this.reminderSchemas = {
      create: Joi.object({
        user: this.commonSchemas.objectId.required(),
        task: this.commonSchemas.objectId.optional(),
        title: Joi.string().min(2).max(200).trim().required(),
        description: Joi.string().max(500).optional(),
        reminderDate: this.commonSchemas.date.required(),
        isRecurring: Joi.boolean().default(false),
        recurrencePattern: Joi.when('isRecurring', {
          is: true,
          then: Joi.object({
            type: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly').required(),
            interval: Joi.number().integer().min(1).default(1),
            endDate: this.commonSchemas.date.optional(),
            maxOccurrences: Joi.number().integer().min(1).optional()
          }).required(),
          otherwise: Joi.optional()
        })
      }),

      update: Joi.object({
        title: Joi.string().min(2).max(200).trim().optional(),
        description: Joi.string().max(500).optional(),
        reminderDate: this.commonSchemas.date.optional(),
        isRecurring: Joi.boolean().optional(),
        recurrencePattern: Joi.object({
          type: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly').optional(),
          interval: Joi.number().integer().min(1).optional(),
          endDate: this.commonSchemas.date.optional(),
          maxOccurrences: Joi.number().integer().min(1).optional()
        }).optional(),
        isActive: Joi.boolean().optional()
      })
    };

    // Notification validation schemas
    this.notificationSchemas = {
      send: Joi.object({
        recipient: this.commonSchemas.objectId.required(),
        type: Joi.string().valid(
          'info', 'warning', 'error', 'success',
          'lead_created', 'lead_status_change', 'task_assignment',
          'reminder', 'system_announcement'
        ).default('info'),
        title: Joi.string().min(2).max(200).trim().required(),
        message: Joi.string().min(2).max(1000).trim().required(),
        data: Joi.object().optional(),
        priority: Joi.string().valid('low', 'normal', 'high').default('normal')
      }),

      bulk: Joi.object({
        recipients: Joi.array().items(this.commonSchemas.objectId).min(1).required(),
        type: Joi.string().valid(
          'info', 'warning', 'error', 'success',
          'lead_created', 'lead_status_change', 'task_assignment',
          'reminder', 'system_announcement'
        ).default('info'),
        title: Joi.string().min(2).max(200).trim().required(),
        message: Joi.string().min(2).max(1000).trim().required(),
        data: Joi.object().optional(),
        priority: Joi.string().valid('low', 'normal', 'high').default('normal')
      })
    };

    // Query validation schemas
    this.querySchemas = {
      pagination: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20),
        sortBy: Joi.string().optional(),
        sortOrder: Joi.string().valid('asc', 'desc').default('desc')
      }),

      dateRange: Joi.object({
        startDate: this.commonSchemas.date.optional(),
        endDate: this.commonSchemas.date.optional()
      }).custom((value, helpers) => {
        if (value.startDate && value.endDate && value.startDate > value.endDate) {
          return helpers.error('custom.dateRange');
        }
        return value;
      }).messages({
        'custom.dateRange': 'Start date must be before end date'
      }),

      search: Joi.object({
        q: Joi.string().min(1).max(100).trim().optional(),
        fields: Joi.array().items(Joi.string()).optional()
      })
    };
  }

  /**
   * Validate data against schema
   * @param {Object} data - Data to validate
   * @param {Object} schema - Joi schema
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  validate(data, schema, options = {}) {
    const defaultOptions = {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    };

    const validationOptions = { ...defaultOptions, ...options };
    const result = schema.validate(data, validationOptions);

    if (result.error) {
      const errors = result.error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return {
        isValid: false,
        errors,
        data: null
      };
    }

    return {
      isValid: true,
      errors: [],
      data: result.value
    };
  }

  /**
   * Validate user registration data
   * @param {Object} data - User registration data
   * @returns {Object} Validation result
   */
  validateUserRegistration(data) {
    return this.validate(data, this.userSchemas.register);
  }

  /**
   * Validate user login data
   * @param {Object} data - User login data
   * @returns {Object} Validation result
   */
  validateUserLogin(data) {
    return this.validate(data, this.userSchemas.login);
  }

  /**
   * Validate user update data
   * @param {Object} data - User update data
   * @returns {Object} Validation result
   */
  validateUserUpdate(data) {
    return this.validate(data, this.userSchemas.update);
  }

  /**
   * Validate lead creation data
   * @param {Object} data - Lead creation data
   * @returns {Object} Validation result
   */
  validateLeadCreation(data) {
    return this.validate(data, this.leadSchemas.create);
  }

  /**
   * Validate lead update data
   * @param {Object} data - Lead update data
   * @returns {Object} Validation result
   */
  validateLeadUpdate(data) {
    return this.validate(data, this.leadSchemas.update);
  }

  /**
   * Validate lead status change data
   * @param {Object} data - Status change data
   * @returns {Object} Validation result
   */
  validateLeadStatusChange(data) {
    return this.validate(data, this.leadSchemas.statusChange);
  }

  /**
   * Validate lead query parameters
   * @param {Object} data - Query parameters
   * @returns {Object} Validation result
   */
  validateLeadQuery(data) {
    return this.validate(data, this.leadSchemas.query);
  }

  /**
   * Validate project creation data
   * @param {Object} data - Project creation data
   * @returns {Object} Validation result
   */
  validateProjectCreation(data) {
    return this.validate(data, this.projectSchemas.create);
  }

  /**
   * Validate project update data
   * @param {Object} data - Project update data
   * @returns {Object} Validation result
   */
  validateProjectUpdate(data) {
    return this.validate(data, this.projectSchemas.update);
  }

  /**
   * Validate project members update data
   * @param {Object} data - Members update data
   * @returns {Object} Validation result
   */
  validateProjectMembers(data) {
    return this.validate(data, this.projectSchemas.members);
  }

  /**
   * Validate task creation data
   * @param {Object} data - Task creation data
   * @returns {Object} Validation result
   */
  validateTaskCreation(data) {
    return this.validate(data, this.taskSchemas.create);
  }

  /**
   * Validate task update data
   * @param {Object} data - Task update data
   * @returns {Object} Validation result
   */
  validateTaskUpdate(data) {
    return this.validate(data, this.taskSchemas.update);
  }

  /**
   * Validate reminder creation data
   * @param {Object} data - Reminder creation data
   * @returns {Object} Validation result
   */
  validateReminderCreation(data) {
    return this.validate(data, this.reminderSchemas.create);
  }

  /**
   * Validate reminder update data
   * @param {Object} data - Reminder update data
   * @returns {Object} Validation result
   */
  validateReminderUpdate(data) {
    return this.validate(data, this.reminderSchemas.update);
  }

  /**
   * Validate notification send data
   * @param {Object} data - Notification data
   * @returns {Object} Validation result
   */
  validateNotificationSend(data) {
    return this.validate(data, this.notificationSchemas.send);
  }

  /**
   * Validate bulk notification data
   * @param {Object} data - Bulk notification data
   * @returns {Object} Validation result
   */
  validateBulkNotification(data) {
    return this.validate(data, this.notificationSchemas.bulk);
  }

  /**
   * Validate pagination parameters
   * @param {Object} data - Pagination data
   * @returns {Object} Validation result
   */
  validatePagination(data) {
    return this.validate(data, this.querySchemas.pagination);
  }

  /**
   * Validate date range parameters
   * @param {Object} data - Date range data
   * @returns {Object} Validation result
   */
  validateDateRange(data) {
    return this.validate(data, this.querySchemas.dateRange);
  }

  /**
   * Validate search parameters
   * @param {Object} data - Search data
   * @returns {Object} Validation result
   */
  validateSearch(data) {
    return this.validate(data, this.querySchemas.search);
  }

  /**
   * Validate ObjectId
   * @param {String} id - ID to validate
   * @returns {Boolean} Is valid ObjectId
   */
  isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
  }

  /**
   * Validate multiple ObjectIds
   * @param {Array} ids - Array of IDs to validate
   * @returns {Boolean} Are all valid ObjectIds
   */
  areValidObjectIds(ids) {
    if (!Array.isArray(ids)) return false;
    return ids.every(id => this.isValidObjectId(id));
  }

  /**
   * Sanitize input data
   * @param {Object} data - Data to sanitize
   * @returns {Object} Sanitized data
   */
  sanitizeInput(data) {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = {};

    Object.keys(data).forEach(key => {
      const value = data[key];

      if (typeof value === 'string') {
        // Trim whitespace and handle empty strings
        sanitized[key] = value.trim() || undefined;
      } else if (Array.isArray(value)) {
        // Recursively sanitize array items
        sanitized[key] = value.map(item => this.sanitizeInput(item));
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = this.sanitizeInput(value);
      } else {
        sanitized[key] = value;
      }
    });

    // Remove undefined values
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key] === undefined) {
        delete sanitized[key];
      }
    });

    return sanitized;
  }

  /**
   * Create validation middleware
   * @param {Object} schema - Joi schema
   * @param {String} source - Source of data ('body', 'query', 'params')
   * @returns {Function} Express middleware function
   */
  createValidationMiddleware(schema, source = 'body') {
    return (req, res, next) => {
      const data = req[source];
      const result = this.validate(data, schema);

      if (!result.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: result.errors
        });
      }

      // Replace the original data with validated and sanitized data
      req[source] = result.data;
      next();
    };
  }

  /**
   * Business logic validation for user operations
   * @param {String} operation - Operation type
   * @param {Object} data - Operation data
   * @param {Object} context - Additional context
   * @returns {Object} Validation result
   */
  async validateUserBusinessLogic(operation, data, context = {}) {
    const errors = [];

    switch (operation) {
      case 'create':
        // Check if user creation is allowed
        if (context.createdBy) {
          const creator = await User.findById(context.createdBy).lean();
          if (!creator) {
            errors.push({ field: 'createdBy', message: 'Creator not found' });
          } else if (creator.level >= data.level) {
            errors.push({ field: 'level', message: 'Cannot create user with same or higher level' });
          }
        }
        break;

      case 'update':
        // Validate level changes
        if (data.level && context.currentUser) {
          if (context.currentUser.level >= data.level) {
            errors.push({ field: 'level', message: 'Cannot set user to same or higher level' });
          }
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Business logic validation for lead operations
   * @param {String} operation - Operation type
   * @param {Object} data - Operation data
   * @param {Object} context - Additional context
   * @returns {Object} Validation result
   */
  async validateLeadBusinessLogic(operation, data, context = {}) {
    const errors = [];

    switch (operation) {
      case 'create':
        // Validate user can create leads for the project
        if (context.project && context.user) {
          const project = await Project.findById(data.project).lean();
          const user = await User.findById(context.user).lean();

          if (!project) {
            errors.push({ field: 'project', message: 'Project not found' });
          } else if (!user) {
            errors.push({ field: 'user', message: 'User not found' });
          } else {
            // Check if user has access to project
            const hasAccess = project.owner?.toString() === context.user ||
                             project.members?.includes(context.user) ||
                             project.managers?.includes(context.user) ||
                             user.role === 'superadmin';

            if (!hasAccess) {
              errors.push({ field: 'project', message: 'Access denied to project' });
            }
          }
        }
        break;

      case 'statusChange':
        // Validate status transition is allowed
        if (context.currentStatus && data.newStatusId) {
          // Add business logic for allowed status transitions
          // This would be defined based on your business requirements
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = new Validator();