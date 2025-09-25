const mongoose = require('mongoose');

const channelPartnerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, match: [/^\d{10}$/, 'Please enter a valid 10-digit phone number'] },
  firmName: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  mahareraNo: { type: String, trim: true , require: false }, // Changed to optional
  photo: { type: String, default: '' },
  pinCode: { type: String, required: true, match: [/^\d{6}$/, 'Please enter a valid 6-digit pin code'] },
  customData: { type: mongoose.Schema.Types.Mixed, default: {} },
  isActive: { type: Boolean, default: false }, // Default to false
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// Check lead activity for isActive status on save
// channelPartnerSchema.pre('save', async function(next) {
//   const Lead = mongoose.model('Lead');
//   const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
//   const recentLead = await Lead.findOne({
//     channelPartner: this._id,
//     updatedAt: { $gte: thirtyDaysAgo }
//   });
//   this.isActive = !!recentLead; // Set true if recent lead exists
//   next();
// });

// Check lead activity for isActive status on update
// channelPartnerSchema.pre('findOneAndUpdate', async function(next) {
//   const Lead = mongoose.model('Lead');
//   const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
//   const doc = await this.model.findOne(this.getQuery());
//   if (doc) {
//     const recentLead = await Lead.findOne({
//       channelPartner: doc._id,
//       updatedAt: { $gte: thirtyDaysAgo }
//     });
//     this.set({ isActive: !!recentLead }); // Update isActive
//   }
//   next();
// });

// Indexes for performance
channelPartnerSchema.index({ name: 1 });
channelPartnerSchema.index({ phone: 1 });
channelPartnerSchema.index({ mahareraNo: 1 });
channelPartnerSchema.index({ isActive: 1 });

module.exports = mongoose.model('ChannelPartner', channelPartnerSchema);