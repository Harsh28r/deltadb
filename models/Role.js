const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, lowercase: true, trim: true },
  level: { type: Number, required: true, min: 1 },
  // Global permissions for this role, used across all projects
  permissions: [{ type: String, trim: true, lowercase: true }],
  createdAt: { type: Date, default: Date.now },
});

// Auto-assign all users to superadmin
roleSchema.post('save', async function(doc) {
  if (doc.name.toLowerCase() === 'superadmin') {
    const User = mongoose.model('User');
    const UserReporting = mongoose.model('UserReporting');
    const superadmin = await User.findOne({ role: doc._id });
    if (!superadmin) return;

    const users = await User.find({ role: { $ne: doc._id } });
    for (const user of users) {
      await UserReporting.findOneAndUpdate(
        { user: user._id },
        {
          $setOnInsert: { user: user._id, level: user.level },
          $addToSet: {
            reportsTo: {
              user: superadmin._id,
              teamType: 'superadmin',
              path: `/${superadmin._id}/`
            }
          }
        },
        { upsert: true }
      );
    }
  }
});

module.exports = mongoose.model('Role', roleSchema);

 