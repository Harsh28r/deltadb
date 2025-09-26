// const mongoose = require('mongoose');

// const permissionCache = new Map();

// const checkPermission = (requiredPermission) => {
//   return async (req, res, next) => {
//     try {
//       const user = req.user;
//       if (!user || !user.roleRef) {
//         console.error('checkPermission - No user or roleRef found:', { userId: user?._id });
//         return res.status(403).json({ message: 'Unauthorized: No user or role found' });
//       }

//       // Check cache for user's permissions
//       let permissions = permissionCache.get(user._id.toString());
//       if (!permissions) {
//         const role = await mongoose.model('Role').findById(user.roleRef).select('permissions').lean();
//         if (!role) {
//           console.error('checkPermission - Role not found for roleRef:', user.roleRef);
//           return res.status(403).json({ message: 'Unauthorized: Role not found' });
//         }
//         permissions = role.permissions || [];
//         permissionCache.set(user._id.toString(), permissions);
//       }

//       console.log('checkPermission - User permissions:', permissions);
//       console.log('checkPermission - Required permission:', requiredPermission);

//       // Allow superadmin or level 1 users to bypass permission checks
//       if (user.role === 'superadmin' || user.level === 1) {
//         console.log('checkPermission - Superadmin or level 1 access granted:', { userId: user._id });
//         return next();
//       }

//       // Check if required permission is included
//       if (!permissions.includes(requiredPermission)) {
//         console.error('checkPermission - Permission denied:', requiredPermission);
//         return res.status(403).json({ message: `Unauthorized: ${requiredPermission} permission required` });
//       }

//       next();
//     } catch (err) {
//       console.error('checkPermission - Error:', err.message);
//       res.status(500).json({ message: 'Server error during permission check' });
//     }
//   };
// };

// const checkHierarchy = async (req, res, next) => {
//   try {
//     const user = req.user;
//     if (!user) {
//       console.error('checkHierarchy - No user found');
//       return res.status(403).json({ message: 'Unauthorized: No user found' });
//     }

//     // Skip hierarchy check for superadmin or level 1 users
//     if (user.role === 'superadmin' || user.level === 1) {
//       console.log('checkHierarchy - Superadmin or level 1 access, skipping hierarchy check:', { userId: user._id });
//       return next();
//     }

//     // Skip hierarchy check for channel-partner routes
//     if (req.route?.path.includes('channel-partners')) {
//       console.log('checkHierarchy - Channel partner route, skipping hierarchy check:', { userId: user._id });
//       return next();
//     }

//     // Extract IDs from request
//     let userId, projectId;
//     if (req.method === 'GET') {
//       userId = req.query.userId || req.query.user;
//       projectId = req.query.projectId || req.query.project;
//     } else {
//       userId = req.body.userId || req.body.user || req.params.id;
//       projectId = req.body.projectId || req.body.project;
//     }

//     console.log('checkHierarchy - Extracted IDs:', { userId, projectId });

//     // If no userId or projectId, rely on permissions (handled by checkPermission)
//     if (!userId && !projectId) {
//       console.log('checkHierarchy - No userId or projectId, relying on permissions:', { userId: user._id });
//       return next();
//     }

//     // Check if user is accessing their own data
//     if (userId && userId === user._id.toString()) {
//       console.log('checkHierarchy - User accessing own data:', { userId: user._id });
//       return next();
//     }

//     // Check hierarchy for subordinate users
//     const UserReporting = mongoose.model('UserReporting');
//     const userReportings = await UserReporting.find({
//       user: userId ? mongoose.Types.ObjectId(userId) : { $exists: true },
//       'reportsTo.path': { $regex: `/(${user._id})/` }
//     }).lean();

//     let hasAccess = false;
//     for (const reporting of userReportings) {
//       for (const report of reporting.reportsTo) {
//         if (report.path.includes(user._id.toString())) {
//           if (!projectId || !report.project || report.project.toString() === projectId) {
//             hasAccess = true;
//             break;
//           }
//         }
//       }
//       if (hasAccess) break;
//     }

