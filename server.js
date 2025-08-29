require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { corsOptions, adminLoginCorsOptions, corsDebug } = require('./middleware/cors');

// const userRoutes = require('./routes/userRoutes');
const projectRoutes = require('./routes/projectRoutes');
// const taskRoutes = require('./routes/taskRoutes');
const superadminRoutes = require('./routes/superadminRoutes');
const cpSourceRoutes = require('./routes/cpSourceRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const leadSourceRoutes = require('./routes/leadSourceRoutes');
const leadStatusRoutes = require('./routes/leadStatusRoutes');
const leadRoutes = require('./routes/leadRoutes');
const userReportingRoutes = require('./routes/userReportingRoutes');
const userProjectRoutes = require('./routes/userProjectRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // Adjust for production
});

// Middleware
// CORS configuration using dedicated middleware
app.use(cors(corsOptions));
app.use(corsDebug);

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

// MongoDB connection stringhudugbd
const MONGO_URI =  'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Log MongoDB URI
console.log('MONGO_URI:', MONGO_URI);

// Global variable to track connection status
let isMongoConnected = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;

// Connect to MongoDB
const connectToMongoDB = async () => {
  try {
    if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
      console.error('Max connection attempts reached. Starting server without MongoDB...');
      startServer();
      return;
    }

    connectionAttempts++;
    console.log(`MongoDB connection attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS}`);
    
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000, // 30 second timeout for deployment
      socketTimeoutMS: 45000, // 45 second timeout
      maxPoolSize: 10, // Connection pool size
      retryWrites: true,
      w: 'majority'
    });
    
    console.log('MongoDB connected successfully');
    isMongoConnected = true;
    startServer();
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    console.error('Full error:', JSON.stringify(err, null, 2));
    isMongoConnected = false;
    
    // Retry connection after 5 seconds
    setTimeout(connectToMongoDB, 5000);
  }
};

// Listen for connection events
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
  isMongoConnected = true;
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
  isMongoConnected = false;
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected from MongoDB');
  isMongoConnected = false;
});

// Database connection check middleware
app.use((req, res, next) => {
  if (!isMongoConnected) {
    return res.status(503).json({ 
      error: 'Service temporarily unavailable',
      message: 'Database connection not ready. Please try again in a few seconds.',
      timestamp: new Date().toISOString(),
      details: 'MongoDB connection is being established. This is normal during deployment startup.'
    });
  }
  next();
});

// Routes
// app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
// app.use('/api/tasks', taskRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/cp-sources', cpSourceRoutes);
app.use('/api/notifications', notificationRoutes);

app.use('/api/lead-sources', leadSourceRoutes);
app.use('/api/lead-statuses', leadStatusRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/user-reporting', userReportingRoutes);
app.use('/api/user-projects', userProjectRoutes);

// Basic route
app.get('/', (req, res) => {
  res.send('DeltaYards CRM API');
});

// Socket.io for real-time location updates
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

// Debug route to test CORS
app.get('/api/test-cors', (req, res) => {
  console.log('CORS test request received');
  console.log('Origin:', req.headers.origin);
  console.log('User-Agent:', req.headers['user-agent']);
  res.json({ 
    message: 'CORS test successful',
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

// CORS test endpoint specifically for realtechmktg.com
app.get('/api/cors-test-realtech', (req, res) => {
  console.log('🔍 RealTech CORS test request:');
  console.log('  Origin:', req.headers.origin);
  console.log('  Method:', req.method);
  console.log('  Headers:', req.headers);
  
  res.json({ 
    message: 'RealTech CORS test successful',
    origin: req.headers.origin,
    allowed: true,
    timestamp: new Date().toISOString()
  });
});

// Database health check route fjf
app.get('/api/health', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const connectionState = mongoose.connection.readyState;
    const stateNames = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    res.json({
      status: 'ok',
      database: {
        connected: isMongoConnected,
        mongooseState: stateNames[connectionState] || 'unknown',
        readyState: connectionState,
        globalStatus: isMongoConnected
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ 
      error: 'CORS error', 
      message: 'Origin not allowed',
      origin: req.headers.origin 
    });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 5000;

const startServer = () => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('MongoDB connection status:', isMongoConnected);
    if (!isMongoConnected) {
      console.log('Warning: Server started without MongoDB connection');
    }
  });
};

// Start MongoDB connection
console.log('Starting MongoDB connection...');
connectToMongoDB();

// CORS preflight handler for admin-login endpoint
app.options('/api/superadmin/admin-login', cors(adminLoginCorsOptions));

