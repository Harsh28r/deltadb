const Attendance = require('../models/Attendance');
const User = require('../models/User');
const UserReporting = require('../models/UserReporting');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

/**
 * Save base64 image to file system
 */
const saveBase64Image = (base64String, dir) => {
  const matches = base64String.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
  if (!matches) throw new Error('Invalid base64 image');
  const ext = matches[1].toLowerCase();
  if (!['jpeg', 'jpg', 'png', 'webp'].includes(ext)) throw new Error('Unsupported image format');
  const buffer = Buffer.from(matches[2], 'base64');
  const filename = `${Date.now()}-selfie.${ext}`;
  const filepath = path.join(dir, filename);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filepath, buffer);
  return filepath;
};

/**
 * User Check-In
 * POST /api/attendance/check-in
 * Body: { latitude, longitude, address, accuracy, selfie, notes, deviceInfo }
 * Supports both file upload (multipart) and base64 string (JSON)
 */
exports.checkIn = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { latitude, longitude, address, accuracy, selfie, notes } = req.body;

    // Debug logging
    console.log('Check-in request body:', req.body);
    console.log('Has file upload:', !!req.file);
    console.log('Has selfie string:', !!selfie);
    console.log('Latitude:', latitude, 'Type:', typeof latitude);
    console.log('Longitude:', longitude, 'Type:', typeof longitude);

    // Validate selfie is mandatory (either file or string)
    if (!req.file && (!selfie || selfie.trim() === '')) {
      return res.status(400).json({
        message: 'Selfie is required for check-in',
        hint: 'Provide either a file upload or base64 string'
      });
    }

    // Validate coordinates - check for undefined/null but allow 0
    if (latitude === undefined || latitude === null || latitude === '' ||
        longitude === undefined || longitude === null || longitude === '') {
      return res.status(400).json({
        message: 'Location coordinates are required',
        received: { latitude, longitude }
      });
    }

    // Validate that they are valid numbers
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        message: 'Invalid coordinates format. Latitude and longitude must be valid numbers.',
        received: { latitude, longitude }
      });
    }

    // Validate coordinate ranges
    if (lat < -90 || lat > 90) {
      return res.status(400).json({
        message: 'Latitude must be between -90 and 90',
        received: { latitude: lat }
      });
    }

    if (lng < -180 || lng > 180) {
      return res.status(400).json({
        message: 'Longitude must be between -180 and 180',
        received: { longitude: lng }
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

    // Handle selfie - support both file upload and base64 string
    let selfiePath = '';
    const uploadDir = path.join(__dirname, '..', 'uploads', 'attendance', 'selfies');

    if (req.file) {
      // File was uploaded via multipart/form-data
      selfiePath = req.file.path;
      console.log('✅ Using uploaded file:', selfiePath);
    } else if (selfie && selfie.startsWith('data:image/')) {
      // Base64 image provided
      try {
        selfiePath = saveBase64Image(selfie, uploadDir);
        console.log('✅ Saved base64 image:', selfiePath);
      } catch (err) {
        return res.status(400).json({
          message: 'Invalid base64 image format',
          error: err.message
        });
      }
    } else if (selfie) {
      // URL or other string format
      selfiePath = selfie;
      console.log('✅ Using selfie URL/string:', selfiePath);
    }

    // Get device info from request
    const deviceInfo = {
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      platform: req.body.platform || 'unknown'
    };

    // Create new attendance record
    const attendance = new Attendance({
      user: userId,
      date: new Date(),
      checkIn: {
        time: new Date(),
        location: {
          type: 'Point',
          coordinates: [lng, lat], // Use validated values
          address,
          accuracy: accuracy ? parseFloat(accuracy) : null
        },
        deviceInfo,
        selfie: selfiePath,
        notes
      },
      status: 'checked-in'
    });

    await attendance.save();

    // Populate user info
    await attendance.populate('user', 'name email mobile role');

    res.status(201).json({
      message: 'Checked in successfully',
      attendance: {
        id: attendance._id,
        user: attendance.user,
        date: attendance.date,
        checkInTime: attendance.checkIn.time,
        location: {
          latitude: attendance.checkIn.location.coordinates[1],
          longitude: attendance.checkIn.location.coordinates[0],
          address: attendance.checkIn.location.address
        },
        status: attendance.status
      }
    });

  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ message: 'Failed to check in', error: error.message });
  }
};

