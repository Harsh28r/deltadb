#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 DeltaYards CRM Environment Setup');
console.log('=====================================\n');

// Check if .env already exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('⚠️  .env file already exists!');
  console.log('📁 Current .env location:', envPath);
  console.log('\n💡 To update your MongoDB connection:');
  console.log('   1. Edit the .env file');
  console.log('   2. Update MONGO_URI with your MongoDB connection string');
  console.log('   3. Restart the server');
  return;
}

// Create .env file content
const envContent = `# Environment Variables for DeltaYards CRM
# MongoDB Connection String - Replace with your actual MongoDB URI
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database

# JWT Secret Key (generate a strong random string)
JWT_SECRET=your_jwt_secret_key_here

# Superadmin Credentials
SUPERADMIN_EMAIL=admin@deltayards.com
SUPERADMIN_PASSWORD=admin123

# Server Configuration
PORT=5000
NODE_ENV=development

# CORS Settings
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
`;

try {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file created successfully!');
  console.log('📁 Location:', envPath);
  console.log('\n🔑 IMPORTANT: You need to update the following:');
  console.log('   1. MONGO_URI - Your MongoDB connection string');
  console.log('   2. JWT_SECRET - A strong random string for security');
  console.log('   3. SUPERADMIN_EMAIL/PASSWORD - Your admin credentials');
  console.log('\n💡 After updating .env, restart your server with:');
  console.log('   npm run dev');
} catch (error) {
  console.error('❌ Error creating .env file:', error.message);
  console.log('\n💡 Manual setup:');
  console.log('   1. Create a .env file in the project root');
  console.log('   2. Copy the content from env-template.txt');
  console.log('   3. Fill in your actual values');
}

