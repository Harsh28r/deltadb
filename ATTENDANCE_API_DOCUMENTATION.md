# Attendance Tracking System - API Documentation

## Overview
Complete attendance tracking system with GPS location tracking, check-in/check-out, break management, and superadmin dashboard for monitoring all users.

---

## Authentication
All endpoints require authentication. Include the JWT token in the request headers:
```
Authorization: Bearer <your-jwt-token>
```

---

## User Endpoints

### 1. Check-In
Mark attendance for the day with GPS location.

**Endpoint:** `POST /api/attendance/check-in`

**Auth Required:** Yes (Any authenticated user)

**Request Body:**
```json
{
  "latitude": 28.7041,                              // Required
  "longitude": 77.1025,                             // Required
  "address": "Connaught Place, New Delhi",          // Optional
  "accuracy": 10.5,                                 // Optional
  "selfie": "base64_encoded_image_or_url",          // Required (MANDATORY)
  "notes": "Starting work for the day",             // Optional
  "platform": "mobile"                              // Optional
}
```

**Important:** `selfie` is **MANDATORY** for check-in. The request will fail with a 400 error if selfie is not provided.

**Response (201):**
```json
{
  "message": "Checked in successfully",
  "attendance": {
    "id": "60d5ec49f1b2c8a1f8e4b234",
    "user": {
      "_id": "60d5ec49f1b2c8a1f8e4b123",
      "name": "John Doe",
      "email": "john@example.com",
      "mobile": "+919876543210",
      "role": "sales"
    },
    "date": "2025-10-10T00:00:00.000Z",
    "checkInTime": "2025-10-10T09:30:00.000Z",
    "location": {
      "latitude": 28.7041,
      "longitude": 77.1025,
      "address": "Connaught Place, New Delhi"
    },
    "status": "checked-in"
  }
}
```

**Error Responses:**
- `400`: Already checked in today / Selfie is required for check-in
- `401`: Unauthorized (no token)
- `500`: Server error

---

### 2. Check-Out
Mark end of work day with GPS location.

**Endpoint:** `POST /api/attendance/check-out`

**Auth Required:** Yes (Any authenticated user)

**Request Body:**
```json
{
  "latitude": 28.7041,                              // Required
  "longitude": 77.1025,                             // Required
  "address": "Office Location",                     // Optional
  "accuracy": 10.5,                                 // Optional
  "selfie": "base64_encoded_image_or_url",          // Required (MANDATORY)
  "notes": "Completed daily tasks"                  // Optional
}
```

**Important:** `selfie` is **MANDATORY** for check-out. The request will fail with a 400 error if selfie is not provided.

**Response (200):**
```json
{
  "message": "Checked out successfully",
  "attendance": {
    "id": "60d5ec49f1b2c8a1f8e4b234",
    "user": {
      "_id": "60d5ec49f1b2c8a1f8e4b123",
      "name": "John Doe",
      "email": "john@example.com",
      "mobile": "+919876543210",
      "role": "sales"
    },
    "date": "2025-10-10T00:00:00.000Z",
    "checkInTime": "2025-10-10T09:30:00.000Z",
    "checkOutTime": "2025-10-10T18:45:00.000Z",
    "totalHours": 9.25,
    "activeWorkTime": 8.5,
    "status": "checked-out"
  }
}
```

---

### 3. Get Attendance Status
Get current attendance status for today.

**Endpoint:** `GET /api/attendance/status`

**Auth Required:** Yes (Any authenticated user)

**Response (200):**
```json
{
  "status": "checked-in",
  "attendance": {
    "id": "60d5ec49f1b2c8a1f8e4b234",
    "user": {
      "_id": "60d5ec49f1b2c8a1f8e4b123",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "date": "2025-10-10T00:00:00.000Z",
    "checkInTime": "2025-10-10T09:30:00.000Z",
    "checkInLocation": {
      "latitude": 28.7041,
      "longitude": 77.1025,
      "address": "Connaught Place, New Delhi"
    },
    "checkOutTime": null,
    "checkOutLocation": null,
    "totalHours": 0,
    "activeWorkTime": 0,
    "isOnBreak": false,
    "breaks": []
  },
  "canCheckIn": false,
  "canCheckOut": true
}
```

