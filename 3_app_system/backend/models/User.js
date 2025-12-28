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
  followedMPs: [mongoose.Schema.Types.ObjectId],
  followedTopics: [mongoose.Schema.Types.ObjectId],
  bookmarks: [mongoose.Schema.Types.ObjectId],
  preferences: {
    preferredTopics: [String],
    displayPreferences: {
      showTrending: Boolean,
      showResponses: Boolean,
      layout: String
    }
  },
  lastLogin: Date,
  isRestricted: { type: Boolean, default: false },
  restrictedSince: Date,
  restrictionEndDate: Date,
  createdAt: Date,
  status: String,
  // Password reset fields
  resetPasswordToken: String,
  resetPasswordExpires: Date,
});

module.exports = mongoose.model("User", userSchema, "User");

