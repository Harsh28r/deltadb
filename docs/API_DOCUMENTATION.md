# DeltaYards CRM API Documentation

## Overview

This document provides comprehensive documentation for the DeltaYards CRM API. The API is built with Node.js, Express, and MongoDB, featuring real-time capabilities through WebSocket integration.

## Base URL
```
Production: https://your-domain.com/api
Development: http://localhost:5000/api
```

## Authentication

All API endpoints (except public ones) require JWT authentication. Include the token in the request header:

```
Authorization: Bearer <your-jwt-token>
```

### Authentication Endpoints

#### Admin Login
```http
POST /superadmin/admin-login
```

**Request Body:**
```json
{
  "email": "admin@deltayards.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "user_id",
    "name": "Admin Name",
    "email": "admin@deltayards.com",
    "role": "superadmin",
    "level": 1
  },
  "token": "jwt_token_here"
}
```

#### User Login
```http
POST /users/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "user-password"
}
```

## User Management

### Get All Users
```http
GET /users?page=1&limit=20&role=user&sortBy=createdAt&sortOrder=desc
```

**Query Parameters:**
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20, max: 100)
- `role` (string, optional): Filter by user role
- `level` (integer, optional): Filter by user level
- `isActive` (boolean, optional): Filter by active status
- `sortBy` (string, optional): Sort field (default: createdAt)
- `sortOrder` (string, optional): Sort order - asc/desc (default: desc)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user_id",
      "name": "User Name",
      "email": "user@example.com",
      "role": "user",
      "level": 3,
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 100,
    "itemsPerPage": 20,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Create User
```http
POST /users
```

**Request Body:**
```json
{
  "name": "New User",
  "email": "newuser@example.com",
  "password": "secure-password",
  "mobile": "+1234567890",
  "role": "user",
  "level": 3
}
```

### Update User
```http
PUT /users/:userId
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "email": "updated@example.com",
  "mobile": "+1234567890",
  "isActive": true,
  "customPermissions": {
    "allowed": ["read_leads", "create_leads"],
    "denied": ["delete_leads"]
  }
}
```

### Delete User (Soft Delete)
```http
DELETE /users/:userId
```

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

## Lead Management

### Get All Leads
```http
GET /leads?page=1&limit=20&project=projectId&user=userId&currentStatus=statusId
```

