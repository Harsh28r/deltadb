const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { reverseGeocode, checkGeofence } = require('../utils/geocoding');
const path = require('path');

/**
 * Enhanced Check-In with Live Selfie and Auto-Geocoding
 * POST /api/attendance/check-in-live
 * Multipart form data: { latitude, longitude, selfie (file), notes, platform }
 */
exports.checkInLive = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { latitude, longitude, notes, platform } = req.body;

    console.log('📸 Live Check-in request:', {
      userId,
      latitude,
      longitude,
      hasSelfie: !!req.file,
      platform
    });

    // Validate coordinates
    if (latitude === undefined || latitude === null || latitude === '' ||
        longitude === undefined || longitude === null || longitude === '') {
      return res.status(400).json({
        message: 'Location coordinates are required',
        received: { latitude, longitude }
      });
    }

    // Parse and validate coordinates
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        message: 'Invalid coordinates format',
        received: { latitude, longitude }
      });
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        message: 'Coordinates out of valid range'
      });
    }

    // Check if selfie was uploaded
    if (!req.file) {
      return res.status(400).json({
        message: 'Selfie image is required for check-in',
        hint: 'Please upload a selfie using the "selfie" field'
      });
    }

    // Check if user already checked in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingAttendance = await Attendance.findOne({
      user: userId,
      date: { $gte: today, $lt: tomorrow }
    });

    if (existingAttendance && existingAttendance.status === 'checked-in') {
      return res.status(400).json({
        message: 'You are already checked in today',
        attendance: existingAttendance
      });
    }

    // Auto-geocode the location
    console.log('🌍 Geocoding location...');
    let geocodedData;
    try {
      geocodedData = await reverseGeocode(lat, lng);
      console.log('✅ Geocoding successful:', geocodedData.formattedAddress);
    } catch (geocodeError) {
      console.error('⚠️ Geocoding failed:', geocodeError.message);
      geocodedData = {
        formattedAddress: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        components: {},
        provider: 'fallback'
      };
    }

    // Get device info
    const deviceInfo = {
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      platform: platform || 'unknown'
    };

    // Build selfie URL (relative path for storage)
    const selfieUrl = `/uploads/attendance/selfies/${req.file.filename}`;

    // Get GPS accuracy from request if available
    const accuracy = req.body.accuracy ? parseFloat(req.body.accuracy) : null;

    // Optional: Check geofence if office location is configured
    let geofenceCheck = null;
    if (process.env.OFFICE_LATITUDE && process.env.OFFICE_LONGITUDE) {
      const officeLat = parseFloat(process.env.OFFICE_LATITUDE);
      const officeLng = parseFloat(process.env.OFFICE_LONGITUDE);
      const radiusMeters = parseInt(process.env.OFFICE_RADIUS_METERS || '200');

      geofenceCheck = checkGeofence(lat, lng, officeLat, officeLng, radiusMeters);
      console.log('📍 Geofence check:', geofenceCheck);
    }

    // Create attendance record
    const attendance = new Attendance({
      user: userId,
      date: new Date(),
      checkIn: {
        time: new Date(),
        location: {
          type: 'Point',
          coordinates: [lng, lat],
          address: geocodedData.formattedAddress,
          accuracy
        },
        deviceInfo,
        selfie: selfieUrl,
        notes: notes || `Checked in from ${geocodedData.components.city || 'location'}`
      },
      status: 'checked-in'
    });

    // Add geocoding details to metadata
    attendance.checkIn.geocodingData = {
      provider: geocodedData.provider,
      components: geocodedData.components,
      placeId: geocodedData.placeId
    };

    // Add geofence result if checked
    if (geofenceCheck) {
      attendance.checkIn.geofenceCheck = geofenceCheck;
    }

    await attendance.save();
    await attendance.populate('user', 'name email mobile role');

    console.log('✅ Check-in successful:', attendance._id);

    res.status(201).json({
      message: 'Checked in successfully with live verification',
      attendance: {
        id: attendance._id,
        user: {
          id: attendance.user._id,
          name: attendance.user.name,
          email: attendance.user.email,
          role: attendance.user.role
        },
        date: attendance.date,
        checkInTime: attendance.checkIn.time,
        location: {
          latitude: lat,
          longitude: lng,
          address: geocodedData.formattedAddress,
          components: geocodedData.components,
          accuracy
        },
        selfie: selfieUrl,
        selfieFilename: req.file.filename,
        geofenceCheck: geofenceCheck,
        status: attendance.status
      }
    });

  } catch (error) {
    console.error('❌ Live check-in error:', error);
    res.status(500).json({
      message: 'Failed to check in',
      error: error.message
    });
  }
};

/**
 * Enhanced Check-Out with Live Selfie and Auto-Geocoding
 * POST /api/attendance/check-out-live
 * Multipart form data: { latitude, longitude, selfie (file), notes }
 */
