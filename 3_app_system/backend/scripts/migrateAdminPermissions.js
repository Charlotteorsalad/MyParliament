/**
 * One-time migration: update all AdminUser documents to use the new permission keys.
 * Old: manage_admins, manage_settings, approve_posts, delete_posts, manage_topics
 * New: moderate_forum, manage_support (and keep manage_users, manage_content, manage_mps, view_analytics)
 *
 * Run from backend: node scripts/migrateAdminPermissions.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const AdminUser = require('../models/AdminUser');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/myparliament';

const NEW_PERMISSIONS = [
  'manage_users',
  'manage_content',
  'manage_mps',
  'view_analytics',
  'moderate_forum',
  'manage_support',
];

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected\n');

    const admins = await AdminUser.find({}).select('_id username email role permissions').lean();
    console.log(`Found ${admins.length} admin(s).\n`);

    for (const a of admins) {
      const hadOld =
        (a.permissions && a.permissions.length > 0) &&
        a.permissions.some(
          (p) =>
            ['manage_admins', 'manage_settings', 'approve_posts', 'delete_posts', 'manage_topics'].indexOf(p) !== -1
        );
      const hadNew =
        a.permissions &&
        a.permissions.indexOf('moderate_forum') !== -1 &&
        a.permissions.indexOf('manage_support') !== -1;

      if (hadNew && !hadOld) {
        console.log(`  ${a.username} — already using new permissions, skip`);
        continue;
      }

      await AdminUser.updateOne({ _id: a._id }, { $set: { permissions: NEW_PERMISSIONS } });
      console.log(`  ${a.username} (${a.role}) — updated to new permissions (${NEW_PERMISSIONS.length} items)`);
    }

    console.log('\nDone. All admins now have: manage_users, manage_content, manage_mps, view_analytics, moderate_forum, manage_support.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
    process.exit(0);
  }
}

run();