/**
 * User Check-Out
 * POST /api/attendance/check-out
 * Body: { latitude, longitude, address, accuracy, selfie, notes }
 * Supports both file upload (multipart) and base64 string (JSON)
 */
exports.checkOut = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { latitude, longitude, address, accuracy, selfie, notes } = req.body;

    // Debug logging
    console.log('Check-out request body:', req.body);
    console.log('Has file upload:', !!req.file);
    console.log('Has selfie string:', !!selfie);

    // Validate selfie is mandatory (either file or string)
    if (!req.file && (!selfie || selfie.trim() === '')) {
      return res.status(400).json({
        message: 'Selfie is required for check-out',
        hint: 'Provide either a file upload or base64 string'
      });
    }

    // Validate coordinates - check for undefined/null but allow 0
    if (latitude === undefined || latitude === null || latitude === '' ||
        longitude === undefined || longitude === null || longitude === '') {
      return res.status(400).json({
        message: 'Location coordinates are required',
        received: { latitude, longitude }
      });
    }

    // Validate that they are valid numbers
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        message: 'Invalid coordinates format. Latitude and longitude must be valid numbers.',
        received: { latitude, longitude }
      });
    }

    // Validate coordinate ranges
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        message: 'Invalid coordinate ranges',
        received: { latitude: lat, longitude: lng }
      });
    }

    // Find today's attendance
    const attendance = await Attendance.getTodayAttendance(userId);

    if (!attendance) {
      return res.status(404).json({ message: 'No check-in record found for today' });
    }

    if (attendance.status === 'checked-out') {
      return res.status(400).json({
        message: 'You have already checked out today',
        attendance
      });
    }

    // Handle selfie - support both file upload and base64 string
    let selfiePath = '';
    const uploadDir = path.join(__dirname, '..', 'uploads', 'attendance', 'selfies');

    if (req.file) {
      // File was uploaded via multipart/form-data
      selfiePath = req.file.path;
      console.log('✅ Using uploaded file:', selfiePath);
    } else if (selfie && selfie.startsWith('data:image/')) {
      // Base64 image provided
      try {
        selfiePath = saveBase64Image(selfie, uploadDir);
        console.log('✅ Saved base64 image:', selfiePath);
      } catch (err) {
        return res.status(400).json({
          message: 'Invalid base64 image format',
          error: err.message
        });
      }
    } else if (selfie) {
      // URL or other string format
      selfiePath = selfie;
      console.log('✅ Using selfie URL/string:', selfiePath);
    }

    // Get device info
    const deviceInfo = {
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      platform: req.body.platform || 'unknown'
    };

    // Update checkout info
    attendance.checkOut = {
      time: new Date(),
      location: {
        type: 'Point',
        coordinates: [lng, lat], // Use validated values
        address,
        accuracy: accuracy ? parseFloat(accuracy) : null
      },
      deviceInfo,
      selfie: selfiePath,
      notes
    };

    // The pre-save hook will calculate total hours and update status
    await attendance.save();
    await attendance.populate('user', 'name email mobile role');

    res.json({
      message: 'Checked out successfully',
      attendance: {
        id: attendance._id,
        user: attendance.user,
        date: attendance.date,
        checkInTime: attendance.checkIn.time,
        checkOutTime: attendance.checkOut.time,
        totalHours: attendance.totalHours,
        activeWorkTime: attendance.getActiveWorkTime(),
        status: attendance.status
      }
    });

  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ message: 'Failed to check out', error: error.message });
  }
};

/**
 * Get Current User's Attendance Status
 * GET /api/attendance/status
 */
