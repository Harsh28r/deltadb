# Follow-Up API Documentation

## Overview

The Follow-Up API provides endpoints to view all scheduled meetings, follow-ups, and reminders across the CRM system. These are automatically created when lead statuses are changed with date/time fields.

## Base URL
```
/api/follow-ups
```

---

## Endpoints

### 1. Get All Follow-Ups

Get all follow-ups/meetings with advanced filtering options.

**Endpoint:** `GET /api/follow-ups`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | String (ObjectId) | No | Filter by assigned user |
| `projectId` | String (ObjectId) | No | Filter by project |
| `statusId` | String (ObjectId) | No | Filter by lead status |
| `startDate` | Date | No | Filter from this date |
| `endDate` | Date | No | Filter until this date |
| `status` | String | No | Filter by reminder status: `pending`, `sent`, `dismissed` |
| `type` | String | No | Filter type: `upcoming`, `overdue`, `today`, `all` (default: `all`) |
| `page` | Number | No | Page number (default: 1) |
| `limit` | Number | No | Items per page (default: 20, max: 100) |

**Example Request:**
```bash
GET /api/follow-ups?type=upcoming&page=1&limit=20
```

**Response:**
```json
{
  "followUps": [
    {
      "id": "66f1234567890abcdef12345",
      "title": "Site Visit Scheduled Follow-up: visitDate",
      "description": "Follow-up for lead regarding visitDate scheduled on Fri, Sep 27, 2025 at 06:00 PM",
      "dateTime": {
        "iso": "2025-09-27T18:00:00.000Z",
        "formatted": "Fri, Sep 27, 2025 at 06:00 PM",
        "date": "Fri, Sep 27, 2025",
        "time": "06:00 PM",
        "relative": "in 2 days",
        "timestamp": 1727456400000
      },
      "status": "pending",
      "assignedTo": {
        "id": "66f0000000000000000000001",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+1234567890"
      },
      "lead": {
        "id": "66f1111111111111111111111",
        "status": "Site Visit Scheduled",
        "customData": {
          "visitDate": "2025-09-27T18:00:00.000Z",
          "clientName": "ABC Corp"
        },
        "project": "Luxury Apartments",
        "assignedTo": {
          "id": "66f0000000000000000000001",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "channelPartner": "XYZ Partners",
        "leadSource": "Website"
      },
      "createdAt": {
        "iso": "2025-09-25T10:30:00.000Z",
        "formatted": "Wed, Sep 25, 2025 at 10:30 AM",
        "relative": "2 days ago"
      }
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 95,
    "limit": 20
  },
  "summary": {
    "total": 95,
    "type": "upcoming"
  }
}
```

---

### 2. Get Follow-Up Statistics

Get summary statistics of all follow-ups.

**Endpoint:** `GET /api/follow-ups/stats`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | String (ObjectId) | No | Get stats for specific user |

**Example Request:**
```bash
GET /api/follow-ups/stats
```

**Response:**
```json
{
  "stats": {
    "total": 245,
    "pending": 120,
    "overdue": 35,
    "today": 12,
    "upcoming": 85,
    "completed": 125
  }
}
```

**Stats Explanation:**
- `total`: Total number of follow-ups
- `pending`: Follow-ups not yet completed
- `overdue`: Follow-ups past their scheduled time
- `today`: Follow-ups scheduled for today
- `upcoming`: Follow-ups in the next 7 days
- `completed`: Follow-ups that have been sent/completed

---

### 3. Get Today's Follow-Ups

Get all follow-ups scheduled for today.

**Endpoint:** `GET /api/follow-ups/today`

**Example Request:**
```bash
GET /api/follow-ups/today
```

**Response:**
```json
{
  "followUps": [
    {
      "id": "66f1234567890abcdef12345",
      "title": "Client Meeting Follow-up",
      "description": "Follow-up for lead regarding meeting scheduled on Wed, Sep 25, 2025 at 02:00 PM",
      "dateTime": {
        "iso": "2025-09-25T14:00:00.000Z",
        "formatted": "Today at 02:00 PM",
        "relative": "in 3 hours"
      },
      "status": "pending",
      "assignedTo": {
        "id": "66f0000000000000000000001",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+1234567890"
      },
      "lead": {
        "id": "66f1111111111111111111111",
        "status": "Meeting Scheduled",
        "project": "Luxury Apartments",
        "assignedTo": {
          "id": "66f0000000000000000000001",
          "name": "John Doe",
          "email": "john@example.com"
        }
      }
    }
  ],
  "count": 12
}
```

---

### 4. Get Follow-Ups by Project

Get all follow-ups for a specific project.

**Endpoint:** `GET /api/follow-ups/project/:projectId`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | String (ObjectId) | Yes | Project ID |

**Example Request:**
```bash
GET /api/follow-ups/project/66f2222222222222222222222
```

