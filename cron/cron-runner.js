require('dotenv').config();
const mongoose = require('mongoose');

// MongoDB connection string
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Connect to MongoDB
const connectToMongoDB = async () => {
  try {
    console.log('Connecting to MongoDB for cron service...');
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 5,
      retryWrites: true,
      w: 'majority'
    });
    console.log('MongoDB connected successfully for cron service');
    
    // Start the cron job after successful connection
    require('./deactivation');
    console.log('Cron jobs initialized successfully');
    
  } catch (err) {
    console.error('MongoDB connection error for cron service:', err.message);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});

// Start the cron service
connectToMongoDB();
