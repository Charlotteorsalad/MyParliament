const mongoose = require('mongoose');

const adminNotificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'forum_flagged',
      'forum_flagged_reply',
      'forum_pending',
      'forum_user_report',
      'forum_user_report_reply',
      'forum_user_report_topic',
      // Technical support notifications
      'incident_assigned',
      'cr_assigned',
      'maintenance_assigned',
      'incident_edited',
      'cr_edited',
      'maintenance_edited',
      'maintenance_created',
      // Feedback / survey
      'feedback_received',
      'survey_submitted',
      'other'
    ],
    default: 'other'
  },
  // If set, only this admin sees the notification; null = visible to all admins
  targetAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
  title: { type: String, required: true },
  message: { type: String, required: true },
  link: { type: String, default: null },
  meta: {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'ForumPost' },
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'ForumTopic' },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    label: String,
    reportCount: { type: Number, default: 1 },
    reports: [{
      reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: String,
      createdAt: { type: Date, default: Date.now }
    }],
    refId: String,
    refNumber: String
  },
  read: { type: Boolean, default: false },
  readAt: Date,
  readBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' }
}, {
  timestamps: true
});

adminNotificationSchema.index({ read: 1, createdAt: -1 });
adminNotificationSchema.index({ targetAdminId: 1, createdAt: -1 });

module.exports = mongoose.model('AdminNotification', adminNotificationSchema);
