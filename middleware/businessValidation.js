const mongoose = require('mongoose');
const { AppError } = require('./errorHandler');

/**
 * Business rule validation middleware
 * Contains complex business logic validations that go beyond schema validation
 */

class BusinessValidationError extends Error {
  constructor(message, code = null, field = null) {
    super(message);
    this.name = 'BusinessLogicError';
    this.code = code;
    this.field = field;
  }
}

// User business validations
const validateUserBusinessRules = async (req, res, next) => {
  try {
    const { role, level, email } = req.body;

    // Business Rule: Superadmin email domain validation
    if (role === 'superadmin' && !email?.endsWith('@deltayards.com')) {
      throw new BusinessValidationError(
        'Superadmin users must have @deltayards.com email address',
        'INVALID_SUPERADMIN_EMAIL',
        'email'
      );
    }

    // Business Rule: Level hierarchy validation
    if (role && level) {
      const User = mongoose.model('User');
      const requestingUser = req.user;

      // Users cannot create users with equal or higher level than themselves
      if (requestingUser && requestingUser.level >= level && requestingUser.role !== 'superadmin') {
        throw new BusinessValidationError(
          `You cannot create users with level ${level}. Your level is ${requestingUser.level}`,
          'INVALID_USER_LEVEL',
          'level'
        );
      }
    }

    // Business Rule: Role and level consistency
    if (role && level) {
      const Role = mongoose.model('Role');
      const roleDoc = await Role.findOne({ name: role });

      if (roleDoc && roleDoc.level !== level) {
        throw new BusinessValidationError(
          `Role '${role}' requires level ${roleDoc.level}, but ${level} was provided`,
          'ROLE_LEVEL_MISMATCH',
          'level'
        );
      }
    }

    next();
  } catch (error) {
    next(new AppError(error.message, 422, error.code || 'BUSINESS_VALIDATION_ERROR'));
  }
};

// Lead business validations
const validateLeadBusinessRules = async (req, res, next) => {
  try {
    const { currentStatus, currentStatusId, project, projectId, channelPartner } = req.body;

    // Business Rule: New leads must start with default status
    if (req.method === 'POST') {
      const LeadStatus = mongoose.model('LeadStatus');
      const defaultStatus = await LeadStatus.findOne({ is_default_status: true });

      if (!defaultStatus) {
        throw new BusinessValidationError(
          'No default lead status configured. Please contact administrator',
          'NO_DEFAULT_STATUS'
        );
      }

      const providedStatus = currentStatusId || currentStatus;
      if (providedStatus && providedStatus !== defaultStatus._id.toString()) {
        throw new BusinessValidationError(
          'New leads must be created with the default status',
          'INVALID_INITIAL_STATUS',
          'currentStatus'
        );
      }
    }

    // Business Rule: Project access validation
    if (project || projectId) {
      const Project = mongoose.model('Project');
      const projectDoc = await Project.findById(project || projectId);

      if (!projectDoc) {
        throw new BusinessValidationError(
          'Invalid project specified',
          'INVALID_PROJECT',
          'project'
        );
      }

      // Check if user has access to this project
      const requestingUser = req.user;
      if (requestingUser.role !== 'superadmin' && requestingUser.level !== 1) {
        const hasAccess = projectDoc.members.includes(requestingUser._id) ||
                         projectDoc.managers.includes(requestingUser._id) ||
                         projectDoc.owner.equals(requestingUser._id);

        if (!hasAccess) {
          throw new BusinessValidationError(
            'You do not have access to this project',
            'PROJECT_ACCESS_DENIED',
            'project'
          );
        }
      }
    }

    // Business Rule: Channel partner validation
    if (channelPartner) {
      const ChannelPartner = mongoose.model('ChannelPartner');
      const cpDoc = await ChannelPartner.findById(channelPartner);

      if (!cpDoc) {
        throw new BusinessValidationError(
          'Invalid channel partner specified',
          'INVALID_CHANNEL_PARTNER',
          'channelPartner'
        );
      }

      if (!cpDoc.isActive) {
        throw new BusinessValidationError(
          'Cannot assign leads to inactive channel partner',
          'INACTIVE_CHANNEL_PARTNER',
          'channelPartner'
        );
      }
    }

    next();
  } catch (error) {
    next(new AppError(error.message, 422, error.code || 'BUSINESS_VALIDATION_ERROR'));
  }
};

// Lead status change validation
const validateLeadStatusChange = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { statusId, newStatus } = req.body;

    const Lead = mongoose.model('Lead');
    const LeadStatus = mongoose.model('LeadStatus');

    const lead = await Lead.findById(id);
    if (!lead) {
      throw new BusinessValidationError('Lead not found', 'LEAD_NOT_FOUND');
    }

    const targetStatusId = statusId || newStatus;
    const newStatusDoc = await LeadStatus.findById(targetStatusId);
    if (!newStatusDoc) {
      throw new BusinessValidationError('Invalid status specified', 'INVALID_STATUS');
    }

    // Business Rule: Cannot change status of leads that are already in final status
    const currentStatusDoc = await LeadStatus.findById(lead.currentStatus);
    if (currentStatusDoc?.is_final_status) {
      throw new BusinessValidationError(
        'Cannot change status of leads in final status',
        'FINAL_STATUS_IMMUTABLE',
        'status'
      );
    }

    // Business Rule: Check if user has permission for this status change
    const requestingUser = req.user;
    if (requestingUser.role !== 'superadmin' && requestingUser.level !== 1) {
      // Add custom business logic here for status change permissions
      // For example: only managers can move leads to certain statuses
    }

    next();
  } catch (error) {
    next(new AppError(error.message, 422, error.code || 'BUSINESS_VALIDATION_ERROR'));
  }
};

