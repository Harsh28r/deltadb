# Updated Follow-up API - Time-Based Categorization

## Overview
The follow-up API has been updated to use a single endpoint with time-based categorization using the `type` query parameter.

## Automatic Time-Based Categorization
Reminders are automatically categorized based on their `dateTime` field:
- **pending**: Reminders where `dateTime < now` (overdue)
- **today**: Reminders scheduled from now until end of today
- **tomorrow**: Reminders scheduled for tomorrow
- **upcoming**: Reminders scheduled after tomorrow

## Single Endpoint: `/api/followups`

### 1. Get All Categories (Default)
Returns all reminders organized by time category.

```bash
GET /api/followups
GET /api/followups?type=all
```

**Response:**
```json
{
  "followUps": {
    "pending": [/* overdue reminders */],
    "today": [/* today's reminders */],
    "tomorrow": [/* tomorrow's reminders */],
    "upcoming": [/* future reminders */]
  },
  "summary": {
    "pending": 2,
    "today": 3,
    "tomorrow": 1,
    "upcoming": 5,
    "total": 11
  },
  "timestamp": "2025-10-10T12:00:00Z"
}
```

### 2. Get Specific Category
Filter to show only one category.

```bash
# Pending (overdue) only
GET /api/followups?type=pending

# Today only
GET /api/followups?type=today

# Tomorrow only
GET /api/followups?type=tomorrow

# Upcoming only
GET /api/followups?type=upcoming
```

**Response (single category):**
```json
{
  "followUps": [
    {
      "id": "68db1e78a0e3ce5dffbe7ac2",
      "title": "Follow up with John Doe",
      "description": "Discuss property requirements",
      "dateTime": "2025-10-09T10:00:00Z",
      "status": "pending",
      "assignedTo": {
        "id": "68d6423be659aaf9b87e7e1e",
        "name": "Sales Agent",
        "email": "agent@example.com",
        "phone": "1234567890"
      },
      "lead": {
        "id": "68db1234a0e3ce5dffbe7ac2",
        "status": "Hot Lead",
        "customData": { "name": "John Doe", "contact": "9876543210" },
        "project": "Luxury Apartments",
        "assignedTo": { "id": "...", "name": "...", "email": "..." },
        "channelPartner": "ABC Realty",
        "leadSource": "Newspaper"
      },
      "createdAt": "2025-10-08T09:00:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalItems": 1,
    "limit": 20
  },
  "summary": {
    "total": 1,
    "type": "pending"
  }
}
```

## Query Parameters

### Required
- None (all parameters are optional)

### Optional
| Parameter | Type | Values | Description |
|-----------|------|--------|-------------|
| `type` | string | `all`, `pending`, `today`, `tomorrow`, `upcoming` | Filter by time category (default: `all`) |
| `userId` | string | ObjectId | Filter by specific user |
| `projectId` | string | ObjectId | Filter by specific project |
| `statusId` | string | ObjectId | Filter by lead status |
| `status` | string | `pending`, `sent`, `dismissed` | Filter by reminder status |
| `startDate` | date | ISO date | Custom start date filter |
| `endDate` | date | ISO date | Custom end date filter |
| `page` | number | 1+ | Page number (default: 1) |
| `limit` | number | 1-100 | Items per page (default: 20) |

## Example Usage

### Get all categories for current user
```bash
curl -X GET "http://localhost:5001/api/followups" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get only pending (overdue) reminders
```bash
curl -X GET "http://localhost:5001/api/followups?type=pending" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get today's reminders for a specific user
```bash
curl -X GET "http://localhost:5001/api/followups?type=today&userId=68d6423be659aaf9b87e7e1e" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get upcoming reminders for a specific project
```bash
curl -X GET "http://localhost:5001/api/followups?type=upcoming&projectId=68db1234a0e3ce5dffbe7ac2" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get tomorrow's reminders with pagination
```bash
curl -X GET "http://localhost:5001/api/followups?type=tomorrow&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Other Endpoints

### Get Statistics
```bash
GET /api/followups/stats
GET /api/followups/stats?userId=USER_ID
```

Returns counts for pending, today, overdue, upcoming, and completed reminders.

### Get by Project
```bash
GET /api/followups/project/:projectId
```

Returns all reminders for a specific project.

## Frontend Implementation Example

```javascript
// React/Vue component
const FollowUpsDashboard = () => {
  const [followUps, setFollowUps] = useState({
    pending: [],
    today: [],
    tomorrow: [],
    upcoming: []
  });
  const [loading, setLoading] = useState(true);

  // Fetch all categories at once
  useEffect(() => {
    fetch('/api/followups?type=all', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setFollowUps(data.followUps);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <Tabs>
      <Tab label={`Pending (${followUps.pending.length})`} badge="danger">
        {followUps.pending.map(reminder => (
          <ReminderCard key={reminder.id} {...reminder} overdue />
        ))}
      </Tab>

      <Tab label={`Today (${followUps.today.length})`} badge="warning">
        {followUps.today.map(reminder => (
          <ReminderCard key={reminder.id} {...reminder} />
        ))}
      </Tab>

      <Tab label={`Tomorrow (${followUps.tomorrow.length})`}>
        {followUps.tomorrow.map(reminder => (
          <ReminderCard key={reminder.id} {...reminder} />
        ))}
      </Tab>

      <Tab label={`Upcoming (${followUps.upcoming.length})`}>
        {followUps.upcoming.map(reminder => (
          <ReminderCard key={reminder.id} {...reminder} />
        ))}
      </Tab>
    </Tabs>
  );
};
```

## How It Works

### No Manual Updates Needed
The categorization happens automatically based on the current time when you query the API. You don't need any cron jobs or background processes to move reminders between categories.

### Real-time Accuracy
Every time you call the API, it:
1. Gets the current date/time
2. Compares each reminder's `dateTime` with now
3. Places the reminder in the appropriate category
4. Returns the categorized results

### Example Flow
```
Reminder created: dateTime = 2025-10-12 14:00

Query on 2025-10-10:
→ Returns in "upcoming" category

Query on 2025-10-11:
→ Returns in "tomorrow" category

Query on 2025-10-12 at 10:00:
→ Returns in "today" category

Query on 2025-10-12 at 15:00:
→ Returns in "pending" category (overdue)
```

## Migration Guide

If you were using the old endpoints:

**OLD:**
```bash
GET /api/followups/today
GET /api/followups/pending
GET /api/followups/tomorrow
GET /api/followups/upcoming
GET /api/followups/categorized
```

**NEW:**
```bash
GET /api/followups?type=today
GET /api/followups?type=pending
GET /api/followups?type=tomorrow
GET /api/followups?type=upcoming
GET /api/followups?type=all  # (or just /api/followups)
```

Simply update your API calls to use the query parameter instead!
