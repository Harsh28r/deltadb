
// Enhanced middleware integration for DeltaYards CRM
const { smartRateLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');
const validator = require('../utils/validator');

// Middleware functions
const enhancedMiddleware = {
  // Rate limiting middleware
  rateLimiting: smartRateLimiter,

  // Request logging middleware
  requestLogging: logger.createRequestMiddleware(),

  // Error handling middleware
  errorHandling: logger.createErrorMiddleware(),

  // Validation middleware factory
  validation: (schema, source = 'body') => validator.createValidationMiddleware(schema, source)
};

module.exports = enhancedMiddleware;
