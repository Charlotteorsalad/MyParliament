const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
      'manage_users',    // User List, User Monitor, User Feedback
      'manage_content',  // Educational Content & Quizzes
      'manage_mps',      // MP Management
      'view_analytics',  // Analytics & Reports
      'moderate_forum',  // Forum Moderation (topics, posts, restrictions)
      'manage_support'   // Technical Support (incidents, change requests, maintenance)
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
  timestamps: true,
  versionKey: false  // disable __v (Mongoose version key) – not needed for this app
});

// Hash password before saving (only when password is new or changed)
adminUserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    this.updatedAt = new Date();
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  this.updatedAt = new Date();
  next();
});

// Indexes are automatically created by unique: true constraints
// No need for explicit index definitions

module.exports = mongoose.model("AdminUser", adminUserSchema, "AdminUser");
