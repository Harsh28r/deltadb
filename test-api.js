const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test function to check if server is running
async function testServerHealth() {
  try {
    console.log('🔍 Testing server health...');
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server is running:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Server is not running or health endpoint failed');
    console.log('Error:', error.message);
    return false;
  }
}

// Test function to check projects endpoint
async function testProjectsAPI() {
  try {
    console.log('\n🔍 Testing projects API...');
    const response = await axios.get(`${BASE_URL}/projects`);
    console.log('✅ Projects API working:', response.data.length, 'projects found');
    return response.data;
  } catch (error) {
    console.log('❌ Projects API failed:', error.response?.status, error.response?.data?.message || error.message);
    return null;
  }
}

// Test function to check leads endpoint
async function testLeadsAPI() {
  try {
    console.log('\n🔍 Testing leads API...');
    const response = await axios.get(`${BASE_URL}/leads`);
    console.log('✅ Leads API working:', response.data.length, 'leads found');
    return response.data;
  } catch (error) {
    console.log('❌ Leads API failed:', error.response?.status, error.response?.data?.message || error.message);
    return null;
  }
}

// Test function to check leads with project filter
async function testLeadsWithProjectFilter(projectId) {
  try {
    console.log(`\n🔍 Testing leads API with project filter (${projectId})...`);
    const response = await axios.get(`${BASE_URL}/leads?projectId=${projectId}`);
    console.log('✅ Leads with project filter working:', response.data.length, 'leads found');
    return response.data;
  } catch (error) {
    console.log('❌ Leads with project filter failed:', error.response?.status, error.response?.data?.message || error.message);
    return null;
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting API Tests...\n');
  
  // Test 1: Server health
  const serverHealthy = await testServerHealth();
  if (!serverHealthy) {
    console.log('\n❌ Server is not running. Please start the server with: npm start');
    return;
  }
  
  // Test 2: Projects API
  const projects = await testProjectsAPI();
  
  // Test 3: Leads API
  const leads = await testLeadsAPI();
  
  // Test 4: Leads with project filter (if we have projects)
  if (projects && projects.length > 0) {
    const firstProjectId = projects[0]._id;
    await testLeadsWithProjectFilter(firstProjectId);
  }
  
  console.log('\n✨ API Tests completed!');
  
  if (projects && projects.length > 0) {
    console.log('\n📋 Available Projects:');
    projects.forEach(project => {
      console.log(`  - ${project.name} (${project.location}) - ID: ${project._id}`);
    });
  }
  
  if (leads && leads.length > 0) {
    console.log('\n📋 Available Leads:');
    leads.forEach(lead => {
      console.log(`  - Lead ID: ${lead._id} - Project: ${lead.project?.name || 'No project'}`);
    });
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };



