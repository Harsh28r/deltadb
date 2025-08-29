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
app.use(cors({
  origin: '*', // Allow all origins for now
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(bodyParser.json({ limit: '10mb' }));

// Global rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests, please try again later.'
});
app.use(limiter);

// MongoDB connection with better error handling
let isConnected = false;

const connectDB = async () => {
  try {
    if (isConnected) return;
    
    const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
    
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 5, // Reduced for serverless
      retryWrites: true,
      w: 'majority'
    });
    
    isConnected = true;
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    isConnected = false;
  }
};

// Connect to MongoDB
connectDB();

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    res.json({
      status: 'ok',
      database: {
        connected: isConnected,
        readyState: mongoose.connection.readyState
      },
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'DeltaYards CRM API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes with error handling
app.use('/api/projects', projectRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/cp-sources', cpSourceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/lead-sources', leadSourceRoutes);
app.use('/api/lead-statuses', leadStatusRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/user-reporting', userReportingRoutes);
app.use('/api/user-projects', userProjectRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  // Don't expose internal errors in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(err.status || 500).json({
    error: message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  });
});

// Export for Vercel
module.exports = app;
