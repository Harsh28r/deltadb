const User = require('../models/User');
const Project = require('../models/Project');
const Lead = require('../models/Lead');
const UserProject = require('../models/UserProject');
const Role = require('../models/Role');
const Notification = require('../models/Notification');

// Get user dashboard data
const getUserDashboard = async (req, res) => {
  try {
    console.log('🔍 getUserDashboard - User ID:', req.user.id);
    console.log('🔍 getUserDashboard - User details:', req.user);
    
    const userId = req.user.id;
    
    // Get user details with role information
    const user = await User.findById(userId).populate('roleRef');
    if (!user) {
      console.log('❌ User not found for ID:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('🔍 Found user:', {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      level: user.level
    });

    // Get user's assigned projects
    console.log('🔍 Looking for user projects with userId:', userId);
    const userProjects = await UserProject.find({ user: userId })
      .populate('project')
      .populate('user');
    
    console.log('🔍 Found user projects count:', userProjects.length);
    console.log('🔍 User projects details:', userProjects.map(up => ({
      id: up._id,
      user: up.user?._id,
      project: up.project?._id,
      projectName: up.project?.name
    })));

    // Get user's leads (leads assigned to this user)
    const userLeads = await Lead.find({ user: userId })
      .populate('project')
      .populate('leadSource')
      .populate('currentStatus')
      .sort({ createdAt: -1 })
      .limit(10); // Latest 10 leads

    // Get user's recent notifications
    const notifications = await Notification.find({ 
      $or: [
        { recipient: userId },
        { recipient: 'all' }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(5); // Latest 5 notifications

    // Get user's actual effective permissions
    const effectivePermissions = await user.getEffectivePermissions();
    const rolePermissions = user.roleRef ? user.roleRef.permissions || [] : [];

    // Dashboard statistics
    const stats = {
      totalProjects: userProjects.length,
      totalLeads: await Lead.countDocuments({ user: userId }),
      activeLeads: await Lead.countDocuments({ 
        user: userId, 
        'currentStatus.name': { $nin: ['Closed', 'Lost', 'Cancelled'] }
      }),
      recentActivity: userLeads.length
    };

    // Format response
    const dashboard = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level,
        mobile: user.mobile,
        companyName: user.companyName,
        permissions: effectivePermissions
      },
      projects: userProjects.map(up => ({
        id: up.project._id,
        name: up.project.name,
        location: up.project.location,
        logo: up.project.logo,
        developBy: up.project.developBy,
        assignedAt: up.createdAt
      })),
      leads: userLeads.map(lead => ({
        id: lead._id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        project: lead.project ? {
          id: lead.project._id,
          name: lead.project.name
        } : null,
        leadSource: lead.leadSource ? lead.leadSource.name : null,
        currentStatus: lead.currentStatus ? lead.currentStatus.name : null,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt
      })),
      notifications: notifications.map(notif => ({
        id: notif._id,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        isRead: notif.isRead,
        createdAt: notif.createdAt
      })),
      stats
    };

    res.json({
      message: 'Dashboard data retrieved successfully',
      dashboard
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Server error while fetching dashboard data' });
  }
};

// Get user's assigned projects
const getUserProjects = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userProjects = await UserProject.find({ user: userId })
      .populate('project')
      .sort({ createdAt: -1 });

    const projects = userProjects.map(up => ({
      id: up.project._id,
      name: up.project.name,
      location: up.project.location,
      logo: up.project.logo,
      developBy: up.project.developBy,
      assignedAt: up.createdAt
    }));

    res.json({
      message: 'User projects retrieved successfully',
      projects,
      total: projects.length
    });

  } catch (error) {
    console.error('Get user projects error:', error);
    res.status(500).json({ message: 'Server error while fetching user projects' });
  }
};

// Get user's leads
const getUserLeads = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status, projectId } = req.query;
    
    let query = { user: userId };
    
    if (status) {
      query['currentStatus.name'] = status;
    }
    
    if (projectId) {
      query.project = projectId;
    }

    const leads = await Lead.find(query)
      .populate('project')
      .populate('leadSource')
      .populate('currentStatus')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Lead.countDocuments(query);

    const formattedLeads = leads.map(lead => ({
      id: lead._id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      project: lead.project ? {
        id: lead.project._id,
        name: lead.project.name
      } : null,
      leadSource: lead.leadSource ? lead.leadSource.name : null,
      currentStatus: lead.currentStatus ? lead.currentStatus.name : null,
      customData: lead.customData,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt
    }));

    res.json({
      message: 'User leads retrieved successfully',
      leads: formattedLeads,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Get user leads error:', error);
    res.status(500).json({ message: 'Server error while fetching user leads' });
  }
};

