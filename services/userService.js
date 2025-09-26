const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const UserReporting = require('../models/UserReporting');
const cacheManager = require('../utils/cacheManager');
const performanceOptimizer = require('../utils/performanceOptimizer');
const paginationManager = require('../utils/pagination');

class UserService {
  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
  }

  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Object} Created user and token
   */
  async registerUser(userData) {
    try {
      const { name, email, password, mobile, role = 'user', level = 3, createdBy = null } = userData;

      // Check if user already exists
      const existingUser = await this.findUserByEmail(email.toLowerCase());
      if (existingUser) {
        throw new Error('User already exists');
      }

      // Get role permissions
      const rolePermissions = await this.getRolePermissions(role);

      // Create new user
      const user = new User({
        name,
        email: email.toLowerCase(),
        password, // Will be hashed by User model
        mobile,
        role,
        level,
        customPermissions: {
          allowed: rolePermissions,
          denied: []
        },
        isActive: true
      });

      await user.save();

      // Create user reporting structure
      await this.createUserReporting(user._id, level, createdBy);

      // Generate JWT token
      const token = this.generateJWT(user);

      // Cache user data
      cacheManager.setUser(user._id.toString(), user.toObject());

      return {
        user: this.sanitizeUserData(user),
        token
      };

    } catch (error) {
      console.error('User registration error:', error);
      throw error;
    }
  }

  /**
   * Authenticate user login
   * @param {String} email - User email
   * @param {String} password - User password
   * @returns {Object} User data and token
   */
  async authenticateUser(email, password) {
    try {
      // Try to get from cache first
      let user = cacheManager.getUser(`email:${email.toLowerCase()}`);

      if (!user) {
        user = await User.findOne({
          email: email.toLowerCase(),
          isActive: true
        }).populate('roleRef').lean();

        if (user) {
          cacheManager.setUser(`email:${email.toLowerCase()}`, user);
          cacheManager.setUser(user._id.toString(), user);
        }
      }

      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(password, user.password);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // Generate token
      const token = this.generateJWT(user);

      return {
        user: this.sanitizeUserData(user),
        token
      };

    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  /**
   * Find user by email with caching
   * @param {String} email - User email
   * @returns {Object|null} User object or null
   */
  async findUserByEmail(email) {
    const cacheKey = `email:${email.toLowerCase()}`;
    let user = cacheManager.getUser(cacheKey);

    if (!user) {
      user = await User.findOne({ email: email.toLowerCase() }).lean();
      if (user) {
        cacheManager.setUser(cacheKey, user);
      }
    }

    return user;
  }

  /**
   * Find user by ID with caching
   * @param {String} userId - User ID
   * @returns {Object|null} User object or null
   */
  async findUserById(userId) {
    let user = cacheManager.getUser(userId);

    if (!user) {
      user = await User.findById(userId).populate('roleRef').lean();
      if (user) {
        cacheManager.setUser(userId, user);
      }
    }

    return user;
  }

  /**
   * Get users with pagination and filters
   * @param {Object} query - Query parameters
   * @returns {Object} Paginated users
   */
  async getUsers(query) {
    try {
      const paginationParams = paginationManager.createPaginationParams(query);
      const sortParams = paginationManager.createSortParams(query, { createdAt: -1 });
      const filterParams = paginationManager.createFilterParams(query, [
        'role', 'level', 'isActive', 'email', 'name'
      ]);

      // Use performance optimizer for cached queries
      const cacheKey = `users:${JSON.stringify({ filterParams, sortParams, paginationParams })}`;

      return await performanceOptimizer.getCachedData(
        cacheKey,
        async () => {
          const userQuery = performanceOptimizer.createOptimizedQuery(
            User,
            filterParams,
            { lean: true, select: 'name email role level isActive createdAt mobile' }
          );

          userQuery.sort(sortParams);

          return await paginationManager.executePaginatedQuery(userQuery, paginationParams);
        },
        { type: 'query', ttl: 300 }
      );

    } catch (error) {
      console.error('Error getting users:', error);
      throw error;
    }
  }

  /**
   * Update user data
   * @param {String} userId - User ID
   * @param {Object} updateData - Data to update
   * @param {String} updatedBy - User making the update
   * @returns {Object} Updated user
   */
  async updateUser(userId, updateData, updatedBy) {
    try {
      // Validate update data
      const allowedFields = [
        'name', 'email', 'mobile', 'role', 'level',
        'customPermissions', 'isActive', 'restrictions'
      ];

      const sanitizedData = {};
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          sanitizedData[key] = updateData[key];
        }
      });

      sanitizedData.updatedBy = updatedBy;
      sanitizedData.updatedAt = new Date();

      // Handle role change
      if (sanitizedData.role) {
        const rolePermissions = await this.getRolePermissions(sanitizedData.role);
        sanitizedData.customPermissions = {
          allowed: rolePermissions,
          denied: sanitizedData.customPermissions?.denied || []
        };
      }

      const user = await User.findByIdAndUpdate(
        userId,
        sanitizedData,
        { new: true, runValidators: true }
      );

      if (!user) {
        throw new Error('User not found');
      }

      // Invalidate cache
      cacheManager.invalidateUserData(userId);

      // Update user reporting if level changed
      if (sanitizedData.level) {
        await this.updateUserReporting(userId, sanitizedData.level);
      }

      return this.sanitizeUserData(user);

    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Delete user (soft delete)
   * @param {String} userId - User ID
   * @param {String} deletedBy - User making the deletion
   * @returns {Boolean} Success status
   */
  async deleteUser(userId, deletedBy) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          isActive: false,
          deletedAt: new Date(),
          deletedBy
        },
        { new: true }
      );

      if (!user) {
        throw new Error('User not found');
      }

      // Invalidate cache
      cacheManager.invalidateUserData(userId);

      return true;

    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Get user permissions
   * @param {String} userId - User ID
   * @returns {Array} User permissions
   */
  async getUserPermissions(userId) {
    try {
      // Try cache first
      let permissions = cacheManager.getUserPermissions(userId);

      if (!permissions) {
        const user = await this.findUserById(userId);
        if (!user) {
          throw new Error('User not found');
        }

        // Get effective permissions from User model method
        const userDoc = await User.findById(userId);
        permissions = await userDoc.getEffectivePermissions();

        // Cache permissions
        cacheManager.setUserPermissions(userId, permissions);
      }

      return permissions;

    } catch (error) {
      console.error('Error getting user permissions:', error);
      throw error;
    }
  }

  /**
   * Update user permissions
   * @param {String} userId - User ID
   * @param {Object} permissions - Permissions to update
   * @param {String} updatedBy - User making the update
   * @returns {Object} Updated user
   */
  async updateUserPermissions(userId, permissions, updatedBy) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          customPermissions: permissions,
          updatedBy,
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!user) {
        throw new Error('User not found');
      }

      // Invalidate cache
      cacheManager.deleteUserPermissions(userId);
      cacheManager.invalidateUserData(userId);

      return this.sanitizeUserData(user);

    } catch (error) {
      console.error('Error updating user permissions:', error);
      throw error;
    }
  }

  /**
   * Bulk operations for users
   * @param {Array} operations - Array of operations
   * @param {String} operatedBy - User performing operations
   * @returns {Object} Results summary
   */
  async bulkOperations(operations, operatedBy) {
    try {
      const results = {
        success: 0,
        failed: 0,
        errors: []
      };

      // Process operations in batches
      await performanceOptimizer.batchProcess(
        User,
        {},
        async (batch) => {
          for (const operation of operations) {
            try {
              switch (operation.type) {
                case 'update':
                  await this.updateUser(operation.userId, operation.data, operatedBy);
                  results.success++;
                  break;
                case 'delete':
                  await this.deleteUser(operation.userId, operatedBy);
                  results.success++;
                  break;
                default:
                  throw new Error(`Unknown operation type: ${operation.type}`);
              }
            } catch (error) {
              results.failed++;
              results.errors.push({
                userId: operation.userId,
                error: error.message
              });
            }
          }
          return [];
        },
        { batchSize: 50 }
      );

      return results;

    } catch (error) {
      console.error('Error in bulk operations:', error);
      throw error;
    }
  }

  // Helper methods

  /**
   * Generate JWT token for user
   * @param {Object} user - User object
   * @returns {String} JWT token
   */
  generateJWT(user) {
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
      level: user.level
    };

    return jwt.sign(payload, this.JWT_SECRET, { expiresIn: this.JWT_EXPIRES_IN });
  }

  /**
   * Verify password
   * @param {String} inputPassword - Input password
   * @param {String} hashedPassword - Hashed password from DB
   * @returns {Boolean} Password match status
   */
  async verifyPassword(inputPassword, hashedPassword) {
    // Handle both hashed and plain text passwords (for migration period)
    if (hashedPassword && hashedPassword.length > 20) {
      return await bcrypt.compare(inputPassword, hashedPassword);
    } else {
      // Fallback for plain text passwords
      return inputPassword === hashedPassword;
    }
  }

  /**
   * Get role permissions
   * @param {String} roleName - Role name
   * @returns {Array} Role permissions
   */
  async getRolePermissions(roleName) {
    try {
      const role = await Role.findOne({ name: roleName }).lean();
      return role ? role.permissions : [];
    } catch (error) {
      console.error('Error getting role permissions:', error);
      return [];
    }
  }

  /**
   * Create user reporting structure
   * @param {String} userId - User ID
   * @param {Number} level - User level
   * @param {String} createdBy - User creating the structure
   */
  async createUserReporting(userId, level, createdBy) {
    try {
      // Find superadmin for default reporting
      const superadmin = await User.findOne({ role: 'superadmin', level: 1 }).lean();

      if (superadmin) {
        const reporting = new UserReporting({
          user: userId,
          reportsTo: [{
            user: superadmin._id,
            teamType: 'superadmin',
            path: `/${superadmin._id}/`,
            context: 'Default superadmin oversight'
          }],
          level
        });

        await reporting.save();
      }

    } catch (error) {
      console.error('Error creating user reporting:', error);
    }
  }

  /**
   * Update user reporting structure
   * @param {String} userId - User ID
   * @param {Number} newLevel - New user level
   */
  async updateUserReporting(userId, newLevel) {
    try {
      const reporting = await UserReporting.findOne({ user: userId });

      if (reporting) {
        reporting.level = newLevel;
        await reporting.save();
      }

    } catch (error) {
      console.error('Error updating user reporting:', error);
    }
  }

  /**
   * Sanitize user data for response
   * @param {Object} user - User object
   * @returns {Object} Sanitized user data
   */
  sanitizeUserData(user) {
    const userObj = user.toObject ? user.toObject() : user;

    // Remove sensitive fields
    delete userObj.password;
    delete userObj.__v;

    return userObj;
  }

  /**
   * Get user statistics
   * @returns {Object} User statistics
   */
  async getUserStats() {
    try {
      const stats = await User.aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            activeUsers: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
            usersByRole: {
              $push: {
                role: '$role',
                count: 1,
                isActive: '$isActive'
              }
            }
          }
        }
      ]);

      // Process role statistics
      const roleStats = {};
      stats[0]?.usersByRole?.forEach(user => {
        if (!roleStats[user.role]) {
          roleStats[user.role] = { total: 0, active: 0 };
        }
        roleStats[user.role].total++;
        if (user.isActive) {
          roleStats[user.role].active++;
        }
      });

      return {
        totalUsers: stats[0]?.totalUsers || 0,
        activeUsers: stats[0]?.activeUsers || 0,
        roleStats
      };

    } catch (error) {
      console.error('Error getting user stats:', error);
      return {};
    }
  }
}

module.exports = new UserService();