---

### 4. Start Break
Start a break during work hours.

**Endpoint:** `POST /api/attendance/break/start`

**Auth Required:** Yes (Any authenticated user)

**Request Body:**
```json
{
  "reason": "Lunch break"
}
```

**Response (200):**
```json
{
  "message": "Break started",
  "break": {
    "startTime": "2025-10-10T13:00:00.000Z",
    "reason": "Lunch break",
    "_id": "60d5ec49f1b2c8a1f8e4b999"
  }
}
```

---

### 5. End Break
End current break.

**Endpoint:** `POST /api/attendance/break/end`

**Auth Required:** Yes (Any authenticated user)

**Response (200):**
```json
{
  "message": "Break ended",
  "break": {
    "_id": "60d5ec49f1b2c8a1f8e4b999",
    "startTime": "2025-10-10T13:00:00.000Z",
    "endTime": "2025-10-10T13:45:00.000Z",
    "reason": "Lunch break",
    "duration": 45
  },
  "totalBreakTime": 45
}
```

---

### 6. Add Work Location
Add a location point during work (e.g., client visit, site visit).

**Endpoint:** `POST /api/attendance/work-location`

**Auth Required:** Yes (Any authenticated user)

**Request Body:**
```json
{
  "latitude": 28.6139,
  "longitude": 77.2090,
  "address": "Client Office, South Delhi",
  "activity": "Client meeting",
  "notes": "Discussed new requirements"
}
```

**Response (200):**
```json
{
  "message": "Work location added",
  "workLocation": {
    "time": "2025-10-10T15:30:00.000Z",
    "location": {
      "type": "Point",
      "coordinates": [77.2090, 28.6139],
      "address": "Client Office, South Delhi"
    },
    "activity": "Client meeting",
    "notes": "Discussed new requirements",
    "_id": "60d5ec49f1b2c8a1f8e4b888"
  }
}
```

---

### 7. Get My Attendance History
Get your own attendance history.

**Endpoint:** `GET /api/attendance/my-history`

**Auth Required:** Yes (Any authenticated user)

**Query Parameters:**
- `startDate` (optional): Start date (YYYY-MM-DD)
- `endDate` (optional): End date (YYYY-MM-DD)
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 30): Records per page

**Example:** `GET /api/attendance/my-history?startDate=2025-10-01&endDate=2025-10-10&page=1&limit=20`

**Response (200):**
```json
{
  "attendance": [
    {
      "id": "60d5ec49f1b2c8a1f8e4b234",
      "date": "2025-10-10T00:00:00.000Z",
      "checkInTime": "2025-10-10T09:30:00.000Z",
      "checkInLocation": {
        "latitude": 28.7041,
        "longitude": 77.1025,
        "address": "Office"
      },
      "checkOutTime": "2025-10-10T18:45:00.000Z",
      "checkOutLocation": {
        "latitude": 28.7041,
        "longitude": 77.1025,
        "address": "Office"
      },
      "totalHours": 9.25,
      "totalBreakTime": 45,
      "status": "checked-out",
      "workLocations": 3,
      "breaks": 2
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 30,
    "totalPages": 2
  }
}
```

---

## Superadmin Endpoints

### 8. Get Live Attendance Dashboard
Real-time view of all users' attendance status.

**Endpoint:** `GET /api/attendance/admin/live`

**Auth Required:** Yes (Superadmin only)

