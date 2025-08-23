require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// const userRoutes = require('./routes/userRoutes');
const projectRoutes = require('./routes/projectRoutes');
// const taskRoutes = require('./routes/taskRoutes');
const superadminRoutes = require('./routes/superadminRoutes');
const cpSourceRoutes = require('./routes/cpSourceRoutes');


const app = express();

// Middleware
// CORS configuration - simplified
app.use(cors({
  origin: ['http://localhost:3000', 'https://delta-frontend-5ej2q824y-deltas-projects-43e49e0e.vercel.app'],
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
  exposedHeaders: ['Authorization', 'x-auth-token']
}));



app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log environment variables
console.log('MONGO_URI:', process.env.MONGO_URI);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    console.error('Full error:', JSON.stringify(err, null, 2));
    process.exit(1);
  });

// Routes
// app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
// app.use('/api/tasks', taskRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/cp-sources', cpSourceRoutes);


// Basic route
app.get('/', (req, res) => {
  res.send('Flow Backend API');
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));