const mongoose = require('mongoose');
require('dotenv').config();

const relatedTypeToModel = {
  'task': 'Task',
  'lead': 'Lead',
  'project': 'Project',
  'cp-sourcing': 'CPSourcing'
};

async function migrateReminders() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/crm');
    console.log('Connected to MongoDB');

    const Reminder = mongoose.model('Reminder', new mongoose.Schema({}, { strict: false }));

    // Get all reminders
    const reminders = await Reminder.find({}).lean();
    console.log(`Found ${reminders.length} reminders to update`);

    let updated = 0;
    for (const reminder of reminders) {
      if (!reminder.relatedModel && reminder.relatedType) {
        await Reminder.updateOne(
          { _id: reminder._id },
          { $set: { relatedModel: relatedTypeToModel[reminder.relatedType] } }
        );
        updated++;
      }
    }

    console.log(`Successfully updated ${updated} reminders`);
    await mongoose.connection.close();
    console.log('Migration complete');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateReminders();