//     if (!hasAccess) {
//       console.error('checkHierarchy - No matching hierarchy found:', { userId, projectId, requestingUser: user._id });
//       return res.status(403).json({ message: 'Unauthorized: No hierarchy access' });
//     }

//     console.log('checkHierarchy - Access granted:', { userId, projectId, requestingUser: user._id });
//     next();
//   } catch (err) {
//     console.error('checkHierarchy - Error:', err.message);
//     res.status(500).json({ message: 'Server error during hierarchy check' });
//   }
// };

// module.exports = { checkPermission, checkHierarchy };

const mongoose = require('mongoose');

const permissionCache = new Map();

const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user || !user._id) {
        console.error('checkPermission - No user found:', { userId: user?._id });
        return res.status(403).json({ message: 'Unauthorized: No user found' });
      }

      let permissions = permissionCache.get(user._id.toString());
      if (!permissions) {
        if (!user.customPermissions) {
          const userDoc = await mongoose.model('User').findById(user._id).select('customPermissions role level').lean();
          if (!userDoc) {
            console.error('checkPermission - User not found:', { userId: user._id });
            return res.status(403).json({ message: 'Unauthorized: User not found' });
          }
          user.customPermissions = userDoc.customPermissions || { allowed: [], denied: [] };
          user.role = userDoc.role;
          user.level = userDoc.level;
        }
        permissions = {
          allowed: user.customPermissions.allowed || [],
          denied: user.customPermissions.denied || []
        };
        permissionCache.set(user._id.toString(), permissions);
        console.log('checkPermission - Cached permissions:', { userId: user._id, permissions });
      } else {
        console.log('checkPermission - Cache hit for permissions:', { userId: user._id });
      }

      console.log('checkPermission - Required permission:', requiredPermission);
      console.log('checkPermission - User permissions:', permissions);

      if (user.role === 'superadmin' || user.level === 1) {
        console.log('checkPermission - Superadmin or level 1 access granted:', { userId: user._id });
        return next();
      }

      if (permissions.denied.includes(requiredPermission)) {
        console.error('checkPermission - Permission explicitly denied:', { requiredPermission, userId: user._id });
        return res.status(403).json({ message: `Unauthorized: ${requiredPermission} permission denied` });
      }

      if (!permissions.allowed.includes(requiredPermission)) {
        console.error('checkPermission - Permission not allowed:', { requiredPermission, userId: user._id });
        return res.status(403).json({ message: `Unauthorized: ${requiredPermission} permission required` });
      }

      console.log('checkPermission - Permission granted:', { requiredPermission, userId: user._id });
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

    if (user.role === 'superadmin' || user.level === 1) {
      console.log('checkHierarchy - Superadmin or level 1 access, skipping hierarchy check:', { userId: user._id });
      return next();
    }

    if (req.route?.path.includes('channel-partners')) {
      console.log('checkHierarchy - Channel partner route, skipping hierarchy check:', { userId: user._id });
      return next();
    }

    let userId, projectId;
    if (req.method === 'GET') {
      userId = req.query.userId || req.query.user;
      projectId = req.query.projectId || req.query.project;
    } else {
      userId = req.body.userId || req.body.user || req.body.assignedTo || req.params.id;
      projectId = req.body.projectId || req.body.project || req.body.relatedId;
    }

    console.log('checkHierarchy - Extracted IDs:', { userId, projectId });

    // Skip hierarchy check for general tasks
    if (req.body.taskType === 'general' || (req.params.id && (await mongoose.model('Task').findById(req.params.id).lean())?.taskType === 'general')) {
      console.log('checkHierarchy - General task, skipping project hierarchy check:', { userId: user._id });
      return next();
    }

    if (!userId && !projectId) {
      console.log('checkHierarchy - No userId or projectId, relying on permissions:', { userId: user._id });
      return next();
    }

    if (userId && userId === user._id.toString()) {
      console.log('checkHierarchy - User accessing own data:', { userId: user._id });
      return next();
    }

    const UserReporting = mongoose.model('UserReporting');
    const userReportings = await UserReporting.find({
      user: userId ? mongoose.Types.ObjectId(userId) : { $exists: true },
      'reportsTo.path': { $regex: `/(${user._id})/` },
      'reportsTo.teamType': 'project'
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