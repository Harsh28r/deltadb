const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const redisCache = require('../utils/redisCache');

// Create different rate limiters for different endpoints
const rateLimiters = {
  // General API rate limiter
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Increased for high user load
    message: {
      error: 'Too many requests',
      message: 'You have exceeded the request limit. Please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Use Redis store for distributed rate limiting
    store: new RedisStore({
      // @ts-expect-error - Known issue: the call function is not present in @types/ioredis
      sendCommand: (...args) => redisCache.client?.call(...args),
      prefix: 'rl:general:'
    }),
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise use proper IP handling
      if (req.user?.id) {
        return req.user.id;
      }

      // Use express-rate-limit's built-in IP handling for IPv6 compatibility
      const forwarded = req.headers['x-forwarded-for'];
      const ip = forwarded ? forwarded.split(',')[0].trim() : req.connection.remoteAddress;
      return ip;
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/api/health' || req.path === '/';
    }
  }),

  // Authentication endpoints (more restrictive)
  auth: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // Only 10 login attempts per 15 minutes
    message: {
      error: 'Too many authentication attempts',
      message: 'Too many login attempts. Please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args) => redisCache.client?.call(...args),
      prefix: 'rl:auth:'
    }),
    skipSuccessfulRequests: true // Don't count successful logins
  }),

  // Admin endpoints (very restrictive)
  admin: rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // 50 requests per 5 minutes for admin
    message: {
      error: 'Admin rate limit exceeded',
      message: 'Too many admin requests. Please wait before trying again.',
      retryAfter: '5 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args) => redisCache.client?.call(...args),
      prefix: 'rl:admin:'
    })
  }),

  // File upload endpoints
  upload: rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 20, // 20 file uploads per 10 minutes
    message: {
      error: 'File upload rate limit exceeded',
      message: 'Too many file uploads. Please wait before uploading again.',
      retryAfter: '10 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args) => redisCache.client?.call(...args),
      prefix: 'rl:upload:'
    })
  }),

  // Lead creation/updates (business critical)
  leads: rateLimit({
    windowMs: 1 * 1000, // 1 second
    max: 100, // 100 lead operations per second
    message: {
      error: 'Lead operation rate limit exceeded',
      message: 'Too many lead operations. Please slow down.',
      retryAfter: '1 second'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args) => redisCache.client?.call(...args),
      prefix: 'rl:leads:'
    })
  }),

  // Search endpoints (can be expensive)
  search: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 searches per minute
    message: {
      error: 'Search rate limit exceeded',
      message: 'Too many search requests. Please wait before searching again.',
      retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args) => redisCache.client?.call(...args),
      prefix: 'rl:search:'
    })
  }),

  // WebSocket connections
  websocket: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // 10 WebSocket connections per minute per user
    message: {
      error: 'WebSocket connection rate limit exceeded',
      message: 'Too many WebSocket connection attempts.',
      retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args) => redisCache.client?.call(...args),
      prefix: 'rl:websocket:'
    })
  })
};

// Dynamic rate limiter based on user role/level
const createDynamicRateLimit = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: (req) => {
      // Higher limits for higher level users
      if (req.user) {
        switch (req.user.role) {
          case 'superadmin':
            return options.superadminMax || 2000;
          case 'admin':
            return options.adminMax || 1500;
          case 'manager':
            return options.managerMax || 1000;
          default:
            return options.userMax || 500;
        }
      }
      return options.guestMax || 100;
    },
    message: (req) => ({
      error: 'Rate limit exceeded',
      message: `Rate limit exceeded for ${req.user?.role || 'guest'} user.`,
      retryAfter: Math.ceil(options.windowMs / 60000) + ' minutes'
    }),
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args) => redisCache.client?.call(...args),
      prefix: options.prefix || 'rl:dynamic:'
    }),
    keyGenerator: (req) => {
      if (req.user?.id) {
        return req.user.id;
      }
      const forwarded = req.headers['x-forwarded-for'];
      return forwarded ? forwarded.split(',')[0].trim() : req.connection.remoteAddress;
    }
  });
};

// Advanced rate limiter with burst protection
const createBurstProtectionLimit = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 60 * 1000, // 1 minute
    max: options.max || 30,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,

    // Custom logic for burst detection
    onLimitReached: (req, res, options) => {
      console.warn(`🚨 Rate limit reached for ${req.user?.email || req.ip} on ${req.path}`);

      // Log to monitoring system in production
      // monitoringService.logRateLimit(req.user?.id || req.ip, req.path);
    },

    message: {
      error: 'Burst protection activated',
      message: 'Too many requests in a short time. Please slow down.',
      retryAfter: Math.ceil((options.windowMs || 60000) / 1000) + ' seconds'
    },

    standardHeaders: true,
    legacyHeaders: false,

    store: new RedisStore({
      sendCommand: (...args) => redisCache.client?.call(...args),
      prefix: options.prefix || 'rl:burst:'
    })
  });
};

// Rate limiter for expensive operations
const expensiveOperationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: (req) => {
    // Very limited for expensive operations
    if (req.user?.role === 'superadmin') return 100;
    if (req.user?.role === 'admin') return 50;
    if (req.user?.role === 'manager') return 25;
    return 10;
  },
  message: {
    error: 'Expensive operation limit exceeded',
    message: 'You have reached the limit for resource-intensive operations.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redisCache.client?.call(...args),
    prefix: 'rl:expensive:'
  })
});

// Middleware to apply appropriate rate limiter based on endpoint
const smartRateLimiter = (req, res, next) => {
  const path = req.path.toLowerCase();

  // Apply specific rate limiter based on endpoint
  if (path.includes('login') || path.includes('auth')) {
    return rateLimiters.auth(req, res, next);
  }

  if (path.includes('admin') || path.includes('superadmin')) {
    return rateLimiters.admin(req, res, next);
  }

  if (path.includes('upload') || path.includes('file')) {
    return rateLimiters.upload(req, res, next);
  }

  if (path.includes('lead') && (req.method === 'POST' || req.method === 'PUT')) {
    return rateLimiters.leads(req, res, next);
  }

  if (path.includes('search') || path.includes('query')) {
    return rateLimiters.search(req, res, next);
  }

  // Default to general rate limiter
  return rateLimiters.general(req, res, next);
};

module.exports = {
  rateLimiters,
  createDynamicRateLimit,
  createBurstProtectionLimit,
  expensiveOperationLimiter,
  smartRateLimiter
};