exports.getAttendanceStatus = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const attendance = await Attendance.getTodayAttendance(userId);

    if (!attendance) {
      return res.json({
        status: 'not-checked-in',
        message: 'No attendance record for today',
        canCheckIn: true,
        canCheckOut: false
      });
    }

    await attendance.populate('user', 'name email mobile role');

    res.json({
      status: attendance.status,
      attendance: {
        id: attendance._id,
        user: attendance.user,
        date: attendance.date,
        checkInTime: attendance.checkIn.time,
        checkInLocation: {
          latitude: attendance.checkIn.location.coordinates[1],
          longitude: attendance.checkIn.location.coordinates[0],
          address: attendance.checkIn.location.address
        },
        checkOutTime: attendance.checkOut?.time,
        checkOutLocation: attendance.checkOut?.location ? {
          latitude: attendance.checkOut.location.coordinates[1],
          longitude: attendance.checkOut.location.coordinates[0],
          address: attendance.checkOut.location.address
        } : null,
        totalHours: attendance.totalHours,
        activeWorkTime: attendance.getActiveWorkTime(),
        isOnBreak: attendance.isOnBreak(),
        breaks: attendance.breaks
      },
      canCheckIn: attendance.status !== 'checked-in',
      canCheckOut: attendance.status === 'checked-in'
    });

  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ message: 'Failed to get attendance status', error: error.message });
  }
};

/**
 * Start Break
 * POST /api/attendance/break/start
 * Body: { reason }
 */
exports.startBreak = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { reason } = req.body;

    const attendance = await Attendance.getTodayAttendance(userId);

    if (!attendance) {
      return res.status(404).json({ message: 'No check-in record found for today' });
    }

    if (attendance.status !== 'checked-in') {
      return res.status(400).json({ message: 'You must be checked in to start a break' });
    }

    if (attendance.isOnBreak()) {
      return res.status(400).json({ message: 'You are already on a break' });
    }

    attendance.breaks.push({
      startTime: new Date(),
      reason: reason || 'Break'
    });

    await attendance.save();

    res.json({
      message: 'Break started',
      break: attendance.breaks[attendance.breaks.length - 1]
    });

  } catch (error) {
    console.error('Start break error:', error);
    res.status(500).json({ message: 'Failed to start break', error: error.message });
  }
};

/**
 * End Break
 * POST /api/attendance/break/end
 */
exports.endBreak = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const attendance = await Attendance.getTodayAttendance(userId);

    if (!attendance) {
      return res.status(404).json({ message: 'No check-in record found for today' });
    }

    if (!attendance.isOnBreak()) {
      return res.status(400).json({ message: 'You are not currently on a break' });
    }

    const lastBreak = attendance.breaks[attendance.breaks.length - 1];
    lastBreak.endTime = new Date();

    // Calculate duration in minutes
    const durationMs = lastBreak.endTime - lastBreak.startTime;
    lastBreak.duration = Math.round(durationMs / (1000 * 60));

    // Update total break time
    attendance.totalBreakTime += lastBreak.duration;

    await attendance.save();

    res.json({
      message: 'Break ended',
      break: lastBreak,
      totalBreakTime: attendance.totalBreakTime
    });

  } catch (error) {
    console.error('End break error:', error);
    res.status(500).json({ message: 'Failed to end break', error: error.message });
  }
};

/**
 * Add Work Location/Activity
 * POST /api/attendance/work-location
 * Body: { latitude, longitude, address, activity, notes }
 */
exports.addWorkLocation = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { latitude, longitude, address, activity, notes } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Location coordinates are required' });
    }

    const attendance = await Attendance.getTodayAttendance(userId);

    if (!attendance) {
      return res.status(404).json({ message: 'No check-in record found for today' });
    }

    if (attendance.status !== 'checked-in') {
      return res.status(400).json({ message: 'You must be checked in to add work locations' });
    }

    attendance.workLocations.push({
      time: new Date(),
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
        address
      },
      activity,
      notes
    });

    await attendance.save();

    res.json({
      message: 'Work location added',
      workLocation: attendance.workLocations[attendance.workLocations.length - 1]
    });

  } catch (error) {
    console.error('Add work location error:', error);
    res.status(500).json({ message: 'Failed to add work location', error: error.message });
  }
};

/**
 * Get My Attendance History
 * GET /api/attendance/my-history
 * Query: startDate, endDate, page, limit
 */
exports.getMyAttendanceHistory = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { startDate, endDate, page = 1, limit = 30 } = req.query;

    const filter = { user: userId };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const total = await Attendance.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    const attendance = await Attendance.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('user', 'name email mobile role')
      .lean();

    // Format response
    const formattedAttendance = attendance.map(att => ({
      id: att._id,
      date: att.date,
      checkInTime: att.checkIn?.time,
      checkInLocation: att.checkIn?.location ? {
        latitude: att.checkIn.location.coordinates[1],
        longitude: att.checkIn.location.coordinates[0],
        address: att.checkIn.location.address
      } : null,
      checkOutTime: att.checkOut?.time,
      checkOutLocation: att.checkOut?.location ? {
        latitude: att.checkOut.location.coordinates[1],
        longitude: att.checkOut.location.coordinates[0],
        address: att.checkOut.location.address
      } : null,
      totalHours: att.totalHours,
      totalBreakTime: att.totalBreakTime,
      status: att.status,
      workLocations: att.workLocations?.length || 0,
      breaks: att.breaks?.length || 0
    }));

    res.json({
      attendance: formattedAttendance,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages
      }
    });

  } catch (error) {
    console.error('Get my attendance history error:', error);
    res.status(500).json({ message: 'Failed to get attendance history', error: error.message });
  }
};

/**
 * SUPERADMIN - Get All Users Attendance
 * GET /api/attendance/admin/all
 * Query: date, startDate, endDate, userId, status, page, limit
 */
exports.getAllUsersAttendance = async (req, res) => {
  try {
    const { date, startDate, endDate, userId, status, page = 1, limit = 50 } = req.query;

    const filter = {};

    // Date filtering
    if (date) {
      const searchDate = new Date(date);
      searchDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.date = { $gte: searchDate, $lt: nextDay };
    } else if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    if (userId) filter.user = userId;
    if (status) filter.status = status;

    const total = await Attendance.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    const attendance = await Attendance.find(filter)
      .sort({ date: -1, 'checkIn.time': -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('user', 'name email mobile role level')
      .populate('manualEntryBy', 'name email')
      .lean();

    // Format response with full details
    const formattedAttendance = attendance.map(att => ({
      id: att._id,
      user: att.user,
      date: att.date,
      checkIn: {
        time: att.checkIn?.time,
        location: att.checkIn?.location ? {
          latitude: att.checkIn.location.coordinates[1],
          longitude: att.checkIn.location.coordinates[0],
          address: att.checkIn.location.address,
          accuracy: att.checkIn.location.accuracy
        } : null,
        deviceInfo: att.checkIn?.deviceInfo,
        selfie: att.checkIn?.selfie,
        notes: att.checkIn?.notes
      },
      checkOut: att.checkOut?.time ? {
        time: att.checkOut.time,
        location: att.checkOut.location ? {
          latitude: att.checkOut.location.coordinates[1],
          longitude: att.checkOut.location.coordinates[0],
          address: att.checkOut.location.address,
          accuracy: att.checkOut.location.accuracy
        } : null,
        deviceInfo: att.checkOut.deviceInfo,
        selfie: att.checkOut.selfie,
        notes: att.checkOut.notes
      } : null,
      totalHours: att.totalHours,
      totalBreakTime: att.totalBreakTime,
      status: att.status,
      breaks: att.breaks,
      workLocations: att.workLocations,
      isManualEntry: att.isManualEntry,
      manualEntryBy: att.manualEntryBy,
      manualEntryReason: att.manualEntryReason
    }));

    res.json({
      attendance: formattedAttendance,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages
      },
      summary: {
        total,
        checkedIn: await Attendance.countDocuments({ ...filter, status: 'checked-in' }),
        checkedOut: await Attendance.countDocuments({ ...filter, status: 'checked-out' }),
        absent: await Attendance.countDocuments({ ...filter, status: 'absent' })
      }
    });

  } catch (error) {
    console.error('Get all users attendance error:', error);
    res.status(500).json({ message: 'Failed to get attendance data', error: error.message });
  }
};

/**
 * SUPERADMIN - Get User's Detailed Attendance
 * GET /api/attendance/admin/user/:userId
 * Query: startDate, endDate, page, limit
 */
exports.getUserAttendanceDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, page = 1, limit = 30 } = req.query;

    // Verify user exists
    const user = await User.findById(userId).select('name email mobile role level');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const filter = { user: userId };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const total = await Attendance.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    const attendance = await Attendance.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    // Calculate statistics
    const stats = {
      totalDays: total,
      totalHours: attendance.reduce((sum, att) => sum + (att.totalHours || 0), 0),
      totalBreakTime: attendance.reduce((sum, att) => sum + (att.totalBreakTime || 0), 0),
      avgHoursPerDay: total > 0 ? (attendance.reduce((sum, att) => sum + (att.totalHours || 0), 0) / total).toFixed(2) : 0,
      checkedInDays: attendance.filter(att => att.status === 'checked-in').length,
      checkedOutDays: attendance.filter(att => att.status === 'checked-out').length,
      workLocationCount: attendance.reduce((sum, att) => sum + (att.workLocations?.length || 0), 0)
    };

    res.json({
      user,
      stats,
      attendance: attendance.map(att => ({
        id: att._id,
        date: att.date,
        checkIn: {
          time: att.checkIn?.time,
          location: att.checkIn?.location ? {
            latitude: att.checkIn.location.coordinates[1],
            longitude: att.checkIn.location.coordinates[0],
            address: att.checkIn.location.address
          } : null,
          selfie: att.checkIn?.selfie
        },
        checkOut: att.checkOut?.time ? {
          time: att.checkOut.time,
          location: att.checkOut.location ? {
            latitude: att.checkOut.location.coordinates[1],
            longitude: att.checkOut.location.coordinates[0],
            address: att.checkOut.location.address
          } : null,
          selfie: att.checkOut.selfie
        } : null,
        totalHours: att.totalHours,
        totalBreakTime: att.totalBreakTime,
        status: att.status,
        breaks: att.breaks,
        workLocations: att.workLocations
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages
      }
    });

  } catch (error) {
    console.error('Get user attendance details error:', error);
    res.status(500).json({ message: 'Failed to get user attendance', error: error.message });
  }
};

/**
 * SUPERADMIN - Get Live Attendance Dashboard
 * GET /api/attendance/admin/live
 * Query: date, startDate, endDate
 */
exports.getLiveAttendanceDashboard = async (req, res) => {
  try {
    const { date, startDate, endDate } = req.query;

    let dateFilter = {};

    if (date) {
      // Filter by specific date
      const searchDate = new Date(date);
      searchDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);
      dateFilter = { $gte: searchDate, $lt: nextDay };
    } else if (startDate || endDate) {
      // Filter by date range
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateFilter.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
    } else {
      // Default to today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateFilter = { $gte: today, $lt: tomorrow };
    }

    // Get attendance records for the filtered date(s)
    const todayAttendance = await Attendance.find({
      date: dateFilter
    })
      .populate('user', 'name email mobile role level')
      .sort({ 'checkIn.time': -1 })
      .lean();

    // Get all active users (not just those who checked in)
    const allUsers = await User.find({
      isActive: true,
      role: { $ne: 'superadmin' }
    }).select('name email mobile role level').lean();

    const checkedInUsers = todayAttendance.filter(att => att.status === 'checked-in');
    const checkedOutUsers = todayAttendance.filter(att => att.status === 'checked-out');

    // Find users who haven't checked in
    const checkedInUserIds = todayAttendance.map(att => att.user._id.toString());
    const absentUsers = allUsers.filter(user =>
      !checkedInUserIds.includes(user._id.toString())
    );

    // Users currently on break
    const usersOnBreak = todayAttendance.filter(att => {
      if (!att.breaks || att.breaks.length === 0) return false;
      const lastBreak = att.breaks[att.breaks.length - 1];
      return lastBreak && !lastBreak.endTime;
    });

    res.json({
      date: date || startDate || new Date().toISOString().split('T')[0],
      dateRange: startDate && endDate ? { startDate, endDate } : null,
      summary: {
        totalUsers: allUsers.length,
        checkedIn: checkedInUsers.length,
        checkedOut: checkedOutUsers.length,
        absent: absentUsers.length,
        onBreak: usersOnBreak.length
      },
      checkedInUsers: checkedInUsers.map(att => ({
        user: att.user,
        checkInTime: att.checkIn.time,
        checkInLocation: {
          latitude: att.checkIn.location.coordinates[1],
          longitude: att.checkIn.location.coordinates[0],
          address: att.checkIn.location.address
        },
        checkInSelfie: att.checkIn?.selfie,
        hoursWorked: att.totalHours || ((new Date() - new Date(att.checkIn.time)) / (1000 * 60 * 60)).toFixed(2),
        isOnBreak: att.breaks && att.breaks.length > 0 && !att.breaks[att.breaks.length - 1].endTime,
        workLocations: att.workLocations?.length || 0
      })),
      checkedOutUsers: checkedOutUsers.map(att => ({
        user: att.user,
        checkInTime: att.checkIn.time,
        checkInSelfie: att.checkIn?.selfie,
        checkOutTime: att.checkOut.time,
        checkOutSelfie: att.checkOut?.selfie,
        totalHours: att.totalHours,
        checkOutLocation: {
          latitude: att.checkOut.location.coordinates[1],
          longitude: att.checkOut.location.coordinates[0],
          address: att.checkOut.location.address
        }
      })),
      absentUsers: absentUsers.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        level: user.level
      }))
    });

  } catch (error) {
    console.error('Get live dashboard error:', error);
    res.status(500).json({ message: 'Failed to get live dashboard', error: error.message });
  }
};

