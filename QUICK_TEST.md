# 🔥 QUICK NOTIFICATION TEST

## Step 1: Restart Server
```bash
pm2 restart all
# OR
npm start
```

## Step 2: Check Service Status

```http
GET http://localhost:5000/api/test/notification-status
Authorization: Bearer YOUR_TOKEN
```

**Expected Response:**
```json
{
  "notificationServiceAvailable": true,
  "socketManagerAvailable": true,
  "reminderServiceAvailable": true,
  "queueSize": 0,
  "batchSize": 50,
  "socketConnections": 0
}
```

✅ If all are `true`, services are initialized!

---

## Step 3: Send Test Notification

```http
POST http://localhost:5000/api/test/test-notification
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "userId": "YOUR_USER_ID",
  "message": "Hello! This is a test notification"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Test notification sent",
  "targetUserId": "67425a95...",
  "queueSize": 1
}
```

✅ Check server console for logs like:
```
🔔 NotificationService: Sending notification to user 67425a95...
📦 Added to queue. Queue size: 1
```

---

## Step 4: Check Notifications Were Saved

Wait 5 seconds (batch processes every 5 seconds), then:

```http
GET http://localhost:5000/api/notifications/YOUR_USER_ID?page=1&limit=10
Authorization: Bearer YOUR_TOKEN
```

**Expected Response:**
```json
{
  "notifications": [
    {
      "_id": "...",
      "user": {...},
      "type": "test",
      "message": "Hello! This is a test notification",
      "status": "sent",
      "timestamp": "2025-09-30T...",
      ...
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalItems": 1,
    "limit": 10
  }
}
```

✅ Console should show:
```
✅ Processed 1 notifications
```

---

## Step 5: Test Real Notification (Lead Creation)

```http
POST http://localhost:5000/api/leads
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "userId": "DIFFERENT_USER_ID",
  "projectId": "YOUR_PROJECT_ID",
  "leadSourceId": "YOUR_LEAD_SOURCE_ID",
  "customData": {
    "name": "Test Lead",
    "phone": "9876543210"
  }
}
```

**Expected Console Logs:**
```
🔔 NotificationService: Sending notification to user DIFFERENT_USER_ID
  type: lead_created
  title: New Lead Assigned
📦 Added to queue. Queue size: 1
```

Then check notifications for `DIFFERENT_USER_ID`:
```http
GET http://localhost:5000/api/notifications/DIFFERENT_USER_ID
```

---

## 🐛 Troubleshooting

### Services Not Available?
Check server startup logs for:
```
✅ Real-time system initialized
```

If missing, check:
1. Server.js lines 53-67
2. Restart server completely

### Notifications Not Saving?
Check MongoDB connection:
```http
GET http://localhost:5000/api/health
```

Should show:
```json
{
  "database": {
    "connected": true
  }
}
```

### Queue Not Processing?
Wait 5 seconds (batch timeout), or create 50+ notifications to trigger batch.

Console should show:
```
✅ Processed X notifications
```

---

## ✅ SUCCESS CHECKLIST

- [ ] Service status shows all `true`
- [ ] Test notification endpoint works
- [ ] Console shows notification logs
- [ ] After 5 seconds, notifications appear in database
- [ ] Real lead creation triggers notification
- [ ] Notification appears in GET /api/notifications endpoint

**If all checked, notifications are working! 🎉**