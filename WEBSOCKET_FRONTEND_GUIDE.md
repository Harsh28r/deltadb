# WebSocket Frontend Integration Guide

## Overview
Your backend now broadcasts real-time updates for leads using WebSocket (Socket.IO). This means your frontend can receive instant updates without refreshing the page!

## What's Broadcasting
The backend now emits these events:
- ✅ **lead-created** - When a new lead is created
- ✅ **lead-assigned** - When a lead is assigned to a user
- ✅ **lead-updated** - When a lead is edited
- ✅ **lead-status-changed** - When lead status changes
- ✅ **lead-deleted** - When a lead is deleted

## Frontend Setup (React Example)

### 1. Install Socket.IO Client
```bash
npm install socket.io-client
```

### 2. Create WebSocket Hook (useSocket.js)
```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000'; // Your backend URL

export const useSocket = (token) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    // Connect to WebSocket with auth token
    const socketInstance = io(SOCKET_URL, {
      auth: {
        token: token // Your JWT token
      }
    });

    socketInstance.on('connect', () => {
      console.log('✅ WebSocket connected');
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('⚠️ WebSocket disconnected');
      setConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [token]);

  return { socket, connected };
};
```

### 3. Use WebSocket in Your Component
```javascript
import React, { useEffect, useState } from 'react';
import { useSocket } from './hooks/useSocket';

function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const { socket, connected } = useSocket(localStorage.getItem('token'));

  // Fetch initial leads
  useEffect(() => {
    fetchLeads();
  }, []);

  // Listen for real-time updates
  useEffect(() => {
    if (!socket) return;

    // Listen for new lead created
    socket.on('lead-created', (data) => {
      console.log('New lead created:', data);
      // Add new lead to the list
      setLeads(prev => [data.lead, ...prev]);
    });

    // Listen for lead updates
    socket.on('lead-updated', (data) => {
      console.log('Lead updated:', data);
      // Update the lead in the list
      setLeads(prev => prev.map(lead =>
        lead._id === data.lead._id ? data.lead : lead
      ));
    });

    // Listen for status changes
    socket.on('lead-status-changed', (data) => {
      console.log('Lead status changed:', data);
      // Update the lead status
      setLeads(prev => prev.map(lead =>
        lead._id === data.lead._id ? data.lead : lead
      ));
    });

    // Listen for lead deletion
    socket.on('lead-deleted', (data) => {
      console.log('Lead deleted:', data);
      // Remove lead from list
      setLeads(prev => prev.filter(lead => lead._id !== data.leadId));
    });

    // Listen for lead assigned to you
    socket.on('lead-assigned', (data) => {
      console.log('New lead assigned to you:', data);
      // Show notification or add to your leads
      showNotification('New lead assigned to you!');
      setLeads(prev => [data.lead, ...prev]);
    });

    // Cleanup
    return () => {
      socket.off('lead-created');
      socket.off('lead-updated');
      socket.off('lead-status-changed');
      socket.off('lead-deleted');
      socket.off('lead-assigned');
    };
  }, [socket]);

  const fetchLeads = async () => {
    const response = await fetch('http://localhost:5000/api/leads', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    const data = await response.json();
    setLeads(data.leads);
  };

  return (
    <div>
      <h1>Leads {connected && '🟢'}</h1>
      {leads.map(lead => (
        <div key={lead._id}>
          {/* Render lead */}
        </div>
      ))}
    </div>
  );
}
```

### 4. Join Project Room (Optional - for project-specific updates)
```javascript
useEffect(() => {
  if (!socket || !projectId) return;

  // Join project room to receive only this project's updates
  socket.emit('join-project', projectId);

  socket.on('joined-project', (data) => {
    console.log('Joined project room:', data);
  });

  return () => {
    socket.emit('leave-project', projectId);
  };
}, [socket, projectId]);
```

## Available Events to Listen

### Lead Events
| Event | Data | Description |
|-------|------|-------------|
| `lead-created` | `{ lead, createdBy }` | New lead created in project |
| `lead-assigned` | `{ lead, assignedBy }` | Lead assigned to you |
| `lead-updated` | `{ lead, updatedBy }` | Lead edited |
| `lead-status-changed` | `{ lead, changedBy }` | Lead status changed |
| `lead-deleted` | `{ leadId, deletedBy }` | Lead deleted |

### Notification Events (Already Implemented)
| Event | Data | Description |
|-------|------|-------------|
| `notification` | `{ type, title, message, data }` | New notification |
| `reminder` | `{ ... }` | New reminder |

### Project Events
| Event | Data | Description |
|-------|------|-------------|
| `joined-project` | `{ projectId, success }` | Confirmed project room join |
| `left-project` | `{ projectId }` | Left project room |

## Events You Can Emit

| Event | Data | Description |
|-------|------|-------------|
| `join-project` | `projectId` | Join project-specific room |
| `leave-project` | `projectId` | Leave project room |
| `subscribe-lead` | `leadId` | Subscribe to specific lead updates |
| `unsubscribe-lead` | `leadId` | Unsubscribe from lead |
| `subscribe-reminders` | - | Subscribe to your reminders |

## Testing WebSocket Connection

### 1. Check if WebSocket is running
Open browser console on your frontend and look for:
```
✅ WebSocket connected
```

### 2. Test with Browser DevTools
```javascript
// In browser console:
const socket = io('http://localhost:5000', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});

socket.on('connect', () => console.log('Connected!'));
socket.on('lead-created', (data) => console.log('Lead created:', data));
```

## Production Deployment

### Update Socket URL
```javascript
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'https://your-api.com';
```

### CORS is already configured
Your backend already has CORS enabled for WebSocket connections (see `server.js:90-92`).

## Benefits

### Before (Without WebSocket)
- ❌ User must manually refresh page to see new leads
- ❌ No real-time updates
- ❌ Miss important changes
- ❌ Polling wastes resources

### After (With WebSocket)
- ✅ Instant updates when leads are created/updated/deleted
- ✅ No manual refresh needed
- ✅ See changes made by other users immediately
- ✅ Better user experience
- ✅ Efficient (only updates when needed)

## Troubleshooting

### WebSocket not connecting?
1. Check if backend is running on port 5000
2. Verify JWT token is valid
3. Check browser console for errors
4. Make sure CORS is configured correctly

### Not receiving events?
1. Check if you're listening to the correct event name
2. Verify you're in the correct room (project room, etc.)
3. Check backend logs to see if events are being emitted

## Example: Show Toast Notification
```javascript
socket.on('lead-created', (data) => {
  toast.success(`New lead created by ${data.createdBy}!`);
  // Refresh your lead list or add the new lead
});
```

---

**Your backend is now broadcasting real-time updates!**
Just connect from the frontend and you'll never need to refresh again! 🎉
