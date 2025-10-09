require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/deltacrm?retryWrites=true&w=majority&appName=Cluster0';

async function testStatusChange() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Load models
    const Lead = require('./models/Lead');
    const LeadStatus = require('./models/LeadStatus');
    const Reminder = require('./models/Reminder');
    const User = require('./models/User');
    const Role = require('./models/Role'); // Required by Lead model

    // Find a test lead
    console.log('🔍 Finding a test lead...');
    const testLead = await Lead.findOne()
      .populate('user')
      .populate('currentStatus');

    if (!testLead) {
      console.log('❌ No leads found in database');
      return;
    }

    console.log(`✅ Found lead: ${testLead._id}`);
    console.log(`   Current Status: ${testLead.currentStatus?.name}`);
    console.log(`   Assigned to: ${testLead.user?.name} (${testLead.user?._id})`);

    // Count reminders before
    const remindersBefore = await Reminder.countDocuments({
      relatedType: 'lead',
      relatedId: testLead._id
    });
    console.log(`   Current reminders: ${remindersBefore}\n`);

    // Find a status with datetime field
    console.log('🔍 Finding statuses with datetime fields...');
    const statuses = await LeadStatus.find().lean();

    let statusWithDate = null;
    for (const status of statuses) {
      const dateFields = status.formFields?.filter(field => {
        const fieldType = field.type?.toLowerCase();
        return ['date', 'datetime', 'datetime-local'].includes(fieldType) ||
               field.name.toLowerCase().includes('date') ||
               field.name.toLowerCase().includes('meeting');
      });

      if (dateFields && dateFields.length > 0) {
        statusWithDate = status;
        console.log(`✅ Found status: "${status.name}" with date fields:`);
        dateFields.forEach(f => console.log(`      - ${f.name} (${f.type})`));
        break;
      }
    }

    if (!statusWithDate) {
      console.log('❌ No status with date fields found');
      return;
    }

    // Prepare test data with future datetime
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3); // 3 days from now
    futureDate.setHours(14, 30, 0, 0); // 2:30 PM

    const dateField = statusWithDate.formFields.find(f =>
      ['date', 'datetime', 'datetime-local'].includes(f.type?.toLowerCase()) ||
      f.name.toLowerCase().includes('date') ||
      f.name.toLowerCase().includes('meeting')
    );

    const testData = {
      [dateField.name]: futureDate.toISOString()
    };

    console.log(`\n🧪 TEST: Changing status to "${statusWithDate.name}"`);
    console.log(`   Setting "${dateField.name}" to: ${futureDate.toISOString()}`);
    console.log(`   Expected: Reminder should be created\n`);

    console.log('📝 Calling changeStatus method...');
    console.log('   Watch for 🔔 logs below:\n');

    // Change status
    await testLead.changeStatus(
      statusWithDate._id,
      testData,
      testLead.user
    );

    console.log('\n✅ Status changed successfully!');

    // Check if reminder was created
    const remindersAfter = await Reminder.find({
      relatedType: 'lead',
      relatedId: testLead._id
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

    console.log(`\n📊 Reminders after status change: ${remindersAfter.length}`);

    if (remindersAfter.length > remindersBefore) {
      console.log(`✅ SUCCESS! New reminder(s) created:`);
      remindersAfter.slice(0, remindersAfter.length - remindersBefore).forEach(r => {
        console.log(`   - Title: ${r.title}`);
        console.log(`     DateTime: ${r.dateTime}`);
        console.log(`     Status: ${r.status}`);
        console.log(`     User: ${r.userId}`);
      });
    } else {
      console.log(`❌ FAILED! No new reminders created`);
      console.log(`   Expected: ${remindersBefore + 1}`);
      console.log(`   Got: ${remindersAfter.length}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testStatusChange();
