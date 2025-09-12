const cron = require('node-cron');
const ChannelPartner = require('../models/ChannelPartner');
const CPSourcing = require('../models/CPSourcing');
const Lead = require('../models/Lead');

cron.schedule('0 0 * * *', async () => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Deactivate ChannelPartners with no recent lead activity
    const channelPartners = await ChannelPartner.find({ isActive: true });
    for (const cp of channelPartners) {
      const recentLead = await Lead.findOne({
        channelPartner: cp._id,
        updatedAt: { $gte: thirtyDaysAgo }
      });
      if (!recentLead) {
        await ChannelPartner.findByIdAndUpdate(cp._id, { isActive: false });
      }
    }

    // Deactivate CPSourcings with no recent lead activity
    const cpSourcings = await CPSourcing.find({ isActive: true });
    for (const sourcing of cpSourcings) {
      const recentLead = await Lead.findOne({
        cpSourcingId: sourcing._id,
        updatedAt: { $gte: thirtyDaysAgo }
      });
      if (!recentLead) {
        await CPSourcing.findByIdAndUpdate(sourcing._id, { isActive: false });
      }
    }

    console.log('Deactivation cron job completed');
  } catch (err) {
    console.error('Deactivation cron job error:', err);
  }
});