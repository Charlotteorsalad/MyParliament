const ActivityLog = require('../models/ActivityLog');

// Activity logging middleware
const logActivity = (action, description, options = {}) => {
  return async (req, res, next) => {
    // Only log if user is authenticated
    if (req.user && req.user._id) {
      try {
        const activity = new ActivityLog({
          userId: req.user._id,
          action,
          description,
          details: options.details || '',
          ipAddress: req.ip || req.connection.remoteAddress || 'Unknown',
          userAgent: req.get('User-Agent') || 'Unknown',
          metadata: options.metadata || {}
        });

        // Save asynchronously to not block the request
        activity.save().catch(err => {
          console.error('Failed to log activity:', err);
        });
      } catch (err) {
        console.error('Activity logging error:', err);
      }
    }
    next();
  };
};

// Specific activity loggers
const logLogin = () => logActivity('login', 'User logged into the system');
const logLogout = () => logActivity('logout', 'User logged out of the system');
const logProfileUpdate = () => logActivity('profile_update', 'User updated their profile');
const logPasswordChange = () => logActivity('password_change', 'User changed their password');
const logContentView = (contentType) => logActivity('content_view', `User viewed ${contentType}`, {
  details: `Viewed ${contentType} content`
});
const logSearch = (query) => logActivity('content_search', 'User performed a search', {
  details: `Searched for: ${query}`,
  metadata: { searchQuery: query }
});
const logMpFollow = (mpId) => logActivity('mp_follow', 'User followed an MP', {
  details: `Started following MP: ${mpId}`,
  metadata: { mpId }
});
const logMpUnfollow = (mpId) => logActivity('mp_unfollow', 'User unfollowed an MP', {
  details: `Stopped following MP: ${mpId}`,
  metadata: { mpId }
});
const logBookmarkAdd = (contentId) => logActivity('bookmark_add', 'User bookmarked content', {
  details: `Bookmarked content: ${contentId}`,
  metadata: { contentId }
});
const logBookmarkRemove = (contentId) => logActivity('bookmark_remove', 'User removed bookmark', {
  details: `Removed bookmark: ${contentId}`,
  metadata: { contentId }
});
const logFeedbackSubmit = () => logActivity('feedback_submit', 'User submitted feedback');
const logAdminAction = (action, target) => logActivity('admin_action', `Admin performed action: ${action}`, {
  details: `Admin action: ${action} on ${target}`,
  metadata: { adminAction: action, target }
});

module.exports = {
  logActivity,
  logLogin,
  logLogout,
  logProfileUpdate,
  logPasswordChange,
  logContentView,
  logSearch,
  logMpFollow,
  logMpUnfollow,
  logBookmarkAdd,
  logBookmarkRemove,
  logFeedbackSubmit,
  logAdminAction
};
