# Lead Reminder System Documentation

## Overview

The Lead Reminder System automatically creates follow-up reminders when a lead's status is changed and the new status contains date/datetime/time fields. This ensures sales teams never miss important follow-ups with leads.

## How It Works

### 1. Automatic Reminder Creation

When a lead status is changed to a status that has **date/datetime/time fields** in its form:

- The system automatically detects these fields
- Creates reminders for each date/time field
- Sends notifications to the assigned user
- Tracks reminders through the cron job system

### 2. Supported Field Types

The system supports three types of date/time fields in lead status forms:

1. **`date`** - Creates reminder at 9:00 AM on the specified date
2. **`datetime`** - Creates reminder at the exact date and time specified
3. **`time`** - Creates reminder today at the specified time

### 3. File Structure

```
deltadb/
├── models/
│   ├── Lead.js                      # Updated with auto-reminder logic
│   ├── Reminder.js                  # Reminder model
│   └── LeadStatus.js               # Status with dynamic form fields
├── services/
│   ├── leadReminderService.js      # Lead-specific reminder operations
│   ├── reminderService.js          # General reminder service with cron jobs
│   └── notificationService.js      # Notification handling
├── controllers/
│   └── reminderController.js       # API endpoints
└── routes/
    └── reminderRoutes.js           # Route definitions
```

## Implementation Details

### Lead Model (`models/Lead.js`)

The Lead model has a new method `createRemindersFromStatusFields()` that:

1. Identifies all date/datetime/time fields in the status
2. Parses the field values
3. Creates reminders only for future dates
4. Bulk inserts all reminders

```javascript
// Auto-creates reminders when status changes
await lead.changeStatus(newStatusId, formData, userId);
// ↑ This automatically triggers reminder creation
```

### Lead Status Form Fields

Example status with dynamic fields:

```json
{
  "name": "Site Visit Scheduled",
  "formFields": [
    {
      "name": "visitDate",
      "type": "datetime",
      "required": true
    },
    {
      "name": "followUpDate",
      "type": "date",
      "required": false
    }
  ]
}
```

When a lead is moved to this status with data:
```json
{
  "visitDate": "2025-10-15T14:30:00Z",
  "followUpDate": "2025-10-16"
}
```

The system creates:
- Reminder 1: "Site Visit Scheduled Follow-up: visitDate" at 2025-10-15 14:30:00
- Reminder 2: "Site Visit Scheduled Follow-up: followUpDate" at 2025-10-16 09:00:00

## API Endpoints

### Get Lead Reminders
```
GET /api/reminders/lead-reminders?leadId={leadId}
```

**Query Parameters:**
- `leadId` (required): Lead ID
- `status`: Filter by status (pending/sent/dismissed)
- `includeCompleted`: Include dismissed reminders (default: false)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

### Get Upcoming Reminders
```
GET /api/reminders/upcoming?hours={hours}
```

**Query Parameters:**
- `hours`: Hours ahead to look (default: 24)

Returns all upcoming lead reminders for the current user.

### Get Overdue Reminders
```
GET /api/reminders/overdue
```

Returns all overdue lead reminders for the current user.

### Snooze a Reminder
```
PUT /api/reminders/{id}/snooze
```

**Body:**
```json
{
  "minutes": 30
}
```

Postpones a reminder by the specified minutes.

### Dismiss a Reminder
```
PUT /api/reminders/{id}/dismiss
```

Marks a reminder as dismissed.

## Cron Job System

The reminder system runs automated cron jobs:

### 1. Process Due Reminders (Every Minute)
- Checks for reminders where `dateTime <= now` and `status = 'pending'`
- Sends notifications via the notification service
- Updates reminder status to 'sent'
- Supports lead, task, and other reminder types

### 2. Cleanup Completed Reminders (Weekly)
- Removes old dismissed reminders (configurable days)

## Notification Flow

When a reminder is due:

1. **Cron Job** detects due reminder
2. **ReminderService** calls appropriate notification method based on `relatedType`
3. **NotificationService** sends:
   - In-app notification to the user
   - WebSocket real-time notification
   - Notification to superadmins (for visibility)

### Lead Reminder Notification Format

```json
{
  "type": "lead_reminder",
  "title": "Lead Follow-up: Site Visit",
  "message": "Follow-up for lead regarding visitDate scheduled on...",
  "data": {
    "reminderId": "...",
    "leadId": "...",
    "reminderDate": "2025-10-15T14:30:00Z",
    "relatedType": "lead"
  },
  "priority": "high"
}
```

