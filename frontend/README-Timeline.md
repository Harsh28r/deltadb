# Timeline Feature - User Journey Tracking

This feature provides a complete timeline view of each user's journey in your CRM system, similar to Amazon's order tracking.

## 🚀 Components Created

### 1. TimelineButton Component
**File:** `components/TimelineButton.jsx`

A beautiful button that navigates to the user's timeline page.

```jsx
import TimelineButton from './components/TimelineButton';

// Usage in your existing components
<TimelineButton 
  userId={user._id} 
  userName={user.name}
  className="ml-auto" // Optional custom styling
/>
```

### 2. UserTimeline Page
**File:** `pages/UserTimeline.jsx`

A complete timeline page showing the user's journey with:
- User profile summary
- Chronological timeline of events
- Project involvement details
- Role changes and permissions
- Beautiful visual timeline with icons and colors

### 3. UserCardWithTimeline Example
**File:** `components/UserCardWithTimeline.jsx`

Example of how to integrate the TimelineButton with existing user cards.

### 4. UserActions Component
**File:** `components/UserActions.jsx`

Example of how to add the TimelineButton to existing user action buttons.

## 🔗 API Endpoint

The timeline page calls this API:
```
GET /api/superadmin/users/:userId/timeline
```

## 📱 How to Integrate

### Option 1: Add TimelineButton to Existing User Cards

```jsx
import TimelineButton from './components/TimelineButton';

// In your existing user card component
<div className="user-card">
  {/* Your existing user info */}
  
  {/* Add this button */}
  <TimelineButton 
    userId={user._id} 
    userName={user.name}
  />
</div>
```

### Option 2: Add to User Action Rows

```jsx
import UserActions from './components/UserActions';

// In your user table or list
<UserActions 
  user={user}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onViewDetails={handleViewDetails}
/>
```

### Option 3: Add to User Detail Pages

```jsx
import TimelineButton from './components/TimelineButton';

// In your user detail page header
<div className="user-header">
  <h1>{user.name}</h1>
  <div className="actions">
    <TimelineButton 
      userId={user._id} 
      userName={user.name}
    />
  </div>
</div>
```

## 🎨 Timeline Features

### Visual Timeline
- **Vertical timeline** with connecting lines
- **Color-coded events** by type
- **Unique icons** for each event type
- **Status indicators** (completed, active, pending)

### Event Types
1. **👤 Account Created** - User registration
2. **🎭 Role Assigned** - Role assignment
3. **🚀 Project Created** - User owns project
4. **⭐ Promoted to Manager** - User manages project
5. **➕ Added to Project** - User joins project
6. **✅ Current Status** - Active status

### Timeline Data
- **Chronological order** from oldest to newest
- **Detailed information** for each event
- **Project summaries** with team sizes
- **Role permissions** and levels
- **Account statistics** (age, projects, etc.)

## 🛠️ Setup Requirements

### Dependencies
```bash
npm install react-router-dom @heroicons/react
```

### Routing
Make sure your App.jsx includes the timeline route:
```jsx
<Route path="/users/:userId/timeline" element={<UserTimeline />} />
```

### API Configuration
The timeline page expects your API to be available at:
- Base URL: Your backend server (e.g., `http://localhost:5000`)
- Authentication: JWT token in localStorage as 'token'

## 🎯 Use Cases

1. **HR Management** - Track employee journey and growth
2. **Performance Review** - See user's project contributions
3. **Resource Allocation** - Understand user workload
4. **Audit Trail** - Complete history of user activities
5. **Team Management** - See who's working on what
6. **Role Planning** - Understand user capabilities

## 🔒 Security

- **Superadmin only** - Timeline access restricted to superadmin
- **JWT authentication** - Requires valid token
- **User isolation** - Users can only see their own timeline (if you implement user-specific access)

## 🎨 Customization

### Colors
Modify the `getEventColor` function in `UserTimeline.jsx` to change event colors.

### Icons
Update the `getEventIcon` function to use different icons from Heroicons.

### Styling
All components use Tailwind CSS classes for easy customization.

## 📱 Mobile Responsive

All components are fully responsive and work on:
- Desktop computers
- Tablets
- Mobile phones

## 🚀 Quick Start

1. **Copy the components** to your project
2. **Add the route** to your App.jsx
3. **Import TimelineButton** in your user components
4. **Click the Timeline button** to see the magic!

The timeline will automatically fetch data from your API and display the user's complete journey in a beautiful, organized format.
