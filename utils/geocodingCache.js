const NodeCache = require('node-cache');

/**
 * Geocoding Cache Utility
 * Caches reverse geocoding results to reduce API costs
 *
 * Features:
 * - In-memory caching with TTL
 * - Coordinate rounding to group nearby locations
 * - Automatic cleanup of expired entries
 */

// Cache configuration
const geocodingCache = new NodeCache({
  stdTTL: 86400, // 24 hours in seconds
  checkperiod: 3600, // Check for expired keys every hour
  useClones: false // Better performance, data is immutable
});

/**
 * Round coordinates to reduce precision
 * This groups nearby locations (within ~11 meters) into same cache key
 * @param {number} coord - Latitude or longitude
 * @param {number} precision - Decimal places (default: 4 = ~11m)
 */
function roundCoordinate(coord, precision = 4) {
  return parseFloat(coord.toFixed(precision));
}

/**
 * Generate cache key from coordinates
 */
function getCacheKey(latitude, longitude, precision = 4) {
  const lat = roundCoordinate(latitude, precision);
  const lng = roundCoordinate(longitude, precision);
  return `${lat},${lng}`;
}

/**
 * Get cached geocoding result
 */
function getCachedGeocode(latitude, longitude, precision = 4) {
  const key = getCacheKey(latitude, longitude, precision);
  const cached = geocodingCache.get(key);

  if (cached) {
    console.log(`✅ Geocoding cache HIT for ${key}`);
    return {
      ...cached,
      fromCache: true
    };
  }

  console.log(`❌ Geocoding cache MISS for ${key}`);
  return null;
}

/**
 * Store geocoding result in cache
 */
function setCachedGeocode(latitude, longitude, result, ttl = null, precision = 4) {
  const key = getCacheKey(latitude, longitude, precision);
  const success = ttl
    ? geocodingCache.set(key, result, ttl)
    : geocodingCache.set(key, result);

  if (success) {
    console.log(`💾 Cached geocoding result for ${key}`);
  }

  return success;
}

/**
 * Clear all cached entries
 */
function clearCache() {
  geocodingCache.flushAll();
  console.log('🗑️  Geocoding cache cleared');
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  const stats = geocodingCache.getStats();
  return {
    keys: geocodingCache.keys().length,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: stats.hits > 0 ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2) + '%' : '0%',
    ksize: stats.ksize,
    vsize: stats.vsize
  };
}

/**
 * Wrapper for reverse geocoding with caching
 */
async function reverseGeocodeWithCache(geocodeFn, latitude, longitude, options = {}) {
  const { precision = 4, ttl = null } = options;

  // Try to get from cache first
  const cached = getCachedGeocode(latitude, longitude, precision);
  if (cached) {
    return cached;
  }

  // Cache miss - call the actual geocoding function
  try {
    const result = await geocodeFn(latitude, longitude);

    // Store in cache
    setCachedGeocode(latitude, longitude, result, ttl, precision);

    return {
      ...result,
      fromCache: false
    };
  } catch (error) {
    console.error('Geocoding error:', error.message);
    throw error;
  }
}

/**
 * Middleware to warm up cache with common locations
 * Call this during server startup with office/common locations
 */
async function warmUpCache(locations, geocodeFn) {
  console.log(`🔥 Warming up geocoding cache with ${locations.length} locations...`);

  for (const { latitude, longitude, name } of locations) {
    try {
      await reverseGeocodeWithCache(geocodeFn, latitude, longitude);
      console.log(`✅ Cached: ${name || `${latitude}, ${longitude}`}`);
    } catch (error) {
      console.error(`❌ Failed to cache: ${name || `${latitude}, ${longitude}`}`, error.message);
    }
  }

  console.log('🎉 Cache warm-up completed');
}

module.exports = {
  getCachedGeocode,
  setCachedGeocode,
  clearCache,
  getCacheStats,
  reverseGeocodeWithCache,
  warmUpCache,
  roundCoordinate,
  getCacheKey
};
