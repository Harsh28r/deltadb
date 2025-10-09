
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/deltacrm?retryWrites=true&w=majority&appName=Cluster0';

async function testFollowUps() {
  try {
    console.log('🔌 Connecting to MongoDB...');







    
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const Reminder = mongoose.model('Reminder', require('./models/Reminder').schema);
    const Lead = mongoose.model('Lead', require('./models/Lead').schema);
    const LeadStatus = mongoose.model('LeadStatus', require('./models/LeadStatus').schema);

    // Test 1: Check if any reminders exist
    console.log('📊 Test 1: Checking existing reminders...');
    const totalReminders = await Reminder.countDocuments({ relatedType: 'lead' });
    console.log(`   Total lead reminders: ${totalReminders}`);

    if (totalReminders > 0) {
      const sampleReminder = await Reminder.findOne({ relatedType: 'lead' })
        .populate('userId', 'name email')
        .populate('relatedId')
        .lean();

      console.log('   Sample reminder:', {
        id: sampleReminder._id,
        title: sampleReminder.title,
        dateTime: sampleReminder.dateTime,
        status: sampleReminder.status,
        userId: sampleReminder.userId?.name
      });
    }
    console.log('');

    // Test 2: Check lead statuses with date fields
    console.log('📊 Test 2: Checking lead statuses with date/datetime fields...');
    const statuses = await LeadStatus.find().lean();

    statuses.forEach(status => {
      const dateFields = status.formFields?.filter(field => {
        const fieldType = field.type?.toLowerCase();
        return ['date', 'datetime', 'datetime-local', 'time'].includes(fieldType) ||
               field.name.toLowerCase().includes('date') ||
               field.name.toLowerCase().includes('time') ||
               field.name.toLowerCase().includes('follow');
      });

      if (dateFields && dateFields.length > 0) {
        console.log(`   Status: "${status.name}" has ${dateFields.length} date field(s):`);
        dateFields.forEach(field => {
          console.log(`      - ${field.name} (${field.type})`);
        });
      }
    });
    console.log('');

    // Test 3: Check recent leads with status changes
    console.log('📊 Test 3: Checking recent leads...');
    const recentLeads = await Lead.find()
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate('currentStatus', 'name')
      .populate('user', 'name email')
      .lean();

    console.log(`   Found ${recentLeads.length} recent leads:`);
    for (const lead of recentLeads) {
      const leadReminders = await Reminder.countDocuments({
        relatedType: 'lead',
        relatedId: lead._id
      });

      console.log(`   Lead ID: ${lead._id}`);
      console.log(`      Status: ${lead.currentStatus?.name}`);
      console.log(`      Assigned to: ${lead.user?.name}`);
      console.log(`      Reminders: ${leadReminders}`);
      console.log(`      Updated: ${lead.updatedAt}`);
    }
    console.log('');

    // Test 4: Check upcoming follow-ups
    console.log('📊 Test 4: Checking upcoming follow-ups (next 7 days)...');
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcomingReminders = await Reminder.find({
      relatedType: 'lead',
      dateTime: { $gte: now, $lte: nextWeek },
      status: 'pending'
    })
    .populate('userId', 'name email')
    .populate('relatedId')
    .sort({ dateTime: 1 })
    .lean();

    console.log(`   Found ${upcomingReminders.length} upcoming follow-ups:`);
    upcomingReminders.slice(0, 5).forEach(reminder => {
      console.log(`   - ${reminder.title}`);
      console.log(`     Date: ${reminder.dateTime}`);
      console.log(`     Assigned to: ${reminder.userId?.name}`);
      console.log(`     Status: ${reminder.status}`);
    });
    console.log('');

    // Test 5: Check overdue follow-ups
    console.log('📊 Test 5: Checking overdue follow-ups...');
    const overdueReminders = await Reminder.countDocuments({
      relatedType: 'lead',
      dateTime: { $lt: now },
      status: 'pending'
    });
    console.log(`   Found ${overdueReminders} overdue follow-ups\n`);

    console.log('✅ All tests completed!');
    console.log('\n📝 Summary:');
    console.log(`   Total Reminders: ${totalReminders}`);
    console.log(`   Upcoming (7 days): ${upcomingReminders.length}`);
    console.log(`   Overdue: ${overdueReminders}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testFollowUps();