**Response (200):**
```json
{
  "date": "2025-10-10T00:00:00.000Z",
  "summary": {
    "totalUsers": 50,
    "checkedIn": 35,
    "checkedOut": 10,
    "absent": 5,
    "onBreak": 5
  },
  "checkedInUsers": [
    {
      "user": {
        "_id": "60d5ec49f1b2c8a1f8e4b123",
        "name": "John Doe",
        "email": "john@example.com",
        "role": "sales",
        "level": 3
      },
      "checkInTime": "2025-10-10T09:30:00.000Z",
      "checkInLocation": {
        "latitude": 28.7041,
        "longitude": 77.1025,
        "address": "Office"
      },
      "hoursWorked": 3.5,
      "isOnBreak": false,
      "workLocations": 2
    }
  ],
  "checkedOutUsers": [
    {
      "user": {
        "_id": "60d5ec49f1b2c8a1f8e4b456",
        "name": "Jane Smith",
        "email": "jane@example.com"
      },
      "checkInTime": "2025-10-10T08:00:00.000Z",
      "checkOutTime": "2025-10-10T17:00:00.000Z",
      "totalHours": 9.0,
      "checkOutLocation": {
        "latitude": 28.7041,
        "longitude": 77.1025,
        "address": "Office"
      }
    }
  ],
  "absentUsers": [
    {
      "id": "60d5ec49f1b2c8a1f8e4b789",
      "name": "Bob Johnson",
      "email": "bob@example.com",
      "mobile": "+919876543210",
      "role": "sales",
      "level": 4
    }
  ]
}
```

---

### 9. Get All Users Attendance
View attendance records with powerful filters.

**Endpoint:** `GET /api/attendance/

`

**Auth Required:** Yes (Superadmin only)

**Query Parameters:**
- `date` (optional): Specific date (YYYY-MM-DD)
- `startDate` (optional): Start date range
- `endDate` (optional): End date range
- `userId` (optional): Filter by specific user
- `status` (optional): Filter by status (checked-in, checked-out, absent)
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 50): Records per page

**Example:** `GET /api/attendance/admin/all?date=2025-10-10&status=checked-in`

**Response (200):**
```json
{
  "attendance": [
    {
      "id": "60d5ec49f1b2c8a1f8e4b234",
      "user": {
        "_id": "60d5ec49f1b2c8a1f8e4b123",
        "name": "John Doe",
        "email": "john@example.com",
        "role": "sales",
        "level": 3
      },
      "date": "2025-10-10T00:00:00.000Z",
      "checkIn": {
        "time": "2025-10-10T09:30:00.000Z",
        "location": {
          "latitude": 28.7041,
          "longitude": 77.1025,
          "address": "Office",
          "accuracy": 10.5
        },
        "deviceInfo": {
          "userAgent": "Mozilla/5.0...",
          "ip": "192.168.1.1",
          "platform": "mobile"
        },
        "selfie": "base64_or_url",
        "notes": "Starting work"
      },
      "checkOut": null,
      "totalHours": 0,
      "totalBreakTime": 0,
      "status": "checked-in",
      "breaks": [],
      "workLocations": [],
      "isManualEntry": false,
      "manualEntryBy": null,
      "manualEntryReason": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 35,
    "totalPages": 1
  },
  "summary": {
    "total": 35,
    "checkedIn": 25,
    "checkedOut": 10,
    "absent": 0
  }
}
```

---

### 10. Get User Attendance Details
Detailed attendance history for a specific user.

**Endpoint:** `GET /api/attendance/admin/user/:userId`

**Auth Required:** Yes (Superadmin only)

**Query Parameters:**
- `startDate` (optional): Start date
- `endDate` (optional): End date
- `page` (optional, default: 1)
- `limit` (optional, default: 30)

**Example:** `GET /api/attendance/admin/user/60d5ec49f1b2c8a1f8e4b123?startDate=2025-09-01&endDate=2025-10-10`

