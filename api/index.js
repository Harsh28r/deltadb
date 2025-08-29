// Vercel API Routes - Main entry point
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

// Import routes
const projectRoutes = require('../routes/projectRoutes');
const superadminRoutes = require('../routes/superadminRoutes');
const cpSourceRoutes = require('../routes/cpSourceRoutes');
const notificationRoutes = require('../routes/notificationRoutes');
const leadSourceRoutes = require('../routes/leadSourceRoutes');
const leadStatusRoutes = require('../routes/leadStatusRoutes');
const leadRoutes = require('../routes/leadRoutes');
const userReportingRoutes = require('../routes/userReportingRoutes');
const userProjectRoutes = require('../routes/userProjectRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Global rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests, please try again later.'
});
app.use(limiter);

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  retryWrites: true,
  w: 'majority'
}).then(() => {
  console.log('MongoDB connected successfully');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Routes
app.use('/api/projects', projectRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/cp-sources', cpSourceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/lead-sources', leadSourceRoutes);
app.use('/api/lead-statuses', leadStatusRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/user-reporting', userReportingRoutes);
app.use('/api/user-projects', userProjectRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: {
      connected: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState
    },
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'DeltaYards CRM API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Export for Vercel
module.exports = app;
