const mongoose = require('mongoose');
const User = require('./models/User');
const Role = require('./models/Role');
const Notification = require('./models/Notification');

async function diagnose() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/deltadb');
    console.log('✅ Connected to MongoDB\n');

    // 1. Check for superadmin users
    console.log('=== CHECKING SUPERADMINS ===');
    const superadminRole = await Role.findOne({ name: 'superadmin' }).lean();
    console.log('Superadmin role found:', superadminRole ? 'YES' : 'NO');

    if (superadminRole) {
      const superadminsByRef = await User.find({
        roleRef: superadminRole._id,
        isActive: true
      }).select('_id name email role').lean();
      console.log('Superadmins (by roleRef):', superadminsByRef.length);
      superadminsByRef.forEach(u => console.log(`  - ${u.name} (${u._id})`));
    }

    const superadminsByRole = await User.find({
      role: 'superadmin',
      isActive: true
    }).select('_id name email role').lean();
    console.log('Superadmins (by role field):', superadminsByRole.length);
    superadminsByRole.forEach(u => console.log(`  - ${u.name} (${u._id})`));

    // 2. Check user 68d64284e659aaf9b87e7e25
    console.log('\n=== CHECKING USER 68d64284e659aaf9b87e7e25 ===');
    const targetUser = await User.findById('68d64284e659aaf9b87e7e25')
      .select('_id name email role roleRef isActive').lean();
    console.log('User found:', targetUser ? 'YES' : 'NO');
    if (targetUser) {
      console.log('User details:', JSON.stringify(targetUser, null, 2));
    }

    // 3. Check total notifications
    console.log('\n=== CHECKING NOTIFICATIONS ===');
    const totalNotifs = await Notification.countDocuments();
    console.log('Total notifications in DB:', totalNotifs);

    // 4. Check recent notifications
    const recentNotifs = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('recipient user type title message createdAt data')
      .lean();
    console.log('\nRecent 5 notifications:');
    recentNotifs.forEach(n => {
      console.log(`  - To: ${n.recipient}, Type: ${n.type}, Title: ${n.title}`);
      console.log(`    Created: ${n.createdAt}`);
      if (n.data?.actorUserId) {
        console.log(`    Actor: ${n.data.actorUserId}`);
      }
    });

    // 5. Check notifications about user 68d64284e659aaf9b87e7e25
    const aboutUser = await Notification.find({
      'data.actorUserId': '68d64284e659aaf9b87e7e25'
    }).countDocuments();
    console.log(`\nNotifications about user 68d64284e659aaf9b87e7e25: ${aboutUser}`);

    // 6. Check notifications TO superadmins
    const allSuperadminIds = [
      ...superadminsByRole.map(u => u._id.toString()),
      ...(superadminRole ? (await User.find({ roleRef: superadminRole._id, isActive: true }).select('_id').lean()).map(u => u._id.toString()) : [])
    ];
    const uniqueSuperadminIds = [...new Set(allSuperadminIds)];

    console.log(`\nUnique superadmin IDs: ${uniqueSuperadminIds.length}`);
    for (const id of uniqueSuperadminIds) {
      const count = await Notification.countDocuments({ recipient: id });
      console.log(`  - Notifications for ${id}: ${count}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

diagnose();