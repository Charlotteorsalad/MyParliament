const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'login',
      'logout',
      'register',
      'profile_update',
      'password_change',
      'content_view',
      'content_search',
      'mp_follow',
      'mp_unfollow',
      'topic_follow',
      'topic_unfollow',
      'bookmark_add',
      'bookmark_remove',
      'feedback_submit',
      'admin_action',
      'system_event',
      'mp_create',
      'mp_update',
      'mp_delete',
      'mp_status_update',
      'mp_bulk_update',
      'mp_bulk_delete'
    ]
  },
  description: {
    type: String,
    required: true
  },
  details: {
    type: String,
    default: ''
  },
  ipAddress: {
    type: String,
    default: 'Unknown'
  },
  userAgent: {
    type: String,
    default: 'Unknown'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
activityLogSchema.index({ userId: 1, timestamp: -1 });
activityLogSchema.index({ action: 1, timestamp: -1 });
activityLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