**Response (200):**
```json
{
  "user": {
    "_id": "60d5ec49f1b2c8a1f8e4b123",
    "name": "John Doe",
    "email": "john@example.com",
    "mobile": "+919876543210",
    "role": "sales",
    "level": 3
  },
  "stats": {
    "totalDays": 20,
    "totalHours": 185.5,
    "totalBreakTime": 900,
    "avgHoursPerDay": 9.28,
    "checkedInDays": 2,
    "checkedOutDays": 18,
    "workLocationCount": 45
  },
  "attendance": [
    {
      "id": "60d5ec49f1b2c8a1f8e4b234",
      "date": "2025-10-10T00:00:00.000Z",
      "checkIn": {
        "time": "2025-10-10T09:30:00.000Z",
        "location": {
          "latitude": 28.7041,
          "longitude": 77.1025,
          "address": "Office"
        },
        "selfie": "url"
      },
      "checkOut": {
        "time": "2025-10-10T18:45:00.000Z",
        "location": {
          "latitude": 28.7041,
          "longitude": 77.1025,
          "address": "Office"
        },
        "selfie": "url"
      },
      "totalHours": 9.25,
      "totalBreakTime": 45,
      "status": "checked-out",
      "breaks": [
        {
          "startTime": "2025-10-10T13:00:00.000Z",
          "endTime": "2025-10-10T13:45:00.000Z",
          "reason": "Lunch break",
          "duration": 45
        }
      ],
      "workLocations": [
        {
          "time": "2025-10-10T15:30:00.000Z",
          "location": {
            "type": "Point",
            "coordinates": [77.2090, 28.6139],
            "address": "Client Office"
          },
          "activity": "Client meeting",
          "notes": "Project discussion"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 30,
    "total": 20,
    "totalPages": 1
  }
}
```

---

### 11. Get Attendance Statistics
Overall attendance statistics with filters.

**Endpoint:** `GET /api/attendance/admin/stats`

**Auth Required:** Yes (Superadmin only)

**Query Parameters:**
- `startDate` (optional): Start date
- `endDate` (optional): End date
- `userId` (optional): Filter by user

**Example:** `GET /api/attendance/admin/stats?startDate=2025-10-01&endDate=2025-10-10`

**Response (200):**
```json
{
  "stats": {
    "totalRecords": 250,
    "totalHours": "2250.50",
    "avgHoursPerDay": "9.00",
    "totalBreakTime": 11250,
    "totalWorkLocations": 450,
    "statusBreakdown": {
      "checkedIn": 35,
      "checkedOut": 210,
      "absent": 5,
      "onLeave": 0
    },
    "manualEntries": 5
  }
}
```

---

### 12. Get User Location History
Track user's location movements throughout the day.

**Endpoint:** `GET /api/attendance/admin/location-history/:userId`

**Auth Required:** Yes (Superadmin only)

**Query Parameters:**
- `date` (optional): Specific date
- `startDate` (optional): Start date range
- `endDate` (optional): End date range

**Example:** `GET /api/attendance/admin/location-history/60d5ec49f1b2c8a1f8e4b123?date=2025-10-10`

**Response (200):**
```json
{
  "user": {
    "_id": "60d5ec49f1b2c8a1f8e4b123",
    "name": "John Doe",
    "email": "john@example.com",
    "mobile": "+919876543210"
  },
  "totalLocations": 5,
  "locationHistory": [
    {
      "type": "check-in",
      "time": "2025-10-10T09:30:00.000Z",
      "date": "2025-10-10T00:00:00.000Z",
      "latitude": 28.7041,
      "longitude": 77.1025,
      "address": "Office",
      "accuracy": 10.5
    },
    {
      "type": "work-location",
      "time": "2025-10-10T11:00:00.000Z",
      "date": "2025-10-10T00:00:00.000Z",
      "latitude": 28.6139,
      "longitude": 77.2090,
      "address": "Client Office, South Delhi",
      "activity": "Client meeting",
      "notes": "Project discussion"
    },
    {
      "type": "work-location",
      "time": "2025-10-10T15:30:00.000Z",
      "date": "2025-10-10T00:00:00.000Z",
      "latitude": 28.5355,
      "longitude": 77.3910,
      "address": "Site Location",
      "activity": "Site visit",
      "notes": "Progress inspection"
    },
    {
      "type": "check-out",
      "time": "2025-10-10T18:45:00.000Z",
      "date": "2025-10-10T00:00:00.000Z",
      "latitude": 28.7041,
      "longitude": 77.1025,
      "address": "Office",
      "accuracy": 8.2
    }
  ]
}
```

---

### 13. Create Manual Attendance Entry
Superadmin can create manual attendance records for users.

**Endpoint:** `POST /api/attendance/admin/manual-entry`

**Auth Required:** Yes (Superadmin only)

**Request Body:**
```json
{
  "userId": "60d5ec49f1b2c8a1f8e4b123",
  "date": "2025-10-09",
  "checkInTime": "2025-10-09T09:00:00.000Z",
  "checkOutTime": "2025-10-09T18:00:00.000Z",
  "notes": "Manual entry for missed attendance",
  "reason": "System issue - user was present but couldn't check in"
}
```