// Get user's notifications
const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, unreadOnly = false } = req.query;
    
    let query = { 
      $or: [
        { recipient: userId },
        { recipient: 'all' }
      ]
    };
    
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Notification.countDocuments(query);

    const formattedNotifications = notifications.map(notif => ({
      id: notif._id,
      title: notif.title,
      message: notif.message,
      type: notif.type,
      isRead: notif.isRead,
      createdAt: notif.createdAt
    }));

    res.json({
      message: 'User notifications retrieved successfully',
      notifications: formattedNotifications,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Get user notifications error:', error);
    res.status(500).json({ message: 'Server error while fetching notifications' });
  }
};

// Mark notification as read
const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOneAndUpdate(
      { 
        _id: notificationId,
        $or: [
          { recipient: userId },
          { recipient: 'all' }
        ]
      },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({
      message: 'Notification marked as read',
      notification: {
        id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        isRead: notification.isRead,
        createdAt: notification.createdAt
      }
    });

  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ message: 'Server error while updating notification' });
  }
};

// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    console.log('🔍 getUserProfile - User ID:', userId);
    console.log('🔍 getUserProfile - User details:', req.user);
    console.log('🔍 getUserProfile - User ID type:', typeof userId);
    console.log('🔍 getUserProfile - Available user fields:', Object.keys(req.user || {}));
    
    if (!userId) {
      console.log('❌ No user ID found in request');
      return res.status(401).json({ message: 'User ID not found in token' });
    }
    
    const user = await User.findById(userId).populate('roleRef');
    console.log('🔍 getUserProfile - Found user:', user ? 'YES' : 'NO');
    console.log('🔍 getUserProfile - User object:', user);
    
    if (!user) {
      console.log('❌ User not found in database with ID:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    // Get role permissions
    const rolePermissions = user.roleRef ? user.roleRef.permissions || [] : [];
    
    // Get custom permissions for reference
    const customPermissions = user.customPermissions || { allowed: [], denied: [] };
    
    // Calculate effective permissions (role permissions + custom allowed - custom denied)
    const effectivePermissions = [
      ...new Set([
        ...rolePermissions,
        ...customPermissions.allowed
      ])
    ].filter(permission => !customPermissions.denied.includes(permission));

    // Find projects explicitly assigned to this user
    const userProjects = await UserProject.find({ user: user._id })
      .populate('project')
      .sort({ createdAt: -1 })
      .lean();

    const assignedProjects = (userProjects || [])
      .filter(up => up.project)
      .map(up => ({
        id: up.project._id,
        name: up.project.name,
        location: up.project.location,
        logo: up.project.logo,
        developBy: up.project.developBy,
        assignedAt: up.createdAt
      }));

    // Project access derived from restrictions and role
    const canAccessAll = user.role === 'superadmin' || user.level === 1;
    const allowedProjects = user.restrictions?.allowedProjects || [];
    const deniedProjects = user.restrictions?.deniedProjects || [];
    const maxProjects = user.restrictions?.maxProjects ?? null;

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level,
        isActive: user.isActive
      },
      permissions: {
        allowed: effectivePermissions,
        denied: customPermissions.denied
      },
      projectAccess: {
        canAccessAll,
        assignedProjects,
        allowedProjects,
        deniedProjects,
        maxProjects
      }
    });

  } catch (error) {
    console.error('❌ Get user profile error:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error message:', error.message);
    res.status(500).json({ 
      message: 'Server error while fetching user profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Update user profile
const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, mobile, companyName } = req.body;

    // Only allow updating specific fields
    const updateData = {};
    if (name) updateData.name = name;
    if (mobile) updateData.mobile = mobile;
    if (companyName) updateData.companyName = companyName;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).populate('roleRef');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const rolePermissions = user.roleRef ? user.roleRef.permissions || [] : [];

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level,
        mobile: user.mobile,
        companyName: user.companyName,
        permissions: effectivePermissions,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
};

module.exports = {
  getUserDashboard,
  getUserProjects,
  getUserLeads,
  getUserNotifications,
  markNotificationAsRead,
  getUserProfile,
  updateUserProfile
};
