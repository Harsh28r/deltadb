const Lead = require('../models/Lead');
const LeadStatus = require('../models/LeadStatus');
const LeadSource = require('../models/LeadSource');
const Project = require('../models/Project');
const ChannelPartner = require('../models/ChannelPartner');
const CPSourcing = require('../models/CPSourcing');
const User = require('../models/User');
const LeadActivity = require('../models/LeadActivity');
const mongoose = require('mongoose');
const Joi = require('joi');

// Validation schema for dashboard queries (e.g., date ranges, filters)
const dashboardQuerySchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  projectId: Joi.string().hex().length(24).optional(),
  userId: Joi.string().hex().length(24).optional(),
  channelPartnerId: Joi.string().hex().length(24).optional(),
  leadSourceId: Joi.string().hex().length(24).optional()
});

/**
 * Get overall dashboard statistics for real estate leads.
 * Includes total leads, active leads, converted leads, revenue summary (if customData has price), etc.
 */
const getDashboardStats = async (req, res) => {
  const { error } = dashboardQuerySchema.validate(req.query);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const match = { createdAt: { $gte: new Date(req.query.startDate || '1970-01-01'), $lte: new Date(req.query.endDate || new Date()) } };
    if (req.query.projectId) match.project = new mongoose.Types.ObjectId(req.query.projectId);
    if (req.query.userId) match.user = new mongoose.Types.ObjectId(req.query.userId);
    if (req.query.channelPartnerId) match.channelPartner = new mongoose.Types.ObjectId(req.query.channelPartnerId);
    if (req.query.leadSourceId) match.leadSource = new mongoose.Types.ObjectId(req.query.leadSourceId);

    // Total leads
    const totalLeads = await Lead.countDocuments(match);

    // Active leads (non-final status)
    const finalStatuses = await LeadStatus.find({ is_final_status: true }, '_id');
    const finalStatusIds = finalStatuses.map(s => s._id);
    const activeLeads = await Lead.countDocuments({ ...match, currentStatus: { $nin: finalStatusIds } });

    // Converted leads (final status, e.g., "Sold" or "Closed")
    const convertedLeads = await Lead.countDocuments({ ...match, currentStatus: { $in: finalStatusIds } });

    // Leads by status (for pie chart)
    const leadsByStatus = await Lead.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'leadstatuses',
          localField: 'currentStatus',
          foreignField: '_id',
          as: 'status'
        }
      },
      { $unwind: { path: '$status', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$status._id',
          name: { $first: '$status.name' },
          count: { $sum: 1 },
          percentage: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Total estimated revenue (assuming customData has 'propertyPrice' or similar for real estate)
    const totalRevenue = await Lead.aggregate([
      { $match: { ...match, 'customData.propertyPrice': { $exists: true, $ne: null } } },
      { $group: { _id: null, total: { $sum: '$customData.propertyPrice' } } }
    ]);
    const estimatedRevenue = totalRevenue[0]?.total || 0;

    // Recent activities (last 7 days for real-time dashboard)
    const recentActivities = await LeadActivity.find({
      timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      lead: { $exists: true }
    })
      .sort({ timestamp: -1 })
      .limit(10)
      .populate('user', 'name email')
      .populate('lead', 'currentStatus customData');

    // Top performing sources (for bar chart)
    const topSources = await Lead.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'leadsource', // Assuming model collection name
          localField: 'leadSource',
          foreignField: '_id',
          as: 'source'
        }
      },
      { $unwind: { path: '$source', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$source._id',
          name: { $first: '$source.name' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Top channel partners (real estate specific, e.g., agents or brokers)
    const topPartners = await Lead.aggregate([
      { $match: { ...match, channelPartner: { $exists: true } } },
      {
        $lookup: {
          from: 'channelpartners',
          localField: 'channelPartner',
          foreignField: '_id',
          as: 'partner'
        }
      },
      { $unwind: { path: '$partner', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$partner._id',
          name: { $first: '$partner.name' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Conversion rate
    const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(2) : 0;

    res.json({
      stats: {
        totalLeads,
        activeLeads,
        convertedLeads,
        conversionRate,
        estimatedRevenue
      },
      charts: {
        leadsByStatus,
        topSources,
        topPartners
      },
      recentActivities
    });
  } catch (err) {
    console.error('getDashboardStats - Error:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get leads overview for dashboard table (paginated, filtered).
 * Real estate focus: show property details from customData.
 */
const getDashboardLeadsOverview = async (req, res) => {
  const { error } = dashboardQuerySchema.validate(req.query);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const match = { createdAt: { $gte: new Date(req.query.startDate || '1970-01-01'), $lte: new Date(req.query.endDate || new Date()) } };
    if (req.query.projectId) match.project = new mongoose.Types.ObjectId(req.query.projectId);
    if (req.query.userId) match.user = new mongoose.Types.ObjectId(req.query.userId);
    if (req.query.channelPartnerId) match.channelPartner = new mongoose.Types.ObjectId(req.query.channelPartnerId);
    if (req.query.leadSourceId) match.leadSource = new mongoose.Types.ObjectId(req.query.leadSourceId);

    const leads = await Lead.find(match)
      .populate('user', 'name email')
      .populate('project', 'name')
      .populate('channelPartner', 'name')
      .populate('leadSource', 'name')
      .populate('currentStatus', 'name is_final_status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Enhance with real estate specific fields from customData (e.g., propertyType, location, price)
    const enhancedLeads = leads.map(lead => ({
      ...lead,
      propertyType: lead.customData?.propertyType || 'N/A',
      location: lead.customData?.location || 'N/A',
      price: lead.customData?.propertyPrice || 0,
      daysOpen: Math.floor((new Date() - new Date(lead.createdAt)) / (1000 * 60 * 60 * 24))
    }));

    const total = await Lead.countDocuments(match);

    res.json({
      leads: enhancedLeads,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('getDashboardLeadsOverview - Error:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get performance metrics for users/agents (real estate team dashboard).
 */
const getUserPerformance = async (req, res) => {
  const { error } = dashboardQuerySchema.validate(req.query);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const match = { createdAt: { $gte: new Date(req.query.startDate || '1970-01-01'), $lte: new Date(req.query.endDate || new Date()) } };
    if (req.query.projectId) match.project = new mongoose.Types.ObjectId(req.query.projectId);

    // Fetch final statuses first
    const finalStatuses = await LeadStatus.find({ is_final_status: true }, '_id');

    const userPerformance = await Lead.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$user._id',
          name: { $first: '$user.name' },
          email: { $first: '$user.email' },
          totalLeads: { $sum: 1 },
          convertedLeads: {
            $sum: {
              $cond: [
                {
                  $in: ['$currentStatus', finalStatuses.map(s => s._id)]
                },
                1,
                0
              ]
            }
          },
          totalRevenue: { $sum: { $ifNull: ['$customData.propertyPrice', 0] } }
        }
      },
      {
        $lookup: {
          from: 'leadstatuses',
          let: { statusIds: finalStatuses.map(s => s._id) },
          pipeline: [{ $match: { $expr: { $in: ['$_id', '$$statusIds'] } } }],
          as: 'finalStatuses'
        }
      },
      { $addFields: { conversionRate: { $multiply: [{ $divide: ['$convertedLeads', '$totalLeads'] }, 100] } } },
      { $sort: { totalLeads: -1 } },
      { $limit: 10 }
    ]);

    res.json({ performance: userPerformance });
  } catch (err) {
    console.error('getUserPerformance - Error:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get project-wise summary for real estate projects (e.g., developments).
 */
const getProjectSummary = async (req, res) => {
  const { error } = dashboardQuerySchema.validate(req.query);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const match = { createdAt: { $gte: new Date(req.query.startDate || '1970-01-01'), $lte: new Date(req.query.endDate || new Date()) } };

    // Fetch final statuses first
    const finalStatuses = await LeadStatus.find({ is_final_status: true }, '_id name');
    const finalStatusIds = finalStatuses.map(s => s._id);

    const projectSummary = await Lead.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'projects',
          localField: 'project',
          foreignField: '_id',
          as: 'projectInfo'
        }
      },
      { $unwind: { path: '$projectInfo', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'leadstatuses',
          localField: 'currentStatus',
          foreignField: '_id',
          as: 'statusInfo'
        }
      },
      { $unwind: { path: '$statusInfo', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$project',
          projectName: { $first: { $ifNull: ['$projectInfo.name', 'N/A'] } },
          totalLeads: { $sum: 1 },
          finalStatusBreakdown: {
            $push: {
              statusId: '$statusInfo._id',
              statusName: '$statusInfo.name',
              isFinalStatus: '$statusInfo.is_final_status'
            }
          },
          avgPrice: { $avg: { $ifNull: ['$customData.propertyPrice', 0] } },
          totalRevenue: { $sum: { $ifNull: ['$customData.propertyPrice', 0] } }
        }
      },
      {
        $addFields: {
          finalStatusCounts: {
            $reduce: {
              input: '$finalStatusBreakdown',
              initialValue: {},
              in: {
                $mergeObjects: [
                  '$$value',
                  {
                    $arrayToObject: [
                      [
                        {
                          k: { $toString: '$$this.statusId' },
                          v: {
                            $add: [
                              { $ifNull: [{ $getField: { field: { $toString: '$$this.statusId' }, input: '$$value' } }, 0] },
                              { $cond: ['$$this.isFinalStatus', 1, 0] }
                            ]
                          }
                        }
                      ]
                    ]
                  }
                ]
              }
            }
          }
        }
      },
      {
        $addFields: {
          convertedLeads: {
            $sum: {
              $map: {
                input: '$finalStatusBreakdown',
                as: 'status',
                in: { $cond: ['$$status.isFinalStatus', 1, 0] }
              }
            }
          },
          conversionRate: {
            $multiply: [
              {
                $divide: [
                  {
                    $sum: {
                      $map: {
                        input: '$finalStatusBreakdown',
                        as: 'status',
                        in: { $cond: ['$$status.isFinalStatus', 1, 0] }
                      }
                    }
                  },
                  '$totalLeads'
                ]
              },
              100
            ]
          }
        }
      },
      { $sort: { convertedLeads: -1 } }
    ]);

    // Format the response to show final status breakdown clearly
    const formattedSummary = projectSummary.map(project => {
      const finalStatusDetails = {};
      
      // Count final statuses
      project.finalStatusBreakdown.forEach(status => {
        if (status.isFinalStatus) {
          if (!finalStatusDetails[status.statusName]) {
            finalStatusDetails[status.statusName] = 0;
          }
          finalStatusDetails[status.statusName]++;
        }
      });

      return {
        _id: project._id,
        projectName: project.projectName,
        totalLeads: project.totalLeads,
        convertedLeads: project.convertedLeads,
        conversionRate: Math.round(project.conversionRate * 100) / 100,
        avgPrice: project.avgPrice,
        totalRevenue: project.totalRevenue,
        finalStatusBreakdown: finalStatusDetails
      };
    });

    res.json({ summary: formattedSummary });
  } catch (err) {
    console.error('getProjectSummary - Error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Note: For full aggregate with lookups, adjust as per your schema. This follows the flow from provided controllers.

module.exports = {
  getDashboardStats,
  getDashboardLeadsOverview,
  getUserPerformance,
  getProjectSummary
};