const mongoose = require('mongoose');
const User = require('./User');
const UserReporting = require('./UserReporting');

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  level: { type: Number, required: true, min: 1 },
  permissions: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save to update timestamps
roleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Post-update hook to sync User.level and revalidate UserReporting
roleSchema.post('findOneAndUpdate', async function(doc, next) {
  try {
    if (doc && this.getUpdate().level !== undefined && doc.level !== this.getUpdate().level) {
      console.log(`Role level changed from ${doc.level} to ${this.getUpdate().level} for role ${doc._id}`);
      // Find all users with this role
      const users = await User.find({ roleRef: doc._id });
      console.log(`Found ${users.length} users with role ${doc.name}`);

      // Update User.level and revalidate UserReporting
      for (const user of users) {
        await User.findByIdAndUpdate(user._id, { level: this.getUpdate().level }, { new: true });
        console.log(`Updated level to ${this.getUpdate().level} for user ${user._id}`);
        await revalidateUserReporting(user._id, this.getUpdate().level);
      }
    }
    next();
  } catch (err) {
    console.error('Error in Role post-update:', err.message);
    next(err);
  }
});

// Function to revalidate and fix UserReporting
const revalidateUserReporting = async (userId, newLevel) => {
  try {
    const userReporting = await UserReporting.findOne({ user: userId });
    if (!userReporting) {
      console.log(`No UserReporting found for user ${userId}, creating default`);
      const superadmin = await User.findOne({ role: 'superadmin', level: 1 });
      if (superadmin) {
        const reporting = new UserReporting({
          user: userId,
          reportsTo: [
            {
              user: superadmin._id,
              teamType: 'superadmin',
              path: `/${superadmin._id}/`,
              context: 'Superadmin oversight'
            }
          ],
          level: newLevel
        });
        await reporting.save();
      }
      return;
    }

    userReporting.level = newLevel;
    const invalidRelations = [];

    for (const relation of userReporting.reportsTo) {
      const parent = await User.findById(relation.user);
      if (!parent || parent.level >= newLevel) {
        invalidRelations.push(relation.user);
        console.log(`Invalid parent ${relation.user} for user ${userId}: level ${parent?.level || 'not found'} >= ${newLevel}`);
      }
    }

    // Remove invalid relations or log for manual review
    if (invalidRelations.length > 0) {
      userReporting.reportsTo = userReporting.reportsTo.filter(r => !invalidRelations.includes(r.user));
      console.log(`Removed ${invalidRelations.length} invalid relations for user ${userId}`);
    }

    // Ensure superadmin oversight
    const superadmin = await User.findOne({ role: 'superadmin', level: 1 });
    if (superadmin && newLevel > 1 && !userReporting.reportsTo.some(r => r.user.equals(superadmin._id))) {
      const superadminPath = `/${superadmin._id}/`;
      userReporting.reportsTo.push({
        user: superadmin._id,
        teamType: 'superadmin',
        path: superadminPath,
        context: 'Superadmin oversight'
      });
      console.log(`Added superadmin oversight for user ${userId}`);
    }

    await userReporting.save();
    console.log(`UserReporting revalidated for user ${userId}, level: ${newLevel}`);
  } catch (err) {
    console.error(`Error revalidating UserReporting for user ${userId}:`, err.message);
  }
};

module.exports = mongoose.model('Role', roleSchema);