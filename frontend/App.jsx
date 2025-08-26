import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import UserTimeline from './pages/UserTimeline';
import UserList from './pages/UserList'; // Your existing user list page
import Login from './pages/Login'; // Your existing login page
import Dashboard from './pages/Dashboard'; // Your existing dashboard page

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          
          {/* Protected Routes */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/users" element={<UserList />} />
          
          {/* Timeline Route */}
          <Route path="/users/:userId/timeline" element={<UserTimeline />} />
          
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