**Response:**
```json
{
  "followUps": [
    {
      "id": "66f1234567890abcdef12345",
      "title": "Site Visit Follow-up",
      "description": "Follow-up for lead regarding visitDate scheduled on Fri, Sep 27, 2025 at 06:00 PM",
      "dateTime": {
        "iso": "2025-09-27T18:00:00.000Z",
        "formatted": "Fri, Sep 27, 2025 at 06:00 PM",
        "relative": "in 2 days"
      },
      "status": "pending",
      "assignedTo": {
        "id": "66f0000000000000000000001",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "lead": {
        "id": "66f1111111111111111111111",
        "status": "Site Visit Scheduled",
        "project": "Luxury Apartments",
        "assignedTo": {
          "id": "66f0000000000000000000001",
          "name": "John Doe",
          "email": "john@example.com"
        }
      }
    }
  ],
  "count": 25,
  "projectId": "66f2222222222222222222222"
}
```

---

## Common Use Cases

### 1. View All Upcoming Meetings
```bash
GET /api/follow-ups?type=upcoming&status=pending
```

### 2. View Overdue Follow-Ups
```bash
GET /api/follow-ups?type=overdue
```

### 3. View Today's Meetings
```bash
GET /api/follow-ups/today
```

### 4. View Follow-Ups for Specific User
```bash
GET /api/follow-ups?userId=66f0000000000000000000001
```

### 5. View Follow-Ups by Date Range
```bash
GET /api/follow-ups?startDate=2025-09-25&endDate=2025-09-30
```

### 6. View Follow-Ups for Specific Project
```bash
GET /api/follow-ups/project/66f2222222222222222222222
```

### 7. Get Dashboard Statistics
```bash
GET /api/follow-ups/stats
```

---

## Filter Combinations

### Example: Upcoming meetings for a specific user in a project
```bash
GET /api/follow-ups?type=upcoming&userId=66f0000000000000000000001&projectId=66f2222222222222222222222
```

### Example: All overdue follow-ups for the team
```bash
GET /api/follow-ups?type=overdue&status=pending
```

### Example: This week's meetings
```bash
GET /api/follow-ups?startDate=2025-09-25&endDate=2025-10-01&type=upcoming
```

---

## Response Field Descriptions

### Follow-Up Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Follow-up/reminder ID |
| `title` | String | Follow-up title (auto-generated) |
| `description` | String | Detailed description with formatted date |
| `dateTime` | Object | Date/time in multiple formats |
| `status` | String | Current status: `pending`, `sent`, `dismissed` |
| `assignedTo` | Object | User assigned to this follow-up |
| `lead` | Object | Related lead information |
| `createdAt` | Object | When the follow-up was created |

### DateTime Format

All dates are returned in this format:
```json
{
  "iso": "2025-09-27T18:00:00.000Z",      // ISO 8601 format
  "formatted": "Fri, Sep 27, 2025 at 06:00 PM",  // Human-readable
  "date": "Fri, Sep 27, 2025",            // Date only
  "time": "06:00 PM",                     // Time only
  "relative": "in 2 days",                // Relative time
  "timestamp": 1727456400000              // Unix timestamp
}
```

---

## Permissions Required

All endpoints require the `reminders:read` permission.

---

## Hierarchy & Access Control

- **Superadmins & Level 1 users**: Can see all follow-ups across the system
- **Other users**: Can only see follow-ups for themselves and their team members (based on reporting hierarchy)

---

## Pagination

All list endpoints support pagination:

- Default page size: 20 items
- Maximum page size: 100 items
- Use `page` and `limit` query parameters

Example:
```bash
GET /api/follow-ups?page=2&limit=50
```

---

## Error Responses

### 400 Bad Request
```json
{
  "message": "\"userId\" must be a valid ObjectId"
}
```

### 403 Forbidden
```json
{
  "message": "You don't have permission to access this resource"
}
```

### 500 Internal Server Error
```json
{
  "message": "An error occurred while fetching follow-ups"
}
```

---

## Integration Examples

### Frontend Dashboard Widget
```javascript
// Get today's follow-ups for dashboard
fetch('/api/follow-ups/today', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => {
  console.log(`You have ${data.count} follow-ups today`);
  data.followUps.forEach(followUp => {
    console.log(`${followUp.title} at ${followUp.dateTime.time}`);
  });
});
```

### Calendar Integration
```javascript
// Get all upcoming follow-ups for calendar view
fetch('/api/follow-ups?type=upcoming&limit=100', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => {
  // Map to calendar events
  const events = data.followUps.map(followUp => ({
    title: followUp.title,
    start: followUp.dateTime.iso,
    description: followUp.description,
    assignedTo: followUp.assignedTo.name
  }));

  // Display in calendar
  calendar.addEvents(events);
});
```

### Statistics Dashboard
```javascript
// Get statistics for dashboard
fetch('/api/follow-ups/stats', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => {
  document.getElementById('total').textContent = data.stats.total;
  document.getElementById('pending').textContent = data.stats.pending;
  document.getElementById('overdue').textContent = data.stats.overdue;
  document.getElementById('today').textContent = data.stats.today;
});
```

---

## Notes

1. **Automatic Creation**: Follow-ups are automatically created when a lead's status is changed to a status containing date/time fields.

2. **Date Formats**: All dates support multiple formats for easy frontend integration.

3. **Real-time Updates**: When a follow-up's time arrives, it's automatically sent via the notification system.

4. **Hierarchy Filtering**: The API automatically filters results based on user permissions and reporting hierarchy.

5. **Lead Information**: Each follow-up includes complete lead details for context.

6. **Timezone**: All dates are stored and returned in UTC. Convert to local timezone in frontend.
