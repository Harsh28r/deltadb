const Lead = require('../models/Lead');
const LeadStatus = require('../models/LeadStatus');
const LeadSource = require('../models/LeadSource');
const Project = require('../models/Project');
const User = require('../models/User');
const cacheManager = require('../utils/cacheManager');
const performanceOptimizer = require('../utils/performanceOptimizer');
const paginationManager = require('../utils/pagination');

class LeadService {
  constructor(notificationService = null) {
    this.notificationService = notificationService;
  }

  setNotificationService(notificationService) {
    this.notificationService = notificationService;
  }

  /**
   * Create a new lead
   * @param {Object} leadData - Lead creation data
   * @param {String} createdBy - User creating the lead
   * @returns {Object} Created lead
   */
  async createLead(leadData, createdBy) {
    try {
      // Validate required fields
      const requiredFields = ['user', 'project', 'leadSource', 'currentStatus'];
      for (const field of requiredFields) {
        if (!leadData[field]) {
          throw new Error(`${field} is required`);
        }
      }

      // Validate references exist
      await this.validateLeadReferences(leadData);

      const lead = new Lead({
        ...leadData,
        createdBy,
        updatedBy: createdBy,
        isActive: true
      });

      await lead.save();

      // Populate for response
      await lead.populate([
        { path: 'user', select: 'name email' },
        { path: 'project', select: 'name location' },
        { path: 'leadSource', select: 'name' },
        { path: 'currentStatus', select: 'name color' },
        { path: 'channelPartner', select: 'name' }
      ]);

      // Cache the lead
      cacheManager.setLead(lead._id.toString(), lead.toObject());

      // Send notifications
      if (this.notificationService) {
        // Send lead assignment notification to the assigned user and their hierarchy
        await this.notificationService.sendLeadAssignmentNotification(
          lead,
          leadData.user,
          createdBy
        );

        // Also send user activity notification to the creator's hierarchy
        await this.notificationService.sendUserActivityNotification(
          createdBy,
          'lead_created',
          {
            leadId: lead._id,
            projectId: leadData.project,
            assignedTo: leadData.user,
            leadSource: leadData.leadSource
          },
          `Created a new lead and assigned it to team member`
        );
      }

      return lead;

    } catch (error) {
      console.error('Error creating lead:', error);
      throw error;
    }
  }

