const mongoose = require('mongoose');

const adminUserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'superadmin'],
    default: 'admin'
  },
  permissions: [{
    type: String,
    enum: [
      'manage_admins',
      'manage_users',
      'manage_content',
      'view_analytics',
      'manage_settings',
      'approve_posts',
      'delete_posts',
      'manage_topics',
      'manage_mps'
    ]
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  mfaSecret: {
    type: String,
    default: null
  },
  mfaEnabled: {
    type: Boolean,
    default: false
  },
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpire: {
    type: Date,
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  },
  isFirstLogin: {
    type: Boolean,
    default: true
  },
  icNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Update the updatedAt field before saving
adminUserSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Indexes are automatically created by unique: true constraints
// No need for explicit index definitions

module.exports = mongoose.model("AdminUser", adminUserSchema, "AdminUser");
