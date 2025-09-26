const mongoose = require('mongoose');
const cacheManager = require('./cacheManager');

class PerformanceOptimizer {
  constructor() {
    this.queryMetrics = new Map();
    this.slowQueryThreshold = 1000; // 1 second
  }

  /**
   * Optimize MongoDB aggregation pipelines
   * @param {Array} pipeline - Original aggregation pipeline
   * @param {Object} options - Optimization options
   * @returns {Array} Optimized pipeline
   */
  optimizeAggregationPipeline(pipeline, options = {}) {
    const optimized = [...pipeline];

    // Move $match stages as early as possible
    const matchStages = [];
    const otherStages = [];

    optimized.forEach(stage => {
      if (stage.$match) {
        matchStages.push(stage);
      } else {
        otherStages.push(stage);
      }
    });

    // Combine multiple $match stages
    if (matchStages.length > 1) {
      const combinedMatch = { $match: { $and: matchStages.map(s => s.$match) } };
      return [combinedMatch, ...otherStages];
    }

    return [...matchStages, ...otherStages];
  }

  /**
   * Create optimized queries for large datasets
   * @param {Model} model - Mongoose model
   * @param {Object} filter - Query filter
   * @param {Object} options - Query options
   * @returns {Query} Optimized query
   */
  createOptimizedQuery(model, filter = {}, options = {}) {
    let query = model.find(filter);

    // Use lean() for read-only operations
    if (options.lean !== false) {
      query = query.lean();
    }

    // Select only required fields
    if (options.select) {
      query = query.select(options.select);
    }

    // Add appropriate indexes hint
    if (options.hint) {
      query = query.hint(options.hint);
    }

    // Set read preference for read replicas
    if (options.readPreference) {
      query = query.read(options.readPreference);
    }

    return query;
  }

  /**
   * Batch process large datasets
   * @param {Model} model - Mongoose model
   * @param {Object} filter - Query filter
   * @param {Function} processor - Processing function
   * @param {Object} options - Batch options
   */
  async batchProcess(model, filter, processor, options = {}) {
    const batchSize = options.batchSize || 1000;
    const maxConcurrency = options.maxConcurrency || 5;
    let skip = 0;
    let hasMore = true;
    const results = [];

    while (hasMore) {
      // Process batches with limited concurrency
      const batchPromises = [];

      for (let i = 0; i < maxConcurrency && hasMore; i++) {
        const batchQuery = model
          .find(filter)
          .skip(skip)
          .limit(batchSize)
          .lean();

        batchPromises.push(
          batchQuery.exec().then(async (batch) => {
            if (batch.length === 0) {
              hasMore = false;
              return [];
            }

            return await processor(batch);
          })
        );

        skip += batchSize;
      }

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());

      // Check if we should continue
      if (batchResults.some(result => result.length === 0)) {
        hasMore = false;
      }
    }

