const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  registrationStatus: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  profile: {
    firstName: String,
    lastName: String,
    BOD: Date,
    state: String,
    constituency: String,
    picture: String
  },
  mfaEnabled: Boolean,
  followedMPs: [String],
  followedTopics: [mongoose.Schema.Types.ObjectId],
  bookmarks: [mongoose.Schema.Types.ObjectId],
  preferences: {
    preferredTopics: [String],
    displayPreferences: {
      showTrending: Boolean,
      showResponses: Boolean,
      layout: String
    },
    notificationPreferences: {
      emailNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
      mpActivities: { type: Boolean, default: true },
      discussionUpdates: { type: Boolean, default: true },
      educationalContent: { type: Boolean, default: false },
      moderationNotices: { type: Boolean, default: true }
    }
  },
  lastLogin: Date,
  isRestricted: { type: Boolean, default: false },
  restrictedSince: Date,
  restrictionEndDate: Date,
  restrictionReason: { type: String, default: '' },
  createdAt: Date,
  status: String,
  // Password reset fields
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  // Push notification subscriptions (browser Web Push)
  pushSubscriptions: [{
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    },
    createdAt: { type: Date, default: Date.now }
  }],
  // User notifications
  notifications: [{
    type: {
      type: String,
      enum: ['moderation', 'restriction', 'approval', 'system'],
      default: 'moderation'
    },
    title: String,
    message: String,
    link: String,
    read: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
});

module.exports = mongoose.model("User", userSchema, "User");

