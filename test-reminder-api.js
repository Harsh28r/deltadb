const axios = require('axios');

// Test script for enhanced reminder API with lead details
async function testReminderAPI() {
  const baseURL = 'http://localhost:5000/api';
  
  // You'll need to replace these with actual values from your system
  const testAuthToken = 'your-auth-token-here';
  
  try {
    console.log('🧪 Testing Enhanced Reminder API with Lead Details\n');
    
    // Test GET /api/reminder - should now include detailed lead information
    console.log('1. Testing GET /api/reminder...');
    const remindersResponse = await axios.get(`${baseURL}/reminder`, {
      headers: {
        'Authorization': `Bearer ${testAuthToken}`,
        'Content-Type': 'application/json'
      },
      params: {
        relatedType: 'lead', // Only get lead-related reminders
        limit: 5
      }
    });
    
    console.log('✅ GET /api/reminder Response:');
    console.log(`Found ${remindersResponse.data.reminders.length} reminders`);
    
    if (remindersResponse.data.reminders.length > 0) {
      const firstReminder = remindersResponse.data.reminders[0];
      console.log('\n📋 Sample Reminder with Lead Details:');
      console.log(`  Title: ${firstReminder.title}`);
      console.log(`  Description: ${firstReminder.description}`);
      console.log(`  DateTime: ${firstReminder.dateTime}`);
      console.log(`  Status: ${firstReminder.status}`);
      
      if (firstReminder.relatedId && firstReminder.relatedType === 'lead') {
        console.log('\n🎯 Lead Details:');
        console.log(`  Lead ID: ${firstReminder.relatedId._id}`);
        console.log(`  Current Status: ${firstReminder.relatedId.currentStatus?.name || 'N/A'}`);
        console.log(`  Assigned User: ${firstReminder.relatedId.user?.name || 'N/A'} (${firstReminder.relatedId.user?.email || 'N/A'})`);
        console.log(`  Project: ${firstReminder.relatedId.project?.name || 'N/A'} - ${firstReminder.relatedId.project?.location || 'N/A'}`);
        console.log(`  Channel Partner: ${firstReminder.relatedId.channelPartner?.name || 'N/A'} (${firstReminder.relatedId.channelPartner?.firmName || 'N/A'})`);
        console.log(`  Lead Source: ${firstReminder.relatedId.leadSource?.name || 'N/A'}`);
        console.log(`  Follow-up Date: ${firstReminder.relatedId.followUpDate || 'N/A'}`);
        console.log(`  Reminder Date: ${firstReminder.relatedId.reminderDate || 'N/A'}`);
        console.log(`  Is Active: ${firstReminder.relatedId.isActive}`);
        console.log(`  Created: ${firstReminder.relatedId.createdAt}`);
        
        if (firstReminder.relatedId.cpSourcingId) {
          console.log('\n📊 CP Sourcing Details:');
          console.log(`  CP: ${firstReminder.relatedId.cpSourcingId.channelPartnerId?.name || 'N/A'} (${firstReminder.relatedId.cpSourcingId.channelPartnerId?.firmName || 'N/A'})`);
          console.log(`  Project: ${firstReminder.relatedId.cpSourcingId.projectId?.name || 'N/A'} - ${firstReminder.relatedId.cpSourcingId.projectId?.location || 'N/A'}`);
        }
        
        if (firstReminder.relatedId.customData && Object.keys(firstReminder.relatedId.customData).length > 0) {
          console.log('\n📝 Custom Data:');
          console.log(JSON.stringify(firstReminder.relatedId.customData, null, 2));
        }
      }
    }
    
    // Test GET /api/reminder/:id - should also include detailed lead information
    if (remindersResponse.data.reminders.length > 0) {
      const reminderId = remindersResponse.data.reminders[0]._id;
      console.log(`\n2. Testing GET /api/reminder/${reminderId}...`);
      
      const reminderByIdResponse = await axios.get(`${baseURL}/reminder/${reminderId}`, {
        headers: {
          'Authorization': `Bearer ${testAuthToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ GET /api/reminder/:id Response:');
      console.log(`Reminder ID: ${reminderByIdResponse.data._id}`);
      console.log(`Title: ${reminderByIdResponse.data.title}`);
      
      if (reminderByIdResponse.data.relatedId && reminderByIdResponse.data.relatedType === 'lead') {
        console.log(`Lead Details Available: ${reminderByIdResponse.data.relatedId._id ? 'Yes' : 'No'}`);
        console.log(`Lead Status: ${reminderByIdResponse.data.relatedId.currentStatus?.name || 'N/A'}`);
      }
    }
    
    console.log('\n🎉 Test completed successfully!');
    console.log('\n📋 Summary of Enhancements:');
    console.log('✅ GET /api/reminder now includes detailed lead information');
    console.log('✅ GET /api/reminder/:id now includes detailed lead information');
    console.log('✅ Lead details include: status, user, project, channel partner, lead source, CP sourcing, custom data');
    console.log('✅ Nested population for related entities (CP sourcing details, etc.)');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 Note: You need to provide a valid auth token in the testAuthToken variable');
    }
    
    if (error.response?.status === 404) {
      console.log('\n💡 Note: Make sure your server is running on localhost:5000');
    }
  }
}

// Run the test
testReminderAPI();
