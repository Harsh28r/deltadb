const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const superadmin = require('../middleware/superadmin');
const { uploadSelfie, handleUploadError } = require('../config/uploadConfig');

// Original controllers
const {
  // User endpoints
  checkIn,
  checkOut,
  getAttendanceStatus,
  startBreak,
  endBreak,
  addWorkLocation,
  getMyAttendanceHistory,

  // Superadmin endpoints
  getAllUsersAttendance,
  getUserAttendanceDetails,
  getLiveAttendanceDashboard,
  getAttendanceStats,
  getUserLocationHistory,
  createManualAttendance,
  updateAttendance,
  deleteAttendance
} = require('../controllers/attendanceController');

// Enhanced controllers with selfie and geocoding
const {
  checkInLive,
  checkOutLive,
  getSelfieImage,
  verifyLocation
} = require('../controllers/attendanceControllerEnhanced');

// ========================================
// USER ROUTES (Authenticated Users)
// ========================================

/**
 * @route   POST /api/attendance/check-in
 * @desc    User check-in with location (supports both file upload and base64)
 * @access  Private (Authenticated Users)
 * @body    { latitude, longitude, address, accuracy, selfie, notes, platform }
 */
router.post('/check-in', auth, uploadSelfie, handleUploadError, checkIn);

/**
 * @route   POST /api/attendance/check-out
 * @desc    User check-out with location (supports both file upload and base64)
 * @access  Private (Authenticated Users)
 * @body    { latitude, longitude, address, accuracy, selfie, notes }
 */
router.post('/check-out', auth, uploadSelfie, handleUploadError, checkOut);

/**
 * @route   GET /api/attendance/status
 * @desc    Get current user's attendance status for today
 * @access  Private (Authenticated Users)
 */
router.get('/status', auth, getAttendanceStatus);

/**
 * @route   POST /api/attendance/break/start
 * @desc    Start a break
 * @access  Private (Authenticated Users)
 * @body    { reason }
 */
router.post('/break/start', auth, startBreak);

/**
 * @route   POST /api/attendance/break/end
 * @desc    End current break
 * @access  Private (Authenticated Users)
 */
router.post('/break/end', auth, endBreak);

/**
 * @route   POST /api/attendance/work-location
 * @desc    Add work location/activity during the day
 * @access  Private (Authenticated Users)
 * @body    { latitude, longitude, address, activity, notes }
 */
router.post('/work-location', auth, addWorkLocation);

/**
 * @route   GET /api/attendance/my-history
 * @desc    Get my attendance history
 * @access  Private (Authenticated Users)
 * @query   startDate, endDate, page, limit
 */
router.get('/my-history', auth, getMyAttendanceHistory);

// ========================================
// ENHANCED LIVE ROUTES WITH SELFIE & AUTO-GEOCODING
// ========================================

/**
 * @route   POST /api/attendance/check-in-live
 * @desc    Check-in with live selfie capture and automatic geocoding
 * @access  Private (Authenticated Users)
 * @body    Multipart form data: { latitude, longitude, selfie (file), notes, accuracy, platform }
 */
router.post('/check-in-live', auth, uploadSelfie, handleUploadError, checkInLive);

/**
 * @route   POST /api/attendance/check-out-live
 * @desc    Check-out with live selfie capture and automatic geocoding
 * @access  Private (Authenticated Users)
 * @body    Multipart form data: { latitude, longitude, selfie (file), notes, accuracy }
 */
router.post('/check-out-live', auth, uploadSelfie, handleUploadError, checkOutLive);

/**
 * @route   POST /api/attendance/verify-location
 * @desc    Verify if location is within allowed geofence
 * @access  Private (Authenticated Users)
 * @body    { latitude, longitude }
 */
router.post('/verify-location', auth, verifyLocation);

/**
 * @route   GET /api/attendance/selfie/:filename
 * @desc    Get selfie image by filename
 * @access  Private (Authenticated Users)
 */
router.get('/selfie/:filename', auth, getSelfieImage);

// ========================================
// SUPERADMIN ROUTES
// ========================================

/**
 * @route   GET /api/attendance/admin/live
 * @desc    Get live attendance dashboard - who's checked in, checked out, absent
 * @access  Private (Superadmin only)
 * @query   date, startDate, endDate
 */
router.get('/admin/live', superadmin, getLiveAttendanceDashboard);

/**
 * @route   GET /api/attendance/admin/all
 * @desc    Get all users attendance records with filters
 * @access  Private (Superadmin only)
 * @query   date, startDate, endDate, userId, status, page, limit
 */
router.get('/admin/all', superadmin, getAllUsersAttendance);

/**
 * @route   GET /api/attendance/admin/user/:userId
 * @desc    Get detailed attendance for a specific user
 * @access  Private (Superadmin only)
 * @query   startDate, endDate, page, limit
 */
router.get('/admin/user/:userId', superadmin, getUserAttendanceDetails);

/**
 * @route   GET /api/attendance/admin/stats
 * @desc    Get attendance statistics
 * @access  Private (Superadmin only)
 * @query   startDate, endDate, userId
 */
router.get('/admin/stats', superadmin, getAttendanceStats);

/**
 * @route   GET /api/attendance/admin/location-history/:userId
 * @desc    Get user's location tracking history
 * @access  Private (Superadmin only)
 * @query   date, startDate, endDate
 */
router.get('/admin/location-history/:userId', superadmin, getUserLocationHistory);

/**
 * @route   POST /api/attendance/admin/manual-entry
 * @desc    Create manual attendance entry for a user
 * @access  Private (Superadmin only)
 * @body    { userId, date, checkInTime, checkOutTime, notes, reason }
 */
router.post('/admin/manual-entry', superadmin, createManualAttendance);

/**
 * @route   PUT /api/attendance/admin/:attendanceId
 * @desc    Update attendance record
 * @access  Private (Superadmin only)
 * @body    { checkInTime, checkOutTime, status, notes }
 */
router.put('/admin/:attendanceId', superadmin, updateAttendance);

/**
 * @route   DELETE /api/attendance/admin/:attendanceId
 * @desc    Delete attendance record
 * @access  Private (Superadmin only)
 */
router.delete('/admin/:attendanceId', superadmin, deleteAttendance);

module.exports = router;
