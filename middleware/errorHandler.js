const logger = require('../utils/logger');

/**
 * Comprehensive error handling middleware
 * Handles different types of errors with appropriate responses
 */

class AppError extends Error {
  constructor(message, statusCode, errorCode = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Database error handlers
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400, 'INVALID_ID');
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.message.match(/(["'])(\\?.)*?\1/)?.[0];
  const field = Object.keys(err.keyValue || {})[0] || 'field';
  const message = `Duplicate ${field}: ${value}. Please use another value.`;
  return new AppError(message, 400, 'DUPLICATE_FIELD', { field, value });
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => ({
    field: el.path,
    message: el.message,
    value: el.value
  }));

  const message = `Invalid input data`;
  return new AppError(message, 400, 'VALIDATION_ERROR', errors);
};

// JWT error handlers
const handleJWTError = () => {
  return new AppError('Invalid token. Please log in again!', 401, 'INVALID_TOKEN');
};

const handleJWTExpiredError = () => {
  return new AppError('Your token has expired! Please log in again.', 401, 'EXPIRED_TOKEN');
};

// File upload error handlers
const handleMulterError = (err) => {
  let message = 'File upload error';
  let statusCode = 400;
  let errorCode = 'UPLOAD_ERROR';

  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      message = 'File too large. Maximum size is 5MB.';
      errorCode = 'FILE_TOO_LARGE';
      break;
    case 'LIMIT_FILE_COUNT':
      message = 'Too many files. Only 1 file allowed.';
      errorCode = 'TOO_MANY_FILES';
      break;
    case 'LIMIT_UNEXPECTED_FILE':
      message = 'Unexpected field name in file upload.';
      errorCode = 'UNEXPECTED_FIELD';
      break;
    default:
      message = err.message || 'File upload failed';
  }

  return new AppError(message, statusCode, errorCode);
};

// Rate limiting error handler
const handleRateLimitError = (err) => {
  const message = 'Too many requests, please try again later.';
  return new AppError(message, 429, 'RATE_LIMIT_EXCEEDED');
};

// Permission error handler
const handlePermissionError = (err) => {
  const message = 'You do not have permission to perform this action.';
  return new AppError(message, 403, 'INSUFFICIENT_PERMISSIONS');
};

// Business logic error handler
const handleBusinessLogicError = (err) => {
  return new AppError(err.message, 422, 'BUSINESS_LOGIC_ERROR');
};

// Send error response in development
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: 'error',
    error: err,
    message: err.message,
    errorCode: err.errorCode,
    details: err.details,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
};

// Send error response in production
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    const response = {
      status: 'error',
      message: err.message,
      errorCode: err.errorCode,
      timestamp: new Date().toISOString()
    };

    if (err.details) {
      response.details = err.details;
    }

    res.status(err.statusCode).json(response);
  } else {
    // Programming or other unknown error: don't leak error details
    console.error('ERROR 💥', err);
    logger.error('Unhandled error:', err);

    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
      errorCode: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
  }
};

// Main error handling middleware
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log error for monitoring
  if (err.statusCode >= 500) {
    logger.error('Server Error:', {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id
    });
  } else if (err.statusCode >= 400) {
    logger.warn('Client Error:', {
      message: err.message,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id
    });
  }

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (error.name === 'MulterError') error = handleMulterError(error);
    if (error.message === 'Too Many Requests') error = handleRateLimitError(error);
    if (error.name === 'PermissionError') error = handlePermissionError(error);
    if (error.name === 'BusinessLogicError') error = handleBusinessLogicError(error);

    sendErrorProd(error, res);
  }
};

// Async error wrapper
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  logger.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = {
  AppError,
  globalErrorHandler,
  catchAsync
};