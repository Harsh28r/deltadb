const axios = require('axios');
const { reverseGeocodeWithCache } = require('./geocodingCache');

/**
 * Geocoding Utility
 * Supports multiple providers: Google Maps, OpenStreetMap (Nominatim)
 * Falls back to alternative providers if primary fails
 * Includes caching to reduce API costs
 */

/**
 * Reverse Geocode using Google Maps API
 * Requires GOOGLE_MAPS_API_KEY in .env
 */
async function reverseGeocodeGoogle(latitude, longitude) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error('Google Maps API key not configured');
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;
    const response = await axios.get(url);

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const result = response.data.results[0];

      return {
        formattedAddress: result.formatted_address,
        components: parseGoogleAddressComponents(result.address_components),
        placeId: result.place_id,
        provider: 'google'
      };
    }

    throw new Error(`Google Geocoding failed: ${response.data.status}`);
  } catch (error) {
    console.error('Google geocoding error:', error.message);
    throw error;
  }
}

/**
 * Reverse Geocode using OpenStreetMap (Nominatim)
 * Free, no API key required
 */
async function reverseGeocodeOSM(latitude, longitude) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'DeltaYards-CRM-Attendance/1.0'
      }
    });

    if (response.data && response.data.display_name) {
      const addr = response.data.address || {};

      return {
        formattedAddress: response.data.display_name,
        components: {
          street: addr.road || addr.street || '',
          area: addr.suburb || addr.neighbourhood || '',
          city: addr.city || addr.town || addr.village || '',
          district: addr.state_district || '',
          state: addr.state || '',
          country: addr.country || '',
          postalCode: addr.postcode || '',
          countryCode: addr.country_code || ''
        },
        placeId: response.data.place_id,
        provider: 'openstreetmap'
      };
    }

    throw new Error('OpenStreetMap geocoding returned no results');
  } catch (error) {
    console.error('OpenStreetMap geocoding error:', error.message);
    throw error;
  }
}

/**
 * Parse Google Maps address components into structured format
 */
function parseGoogleAddressComponents(components) {
  const result = {
    street: '',
    area: '',
    city: '',
    district: '',
    state: '',
    country: '',
    postalCode: '',
    countryCode: ''
  };

  components.forEach(component => {
    const types = component.types;

    if (types.includes('street_number') || types.includes('route')) {
      result.street += (result.street ? ' ' : '') + component.long_name;
    }
    if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
      result.area = component.long_name;
    }
    if (types.includes('locality')) {
      result.city = component.long_name;
    }
    if (types.includes('administrative_area_level_2')) {
      result.district = component.long_name;
    }
    if (types.includes('administrative_area_level_1')) {
      result.state = component.long_name;
    }
    if (types.includes('country')) {
      result.country = component.long_name;
      result.countryCode = component.short_name;
    }
    if (types.includes('postal_code')) {
      result.postalCode = component.long_name;
    }
  });

  return result;
}

/**
 * Internal geocoding function without cache (used by cache wrapper)
 */
async function _reverseGeocodeInternal(latitude, longitude) {
  // Try Google Maps first if API key is configured
  if (process.env.GOOGLE_MAPS_API_KEY) {
    try {
      return await reverseGeocodeGoogle(latitude, longitude);
    } catch (error) {
      console.warn('Google geocoding failed, falling back to OpenStreetMap:', error.message);
    }
  }

  // Fall back to OpenStreetMap
  try {
    return await reverseGeocodeOSM(latitude, longitude);
  } catch (error) {
    console.error('All geocoding providers failed');

    // Return a basic address if all providers fail
    return {
      formattedAddress: `Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      components: {
        street: '',
        area: '',
        city: '',
        district: '',
        state: '',
        country: '',
        postalCode: '',
        countryCode: ''
      },
      placeId: null,
      provider: 'fallback',
      error: error.message
    };
  }
}

/**
 * Main reverse geocode function with caching and fallback
 * Tries Google first (if API key available), falls back to OSM
 * Results are cached for 24 hours to reduce API costs
 */
async function reverseGeocode(latitude, longitude, options = {}) {
  // Validate coordinates
  if (!latitude || !longitude) {
    throw new Error('Latitude and longitude are required');
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    throw new Error('Invalid coordinates');
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Coordinates out of valid range');
  }

  // Use cached geocoding
  return await reverseGeocodeWithCache(_reverseGeocodeInternal, lat, lng, options);
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
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
 * Check if user is within geofence (for office location validation)
 * @param {number} userLat - User's latitude
 * @param {number} userLng - User's longitude
 * @param {number} officeLat - Office latitude
 * @param {number} officeLng - Office longitude
 * @param {number} radiusMeters - Allowed radius in meters (default: 200m)
 * @returns {object} - { isWithin, distance, message }
 */
function checkGeofence(userLat, userLng, officeLat, officeLng, radiusMeters = 200) {
  const distance = calculateDistance(userLat, userLng, officeLat, officeLng);

  return {
    isWithin: distance <= radiusMeters,
    distance: Math.round(distance),
    distanceText: distance < 1000
      ? `${Math.round(distance)}m`
      : `${(distance / 1000).toFixed(2)}km`,
    allowedRadius: radiusMeters,
    message: distance <= radiusMeters
      ? 'Within allowed location'
      : `Outside allowed radius by ${Math.round(distance - radiusMeters)}m`
  };
}

/**
 * Get timezone from coordinates using Google Maps API
 */
async function getTimezone(latitude, longitude) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    // Return UTC if no API key
    return {
      timeZoneId: 'UTC',
      timeZoneName: 'Coordinated Universal Time',
      offset: 0
    };
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const url = `https://maps.googleapis.com/maps/api/timezone/json?location=${latitude},${longitude}&timestamp=${timestamp}&key=${apiKey}`;

    const response = await axios.get(url);

    if (response.data.status === 'OK') {
      return {
        timeZoneId: response.data.timeZoneId,
        timeZoneName: response.data.timeZoneName,
        offset: response.data.rawOffset + response.data.dstOffset
      };
    }

    throw new Error(`Timezone API failed: ${response.data.status}`);
  } catch (error) {
    console.error('Timezone API error:', error.message);
    return {
      timeZoneId: 'UTC',
      timeZoneName: 'Coordinated Universal Time',
      offset: 0,
      error: error.message
    };
  }
}

module.exports = {
  reverseGeocode,
  reverseGeocodeGoogle,
  reverseGeocodeOSM,
  calculateDistance,
  checkGeofence,
  getTimezone
};
