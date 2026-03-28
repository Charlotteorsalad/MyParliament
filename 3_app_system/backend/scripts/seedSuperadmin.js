/**
 * One-time script: create superadmin account
 * Run from backend folder: node scripts/seedSuperadmin.js
 *
 * Account created:
 *   Email: charlottemyparliamentad@gmail.com
 *   Password: Admin@12345
 *   Role: superadmin
 */
require('dotenv').config();
const mongoose = require('mongoose');
const AdminUser = require('../models/AdminUser');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/myparliament';

const SUPERADMIN = {
  username: 'charlotte_superadmin',
  email: 'charlottemyparliamentad@gmail.com',
  password: 'Admin@12345',
  role: 'superadmin',
  icNumber: '010401070802',
  permissions: [
    'manage_users',
    'manage_content',
    'manage_mps',
    'view_analytics',
    'moderate_forum',
    'manage_support',
  ],
  status: 'active',
  mfaSecret: null,
  mfaEnabled: false,
  resetPasswordToken: null,
  resetPasswordExpire: null,
  lastLogin: null,
  isFirstLogin: true
};

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');

    const existing = await AdminUser.findOne({
      $or: [
        { email: new RegExp(`^${SUPERADMIN.email}$`, 'i') },
        { username: SUPERADMIN.username },
        { icNumber: SUPERADMIN.icNumber }
      ]
    });

    if (existing) {
      console.log('Superadmin already exists:', existing.email);
      existing.password = SUPERADMIN.password;
      existing.role = 'superadmin';
      existing.permissions = SUPERADMIN.permissions;
      existing.status = 'active';
      existing.mfaEnabled = false;
      existing.mfaSecret = null;
      await existing.save();
      console.log('Updated password and role for existing admin.');
    } else {
      await AdminUser.create({
        ...SUPERADMIN,
        password: SUPERADMIN.password
      });
      console.log('Superadmin created:', SUPERADMIN.email);
    }

    console.log('Done. Login at /admin/login with:', SUPERADMIN.email, 'and password:', SUPERADMIN.password);
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
