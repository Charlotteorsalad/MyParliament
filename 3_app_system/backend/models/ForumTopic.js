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
    // Allow longer body text; UI will truncate to 200 chars for preview
    maxlength: 3000
  },
  category: {
    type: String,
    required: true,
    trim: true,
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
    enum: ['active', 'archived', 'flagged'],
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
  linkedTopic: {
    type: String,
    trim: true,
    maxlength: 300,
    default: ''
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
        enum: [
          'reviewed',
          'warned',
          'archived',
          'approved',
          'approve',
          'restrict',
          'flag',
          'mark_sensitive'
        ]
      },
      notifyUser: {
        type: Boolean,
        default: false
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
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      return ret;
    }
  }
});

// Index for better query performance
forumTopicSchema.index({ category: 1, status: 1, createdAt: -1 });
forumTopicSchema.index({ author: 1 });
forumTopicSchema.index({ 'moderationFlags.isFlagged': 1 });
forumTopicSchema.index({ 'moderationFlags.hasSensitiveContent': 1 });

module.exports = mongoose.model('ForumTopic', forumTopicSchema);