## Usage Examples

### Example 1: Schedule Site Visit

1. Create a lead status "Site Visit Scheduled" with a `datetime` field
2. Change lead status to "Site Visit Scheduled"
3. Fill in the form with visit date/time
4. System automatically creates reminder
5. User receives notification when reminder is due

### Example 2: Multiple Follow-ups

A status can have multiple date fields:

```json
{
  "name": "Negotiation",
  "formFields": [
    { "name": "firstFollowUp", "type": "datetime", "required": true },
    { "name": "secondFollowUp", "type": "date", "required": false },
    { "name": "finalDecisionDate", "type": "date", "required": true }
  ]
}
```

Each filled date field creates a separate reminder.

## Advanced Features

### Lead Reminder Service (`services/leadReminderService.js`)

Provides additional capabilities:

#### Create Multiple Reminders with Offsets
```javascript
await leadReminderService.createMultipleLeadReminders(
  lead,
  scheduledDate,
  [1440, 60], // 1 day and 1 hour before
  'Site Visit',
  userId
);
```

Creates reminders:
- 1 day before the scheduled date
- 1 hour before the scheduled date

#### Get Lead Reminders
```javascript
const { reminders, pagination } = await leadReminderService.getLeadReminders(
  leadId,
  { status: 'pending', page: 1, limit: 20 }
);
```

#### Snooze Reminder
```javascript
await leadReminderService.snoozeReminder(reminderId, 30, userId);
// Snoozes for 30 minutes
```

## Configuration

### Cron Job Settings

In `services/reminderService.js`:

```javascript
// Check for due reminders every minute
const reminderJob = cron.schedule('* * * * *', async () => {
  await this.processDueReminders();
});

// Cleanup weekly
const cleanupJob = cron.schedule('0 0 * * 0', async () => {
  await this.cleanupCompletedReminders();
});
```

### Default Reminder Times

- **Date fields**: Set to 9:00 AM on the specified date
- **Datetime fields**: Use exact time specified
- **Time fields**: Use today's date with specified time

## Permissions

Reminder operations require these permissions:

- `reminders:read` - View reminders
- `reminders:create` - Create reminders
- `reminders:update` - Update/snooze/dismiss reminders
- `reminders:delete` - Delete reminders
- `reminders:bulk-update` - Bulk update
- `reminders:bulk-delete` - Bulk delete

## Testing

To test the system:

1. **Create a Lead Status** with date/datetime fields
2. **Create or Update a Lead** to that status with future dates
3. **Check Reminders** using the API endpoints
4. **Wait for Cron** or manually trigger `processDueReminders()`
5. **Verify Notification** is sent when reminder is due

### Manual Testing Commands

```javascript
// Get upcoming reminders
GET /api/reminders/upcoming?hours=48

// Get reminders for specific lead
GET /api/reminders/lead-reminders?leadId=<leadId>

// Snooze a reminder
PUT /api/reminders/<reminderId>/snooze
{ "minutes": 15 }

// Dismiss a reminder
PUT /api/reminders/<reminderId>/dismiss
```

## Troubleshooting

### Reminders Not Created
- Verify the status has date/datetime/time fields
- Check that field values are in the future
- Check server logs for errors in `createRemindersFromStatusFields`

### Notifications Not Sent
- Verify cron job is running: Check logs for "📅 Processing X due reminders"
- Check notification service is initialized
- Verify WebSocket connection is active

### Duplicate Reminders
- System prevents duplicates per status change
- Each status change creates new reminders for that status's fields

## Future Enhancements

Potential improvements:

1. **Recurring Reminders** - Auto-create reminders at regular intervals
2. **Custom Reminder Offsets** - Configure when to remind (e.g., 1 day before)
3. **Email Notifications** - Send email reminders in addition to in-app
4. **SMS Integration** - Send SMS for critical reminders
5. **Reminder Templates** - Pre-configured reminder messages
6. **Smart Scheduling** - AI-based optimal reminder timing

## Support

For issues or questions:
- Check server logs for error messages
- Verify cron jobs are running: `pm2 logs`
- Review the `Lead.js` and `reminderService.js` files
- Ensure all dependencies are installed and services are running
