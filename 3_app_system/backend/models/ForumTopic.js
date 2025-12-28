const mongoose = require('mongoose');

const forumTopicSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  category: {
    type: String,
    required: true,
    enum: ['policy', 'debate', 'general', 'announcement'],
    default: 'general'
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  posts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumPost'
  }],
  status: {
    type: String,
    enum: ['active', 'locked', 'archived', 'flagged'],
    default: 'active'
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isSticky: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }],
  viewCount: {
    type: Number,
    default: 0
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  moderationFlags: {
    isFlagged: {
      type: Boolean,
      default: false
    },
    flaggedBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      reason: String,
      flaggedAt: {
        type: Date,
        default: Date.now
      }
    }],
    moderationNotes: [{
      moderator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdminUser'
      },
      note: String,
      action: {
        type: String,
        enum: ['reviewed', 'warned', 'locked', 'archived', 'approved']
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    hasSensitiveContent: {
      type: Boolean,
      default: false
    },
    sensitiveContentType: {
      type: String,
      enum: ['profanity', 'hate_speech', 'inappropriate', 'spam', 'other']
    }
  }
}, {
  timestamps: true
});

// Index for better query performance
forumTopicSchema.index({ category: 1, status: 1, createdAt: -1 });
forumTopicSchema.index({ author: 1 });
forumTopicSchema.index({ 'moderationFlags.isFlagged': 1 });
forumTopicSchema.index({ 'moderationFlags.hasSensitiveContent': 1 });

module.exports = mongoose.model('ForumTopic', forumTopicSchema);
