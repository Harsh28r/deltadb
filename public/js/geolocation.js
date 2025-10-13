/**
 * Geolocation Helper for Web CRM
 * Browser-based geolocation utilities for attendance tracking
 *
 * Features:
 * - Get current location with high accuracy
 * - Watch location changes in real-time
 * - Calculate distances
 * - Check geofence compliance
 * - Fallback to IP-based location
 */

class GeolocationHelper {
  constructor() {
    this.watchId = null;
    this.lastPosition = null;
    this.locationCallbacks = [];
  }

  /**
   * Check if geolocation is supported
   */
  isSupported() {
    return 'geolocation' in navigator;
  }

  /**
   * Get current position
   * @param {Object} options - Geolocation options
   * @returns {Promise<Position>}
   */
  async getCurrentPosition(options = {}) {
    if (!this.isSupported()) {
      throw new Error('Geolocation is not supported by this browser');
    }

    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    const finalOptions = { ...defaultOptions, ...options };

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.lastPosition = position;
          console.log('✅ Location obtained:', {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
          resolve(position);
        },
        (error) => {
          console.error('❌ Geolocation error:', error.message);
          reject(this._handleGeolocationError(error));
        },
        finalOptions
      );
    });
  }

  /**
   * Get location data formatted for API
   */
  async getLocationForAPI() {
    try {
      const position = await this.getCurrentPosition();

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        altitudeAccuracy: position.coords.altitudeAccuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: position.timestamp
      };
    } catch (error) {
      // Try IP-based location as fallback
      return await this.getIPBasedLocation();
    }
  }

  /**
   * Watch position changes (for real-time tracking)
   */
  watchPosition(callback, errorCallback = null, options = {}) {
    if (!this.isSupported()) {
      if (errorCallback) {
        errorCallback(new Error('Geolocation is not supported'));
      }
      return null;
    }

    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 1000
    };

    const finalOptions = { ...defaultOptions, ...options };

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.lastPosition = position;
        this.locationCallbacks.forEach(cb => cb(position));
        if (callback) callback(position);
      },
      (error) => {
        const handledError = this._handleGeolocationError(error);
        if (errorCallback) errorCallback(handledError);
      },
      finalOptions
    );

    return this.watchId;
  }

  /**
   * Stop watching position
   */
  clearWatch() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      console.log('🛑 Stopped watching location');
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   * @returns {number} Distance in meters
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Check if current position is within geofence
   */
  async checkGeofence(officeLat, officeLng, radiusMeters = 200) {
    try {
      const position = await this.getCurrentPosition();
      const distance = this.calculateDistance(
        position.coords.latitude,
        position.coords.longitude,
        officeLat,
        officeLng
      );

      return {
        isWithin: distance <= radiusMeters,
        distance: Math.round(distance),
        distanceText: distance < 1000
          ? `${Math.round(distance)}m`
          : `${(distance / 1000).toFixed(2)}km`,
        allowedRadius: radiusMeters,
        message: distance <= radiusMeters
          ? 'Within allowed location'
          : `Outside allowed radius by ${Math.round(distance - radiusMeters)}m`,
        currentLocation: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }
      };
    } catch (error) {
      throw new Error(`Geofence check failed: ${error.message}`);
    }
  }

  /**
   * Get location permission status
   */
  async getPermissionStatus() {
    if (!('permissions' in navigator)) {
      return { state: 'unavailable' };
    }

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      return {
        state: permission.state, // 'granted', 'denied', 'prompt'
        permission
      };
    } catch (error) {
      return { state: 'unavailable', error: error.message };
    }
  }

  /**
   * Request location permission
   */
  async requestPermission() {
    try {
      await this.getCurrentPosition();
      return { granted: true };
    } catch (error) {
      return {
        granted: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Get IP-based location as fallback
   */
  async getIPBasedLocation() {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();

      return {
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: 50000, // ~50km accuracy for IP-based location
        city: data.city,
        region: data.region,
        country: data.country_name,
        source: 'ip-based'
      };
    } catch (error) {
      throw new Error('Failed to get IP-based location');
    }
  }

  /**
   * Format distance for display
   */
  formatDistance(meters) {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  }

  /**
   * Handle geolocation errors
   */
  _handleGeolocationError(error) {
    const errors = {
      1: {
        code: 'PERMISSION_DENIED',
        message: 'Location permission denied. Please enable location access in your browser settings.'
      },
      2: {
        code: 'POSITION_UNAVAILABLE',
        message: 'Location information unavailable. Please check your internet connection.'
      },
      3: {
        code: 'TIMEOUT',
        message: 'Location request timed out. Please try again.'
      }
    };

    const handledError = errors[error.code] || {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred'
    };

    return {
      ...handledError,
      originalError: error
    };
  }

  /**
   * Get location with retry logic
   */
  async getLocationWithRetry(maxRetries = 3, retryDelay = 2000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.getCurrentPosition();
      } catch (error) {
        if (i === maxRetries - 1) throw error;

        console.log(`Retry ${i + 1}/${maxRetries} after ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
}

// Create singleton instance
const geoHelper = new GeolocationHelper();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GeolocationHelper;
  module.exports.geoHelper = geoHelper;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.GeolocationHelper = GeolocationHelper;
  window.geoHelper = geoHelper;
}