  /**
   * Get leads with advanced filtering and pagination
   * @param {Object} query - Query parameters
   * @param {String} userId - Requesting user ID
   * @returns {Object} Paginated leads
   */
  async getLeads(query, userId) {
    try {
      const paginationParams = paginationManager.createPaginationParams(query);
      const sortParams = paginationManager.createSortParams(query, { createdAt: -1 });

      // Build filter based on query parameters
      const filter = await this.buildLeadFilter(query, userId);

      // Use aggregation pipeline for complex queries
      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'user',
            pipeline: [{ $project: { name: 1, email: 1, role: 1 } }]
          }
        },
        {
          $lookup: {
            from: 'projects',
            localField: 'project',
            foreignField: '_id',
            as: 'project',
            pipeline: [{ $project: { name: 1, location: 1 } }]
          }
        },
        {
          $lookup: {
            from: 'leadsources',
            localField: 'leadSource',
            foreignField: '_id',
            as: 'leadSource',
            pipeline: [{ $project: { name: 1 } }]
          }
        },
        {
          $lookup: {
            from: 'leadstatuses',
            localField: 'currentStatus',
            foreignField: '_id',
            as: 'currentStatus',
            pipeline: [{ $project: { name: 1, color: 1, is_final_status: 1 } }]
          }
        },
        {
          $lookup: {
            from: 'channelpartners',
            localField: 'channelPartner',
            foreignField: '_id',
            as: 'channelPartner',
            pipeline: [{ $project: { name: 1, contactEmail: 1 } }]
          }
        },
        // Unwind arrays created by lookup
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
        { $unwind: { path: '$project', preserveNullAndEmptyArrays: false } },
        { $unwind: { path: '$leadSource', preserveNullAndEmptyArrays: false } },
        { $unwind: { path: '$currentStatus', preserveNullAndEmptyArrays: false } },
        { $unwind: { path: '$channelPartner', preserveNullAndEmptyArrays: true } },
        // Add computed fields
        {
          $addFields: {
            statusHistoryCount: { $size: '$statusHistory' },
            daysSinceCreated: {
              $dateDiff: {
                startDate: '$createdAt',
                endDate: '$$NOW',
                unit: 'day'
              }
            }
          }
        },
        // Sort
        { $sort: sortParams }
      ];

      // Use performance optimizer for caching
      const cacheKey = `leads:${JSON.stringify({ filter, sortParams, paginationParams })}`;

      return await performanceOptimizer.getCachedData(
        cacheKey,
        async () => {
          return await paginationManager.executeAggregationQuery(
            Lead,
            pipeline,
            paginationParams
          );
        },
        { type: 'query', ttl: 180 } // Cache for 3 minutes
      );

    } catch (error) {
      console.error('Error getting leads:', error);
      throw error;
    }
  }

  /**
   * Get lead by ID with full details
   * @param {String} leadId - Lead ID
   * @param {String} userId - Requesting user ID
   * @returns {Object} Lead with full details
   */
  async getLeadById(leadId, userId) {
    try {
      // Try cache first
      let lead = cacheManager.getLead(leadId);

      if (!lead) {
        lead = await Lead.findById(leadId)
          .populate([
            { path: 'user', select: 'name email role' },
            { path: 'project', select: 'name location developBy' },
            { path: 'leadSource', select: 'name description' },
            { path: 'currentStatus', select: 'name color is_final_status formFields' },
            { path: 'channelPartner', select: 'name contactEmail contactPhone' },
            { path: 'statusHistory.status', select: 'name color' },
            { path: 'createdBy', select: 'name email' },
            { path: 'updatedBy', select: 'name email' }
          ])
          .lean();

        if (lead) {
          cacheManager.setLead(leadId, lead);
        }
      }

      if (!lead) {
        throw new Error('Lead not found');
      }

      // Check access permissions
      await this.validateLeadAccess(lead, userId);

      return lead;

    } catch (error) {
      console.error('Error getting lead by ID:', error);
      throw error;
    }
  }

  /**
   * Update lead
   * @param {String} leadId - Lead ID
   * @param {Object} updateData - Update data
   * @param {String} updatedBy - User updating the lead
   * @returns {Object} Updated lead
   */
  async updateLead(leadId, updateData, updatedBy) {
    try {
      // Get current lead
      const currentLead = await Lead.findById(leadId);
      if (!currentLead) {
        throw new Error('Lead not found');
      }

      // Check if lead has final status and updater is not superadmin
      const currentStatus = await LeadStatus.findById(currentLead.currentStatus).lean();
      if (currentStatus?.is_final_status) {
        const user = await User.findById(updatedBy).lean();
        if (user?.role !== 'superadmin') {
          throw new Error('Only superadmin can edit leads with final status');
        }
      }

      // Sanitize update data
      const allowedFields = [
        'customData', 'channelPartner', 'cpSourcingId', 'isActive'
      ];

      const sanitizedData = {};
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          sanitizedData[key] = updateData[key];
        }
      });

      sanitizedData.updatedBy = updatedBy;
      sanitizedData.updatedAt = new Date();

      const lead = await Lead.findByIdAndUpdate(
        leadId,
        sanitizedData,
        { new: true, runValidators: true, context: { userId: { _id: updatedBy } } }
      ).populate([
        { path: 'user', select: 'name email' },
        { path: 'project', select: 'name location' },
        { path: 'leadSource', select: 'name' },
        { path: 'currentStatus', select: 'name color is_final_status' }
      ]);

      // Invalidate cache
      cacheManager.deleteLead(leadId);

      return lead;

    } catch (error) {
      console.error('Error updating lead:', error);
      throw error;
    }
  }

  /**
   * Change lead status
   * @param {String} leadId - Lead ID
   * @param {String} newStatusId - New status ID
   * @param {Object} newData - New custom data
   * @param {String} userId - User changing status
   * @returns {Object} Updated lead
   */
  async changeLeadStatus(leadId, newStatusId, newData, userId) {
    try {
      const lead = await Lead.findById(leadId);
      if (!lead) {
        throw new Error('Lead not found');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get old and new status for notifications
      const oldStatus = await LeadStatus.findById(lead.currentStatus).lean();
      const newStatus = await LeadStatus.findById(newStatusId).lean();

      // Use Lead model method to change status
      await lead.changeStatus(newStatusId, newData, user);

      // Populate for response
      await lead.populate([
        { path: 'user', select: 'name email' },
        { path: 'project', select: 'name location' },
        { path: 'currentStatus', select: 'name color is_final_status' }
      ]);

      // Invalidate cache
      cacheManager.deleteLead(leadId);

      // Send notifications
      if (this.notificationService && oldStatus && newStatus) {
        await this.notificationService.sendLeadStatusNotification(
          lead, oldStatus, newStatus, userId
        );

        // Also send user activity notification for status change
        await this.notificationService.sendUserActivityNotification(
          userId,
          'lead_status_changed',
          {
            leadId: lead._id,
            projectId: lead.project,
            oldStatus: oldStatus.name,
            newStatus: newStatus.name,
            oldStatusId: oldStatus._id,
            newStatusId: newStatus._id
          },
          `Changed lead status from "${oldStatus.name}" to "${newStatus.name}"`
        );
      }

      return lead;

    } catch (error) {
      console.error('Error changing lead status:', error);
      throw error;
    }
  }

  /**
   * Delete lead (soft delete)
   * @param {String} leadId - Lead ID
   * @param {String} deletedBy - User deleting the lead
   * @returns {Boolean} Success status
   */
  async deleteLead(leadId, deletedBy) {
    try {
      const lead = await Lead.findById(leadId);
      if (!lead) {
        throw new Error('Lead not found');
      }

      // Check if lead has final status
      const currentStatus = await LeadStatus.findById(lead.currentStatus).lean();
      if (currentStatus?.is_final_status) {
        const user = await User.findById(deletedBy).lean();
        if (user?.role !== 'superadmin') {
          throw new Error('Only superadmin can delete leads with final status');
        }
      }

      lead.isActive = false;
      lead.deletedAt = new Date();
      lead.deletedBy = deletedBy;
      await lead.save();

      // Invalidate cache
      cacheManager.deleteLead(leadId);

      return true;

    } catch (error) {
      console.error('Error deleting lead:', error);
      throw error;
    }
  }

  /**
   * Get lead statistics
   * @param {Object} filters - Filter criteria
   * @returns {Object} Lead statistics
   */
  async getLeadStats(filters = {}) {
    try {
      const pipeline = [
        { $match: { isActive: true, ...filters } },
        {
          $group: {
            _id: '$currentStatus',
            count: { $sum: 1 },
            leads: { $push: '$$ROOT' }
          }
        },
        {
          $lookup: {
            from: 'leadstatuses',
            localField: '_id',
            foreignField: '_id',
            as: 'status'
          }
        },
        {
          $unwind: '$status'
        },
        {
          $project: {
            statusId: '$_id',
            statusName: '$status.name',
            statusColor: '$status.color',
            count: 1,
            isFinalStatus: '$status.is_final_status'
          }
        },
        {
          $sort: { count: -1 }
        }
      ];

      const statusStats = await Lead.aggregate(pipeline);

      // Get total counts
      const totalStats = await Lead.aggregate([
        { $match: { isActive: true, ...filters } },
        {
          $group: {
            _id: null,
            totalLeads: { $sum: 1 },
            finalStatusLeads: {
              $sum: { $cond: [{ $in: ['$currentStatus', '$finalStatuses'] }, 1, 0] }
            },
            createdThisMonth: {
              $sum: {
                $cond: [
                  {
                    $gte: [
                      '$createdAt',
                      new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);

      return {
        statusBreakdown: statusStats,
        totals: totalStats[0] || { totalLeads: 0, finalStatusLeads: 0, createdThisMonth: 0 }
      };

    } catch (error) {
      console.error('Error getting lead stats:', error);
      throw error;
    }
  }

  /**
   * Bulk lead operations
   * @param {Array} operations - Array of operations
   * @param {String} operatedBy - User performing operations
   * @returns {Object} Results summary
   */
  async bulkLeadOperations(operations, operatedBy) {
    try {
      const results = {
        success: 0,
        failed: 0,
        errors: []
      };

      // Process in batches for performance
      for (const operation of operations) {
        try {
          switch (operation.type) {
            case 'statusChange':
              await this.changeLeadStatus(
                operation.leadId,
                operation.newStatusId,
                operation.newData || {},
                operatedBy
              );
              break;
            case 'update':
              await this.updateLead(operation.leadId, operation.data, operatedBy);
              break;
            case 'delete':
              await this.deleteLead(operation.leadId, operatedBy);
              break;
            default:
              throw new Error(`Unknown operation type: ${operation.type}`);
          }

          results.success++;

        } catch (error) {
          results.failed++;
          results.errors.push({
            leadId: operation.leadId,
            operation: operation.type,
            error: error.message
          });
        }
      }

      return results;

    } catch (error) {
      console.error('Error in bulk lead operations:', error);
      throw error;
    }
  }

  // Helper methods

  /**
   * Validate lead references exist
   * @param {Object} leadData - Lead data
   */
  async validateLeadReferences(leadData) {
    const validations = [
      { model: User, id: leadData.user, name: 'User' },
      { model: Project, id: leadData.project, name: 'Project' },
      { model: LeadSource, id: leadData.leadSource, name: 'Lead Source' },
      { model: LeadStatus, id: leadData.currentStatus, name: 'Lead Status' }
    ];

    for (const validation of validations) {
      const exists = await validation.model.findById(validation.id).lean();
      if (!exists) {
        throw new Error(`${validation.name} not found`);
      }
    }
  }

  /**
   * Build lead filter based on query parameters
   * @param {Object} query - Query parameters
   * @param {String} userId - User ID for permission filtering
   * @returns {Object} MongoDB filter object
   */
  async buildLeadFilter(query, userId) {
    const filter = { isActive: true };

    // Basic filters
    if (query.project) filter.project = query.project;
    if (query.user) filter.user = query.user;
    if (query.currentStatus) filter.currentStatus = query.currentStatus;
    if (query.leadSource) filter.leadSource = query.leadSource;
    if (query.channelPartner) filter.channelPartner = query.channelPartner;

    // Date range filters
    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
      if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
    }

    // Permission-based filtering
    const user = await User.findById(userId).lean();
    if (user && user.role !== 'superadmin') {
      // Apply user-specific filtering based on role and permissions
      if (user.role === 'user') {
        filter.user = userId; // Users can only see their own leads
      }
      // Add more role-based filtering as needed
    }

    return filter;
  }

  /**
   * Validate user access to lead
   * @param {Object} lead - Lead object
   * @param {String} userId - User ID
   */
  async validateLeadAccess(lead, userId) {
    const user = await User.findById(userId).lean();

    if (!user) {
      throw new Error('User not found');
    }

    // Superadmin can access all leads
    if (user.role === 'superadmin') {
      return true;
    }

    // Lead owner can access their lead
    if (lead.user._id.toString() === userId) {
      return true;
    }

    // Project members can access project leads
    const project = await Project.findById(lead.project._id).lean();
    if (project) {
      const isProjectMember =
        project.owner?.toString() === userId ||
        project.members?.includes(userId) ||
        project.managers?.includes(userId);

      if (isProjectMember) {
        return true;
      }
    }

    throw new Error('Access denied');
  }
}

module.exports = new LeadService();