/**
 * SUPERADMIN - Get Attendance Statistics
 * GET /api/attendance/admin/stats
 * Query: startDate, endDate, userId
 */
exports.getAttendanceStats = async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;

    const filter = {};

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    if (userId) filter.user = userId;

    const attendance = await Attendance.find(filter);

    const stats = {
      totalRecords: attendance.length,
      totalHours: attendance.reduce((sum, att) => sum + (att.totalHours || 0), 0).toFixed(2),
      avgHoursPerDay: attendance.length > 0 ?
        (attendance.reduce((sum, att) => sum + (att.totalHours || 0), 0) / attendance.length).toFixed(2) : 0,
      totalBreakTime: attendance.reduce((sum, att) => sum + (att.totalBreakTime || 0), 0),
      totalWorkLocations: attendance.reduce((sum, att) => sum + (att.workLocations?.length || 0), 0),
      statusBreakdown: {
        checkedIn: attendance.filter(att => att.status === 'checked-in').length,
        checkedOut: attendance.filter(att => att.status === 'checked-out').length,
        absent: attendance.filter(att => att.status === 'absent').length,
        onLeave: attendance.filter(att => att.status === 'on-leave').length
      },
      manualEntries: attendance.filter(att => att.isManualEntry).length
    };

    res.json({ stats });

  } catch (error) {
    console.error('Get attendance stats error:', error);
    res.status(500).json({ message: 'Failed to get attendance statistics', error: error.message });
  }
};

/**
 * SUPERADMIN - Track User Location History
 * GET /api/attendance/admin/location-history/:userId
 * Query: date, startDate, endDate
 */
