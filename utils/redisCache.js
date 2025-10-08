

const Redis = require('ioredis');

class RedisCache {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.defaultTTL = 300; // 5 minutes default
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    try {
      // Check if Redis is disabled
      if (process.env.REDIS_ENABLED === 'false') {
        console.log('⚠️ Redis is disabled in .env (REDIS_ENABLED=false)');
        console.log('ℹ️ Application will work without caching');
        this.isConnected = false;
        return null;
      }

      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3
      };

      this.client = new Redis(redisConfig);

      this.client.on('connect', () => {
        console.log('✅ Redis connected successfully');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis connection error:', err.message);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        console.log('⚠️ Redis connection closed');
        this.isConnected = false;
      });

      // Test connection
      await this.client.ping();
      console.log('🔄 Redis ping successful');

      return this.client;
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error.message);
      console.log('⚠️ Continuing without Redis cache');
      this.isConnected = false;
      return null;
    }
  }

  /**
   * Get value from cache
   * @param {String} key - Cache key
   * @returns {Object|null} Parsed JSON value or null
   */
  async get(key) {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (!value) return null;

      return JSON.parse(value);
    } catch (error) {
      console.error(`Redis GET error for key ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Set value in cache
   * @param {String} key - Cache key
   * @param {*} value - Value to cache (will be JSON stringified)
   * @param {Number} ttl - Time to live in seconds (default: 300s)
   */
  async set(key, value, ttl = this.defaultTTL) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const stringValue = JSON.stringify(value);
      await this.client.setex(key, ttl, stringValue);
      return true;
    } catch (error) {
      console.error(`Redis SET error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Delete key from cache
   * @param {String} key - Cache key
   */
  async del(key) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`Redis DEL error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   * @param {String} pattern - Key pattern (e.g., 'followups:*')
   */
  async delPattern(pattern) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
        console.log(`🗑️ Deleted ${keys.length} keys matching pattern: ${pattern}`);
      }
      return true;
    } catch (error) {
      console.error(`Redis DEL pattern error for ${pattern}:`, error.message);
      return false;
    }
  }

  /**
   * Check if key exists
   * @param {String} key - Cache key
   */
  async exists(key) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Redis EXISTS error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Increment a counter
   * @param {String} key - Counter key
   * @param {Number} by - Increment by (default: 1)
   */
  async incr(key, by = 1) {
    if (!this.isConnected || !this.client) {
      return 0;
    }

    try {
      const result = await this.client.incrby(key, by);
      return result;
    } catch (error) {
      console.error(`Redis INCR error for key ${key}:`, error.message);
      return 0;
    }
  }

  /**
   * Set expiration on a key
   * @param {String} key - Cache key
   * @param {Number} seconds - Seconds until expiration
   */
  async expire(key, seconds) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.expire(key, seconds);
      return true;
    } catch (error) {
      console.error(`Redis EXPIRE error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    if (!this.isConnected || !this.client) {
      return {
        connected: false,
        keys: 0
      };
    }

    try {
      const info = await this.client.info('stats');
      const dbSize = await this.client.dbsize();

      return {
        connected: this.isConnected,
        keys: dbSize,
        info: info
      };
    } catch (error) {
      console.error('Redis STATS error:', error.message);
      return {
        connected: false,
        keys: 0,
        error: error.message
      };
    }
  }

  /**
   * Clear all cache
   */
  async flush() {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.flushdb();
      console.log('🗑️ Redis cache flushed');
      return true;
    } catch (error) {
      console.error('Redis FLUSH error:', error.message);
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      console.log('👋 Redis disconnected');
    }
  }

  /**
   * Middleware to cache API responses
   * @param {Number} ttl - Cache TTL in seconds
   */
  middleware(ttl = 300) {
    return async (req, res, next) => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      // Build cache key from URL and query params
      const cacheKey = `api:${req.originalUrl}:${JSON.stringify(req.query)}:user:${req.user?._id || 'public'}`;

      try {
        // Try to get from cache
        const cached = await this.get(cacheKey);

        if (cached) {
          console.log(`📦 Cache HIT: ${cacheKey}`);
          return res.json(cached);
        }

        console.log(`❌ Cache MISS: ${cacheKey}`);

        // Store original res.json
        const originalJson = res.json.bind(res);

        // Override res.json to cache the response
        res.json = (data) => {
          // Cache the response
          this.set(cacheKey, data, ttl).catch(err => {
            console.error('Error caching response:', err);
          });

          // Send the response
          return originalJson(data);
        };

        next();
      } catch (error) {
        console.error('Cache middleware error:', error.message);
        next();
      }
    };
  }
}

// Create singleton instance
const redisCache = new RedisCache();

module.exports = redisCache;
