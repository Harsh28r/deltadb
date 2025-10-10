# Categorized Follow-ups API Documentation

## Overview
The new categorized follow-ups API automatically organizes reminders based on their scheduled time:

- **Pending** (Overdue): Reminders whose time has passed but are still marked as 'pending'
- **Today**: Reminders scheduled for today (from now until end of day)
- **Tomorrow**: Reminders scheduled for tomorrow
- **Upcoming**: Reminders scheduled after tomorrow

## How It Works

### Automatic Categorization
The system uses **real-time date comparison** to automatically categorize reminders:

1. When you query the API, it checks the current date/time
2. Any reminder with `dateTime < now` and `status = 'pending'` → **Pending** (Overdue)
3. Any reminder with `dateTime >= now` and `dateTime <= end of today` → **Today**
4. Any reminder scheduled for tomorrow → **Tomorrow**
5. Any reminder scheduled after tomorrow → **Upcoming**

### No Manual Updates Needed
You **don't need a cron job** to move reminders between categories! The categorization happens automatically at query time based on the current date.

## API Endpoint

### GET `/api/followups/categorized`

**Query Parameters:**
- `userId` (optional): Filter by specific user ID (defaults to current user)

**Headers:**
```
Authorization: Bearer <your_jwt_token>
```

**Example Request:**
```bash
curl -X GET "http://localhost:5001/api/followups/categorized" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**
```json
{
  "followUps": {
    "pending": [
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
          "customData": {
            "name": "John Doe",
            "contact": "9876543210"
          },
          "project": "Luxury Apartments",
          "assignedTo": {
            "id": "68d6423be659aaf9b87e7e1e",
            "name": "Sales Agent",
            "email": "agent@example.com"
          },
          "channelPartner": "ABC Realty",
          "leadSource": "Newspaper"
        },
        "createdAt": "2025-10-08T09:00:00Z"
      }
    ],
    "today": [
      {
        "id": "68db1e78a0e3ce5dffbe7ac3",
        "title": "Meeting with Sarah",
        "description": "Site visit scheduled",
        "dateTime": "2025-10-10T15:00:00Z",
        "status": "pending",
        "assignedTo": {
          "id": "68d6423be659aaf9b87e7e1e",
          "name": "Sales Agent",
          "email": "agent@example.com",
          "phone": "1234567890"
        },
        "lead": { /* ... */ },
        "createdAt": "2025-10-10T08:00:00Z"
      }
    ],
    "tomorrow": [
      {
        "id": "68db1e78a0e3ce5dffbe7ac4",
        "title": "Call back Mike",
        "description": "Pricing discussion",
        "dateTime": "2025-10-11T11:00:00Z",
        "status": "pending",
        "assignedTo": { /* ... */ },
        "lead": { /* ... */ },
        "createdAt": "2025-10-10T08:00:00Z"
      }
    ],
    "upcoming": [
      {
        "id": "68db1e78a0e3ce5dffbe7ac5",
        "title": "Property showcase event",
        "description": "Invite potential buyers",
        "dateTime": "2025-10-15T10:00:00Z",
        "status": "pending",
        "assignedTo": { /* ... */ },
        "lead": { /* ... */ },
        "createdAt": "2025-10-10T08:00:00Z"
      }
    ]
  },
  "summary": {
    "pending": 1,
    "today": 1,
    "tomorrow": 1,
    "upcoming": 1,
    "total": 4
  },
  "timestamp": "2025-10-10T12:00:00Z"
}
```

## Benefits

### 1. Real-time Accuracy
- No delay in categorization
- Always reflects current time
- No database updates needed

### 2. Simple Logic
- Categories determined by date comparison at query time
- No background jobs needed
- No status updates required

### 3. Frontend Implementation
Your frontend can now easily display reminders in different tabs:

```javascript
// Example React/Vue component
const FollowUpsDashboard = () => {
  const [followUps, setFollowUps] = useState({
    pending: [],
    today: [],
    tomorrow: [],
    upcoming: []
  });

  useEffect(() => {
    fetch('/api/followups/categorized', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setFollowUps(data.followUps));
  }, []);

  return (
    <Tabs>
      <Tab label={`Pending (${followUps.pending.length})`}>
        {followUps.pending.map(reminder => (
          <ReminderCard key={reminder.id} {...reminder} />
        ))}
      </Tab>
      <Tab label={`Today (${followUps.today.length})`}>
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

## Important Notes

### Status Field
The `status` field in the Reminder model still exists and has these values:
- `'pending'`: Reminder is active and waiting to be completed
- `'sent'`: Notification has been sent (optional, used by notification system)
- `'dismissed'`: User has dismissed/completed the reminder

The **categorization (Pending/Today/Tomorrow/Upcoming) is separate from status**. It's based purely on the datetime comparison.

### Marking Reminders as Complete
When a user completes a reminder, update its status to `'dismissed'`:

```bash
curl -X PATCH "http://localhost:5001/api/reminders/:id" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "dismissed"}'
```

Once dismissed, the reminder won't appear in any category.

## Testing

### Test with Different Times
To test the categorization, create reminders with different times:

```bash
# Overdue (past time)
POST /api/reminders
{
  "title": "Overdue reminder",
  "dateTime": "2025-10-09T10:00:00Z",  // Yesterday
  "relatedType": "lead",
  "relatedId": "...",
  "userId": "..."
}

# Today (later today)
POST /api/reminders
{
  "title": "Today reminder",
  "dateTime": "2025-10-10T18:00:00Z",  // Today at 6 PM
  "relatedType": "lead",
  "relatedId": "...",
  "userId": "..."
}

# Tomorrow
POST /api/reminders
{
  "title": "Tomorrow reminder",
  "dateTime": "2025-10-11T10:00:00Z",  // Tomorrow
  "relatedType": "lead",
  "relatedId": "...",
  "userId": "..."
}

# Upcoming
POST /api/reminders
{
  "title": "Next week reminder",
  "dateTime": "2025-10-17T10:00:00Z",  // Next week
  "relatedType": "lead",
  "relatedId": "...",
  "userId": "..."
}
```

Then call `/api/followups/categorized` and verify they appear in the correct categories!

## Migration from Old System

If you had an old system that manually moved reminders to a "pending" status, you can now:

1. Keep all reminders with `status: 'pending'`
2. Let the API automatically categorize them based on their `dateTime`
3. Update your frontend to use the new `/categorized` endpoint

No database changes needed! 🎉