exports.getUserLocationHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { date, startDate, endDate } = req.query;

    const filter = { user: userId };

    if (date) {
      const searchDate = new Date(date);
      searchDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.date = { $gte: searchDate, $lt: nextDay };
    } else if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const attendance = await Attendance.find(filter)
      .sort({ date: -1 })
      .populate('user', 'name email mobile')
      .lean();

    // Extract all location points with timestamps
    const locationHistory = [];

    attendance.forEach(att => {
      // Check-in location
      if (att.checkIn?.location) {
        locationHistory.push({
          type: 'check-in',
          time: att.checkIn.time,
          date: att.date,
          latitude: att.checkIn.location.coordinates[1],
          longitude: att.checkIn.location.coordinates[0],
          address: att.checkIn.location.address,
          accuracy: att.checkIn.location.accuracy
        });
      }

      // Work locations
      if (att.workLocations) {
        att.workLocations.forEach(wl => {
          locationHistory.push({
            type: 'work-location',
            time: wl.time,
            date: att.date,
            latitude: wl.location.coordinates[1],
            longitude: wl.location.coordinates[0],
            address: wl.location.address,
            activity: wl.activity,
            notes: wl.notes
          });
        });
      }

      // Check-out location
      if (att.checkOut?.location) {
        locationHistory.push({
          type: 'check-out',
          time: att.checkOut.time,
          date: att.date,
          latitude: att.checkOut.location.coordinates[1],
          longitude: att.checkOut.location.coordinates[0],
          address: att.checkOut.location.address,
          accuracy: att.checkOut.location.accuracy
        });
      }
    });

    // Sort by time
    locationHistory.sort((a, b) => new Date(b.time) - new Date(a.time));

    res.json({
      user: attendance[0]?.user,
      totalLocations: locationHistory.length,
      locationHistory
    });

  } catch (error) {
    console.error('Get user location history error:', error);
    res.status(500).json({ message: 'Failed to get location history', error: error.message });
  }
};

/**
 * SUPERADMIN - Manual Attendance Entry
 * POST /api/attendance/admin/manual-entry
 * Body: { userId, date, checkInTime, checkOutTime, notes, reason }
 */
exports.createManualAttendance = async (req, res) => {
  try {
    const { userId, date, checkInTime, checkOutTime, notes, reason } = req.body;
    const adminId = req.user._id || req.user.id;

    if (!userId || !date || !checkInTime) {
      return res.status(400).json({ message: 'userId, date, and checkInTime are required' });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if attendance already exists for this date
    const existingDate = new Date(date);
    existingDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(existingDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const existing = await Attendance.findOne({
      user: userId,
      date: { $gte: existingDate, $lt: nextDay }
    });

    if (existing) {
      return res.status(400).json({
        message: 'Attendance record already exists for this date',
        existingRecord: existing
      });
    }

    // Create manual attendance entry
    const attendance = new Attendance({
      user: userId,
      date: new Date(date),
      checkIn: {
        time: new Date(checkInTime),
        location: {
          type: 'Point',
          coordinates: [0, 0], // Default coordinates for manual entry
          address: 'Manual Entry'
        },
        notes
      },
      status: checkOutTime ? 'checked-out' : 'checked-in',
      isManualEntry: true,
      manualEntryBy: adminId,
      manualEntryReason: reason
    });

    if (checkOutTime) {
      attendance.checkOut = {
        time: new Date(checkOutTime),
        location: {
          type: 'Point',
          coordinates: [0, 0],
          address: 'Manual Entry'
        },
        notes
      };
    }

    await attendance.save();
    await attendance.populate('user', 'name email mobile role');
    await attendance.populate('manualEntryBy', 'name email');

    res.status(201).json({
      message: 'Manual attendance entry created',
      attendance
    });

  } catch (error) {
    console.error('Create manual attendance error:', error);
    res.status(500).json({ message: 'Failed to create manual attendance', error: error.message });
  }
};

/**
 * SUPERADMIN - Update Attendance
 * PUT /api/attendance/admin/:attendanceId
 */
exports.updateAttendance = async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const updates = req.body;

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    // Update allowed fields
    if (updates.checkInTime) attendance.checkIn.time = new Date(updates.checkInTime);
    if (updates.checkOutTime) attendance.checkOut.time = new Date(updates.checkOutTime);
    if (updates.status) attendance.status = updates.status;
    if (updates.notes) attendance.checkIn.notes = updates.notes;

    await attendance.save();
    await attendance.populate('user', 'name email mobile role');

    res.json({
      message: 'Attendance updated successfully',
      attendance
    });

  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({ message: 'Failed to update attendance', error: error.message });
  }
};

/**
 * SUPERADMIN - Delete Attendance
 * DELETE /api/attendance/admin/:attendanceId
 */
exports.deleteAttendance = async (req, res) => {
  try {
    const { attendanceId } = req.params;

    const attendance = await Attendance.findByIdAndDelete(attendanceId);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    res.json({ message: 'Attendance record deleted successfully' });

  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({ message: 'Failed to delete attendance', error: error.message });
  }
};