**Query Parameters:**
- `page` (integer, optional): Page number
- `limit` (integer, optional): Items per page
- `project` (string, optional): Filter by project ID
- `user` (string, optional): Filter by user ID
- `currentStatus` (string, optional): Filter by status ID
- `leadSource` (string, optional): Filter by lead source ID
- `channelPartner` (string, optional): Filter by channel partner ID
- `startDate` (string, optional): Filter from date (ISO format)
- `endDate` (string, optional): Filter to date (ISO format)
- `sortBy` (string, optional): Sort field
- `sortOrder` (string, optional): Sort order

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "lead_id",
      "user": {
        "id": "user_id",
        "name": "User Name",
        "email": "user@example.com"
      },
      "project": {
        "id": "project_id",
        "name": "Project Name",
        "location": "Project Location"
      },
      "leadSource": {
        "id": "source_id",
        "name": "Source Name"
      },
      "currentStatus": {
        "id": "status_id",
        "name": "Status Name",
        "color": "#28a745"
      },
      "customData": {},
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "statusHistoryCount": 3,
      "daysSinceCreated": 5
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalItems": 200,
    "itemsPerPage": 20
  }
}
```

### Get Lead by ID
```http
GET /leads/:leadId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "lead_id",
    "user": {
      "id": "user_id",
      "name": "User Name",
      "email": "user@example.com",
      "role": "user"
    },
    "project": {
      "id": "project_id",
      "name": "Project Name",
      "location": "Project Location",
      "developBy": "Developer Name"
    },
    "leadSource": {
      "id": "source_id",
      "name": "Source Name",
      "description": "Source Description"
    },
    "currentStatus": {
      "id": "status_id",
      "name": "Status Name",
      "color": "#28a745",
      "is_final_status": false,
      "formFields": []
    },
    "statusHistory": [
      {
        "status": {
          "id": "old_status_id",
          "name": "Old Status",
          "color": "#ffc107"
        },
        "data": {},
        "changedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "customData": {
      "contactName": "John Doe",
      "phone": "+1234567890"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-02T00:00:00.000Z"
  }
}
```

### Create Lead
```http
POST /leads
```

**Request Body:**
```json
{
  "user": "user_id",
  "project": "project_id",
  "leadSource": "source_id",
  "currentStatus": "status_id",
  "channelPartner": "partner_id",
  "customData": {
    "contactName": "John Doe",
    "phone": "+1234567890",
    "email": "john@example.com"
  }
}
```

### Update Lead
```http
PUT /leads/:leadId
```

**Request Body:**
```json
{
  "customData": {
    "contactName": "Updated Name",
    "phone": "+0987654321"
  },
  "channelPartner": "new_partner_id"
}
```

### Change Lead Status
```http
PUT /leads/:leadId/status
```

**Request Body:**
```json
{
  "newStatusId": "new_status_id",
  "newData": {
    "meetingDate": "2024-01-15T10:00:00.000Z",
    "notes": "Meeting scheduled with client"
  },
  "comment": "Status updated after client call"
}
```

### Delete Lead
```http
DELETE /leads/:leadId
```

## Project Management

### Get All Projects
```http
GET /projects?page=1&limit=20&owner=userId
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "project_id",
      "name": "Project Name",
      "location": "Project Location",
      "developBy": "Developer Name",
      "owner": {
        "id": "owner_id",
        "name": "Owner Name",
        "email": "owner@example.com"
      },
      "members": [
        {
          "id": "member_id",
          "name": "Member Name",
          "email": "member@example.com"
        }
      ],
      "managers": [],
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {}
}
```

### Create Project
```http
POST /projects
```

**Request Body:**
```json
{
  "name": "New Project",
  "location": "Project Location",
  "developBy": "Developer Name",
  "owner": "owner_user_id",
  "members": ["member1_id", "member2_id"],
  "managers": ["manager1_id"],
  "logo": "https://example.com/logo.png"
}
```

### Update Project Members
```http
PUT /projects/:projectId/members
```

**Request Body:**
```json
{
  "action": "add",
  "userIds": ["user1_id", "user2_id"],
  "type": "members"
}
```

## Task Management

### Get Tasks
```http
GET /tasks?assignedTo=userId&project=projectId&status=in_progress&priority=high
```

**Query Parameters:**
- `assignedTo` (string, optional): Filter by assigned user
- `project` (string, optional): Filter by project
- `status` (string, optional): Filter by status (todo, in_progress, review, completed)
- `priority` (string, optional): Filter by priority (low, medium, high, urgent)
- `dueDate` (string, optional): Filter by due date

### Create Task
```http
POST /tasks
```

**Request Body:**
```json
{
  "title": "Task Title",
  "description": "Task description",
  "assignedTo": "user_id",
  "project": "project_id",
  "dueDate": "2024-01-15T23:59:59.000Z",
  "priority": "high",
  "status": "todo",
  "tags": ["urgent", "client-request"],
  "attachments": ["https://example.com/file.pdf"]
}
```

### Update Task
```http
PUT /tasks/:taskId
```

**Request Body:**
```json
{
  "status": "in_progress",
  "priority": "medium",
  "dueDate": "2024-01-20T23:59:59.000Z"
}
```

## Reminder Management

### Get Reminders
```http
GET /reminder?page=1&limit=20&user=userId
```

### Create Reminder
```http
POST /reminder
```

**Request Body:**
```json
{
  "user": "user_id",
  "task": "task_id",
  "title": "Reminder Title",
  "description": "Reminder description",
  "reminderDate": "2024-01-15T09:00:00.000Z",
  "isRecurring": true,
  "recurrencePattern": {
    "type": "weekly",
    "interval": 1,
    "endDate": "2024-12-31T23:59:59.000Z"
  }
}
```

## Notification Management

### Get User Notifications
```http
GET /notifications?page=1&limit=20&unreadOnly=true&type=lead_created
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "notification_id",
      "type": "lead_created",
      "title": "New Lead Assigned",
      "message": "A new lead has been assigned to you",
      "data": {
        "leadId": "lead_id",
        "projectId": "project_id"
      },
      "read": false,
      "priority": "normal",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {}
}
```

### Mark Notification as Read
```http
PUT /notifications/:notificationId/read
```

### Mark All Notifications as Read
```http
PUT /notifications/read-all
```

## Dashboard & Analytics

### Get Dashboard Data
```http
GET /dashboard
```

**Response:**
```json
{
  "success": true,
  "data": {
    "leadStats": {
      "totalLeads": 150,
      "activeLeads": 120,
      "completedLeads": 30,
      "statusBreakdown": [
        {
          "statusId": "status_id",
          "statusName": "New",
          "count": 45,
          "statusColor": "#007bff"
        }
      ]
    },
    "taskStats": {
      "totalTasks": 80,
      "completedTasks": 50,
      "overdueTasks": 5,
      "upcomingTasks": 25
    },
    "projectStats": {
      "totalProjects": 12,
      "activeProjects": 10
    },
    "recentActivities": []
  }
}
```

## WebSocket Events

### Connection
```javascript
const socket = io('your-domain.com', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Events

#### Join Project Room
```javascript
socket.emit('join-project', projectId);
```

#### Subscribe to Lead Updates
```javascript
socket.emit('subscribe-lead', leadId);
```

#### Subscribe to Task Updates
```javascript
socket.emit('subscribe-task', taskId);
```

#### Subscribe to Reminders
```javascript
socket.emit('subscribe-reminders');
```

### Incoming Events

#### Notification Received
```javascript
socket.on('notification', (data) => {
  console.log('New notification:', data);
});
```

#### Lead Updated
```javascript
socket.on('lead-updated', (data) => {
  console.log('Lead updated:', data);
});
```

#### Task Updated
```javascript
socket.on('task-updated', (data) => {
  console.log('Task updated:', data);
});
```

#### Reminder Alert
```javascript
socket.on('reminder', (data) => {
  console.log('Reminder:', data);
});
```

#### System Message
```javascript
socket.on('system-message', (data) => {
  console.log('System message:', data);
});
```

## Error Handling

All API endpoints return errors in the following format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format",
      "value": "invalid-email"
    }
  ]
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

