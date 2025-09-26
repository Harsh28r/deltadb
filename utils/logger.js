const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '..', 'logs');
    this.ensureLogDir();

    this.logLevels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };

    this.currentLevel = this.logLevels[process.env.LOG_LEVEL || 'INFO'];
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.maxFiles = 5;
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Get log file path for specific type
   * @param {String} type - Log type (error, access, performance, security)
   * @returns {String} Log file path
   */
  getLogFilePath(type = 'general') {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `${type}-${date}.log`);
  }

  /**
   * Format log message
   * @param {String} level - Log level
   * @param {String} message - Log message
   * @param {Object} meta - Additional metadata
   * @returns {String} Formatted log message
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const pid = process.pid;

    let logEntry = {
      timestamp,
      level,
      pid,
      message
    };

    // Add metadata
    if (meta.userId) logEntry.userId = meta.userId;
    if (meta.ip) logEntry.ip = meta.ip;
    if (meta.userAgent) logEntry.userAgent = meta.userAgent;
    if (meta.method) logEntry.method = meta.method;
    if (meta.url) logEntry.url = meta.url;
    if (meta.statusCode) logEntry.statusCode = meta.statusCode;
    if (meta.responseTime) logEntry.responseTime = meta.responseTime;
    if (meta.error) logEntry.error = meta.error;
    if (meta.stack) logEntry.stack = meta.stack;

    return JSON.stringify(logEntry) + '\n';
  }

  /**
   * Write log to file
   * @param {String} type - Log type
   * @param {String} content - Log content
   */
  async writeLog(type, content) {
    try {
      const filePath = this.getLogFilePath(type);

      // Check file size and rotate if necessary
      await this.rotateLogIfNeeded(filePath);

      fs.appendFileSync(filePath, content);
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  /**
   * Rotate log file if it exceeds max size
   * @param {String} filePath - Log file path
   */
  async rotateLogIfNeeded(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);

        if (stats.size > this.maxFileSize) {
          const timestamp = Date.now();
          const rotatedPath = `${filePath}.${timestamp}`;

          fs.renameSync(filePath, rotatedPath);

          // Clean up old rotated files
          await this.cleanupOldLogs(path.dirname(filePath), path.basename(filePath));
        }
      }
    } catch (error) {
      console.error('Error rotating log file:', error);
    }
  }

  /**
   * Clean up old log files
   * @param {String} logDir - Log directory
   * @param {String} baseFileName - Base file name
   */
  async cleanupOldLogs(logDir, baseFileName) {
    try {
      const files = fs.readdirSync(logDir)
        .filter(file => file.startsWith(baseFileName) && file.includes('.'))
        .map(file => ({
          name: file,
          path: path.join(logDir, file),
          stats: fs.statSync(path.join(logDir, file))
        }))
        .sort((a, b) => b.stats.mtime - a.stats.mtime);

      // Keep only the latest files
      const filesToDelete = files.slice(this.maxFiles);

      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }
    } catch (error) {
      console.error('Error cleaning up old logs:', error);
    }
  }

  /**
   * Log error message
   * @param {String} message - Error message
   * @param {Object} meta - Additional metadata
   */
  error(message, meta = {}) {
    if (this.currentLevel >= this.logLevels.ERROR) {
      const logContent = this.formatMessage('ERROR', message, meta);
      console.error(`🔴 ${message}`, meta);
      this.writeLog('error', logContent);
    }
  }

  /**
   * Log warning message
   * @param {String} message - Warning message
   * @param {Object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    if (this.currentLevel >= this.logLevels.WARN) {
      const logContent = this.formatMessage('WARN', message, meta);
      console.warn(`🟡 ${message}`, meta);
      this.writeLog('general', logContent);
    }
  }

  /**
   * Log info message
   * @param {String} message - Info message
   * @param {Object} meta - Additional metadata
   */
  info(message, meta = {}) {
    if (this.currentLevel >= this.logLevels.INFO) {
      const logContent = this.formatMessage('INFO', message, meta);
      console.log(`🔵 ${message}`, meta);
      this.writeLog('general', logContent);
    }
  }

  /**
   * Log debug message
   * @param {String} message - Debug message
   * @param {Object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    if (this.currentLevel >= this.logLevels.DEBUG) {
      const logContent = this.formatMessage('DEBUG', message, meta);
      console.log(`🟣 ${message}`, meta);
      this.writeLog('debug', logContent);
    }
  }

  /**
   * Log API access
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Number} responseTime - Response time in ms
   */
  access(req, res, responseTime) {
    const meta = {
      userId: req.user?.id,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`
    };

    const message = `${req.method} ${req.originalUrl} - ${res.statusCode} - ${responseTime}ms`;
    const logContent = this.formatMessage('ACCESS', message, meta);

    this.writeLog('access', logContent);

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      const color = res.statusCode >= 400 ? '🔴' : res.statusCode >= 300 ? '🟡' : '🟢';
      console.log(`${color} ${message}`);
    }
  }

  /**
   * Log performance metrics
   * @param {String} operation - Operation name
   * @param {Number} duration - Duration in ms
   * @param {Object} meta - Additional metadata
   */
  performance(operation, duration, meta = {}) {
    const message = `${operation} completed in ${duration}ms`;
    const performanceMeta = {
      ...meta,
      operation,
      duration,
      timestamp: new Date().toISOString()
    };

    const logContent = this.formatMessage('PERFORMANCE', message, performanceMeta);
    this.writeLog('performance', logContent);

    // Log slow operations to console
    if (duration > 1000) {
      console.warn(`🐌 Slow operation: ${message}`, performanceMeta);
    }
  }

  /**
   * Log security events
   * @param {String} event - Security event type
   * @param {String} message - Event message
   * @param {Object} meta - Additional metadata
   */
  security(event, message, meta = {}) {
    const securityMeta = {
      ...meta,
      event,
      severity: meta.severity || 'medium',
      timestamp: new Date().toISOString()
    };

    const logContent = this.formatMessage('SECURITY', message, securityMeta);
    this.writeLog('security', logContent);

    // Log high severity events to console
    if (meta.severity === 'high' || meta.severity === 'critical') {
      console.error(`🚨 SECURITY: ${message}`, securityMeta);
    }
  }

  /**
   * Log database operations
   * @param {String} operation - Database operation
   * @param {String} collection - Collection name
   * @param {Number} duration - Operation duration
   * @param {Object} meta - Additional metadata
   */
  database(operation, collection, duration, meta = {}) {
    const message = `DB ${operation} on ${collection} - ${duration}ms`;
    const dbMeta = {
      ...meta,
      operation,
      collection,
      duration,
      timestamp: new Date().toISOString()
    };

    const logContent = this.formatMessage('DATABASE', message, dbMeta);
    this.writeLog('database', logContent);

    // Log slow queries
    if (duration > 500) {
      console.warn(`🐌 Slow DB query: ${message}`, dbMeta);
    }
  }

  /**
   * Log business events (lead status changes, user actions, etc.)
   * @param {String} event - Business event type
   * @param {String} message - Event message
   * @param {Object} meta - Additional metadata
   */
  business(event, message, meta = {}) {
    const businessMeta = {
      ...meta,
      event,
      timestamp: new Date().toISOString()
    };

    const logContent = this.formatMessage('BUSINESS', message, businessMeta);
    this.writeLog('business', logContent);

    console.log(`📊 ${message}`, businessMeta);
  }

  /**
   * Log system health metrics
   * @param {Object} metrics - Health metrics
   */
  health(metrics) {
    const message = 'System health check';
    const logContent = this.formatMessage('HEALTH', message, metrics);
    this.writeLog('health', logContent);
  }

  /**
   * Create request logging middleware
   * @returns {Function} Express middleware function
   */
  createRequestMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();

      // Override res.end to capture response time
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        res.end = originalEnd;
        res.end(chunk, encoding);

        const responseTime = Date.now() - startTime;
        logger.access(req, res, responseTime);
      };

      next();
    };
  }

  /**
   * Create error logging middleware
   * @returns {Function} Express error middleware function
   */
  createErrorMiddleware() {
    return (error, req, res, next) => {
      const meta = {
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.originalUrl,
        error: error.message,
        stack: error.stack
      };

      this.error(`Unhandled error: ${error.message}`, meta);

      // Don't expose error details in production
      if (process.env.NODE_ENV === 'production') {
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.status(500).json({ error: error.message, stack: error.stack });
      }
    };
  }

  /**
   * Get log statistics
   * @param {String} logType - Log type to analyze
   * @param {Number} days - Number of days to analyze
   * @returns {Object} Log statistics
   */
  async getLogStats(logType = 'general', days = 7) {
    try {
      const stats = {
        totalEntries: 0,
        errorCount: 0,
        warnCount: 0,
        infoCount: 0,
        topErrors: [],
        hourlyDistribution: new Array(24).fill(0)
      };

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

      // Analyze log files for the specified period
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const filePath = path.join(this.logDir, `${logType}-${dateStr}.log`);

        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.trim().split('\n').filter(line => line.trim());

          stats.totalEntries += lines.length;

          lines.forEach(line => {
            try {
              const entry = JSON.parse(line);

              // Count by level
              if (entry.level === 'ERROR') stats.errorCount++;
              else if (entry.level === 'WARN') stats.warnCount++;
              else if (entry.level === 'INFO') stats.infoCount++;

              // Hourly distribution
              const hour = new Date(entry.timestamp).getHours();
              stats.hourlyDistribution[hour]++;

            } catch (parseError) {
              // Ignore parsing errors for malformed log entries
            }
          });
        }
      }

      return stats;

    } catch (error) {
      console.error('Error getting log stats:', error);
      return {};
    }
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;