exports.checkOutLive = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { latitude, longitude, notes } = req.body;

    console.log('📸 Live Check-out request:', {
      userId,
      latitude,
      longitude,
      hasSelfie: !!req.file
    });

    // Validate coordinates
    if (latitude === undefined || latitude === null || latitude === '' ||
        longitude === undefined || longitude === null || longitude === '') {
      return res.status(400).json({
        message: 'Location coordinates are required',
        received: { latitude, longitude }
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        message: 'Invalid coordinates format'
      });
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        message: 'Coordinates out of valid range'
      });
    }

    // Check if selfie was uploaded
    if (!req.file) {
      return res.status(400).json({
        message: 'Selfie image is required for check-out',
        hint: 'Please upload a selfie using the "selfie" field'
      });
    }

    // Find today's attendance
    const attendance = await Attendance.getTodayAttendance(userId);

    if (!attendance) {
      return res.status(404).json({
        message: 'No check-in record found for today. Please check-in first.'
      });
    }

    if (attendance.status === 'checked-out') {
      return res.status(400).json({
        message: 'You have already checked out today'
      });
    }

    // Auto-geocode the checkout location
    console.log('🌍 Geocoding checkout location...');
    let geocodedData;
    try {
      geocodedData = await reverseGeocode(lat, lng);
      console.log('✅ Geocoding successful:', geocodedData.formattedAddress);
    } catch (geocodeError) {
      console.error('⚠️ Geocoding failed:', geocodeError.message);
      geocodedData = {
        formattedAddress: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        components: {},
        provider: 'fallback'
      };
    }

    // Get device info
    const deviceInfo = {
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      platform: req.body.platform || 'unknown'
    };

    // Build selfie URL
    const selfieUrl = `/uploads/attendance/selfies/${req.file.filename}`;
    const accuracy = req.body.accuracy ? parseFloat(req.body.accuracy) : null;

    // Update checkout info
    attendance.checkOut = {
      time: new Date(),
      location: {
        type: 'Point',
        coordinates: [lng, lat],
        address: geocodedData.formattedAddress,
        accuracy
      },
      deviceInfo,
      selfie: selfieUrl,
      notes: notes || `Checked out from ${geocodedData.components.city || 'location'}`
    };

    // Add geocoding details
    attendance.checkOut.geocodingData = {
      provider: geocodedData.provider,
      components: geocodedData.components,
      placeId: geocodedData.placeId
    };

    await attendance.save();
    await attendance.populate('user', 'name email mobile role');

    console.log('✅ Check-out successful:', attendance._id);

    res.json({
      message: 'Checked out successfully with live verification',
      attendance: {
        id: attendance._id,
        user: {
          id: attendance.user._id,
          name: attendance.user.name,
          email: attendance.user.email,
          role: attendance.user.role
        },
        date: attendance.date,
        checkInTime: attendance.checkIn.time,
        checkInLocation: {
          latitude: attendance.checkIn.location.coordinates[1],
          longitude: attendance.checkIn.location.coordinates[0],
          address: attendance.checkIn.location.address
        },
        checkInSelfie: attendance.checkIn.selfie,
        checkOutTime: attendance.checkOut.time,
        checkOutLocation: {
          latitude: lat,
          longitude: lng,
          address: geocodedData.formattedAddress,
          components: geocodedData.components,
          accuracy
        },
        checkOutSelfie: selfieUrl,
        totalHours: attendance.totalHours,
        activeWorkTime: attendance.getActiveWorkTime(),
        status: attendance.status
      }
    });

  } catch (error) {
    console.error('❌ Live check-out error:', error);
    res.status(500).json({
      message: 'Failed to check out',
      error: error.message
    });
  }
};

/**
 * Get Selfie Image
 * GET /api/attendance/selfie/:filename
 */
exports.getSelfieImage = async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '..', 'uploads', 'attendance', 'selfies', filename);

    // Security: Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ message: 'Invalid filename' });
    }

    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(404).json({ message: 'Image not found' });
      }
    });

  } catch (error) {
    console.error('Get selfie error:', error);
    res.status(500).json({ message: 'Failed to retrieve image' });
  }
};

/**
 * Verify Location - Check if coordinates are within allowed geofence
 * POST /api/attendance/verify-location
 * Body: { latitude, longitude }
 */
exports.verifyLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Coordinates required' });
    }

    if (!process.env.OFFICE_LATITUDE || !process.env.OFFICE_LONGITUDE) {
      return res.json({
        message: 'Geofencing not configured',
        allowed: true,
        note: 'All locations are allowed'
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const officeLat = parseFloat(process.env.OFFICE_LATITUDE);
    const officeLng = parseFloat(process.env.OFFICE_LONGITUDE);
    const radiusMeters = parseInt(process.env.OFFICE_RADIUS_METERS || '200');

    const geofenceCheck = checkGeofence(lat, lng, officeLat, officeLng, radiusMeters);

    // Auto-geocode to show current location
    let locationName = 'Unknown';
    try {
      const geocoded = await reverseGeocode(lat, lng);
      locationName = geocoded.formattedAddress;
    } catch (error) {
      console.error('Geocoding failed:', error.message);
    }

    res.json({
      allowed: geofenceCheck.isWithin,
      location: {
        latitude: lat,
        longitude: lng,
        name: locationName
      },
      office: {
        latitude: officeLat,
        longitude: officeLng,
        radius: radiusMeters
      },
      geofenceCheck
    });

  } catch (error) {
    console.error('Verify location error:', error);
    res.status(500).json({ message: 'Failed to verify location' });
  }
};