// Task business validations
const validateTaskBusinessRules = async (req, res, next) => {
  try {
    const { assignedTo, dueDate, relatedId, taskType } = req.body;

    // Business Rule: Due date must be in the future
    if (dueDate) {
      const due = new Date(dueDate);
      const now = new Date();

      if (due <= now) {
        throw new BusinessValidationError(
          'Due date must be in the future',
          'INVALID_DUE_DATE',
          'dueDate'
        );
      }
    }

    // Business Rule: Validate assigned user exists and is active
    if (assignedTo) {
      const User = mongoose.model('User');
      const assignedUser = await User.findById(assignedTo);

      if (!assignedUser) {
        throw new BusinessValidationError(
          'Assigned user does not exist',
          'INVALID_ASSIGNED_USER',
          'assignedTo'
        );
      }

      if (!assignedUser.isActive) {
        throw new BusinessValidationError(
          'Cannot assign tasks to inactive users',
          'INACTIVE_ASSIGNED_USER',
          'assignedTo'
        );
      }
    }

    // Business Rule: Validate related entity exists
    if (taskType !== 'general' && relatedId) {
      const modelMap = {
        lead: 'Lead',
        project: 'Project',
        'cp-sourcing': 'CPSourcing'
      };

      const ModelName = modelMap[taskType];
      if (ModelName) {
        const Model = mongoose.model(ModelName);
        const relatedDoc = await Model.findById(relatedId);

        if (!relatedDoc) {
          throw new BusinessValidationError(
            `Related ${taskType} not found`,
            'RELATED_ENTITY_NOT_FOUND',
            'relatedId'
          );
        }
      }
    }

    next();
  } catch (error) {
    next(new AppError(error.message, 422, error.code || 'BUSINESS_VALIDATION_ERROR'));
  }
};

// Project business validations
const validateProjectBusinessRules = async (req, res, next) => {
  try {
    const { members, managers, owner } = req.body;

    // Business Rule: Owner cannot be in members or managers list
    if (owner && (members?.includes(owner) || managers?.includes(owner))) {
      throw new BusinessValidationError(
        'Project owner cannot be listed as member or manager',
        'OWNER_ROLE_CONFLICT',
        'owner'
      );
    }

    // Business Rule: Validate all users exist and are active
    const userIds = [
      ...(members || []),
      ...(managers || []),
      ...(owner ? [owner] : [])
    ].filter(Boolean);

    if (userIds.length > 0) {
      const User = mongoose.model('User');
      const users = await User.find({ _id: { $in: userIds } });

      if (users.length !== userIds.length) {
        throw new BusinessValidationError(
          'One or more specified users do not exist',
          'INVALID_PROJECT_USERS'
        );
      }

      const inactiveUsers = users.filter(user => !user.isActive);
      if (inactiveUsers.length > 0) {
        throw new BusinessValidationError(
          'Cannot assign inactive users to project',
          'INACTIVE_PROJECT_USERS'
        );
      }
    }

    next();
  } catch (error) {
    next(new AppError(error.message, 422, error.code || 'BUSINESS_VALIDATION_ERROR'));
  }
};

// Reminder business validations
const validateReminderBusinessRules = async (req, res, next) => {
  try {
    const { dateTime, userId } = req.body;

    // Business Rule: Reminder date must be in the future
    if (dateTime) {
      const reminderDate = new Date(dateTime);
      const now = new Date();

      if (reminderDate <= now) {
        throw new BusinessValidationError(
          'Reminder date must be in the future',
          'INVALID_REMINDER_DATE',
          'dateTime'
        );
      }
    }

    // Business Rule: Cannot set reminders for inactive users
    if (userId) {
      const User = mongoose.model('User');
      const user = await User.findById(userId);

      if (!user) {
        throw new BusinessValidationError(
          'Reminder user does not exist',
          'INVALID_REMINDER_USER',
          'userId'
        );
      }

      if (!user.isActive) {
        throw new BusinessValidationError(
          'Cannot set reminders for inactive users',
          'INACTIVE_REMINDER_USER',
          'userId'
        );
      }
    }

    next();
  } catch (error) {
    next(new AppError(error.message, 422, error.code || 'BUSINESS_VALIDATION_ERROR'));
  }
};

module.exports = {
  validateUserBusinessRules,
  validateLeadBusinessRules,
  validateLeadStatusChange,
  validateTaskBusinessRules,
  validateProjectBusinessRules,
  validateReminderBusinessRules,
  BusinessValidationError
};