# Enhanced Reminder API with Lead Details

## Overview
The reminder API endpoints have been enhanced to include comprehensive lead details when retrieving reminders related to leads. This provides frontend applications with all necessary lead information without requiring additional API calls.

## Enhanced Endpoints

### GET /api/reminder
**Enhanced with detailed lead information for lead-related reminders**

**Query Parameters:**
- `relatedType=lead` - Filter for lead-related reminders
- `userId` - Filter by user ID
- `status` - Filter by reminder status (pending, sent, dismissed)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

**Response Structure:**
```json
{
  "reminders": [
    {
      "_id": "reminder_id",
      "title": "Follow-up Reminder",
      "description": "Follow-up for lead regarding meeting scheduled on...",
      "dateTime": "2024-01-15T09:00:00.000Z",
      "relatedType": "lead",
      "relatedId": {
        "_id": "lead_id",
        "currentStatus": {
          "_id": "status_id",
          "name": "Initial Contact"
        },
        "user": {
          "_id": "user_id",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "project": {
          "_id": "project_id",
          "name": "Downtown Plaza",
          "location": "Mumbai"
        },
        "channelPartner": {
          "_id": "cp_id",
          "name": "ABC Real Estate",
          "firmName": "ABC Properties Ltd",
          "phone": "+91-9876543210"
        },
        "leadSource": {
          "_id": "source_id",
          "name": "Website"
        },
        "cpSourcingId": {
          "_id": "sourcing_id",
          "channelPartnerId": {
            "_id": "cp_id",
            "name": "XYZ Builder",
            "firmName": "XYZ Construction"
          },
          "projectId": {
            "_id": "project_id",
            "name": "Garden City",
            "location": "Bangalore"
          }
        },
        "followUpDate": "2024-01-20T00:00:00.000Z",
        "reminderDate": "2024-01-15T09:00:00.000Z",
        "isActive": true,
        "customData": {
          "customerName": "Mr. Smith",
          "phone": "+91-9876543210",
          "propertyType": "2BHK",
          "budget": "5000000"
        },
        "createdAt": "2024-01-10T10:00:00.000Z"
      },
      "userId": {
        "_id": "user_id",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "status": "pending",
      "createdAt": "2024-01-10T10:00:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 47,
    "limit": 10
  }
}
```

### GET /api/reminder/:id
**Enhanced with detailed lead information for lead-related reminders**

**Response Structure:**
Same detailed structure as above, but for a single reminder.

## Lead Information Included

When a reminder is related to a lead (`relatedType: 'lead'`), the `relatedId` field now includes:

### Core Lead Data
- `_id` - Lead ID
- `currentStatus` - Current lead status with name
- `customData` - All custom form data associated with the lead
- `followUpDate` - Scheduled follow-up date
- `reminderDate` - Reminder date
- `isActive` - Whether the lead is active
- `createdAt` - Lead creation timestamp

### Related Entities
- `user` - Assigned user (name, email)
- `project` - Associated project (name, location)
- `channelPartner` - Channel partner details (name, firm name, phone)
- `leadSource` - Lead source information (name)

### CP Sourcing Details (if applicable)
- `cpSourcingId` - Channel partner sourcing information
  - `channelPartnerId` - Sourcing channel partner details
  - `projectId` - Sourcing project details

## Benefits

1. **Reduced API Calls**: Frontend applications can get all lead details in a single API call
2. **Better Performance**: Eliminates the need for multiple follow-up requests to get lead information
3. **Comprehensive Data**: Includes all related entities and nested relationships
4. **Consistent Structure**: Same enhanced structure across both list and detail endpoints

## Usage Examples

### Get All Lead Reminders for Current User
```javascript
const response = await fetch('/api/reminder?relatedType=lead', {
  headers: {
    'Authorization': 'Bearer your-token'
  }
});
const data = await response.json();
// Access lead details via data.reminders[0].relatedId
```

### Get Specific Reminder with Lead Details
```javascript
const response = await fetch('/api/reminder/reminder_id', {
  headers: {
    'Authorization': 'Bearer your-token'
  }
});
const reminder = await response.json();
// Access lead details via reminder.relatedId
```

## Testing

Use the provided test script to verify the enhanced functionality:

```bash
node test-reminder-api.js
```

Make sure to:
1. Update the `testAuthToken` variable with a valid authentication token
2. Ensure your server is running on localhost:5000
3. Have some lead-related reminders in your database

## Backward Compatibility

This enhancement is fully backward compatible. Existing API consumers will continue to work, but now receive additional lead detail information when available.
