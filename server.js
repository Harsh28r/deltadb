require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

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
// CORS configuration - flexible for development and production
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost for development
    if (origin === 'http://localhost:3000') return callback(null, true);
    
    // Allow any vercel.app domain
    if (origin.includes('vercel.app')) return callback(null, true);
    
    // Allow realtechmktg.com domain
    if (origin === 'https://www.realtechmktg.com') return callback(null, true);
    
    // Allow all origins in development
    if (process.env.NODE_ENV === 'development') return callback(null, true);
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
  exposedHeaders: ['Authorization', 'x-auth-token']
}));



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

// MongoDB connection string
// const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
 const MONGO_URI = process.env.MONGO_URI
// Log MongoDB URI
console.log('MONGO_URI:', MONGO_URI);

// Global variable to track connection status
let isMongoConnected = false;

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 30000, // 30 second timeout for deployment
  socketTimeoutMS: 45000, // 45 second timeout
  maxPoolSize: 10, // Connection pool size
  retryWrites: true,
  w: 'majority'
})
  .then(() => {
    console.log('MongoDB connected successfully');
    isMongoConnected = true;
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    console.error('Full error:', JSON.stringify(err, null, 2));
    // Don't exit process, let it retry
    isMongoConnected = false;
  });

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
  
  // Retry connection after 5 seconds
  setTimeout(() => {
    console.log('Attempting to reconnect to MongoDB...');
    mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority'
    });
  }, 5000);
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
  res.send('Flow Backend API');
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

// Database health check route
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

// Start server with connection check
const PORT = process.env.PORT || 5000;

// Wait for MongoDB connection before starting server
const startServer = () => {
  if (isMongoConnected) {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log('MongoDB connection status:', isMongoConnected);
    });
  } else {
    console.log('Waiting for MongoDB connection...');
    setTimeout(startServer, 2000);
  }
};

// Start server after 3 seconds to allow MongoDB connection
setTimeout(startServer, 3000);