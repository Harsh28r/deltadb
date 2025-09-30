# Hierarchical Notification System Guide

## Overview

The enhanced notification system now implements a comprehensive hierarchical notification structure that ensures:

1. **Superadmins and upper-level users** receive notifications about all activities of users below them in the hierarchy
2. **Individual users** receive notifications when leads are assigned to them specifically
3. **Proper notification flow** through the reporting chain (User → Manager → Manager's Manager → Superadmin)

## How It Works

### 1. Lead Status Changes

When a user changes a lead status:

- **Primary Notification**: Lead owner receives notification about the status change
- **Hierarchy Notification**: All users in the lead owner's reporting chain + superadmins receive a `[Team Activity]` notification
- **Action Notification**: The person who made the change and their hierarchy receive an `[Action]` notification
- **Project Notification**: Project stakeholders receive project-level notifications

### 2. Lead Assignments/Transfers

When leads are assigned or transferred:

- **Assignment Notification**: The assigned user receives a `New Lead Assigned` notification
- **Hierarchy Notification**: The assigned user's reporting chain + superadmins receive `[Team Activity] Lead Assigned` notification
- **Transfer Notification**: The person who did the transfer and their hierarchy receive `[Action] Leads Transferred` notification
- **Individual Lead Notifications**: Each transferred lead triggers individual assignment notifications

### 3. User Activity Tracking

For any user activity:

- **Activity Notification**: The user's reporting chain + superadmins receive `[Team Activity] User Activity` notifications
- **Contextual Information**: Notifications include user details, activity type, and relevant data

## Notification Types

### Primary Notifications (to the user)
- `lead_status_change`: Lead status updated
- `lead_assigned`: New lead assigned
- `lead_transferred`: Leads transferred to user
- `task_assignment`: New task assigned

### Hierarchy Notifications (to superiors)
- `[Team Activity] Lead Status Updated`: When team member changes lead status
- `[Team Activity] Lead Assigned`: When team member gets new lead
- `[Team Activity] Leads Transferred`: When leads are transferred
- `[Team Activity] User Activity`: General user activity notifications

### Action Notifications (to the actor)
- `[Action] Lead Status Updated`: Confirmation of status change
- `[Action] Lead Assigned`: Confirmation of lead assignment
- `[Action] Leads Transferred`: Confirmation of transfer action

## Notification Priority Levels

- **High Priority**: Lead assignments, lead transfers, final status changes
- **Normal Priority**: Status changes, user activities, general notifications

## Data Structure

Each notification includes:

```javascript
{
  type: 'notification_type',
  title: 'Notification Title',
  message: 'Human-readable message',
  data: {
    // Context-specific data
    leadId: 'lead_id',
    projectId: 'project_id',
    changedBy: 'user_id',
    changedByName: 'User Name',
    changedByEmail: 'user@email.com',
    isHierarchyNotification: true, // For hierarchy notifications
    actorUserId: 'user_id', // For activity notifications
    actorName: 'User Name',
    actorRole: 'user_role'
  },
  priority: 'high|normal',
  read: false,
  status: 'sent'
}
```

## Key Functions

### NotificationService Methods

1. **`sendNotificationWithSuperadmin(userId, notification, hierarchyNotification)`**
   - Sends notification to user and their hierarchy + superadmins
   - Primary method for most notifications

2. **`sendHierarchyNotification(actorUserId, notification)`**
   - Sends notification up the reporting chain + superadmins
   - Used for user activity notifications

3. **`sendLeadStatusNotification(lead, oldStatus, newStatus, changedBy)`**
   - Handles lead status change notifications
   - Notifies lead owner, hierarchy, and project stakeholders

4. **`sendLeadAssignmentNotification(lead, assignedTo, assignedBy)`**
   - Handles lead assignment notifications
   - Notifies assigned user and their hierarchy

5. **`sendUserActivityNotification(userId, activityType, activityData, message)`**
   - General user activity notifications
   - Ensures all user activities are reported to hierarchy

## Usage Examples

### Creating a Lead
```javascript
// In leadService.createLead()
await this.notificationService.sendLeadAssignmentNotification(
  lead,
  leadData.user,
  createdBy
);

await this.notificationService.sendUserActivityNotification(
  createdBy,
  'lead_created',
  {
    leadId: lead._id,
    projectId: leadData.project,
    assignedTo: leadData.user
  },
  'Created a new lead and assigned it to team member'
);
```

### Changing Lead Status
```javascript
// In leadService.changeLeadStatus()
await this.notificationService.sendLeadStatusNotification(
  lead, oldStatus, newStatus, userId
);

await this.notificationService.sendUserActivityNotification(
  userId,
  'lead_status_changed',
  {
    leadId: lead._id,
    oldStatus: oldStatus.name,
    newStatus: newStatus.name
  },
  `Changed lead status from "${oldStatus.name}" to "${newStatus.name}"`
);
```

### Transferring Leads
```javascript
// In leadController.bulkTransferLeads()
await global.notificationService.sendNotificationWithSuperadmin(
  toUser, notification, hierarchyNotif
);

await global.notificationService.sendHierarchyNotification(
  req.user._id.toString(),
  {
    type: 'lead_transferred',
    title: '[Action] Leads Transferred',
    message: `You transferred ${result.modifiedCount} lead(s)`,
    data: { leadIds, fromUser, toUser }
  }
);
```

## Benefits

1. **Complete Visibility**: Superadmins and managers see all activities of their team members
2. **Proper Hierarchy**: Notifications flow through the correct reporting chain
3. **Individual Awareness**: Users get notified when tasks/leads are assigned to them
4. **Rich Context**: Notifications include user names, emails, and detailed activity data
5. **Error Handling**: Individual notification failures don't break the entire system
6. **Performance**: Caching and batch processing for efficient notification delivery

## Configuration

The system automatically:
- Discovers superadmin users by role
- Builds reporting chains from UserReporting model
- Handles duplicate prevention
- Manages notification priorities
- Provides real-time WebSocket updates

## Testing

To test the hierarchical notification system:

1. Create a user hierarchy (User → Manager → Superadmin)
2. Create/assign leads to users
3. Change lead statuses
4. Transfer leads between users
5. Verify that:
   - Individual users get their notifications
   - Managers get team activity notifications
   - Superadmins get all notifications
   - Notification content includes proper context

## Troubleshooting

Common issues and solutions:

1. **Missing Hierarchy Notifications**: Check UserReporting model and reporting relationships
2. **Duplicate Notifications**: System prevents duplicates automatically
3. **Missing User Context**: Ensure User model is properly populated
4. **WebSocket Issues**: Check socketManager configuration
5. **Performance Issues**: Monitor notification queue and batch processing