**Response (201):**
```json
{
  "message": "Manual attendance entry created",
  "attendance": {
    "_id": "60d5ec49f1b2c8a1f8e4b777",
    "user": {
      "_id": "60d5ec49f1b2c8a1f8e4b123",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "date": "2025-10-09T00:00:00.000Z",
    "checkIn": {
      "time": "2025-10-09T09:00:00.000Z",
      "location": {
        "type": "Point",
        "coordinates": [0, 0],
        "address": "Manual Entry"
      },
      "notes": "Manual entry for missed attendance"
    },
    "checkOut": {
      "time": "2025-10-09T18:00:00.000Z",
      "location": {
        "type": "Point",
        "coordinates": [0, 0],
        "address": "Manual Entry"
      }
    },
    "status": "checked-out",
    "totalHours": 9.0,
    "isManualEntry": true,
    "manualEntryBy": {
      "_id": "60d5ec49f1b2c8a1f8e4b001",
      "name": "Admin User",
      "email": "admin@deltayards.com"
    },
    "manualEntryReason": "System issue - user was present but couldn't check in"
  }
}
```

---

### 14. Update Attendance Record
Modify existing attendance record.

**Endpoint:** `PUT /api/attendance/admin/:attendanceId`

**Auth Required:** Yes (Superadmin only)

**Request Body:**
```json
{
  "checkInTime": "2025-10-10T09:00:00.000Z",
  "checkOutTime": "2025-10-10T18:30:00.000Z",
  "status": "checked-out",
  "notes": "Updated by admin"
}
```

**Response (200):**
```json
{
  "message": "Attendance updated successfully",
  "attendance": {
    "_id": "60d5ec49f1b2c8a1f8e4b234",
    "user": {
      "_id": "60d5ec49f1b2c8a1f8e4b123",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "date": "2025-10-10T00:00:00.000Z",
    "checkIn": {
      "time": "2025-10-10T09:00:00.000Z"
    },
    "checkOut": {
      "time": "2025-10-10T18:30:00.000Z"
    },
    "totalHours": 9.5,
    "status": "checked-out"
  }
}
```

---

### 15. Delete Attendance Record
Remove an attendance record.

**Endpoint:** `DELETE /api/attendance/admin/:attendanceId`

**Auth Required:** Yes (Superadmin only)

**Response (200):**
```json
{
  "message": "Attendance record deleted successfully"
}
```

---

## Frontend Integration Examples

### Mobile App Check-In with GPS
```javascript
// Get user's current location
navigator.geolocation.getCurrentPosition(
  async (position) => {
    const { latitude, longitude, accuracy } = position.coords;

    // Reverse geocode to get address (optional)
    const address = await reverseGeocode(latitude, longitude);

    // Capture selfie (MANDATORY - Required field)
    const selfie = await capturePhoto();

    // Send check-in request
    const response = await fetch('https://your-api.com/api/attendance/check-in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        latitude,
        longitude,
        address,
        accuracy,
        selfie,
        notes: 'Starting my day',
        platform: 'mobile'
      })
    });

    const data = await response.json();
    console.log('Check-in successful:', data);
  },
  (error) => {
    console.error('Location error:', error);
  },
  {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  }
);
```

### Superadmin Dashboard - Real-time Monitoring
```javascript
// Fetch live attendance dashboard
async function fetchLiveDashboard() {
  const response = await fetch('https://your-api.com/api/attendance/admin/live', {
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });

  const data = await response.json();

  // Display summary
  console.log('Total Users:', data.summary.totalUsers);
  console.log('Checked In:', data.summary.checkedIn);
  console.log('Absent:', data.summary.absent);

  // Map checked-in users
  data.checkedInUsers.forEach(userAttendance => {
    console.log(`${userAttendance.user.name} - ${userAttendance.hoursWorked} hours worked`);
    // Display on map using userAttendance.checkInLocation
  });

  // List absent users
  data.absentUsers.forEach(user => {
    console.log(`Absent: ${user.name} - ${user.email}`);
  });
}

// Refresh every 30 seconds
setInterval(fetchLiveDashboard, 30000);
```

