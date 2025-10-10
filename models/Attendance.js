const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  checkIn: {
    time: { type: Date, required: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      },
      address: { type: String },
      accuracy: { type: Number } // GPS accuracy in meters
    },
    deviceInfo: {
      userAgent: String,
      ip: String,
      platform: String
    },
    selfie: { type: String }, // URL or base64 image
    notes: { type: String }
  },
  checkOut: {
    time: { type: Date },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
      address: { type: String },
      accuracy: { type: Number }
    },
    deviceInfo: {
      userAgent: String,
      ip: String,
      platform: String
    },
    selfie: { type: String },
    notes: { type: String }
  },
  // Calculated fields
  totalHours: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['checked-in', 'checked-out', 'absent', 'on-leave'],
    default: 'checked-in'
  },
  // Break tracking
  breaks: [{
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    reason: { type: String },
    duration: { type: Number } // in minutes
  }],
  totalBreakTime: { type: Number, default: 0 }, // in minutes

  // Work tracking
  workLocations: [{
    time: { type: Date },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: [Number],
      address: String
    },
    activity: String, // e.g., "Site visit", "Client meeting"
    notes: String
  }],

  // Metadata
  isManualEntry: { type: Boolean, default: false },
  manualEntryBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  manualEntryReason: { type: String },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient queries
attendanceSchema.index({ user: 1, date: -1 });
attendanceSchema.index({ date: -1 });
attendanceSchema.index({ status: 1 });
attendanceSchema.index({ 'checkIn.time': -1 });
attendanceSchema.index({ 'checkIn.location.coordinates': '2dsphere' }); // Geospatial index

// Calculate total hours when checkout is recorded
attendanceSchema.pre('save', function(next) {
  if (this.checkOut && this.checkOut.time && this.checkIn && this.checkIn.time) {
    const checkInTime = new Date(this.checkIn.time);
    const checkOutTime = new Date(this.checkOut.time);
    const diffMs = checkOutTime - checkInTime;
    this.totalHours = (diffMs / (1000 * 60 * 60)).toFixed(2); // Convert to hours
    this.status = 'checked-out';
  }
  this.updatedAt = Date.now();
  next();
});

// Method to calculate active work time (excluding breaks)
attendanceSchema.methods.getActiveWorkTime = function() {
  if (!this.totalHours) return 0;
  const breakHours = this.totalBreakTime / 60;
  return Math.max(0, this.totalHours - breakHours);
};

// Method to check if user is currently on break
attendanceSchema.methods.isOnBreak = function() {
  if (!this.breaks || this.breaks.length === 0) return false;
  const lastBreak = this.breaks[this.breaks.length - 1];
  return lastBreak && !lastBreak.endTime;
};

// Static method to get today's attendance for a user
attendanceSchema.statics.getTodayAttendance = async function(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return await this.findOne({
    user: userId,
    date: { $gte: today, $lt: tomorrow }
  });
};

// Static method to check if user is currently checked in
attendanceSchema.statics.isUserCheckedIn = async function(userId) {
  const todayAttendance = await this.getTodayAttendance(userId);
  return todayAttendance && todayAttendance.status === 'checked-in';
};

// Virtual for formatting
attendanceSchema.virtual('formattedDate').get(function() {
  return this.date.toISOString().split('T')[0];
});

module.exports = mongoose.model('Attendance', attendanceSchema);
