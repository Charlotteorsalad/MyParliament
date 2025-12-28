const mongoose = require('mongoose');

const forumPostSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  topic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumTopic',
    required: true
  },
  parentPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumPost',
    default: null
  },
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumPost'
  }],
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    likedAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['active', 'hidden', 'deleted', 'flagged'],
    default: 'active'
  },
  editHistory: [{
    editedAt: {
      type: Date,
      default: Date.now
    },
    previousContent: String,
    editReason: String
  }],
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
        enum: ['reviewed', 'warned', 'hidden', 'deleted', 'approved']
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
forumPostSchema.index({ topic: 1, createdAt: 1 });
forumPostSchema.index({ author: 1 });
forumPostSchema.index({ 'moderationFlags.isFlagged': 1 });
forumPostSchema.index({ 'moderationFlags.hasSensitiveContent': 1 });

module.exports = mongoose.model('ForumPost', forumPostSchema);