### Common Error Messages

- `Authentication required` - No token provided
- `Invalid token` - Token is invalid or expired
- `Access denied` - User doesn't have permission
- `Resource not found` - Requested resource doesn't exist
- `Validation failed` - Request data validation errors
- `Rate limit exceeded` - Too many requests

## Rate Limiting

The API implements different rate limits based on endpoint type:

- **General API**: 1000 requests per 15 minutes
- **Authentication**: 10 attempts per 15 minutes
- **File Upload**: 20 uploads per 10 minutes
- **Search**: 60 requests per minute
- **Lead Operations**: 100 requests per minute

Rate limit information is included in response headers:
- `X-RateLimit-Limit` - The rate limit ceiling
- `X-RateLimit-Remaining` - Number of requests left
- `X-RateLimit-Reset` - Time when the rate limit resets

## Pagination

All list endpoints support pagination with the following parameters:

- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20, max: 100)

Response includes pagination metadata:
```json
{
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalItems": 200,
    "itemsPerPage": 20,
    "hasNextPage": true,
    "hasPrevPage": false,
    "nextPage": 2,
    "prevPage": null
  }
}
```

## Filtering and Sorting

Most list endpoints support filtering and sorting:

### Filtering
- Use query parameters to filter results
- Date ranges: `startDate` and `endDate` (ISO format)
- Boolean fields: `true`/`false`
- Reference fields: ObjectId

### Sorting
- `sortBy` - Field to sort by
- `sortOrder` - `asc` or `desc`

### Search
- `q` - Search query
- `fields` - Fields to search in

## Performance Optimizations

The API includes several performance optimizations:

1. **Caching**: Frequently accessed data is cached
2. **Database Indexing**: Optimized indexes for fast queries
3. **Pagination**: Efficient pagination with cursor support
4. **Field Selection**: Use projection to limit returned fields
5. **Aggregation**: Complex queries use MongoDB aggregation

## Security Features

1. **JWT Authentication**: Secure token-based authentication
2. **Role-Based Access Control**: Hierarchical permission system
3. **Rate Limiting**: Protection against abuse
4. **Input Validation**: Comprehensive input validation
5. **SQL Injection Protection**: NoSQL injection prevention
6. **CORS Configuration**: Proper cross-origin request handling

## Development Guidelines

### Making Requests

Always include proper headers:
```javascript
{
  'Content-Type': 'application/json',
  'Authorization': 'Bearer your-jwt-token'
}
```

### Error Handling

Implement proper error handling:
```javascript
try {
  const response = await fetch('/api/leads', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const data = await response.json();
  // Handle success
} catch (error) {
  // Handle error
  console.error('API Error:', error.message);
}
```

### WebSocket Integration

```javascript
const socket = io('your-domain.com', {
  auth: { token: jwtToken }
});

socket.on('connect', () => {
  console.log('Connected to server');
  // Join relevant rooms
  socket.emit('join-project', currentProjectId);
});

socket.on('notification', (notification) => {
  // Handle real-time notifications
  displayNotification(notification);
});
```

## Changelog

### Version 1.0.0
- Initial API release
- User management
- Lead management
- Project management
- Task management
- Real-time notifications
- WebSocket integration

---

For more information or support, please contact the development team.