    return results;
  }

  /**
   * Stream large datasets for processing
   * @param {Model} model - Mongoose model
   * @param {Object} filter - Query filter
   * @param {Function} processor - Processing function
   * @param {Object} options - Stream options
   */
  async streamProcess(model, filter, processor, options = {}) {
    const batchSize = options.batchSize || 100;
    let processedCount = 0;

    return new Promise((resolve, reject) => {
      const stream = model
        .find(filter)
        .lean()
        .cursor({ batchSize });

      let batch = [];

      stream.on('data', async (doc) => {
        batch.push(doc);

        if (batch.length >= batchSize) {
          stream.pause();

          try {
            await processor(batch);
            processedCount += batch.length;
            batch = [];
            stream.resume();
          } catch (error) {
            stream.destroy();
            reject(error);
          }
        }
      });

      stream.on('end', async () => {
        if (batch.length > 0) {
          try {
            await processor(batch);
            processedCount += batch.length;
          } catch (error) {
            reject(error);
            return;
          }
        }
        resolve(processedCount);
      });

      stream.on('error', reject);
    });
  }

  /**
   * Cache frequently accessed data with smart invalidation
   * @param {String} key - Cache key
   * @param {Function} dataFetcher - Function to fetch data if not cached
   * @param {Object} options - Cache options
   */
  async getCachedData(key, dataFetcher, options = {}) {
    const cacheType = options.type || 'query';
    const ttl = options.ttl || 300;

    // Try to get from cache first
    let cachedData;
    switch (cacheType) {
      case 'user':
        cachedData = cacheManager.getUser(key);
        break;
      case 'project':
        cachedData = cacheManager.getProject(key);
        break;
      case 'lead':
        cachedData = cacheManager.getLead(key);
        break;
      default:
        cachedData = cacheManager.getQueryResult(key);
    }

    if (cachedData) {
      return cachedData;
    }

    // Fetch fresh data
    const startTime = Date.now();
    const freshData = await dataFetcher();
    const queryTime = Date.now() - startTime;

    // Log slow queries
    if (queryTime > this.slowQueryThreshold) {
      console.warn(`🐌 Slow query detected: ${key} took ${queryTime}ms`);
      this.logSlowQuery(key, queryTime);
    }

    // Cache the result
    switch (cacheType) {
      case 'user':
        cacheManager.setUser(key, freshData);
        break;
      case 'project':
        cacheManager.setProject(key, freshData);
        break;
      case 'lead':
        cacheManager.setLead(key, freshData);
        break;
      default:
        cacheManager.setQueryResult(key, freshData);
    }

    return freshData;
  }

  /**
   * Optimize database indexes based on query patterns
   * @param {Model} model - Mongoose model
   * @param {Array} queryPatterns - Array of common query patterns
   */
  async optimizeIndexes(model, queryPatterns) {
    const indexSuggestions = [];

    for (const pattern of queryPatterns) {
      const { filter, sort, frequency } = pattern;

      // Suggest compound indexes for filters + sort
      const indexFields = { ...filter };

      if (sort) {
        Object.assign(indexFields, sort);
      }

      indexSuggestions.push({
        fields: indexFields,
        options: { background: true },
        frequency,
        pattern
      });
    }

    // Sort by frequency and suggest top indexes
    indexSuggestions.sort((a, b) => b.frequency - a.frequency);

    console.log(`📊 Index suggestions for ${model.modelName}:`);
    indexSuggestions.slice(0, 5).forEach((suggestion, i) => {
      console.log(`${i + 1}. ${JSON.stringify(suggestion.fields)} (frequency: ${suggestion.frequency})`);
    });

    return indexSuggestions;
  }

  /**
   * Monitor query performance
   * @param {String} queryKey - Query identifier
   * @param {Function} queryFunction - Query to execute
   */
  async monitorQuery(queryKey, queryFunction) {
    const startTime = Date.now();

    try {
      const result = await queryFunction();
      const executionTime = Date.now() - startTime;

      this.recordQueryMetric(queryKey, executionTime, true);

      if (executionTime > this.slowQueryThreshold) {
        console.warn(`🐌 Slow query: ${queryKey} took ${executionTime}ms`);
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.recordQueryMetric(queryKey, executionTime, false);
      throw error;
    }
  }

  /**
   * Record query metrics for analysis
   * @param {String} queryKey - Query identifier
   * @param {Number} executionTime - Execution time in ms
   * @param {Boolean} success - Whether query succeeded
   */
  recordQueryMetric(queryKey, executionTime, success) {
    if (!this.queryMetrics.has(queryKey)) {
      this.queryMetrics.set(queryKey, {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        maxTime: 0,
        minTime: Infinity,
        errors: 0,
        lastExecuted: null
      });
    }

    const metric = this.queryMetrics.get(queryKey);
    metric.count++;
    metric.totalTime += executionTime;
    metric.avgTime = metric.totalTime / metric.count;
    metric.maxTime = Math.max(metric.maxTime, executionTime);
    metric.minTime = Math.min(metric.minTime, executionTime);
    metric.lastExecuted = new Date();

    if (!success) {
      metric.errors++;
    }
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance metrics
   */
  getPerformanceStats() {
    const stats = {
      totalQueries: 0,
      slowQueries: 0,
      avgExecutionTime: 0,
      topSlowQueries: []
    };

    const queryStats = Array.from(this.queryMetrics.entries());

    stats.totalQueries = queryStats.reduce((sum, [, metric]) => sum + metric.count, 0);
    stats.slowQueries = queryStats.filter(([, metric]) => metric.avgTime > this.slowQueryThreshold).length;

    if (queryStats.length > 0) {
      const totalAvgTime = queryStats.reduce((sum, [, metric]) => sum + metric.avgTime, 0);
      stats.avgExecutionTime = totalAvgTime / queryStats.length;
    }

    // Get top 10 slowest queries
    stats.topSlowQueries = queryStats
      .sort((a, b) => b[1].avgTime - a[1].avgTime)
      .slice(0, 10)
      .map(([key, metric]) => ({
        query: key,
        avgTime: metric.avgTime,
        count: metric.count,
        errors: metric.errors
      }));

    return stats;
  }

  /**
   * Log slow queries for analysis
   * @param {String} queryKey - Query identifier
   * @param {Number} executionTime - Execution time in ms
   */
  logSlowQuery(queryKey, executionTime) {
    // In production, you'd want to log this to a monitoring service
    console.log(`SLOW_QUERY: ${queryKey} - ${executionTime}ms - ${new Date().toISOString()}`);
  }

  /**
   * Optimize connection pooling for high load
   * @param {Object} options - Connection options
   */
  getOptimizedConnectionOptions(options = {}) {
    return {
      // Connection pool settings for high concurrency
      maxPoolSize: options.maxPoolSize || 50,
      minPoolSize: options.minPoolSize || 5,
      maxIdleTimeMS: options.maxIdleTimeMS || 30000,
      waitQueueMultiple: options.waitQueueMultiple || 10,

      // Performance settings
      serverSelectionTimeoutMS: options.serverSelectionTimeoutMS || 30000,
      socketTimeoutMS: options.socketTimeoutMS || 45000,
      heartbeatFrequencyMS: options.heartbeatFrequencyMS || 10000,

      // Buffer settings for high load
      bufferMaxEntries: 0,
      bufferCommands: false,

      // Read/Write preferences
      readPreference: options.readPreference || 'secondaryPreferred',
      retryWrites: true,
      w: 'majority',

      // Compression for large datasets
      compressors: ['zlib'],
      zlibCompressionLevel: 6
    };
  }
}

module.exports = new PerformanceOptimizer();