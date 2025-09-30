# Quick Hierarchical Notification Test Guide

## Prerequisites

1. **Start your server**: Make sure your application is running on `http://localhost:5000`
2. **Import Postman Collection**: Import the `HIERARCHICAL_NOTIFICATIONS_POSTMAN_TESTS.json` file into Postman
3. **Set up test data**: Ensure you have users with different roles (user, manager, superadmin) in your database

## Quick Test Steps

### Step 1: Authentication Setup
1. Run the "Login as Superadmin" request first
2. This will set the `auth_token` and `superadmin_id` variables
3. Run "Login as Manager" and "Login as User" to set their IDs

### Step 2: Setup Test Data
1. Run "Get Projects" to set `project_id`
2. Run "Get Lead Sources" to set `lead_source_id`  
3. Run "Get Lead Statuses" to set `lead_status_id` and `new_status_id`

### Step 3: Test Lead Assignment Notifications
1. **Create Lead**: Run "Create Lead (Assignment Test)"
   - This should trigger notifications to the assigned user and their hierarchy
   
2. **Verify Notifications**:
   - Run "Check Notifications After Lead Creation" for the user
   - Run "Check Manager Notifications" for the manager
   - Run "Check Superadmin Notifications" for the superadmin

### Step 4: Test Lead Status Change Notifications
1. **Change Status**: Run "Change Lead Status"
   - This should trigger notifications to multiple parties
   
2. **Verify Status Change Notifications**:
   - Run the three "Check Status Change Notifications" requests
   - Verify that hierarchy notifications are sent

### Step 5: Test Lead Transfer Notifications
1. **Transfer Lead**: Run "Transfer Lead to Another User"
   - This should trigger transfer and assignment notifications
   
2. **Verify Transfer Notifications**:
   - Run "Check Transfer Notifications - New Owner"
   - Run "Check Transfer Notifications - Transferrer"

### Step 6: Final Verification
1. Run "Get All Notifications for User" to see user's notifications
2. Run "Get All Notifications for Manager" to see manager's team activity notifications
3. Run "Get All Notifications for Superadmin" to see all hierarchy notifications

## Expected Results

### For User (Individual Notifications):
- ✅ `lead_assigned` notifications when leads are assigned
- ✅ `lead_transferred` notifications when leads are transferred to them
- ✅ `lead_status_change` notifications when their leads' status changes

### For Manager (Hierarchy Notifications):
- ✅ `[Team Activity] Lead Assigned` when team members get leads
- ✅ `[Team Activity] Lead Status Updated` when team members change status
- ✅ `[Team Activity] Leads Transferred` when team members transfer leads

### For Superadmin (All Hierarchy Notifications):
- ✅ All `[Team Activity]` notifications from all users
- ✅ All `[Action]` notifications for their own actions
- ✅ Complete visibility into all team activities

## Troubleshooting

### If notifications are not appearing:

1. **Check Console Logs**: Look at your server console for notification logs
2. **Verify User Hierarchy**: Ensure UserReporting relationships are set up
3. **Check Superadmin Role**: Verify superadmin users are properly configured
4. **Database Connection**: Ensure MongoDB is connected and accessible

### Common Issues:

- **Missing hierarchy notifications**: Check if UserReporting model has proper relationships
- **No superadmin notifications**: Verify superadmin role exists and users have it
- **Duplicate notifications**: System should prevent duplicates automatically
- **Missing user context**: Check if User model data is complete

## Manual Verification

You can also manually check notifications by:

1. **API Call**: `GET /api/notifications?recipient=USER_ID`
2. **Database Query**: Check the `notifications` collection in MongoDB
3. **WebSocket**: Connect to WebSocket and listen for real-time notifications

## Test Data Setup

If you need to create test users:

```javascript
// Create test users with proper hierarchy
const user = new User({
  name: "Test User",
  email: "user@deltayards.com",
  role: "user",
  level: 1
});

const manager = new User({
  name: "Test Manager", 
  email: "manager@deltayards.com",
  role: "manager",
  level: 2
});

const superadmin = new User({
  name: "Test Superadmin",
  email: "superadmin@deltayards.com", 
  role: "superadmin",
  level: 3
});
```

## Success Criteria

The test is successful if:

1. ✅ Users receive individual assignment notifications
2. ✅ Managers receive team activity notifications  
3. ✅ Superadmins receive all hierarchy notifications
4. ✅ Notification content includes proper user context
5. ✅ No duplicate notifications are created
6. ✅ Real-time WebSocket notifications work (if enabled)

## Next Steps

After successful testing:

1. **Production Setup**: Configure proper user hierarchy in production
2. **Notification Preferences**: Add user notification preferences
3. **Email Notifications**: Integrate email notifications for important events
4. **Mobile Push**: Add mobile push notifications
5. **Analytics**: Track notification engagement and effectiveness
