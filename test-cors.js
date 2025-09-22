const axios = require('axios');

// Test CORS configuration
async function testCORS() {
  const baseURL = 'https://deltadb-o1lh.onrender.com';
  const testOrigin = 'https://www.realtechmktg.com';
  
  console.log('🧪 Testing CORS Configuration...\n');
  
  // Test 1: Basic CORS test endpoint
  try {
    console.log('1. Testing basic CORS endpoint...');
    const response = await axios.get(`${baseURL}/api/cors-test-realtech`, {
      headers: {
        'Origin': testOrigin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    console.log('✅ Basic CORS test passed');
    console.log('Response:', response.data);
  } catch (error) {
    console.log('❌ Basic CORS test failed:', error.message);
  }
  
  console.log('\n');
  
  // Test 2: Admin login CORS test
  try {
    console.log('2. Testing admin login CORS endpoint...');
    const response = await axios.get(`${baseURL}/api/admin-login-test`, {
      headers: {
        'Origin': testOrigin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });
    console.log('✅ Admin login CORS test passed');
    console.log('Response:', response.data);
  } catch (error) {
    console.log('❌ Admin login CORS test failed:', error.message);
  }
  
  console.log('\n');
  
  // Test 3: Health check endpoint
  try {
    console.log('3. Testing health check endpoint...');
    const response = await axios.get(`${baseURL}/api/health`, {
      headers: {
        'Origin': testOrigin
      }
    });
    console.log('✅ Health check passed');
    console.log('Response:', response.data);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }
  
  console.log('\n');
  
  // Test 4: Preflight OPTIONS request
  try {
    console.log('4. Testing preflight OPTIONS request...');
    const response = await axios.options(`${baseURL}/api/superadmin/admin-login`, {
      headers: {
        'Origin': testOrigin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });
    console.log('✅ Preflight OPTIONS test passed');
    console.log('Status:', response.status);
    console.log('Headers:', response.headers);
  } catch (error) {
    console.log('❌ Preflight OPTIONS test failed:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Headers:', error.response.headers);
    }
  }
}

// Run the test
testCORS().catch(console.error);
