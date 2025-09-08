const mongoose = require('mongoose');
const LeadSource = require('../models/LeadSource');

const initLeadSource = async () => {
  try {
    // Always normalize the lookup with collation for case-insensitive check
    const exists = await LeadSource.findOne({ name: 'Channel Partner' })
      .collation({ locale: 'en', strength: 2 });

    if (!exists) {
      const leadSource = new LeadSource({ name: 'Channel Partner' });

      // Save without triggering "variation block" (since this is the official allowed version)
      await leadSource.save();

      console.log('✅ Default Channel Partner lead source created');
    } else {
      console.log('ℹ️ Channel Partner lead source already exists');
    }
  } catch (err) {
    console.error('❌ Error initializing Channel Partner lead source:', err.message);
  }
};

module.exports = initLeadSource;
