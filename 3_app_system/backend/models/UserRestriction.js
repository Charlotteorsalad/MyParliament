const mongoose = require('mongoose');

const userRestrictionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  restrictedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    required: true
  },
  restrictionType: {
    type: String,
    enum: ['forum_ban', 'post_restriction', 'comment_restriction', 'full_restriction'],
    required: true
  },
  reason: {
    type: String,
    required: true,
    maxlength: 500
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  violations: [{
    type: {
      type: String,
      enum: ['inappropriate_content', 'spam', 'harassment', 'hate_speech', 'other']
    },
    description: String,
    evidence: {
      topicId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ForumTopic'
      },
      postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ForumPost'
      },
      content: String
    },
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }],
  appealStatus: {
    hasAppealed: {
      type: Boolean,
      default: false
    },
    appealDate: Date,
    appealReason: String,
    appealResponse: String,
    appealDecision: {
      type: String,
      enum: ['pending', 'approved', 'rejected']
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    }
  },
  notes: [{
    moderator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    note: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Index for better query performance
userRestrictionSchema.index({ user: 1, isActive: 1 });
userRestrictionSchema.index({ endDate: 1, isActive: 1 });
userRestrictionSchema.index({ restrictedBy: 1 });

// Method to check if restriction is still valid
userRestrictionSchema.methods.isCurrentlyRestricted = function() {
  return this.isActive && new Date() < this.endDate;
};

// Static method to find active restrictions for a user
userRestrictionSchema.statics.findActiveRestrictions = function(userId) {
  return this.find({
    user: userId,
    isActive: true,
    endDate: { $gt: new Date() }
  });
};

module.exports = mongoose.model('UserRestriction', userRestrictionSchema);