### Track User Location History on Map
```javascript
// Fetch user location history
async function showUserLocationHistory(userId, date) {
  const response = await fetch(
    `https://your-api.com/api/attendance/admin/location-history/${userId}?date=${date}`,
    {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    }
  );

  const data = await response.json();

  // Initialize map
  const map = new google.maps.Map(document.getElementById('map'), {
    zoom: 12,
    center: {
      lat: data.locationHistory[0].latitude,
      lng: data.locationHistory[0].longitude
    }
  });

  // Add markers for each location
  const path = [];
  data.locationHistory.forEach((loc, index) => {
    const position = { lat: loc.latitude, lng: loc.longitude };
    path.push(position);

    new google.maps.Marker({
      position,
      map,
      label: `${index + 1}`,
      title: `${loc.type} at ${new Date(loc.time).toLocaleTimeString()}`
    });
  });

  // Draw path between locations
  new google.maps.Polyline({
    path,
    geodesic: true,
    strokeColor: '#FF0000',
    strokeOpacity: 1.0,
    strokeWeight: 2,
    map
  });
}
```

---

## Database Schema

### Attendance Collection
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  date: Date,
  checkIn: {
    time: Date,
    location: {
      type: "Point",
      coordinates: [longitude, latitude],
      address: String,
      accuracy: Number
    },
    deviceInfo: {
      userAgent: String,
      ip: String,
      platform: String
    },
    selfie: String,
    notes: String
  },
  checkOut: {
    time: Date,
    location: {
      type: "Point",
      coordinates: [longitude, latitude],
      address: String,
      accuracy: Number
    },
    deviceInfo: { ... },
    selfie: String,
    notes: String
  },
  totalHours: Number,
  status: String (checked-in/checked-out/absent/on-leave),
  breaks: [{
    startTime: Date,
    endTime: Date,
    reason: String,
    duration: Number (minutes)
  }],
  totalBreakTime: Number,
  workLocations: [{
    time: Date,
    location: {
      type: "Point",
      coordinates: [longitude, latitude],
      address: String
    },
    activity: String,
    notes: String
  }],
  isManualEntry: Boolean,
  manualEntryBy: ObjectId (ref: User),
  manualEntryReason: String,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Features Summary

### For Users:
- Check-in with GPS location and **mandatory selfie**
- Check-out with GPS location and **mandatory selfie**
- View current attendance status
- Start/end breaks with time tracking
- Add work locations during the day (client visits, site visits)
- View personal attendance history

### For Superadmin:
- Live dashboard showing all users' current status
- View who is checked-in, checked-out, or absent
- Track individual user attendance with detailed statistics
- View user location history and movements
- Create manual attendance entries
- Update or delete attendance records
- Comprehensive statistics and reports
- Filter by date, user, status

### Technical Features:
- GPS location tracking with accuracy
- Geospatial indexing for location queries
- Device info tracking (IP, user agent, platform)
- Automatic work hours calculation
- Break time tracking and deduction
- Support for multiple work locations per day
- Manual entry support for exceptions
- Full audit trail (manual entry tracking)

---

## Testing the APIs

### Using cURL

**Check-In:**
```bash
curl -X POST https://your-api.com/api/attendance/check-in \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 28.7041,
    "longitude": 77.1025,
    "address": "Office Location",
    "accuracy": 10.5
  }'
```

**Get Live Dashboard (Superadmin):**
```bash
curl -X GET https://your-api.com/api/attendance/admin/live \
  -H "Authorization: Bearer SUPERADMIN_TOKEN"
```

---

## Notes

1. All timestamps are in UTC format
2. Coordinates are in GeoJSON format: [longitude, latitude]
3. GPS accuracy is measured in meters
4. Break duration is automatically calculated in minutes
5. Total hours exclude break time for active work time calculation
6. Selfie images can be base64 encoded or URLs
7. Manual entries are clearly marked and tracked
8. Location coordinates [0, 0] indicate manual entry without GPS

---

## Support

For issues or questions, contact the development team.
