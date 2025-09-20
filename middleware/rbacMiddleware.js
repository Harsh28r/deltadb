const mongoose = require('mongoose');

const permissionCache = new Map();

const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user || !user.roleRef) {
        console.error('checkPermission - No user or roleRef found:', { userId: user?._id });
        return res.status(403).json({ message: 'Unauthorized: No user or role found' });
      }

      // Check cache for user's permissions
      let permissions = permissionCache.get(user._id.toString());
      if (!permissions) {
        const role = await mongoose.model('Role').findById(user.roleRef).select('permissions').lean();
        if (!role) {
          console.error('checkPermission - Role not found for roleRef:', user.roleRef);
          return res.status(403).json({ message: 'Unauthorized: Role not found' });
        }
        permissions = role.permissions || [];
        permissionCache.set(user._id.toString(), permissions);
      }

      console.log('checkPermission - User permissions:', permissions);
      console.log('checkPermission - Required permission:', requiredPermission);

      // Allow superadmin or level 1 users to bypass permission checks
      if (user.role === 'superadmin' || user.level === 1) {
        console.log('checkPermission - Superadmin or level 1 access granted:', { userId: user._id });
        return next();
      }

      // Check if required permission is included
      if (!permissions.includes(requiredPermission)) {
        console.error('checkPermission - Permission denied:', requiredPermission);
        return res.status(403).json({ message: `Unauthorized: ${requiredPermission} permission required` });
      }

      next();
    } catch (err) {
      console.error('checkPermission - Error:', err.message);
      res.status(500).json({ message: 'Server error during permission check' });
    }
  };
};

const checkHierarchy = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      console.error('checkHierarchy - No user found');
      return res.status(403).json({ message: 'Unauthorized: No user found' });
    }

    // Skip hierarchy check for superadmin or level 1 users
    if (user.role === 'superadmin' || user.level === 1) {
      console.log('checkHierarchy - Superadmin or level 1 access, skipping hierarchy check:', { userId: user._id });
      return next();
    }

    // Skip hierarchy check for channel-partner routes
    if (req.route?.path.includes('channel-partners')) {
      console.log('checkHierarchy - Channel partner route, skipping hierarchy check:', { userId: user._id });
      return next();
    }

    // Extract IDs from request
    let userId, projectId;
    if (req.method === 'GET') {
      userId = req.query.userId || req.query.user;
      projectId = req.query.projectId || req.query.project;
    } else {
      userId = req.body.userId || req.body.user || req.params.id;
      projectId = req.body.projectId || req.body.project;
    }

    console.log('checkHierarchy - Extracted IDs:', { userId, projectId });

    // If no userId or projectId, rely on permissions (handled by checkPermission)
    if (!userId && !projectId) {
      console.log('checkHierarchy - No userId or projectId, relying on permissions:', { userId: user._id });
      return next();
    }

    // Check if user is accessing their own data
    if (userId && userId === user._id.toString()) {
      console.log('checkHierarchy - User accessing own data:', { userId: user._id });
      return next();
    }

    // Check hierarchy for subordinate users
    const UserReporting = mongoose.model('UserReporting');
    const userReportings = await UserReporting.find({
      user: userId ? mongoose.Types.ObjectId(userId) : { $exists: true },
      'reportsTo.path': { $regex: `/(${user._id})/` }
    }).lean();

    let hasAccess = false;
    for (const reporting of userReportings) {
      for (const report of reporting.reportsTo) {
        if (report.path.includes(user._id.toString())) {
          if (!projectId || !report.project || report.project.toString() === projectId) {
            hasAccess = true;
            break;
          }
        }
      }
      if (hasAccess) break;
    }

    if (!hasAccess) {
      console.error('checkHierarchy - No matching hierarchy found:', { userId, projectId, requestingUser: user._id });
      return res.status(403).json({ message: 'Unauthorized: No hierarchy access' });
    }

    console.log('checkHierarchy - Access granted:', { userId, projectId, requestingUser: user._id });
    next();
  } catch (err) {
    console.error('checkHierarchy - Error:', err.message);
    res.status(500).json({ message: 'Server error during hierarchy check' });
  }
};

module.exports = { checkPermission, checkHierarchy };