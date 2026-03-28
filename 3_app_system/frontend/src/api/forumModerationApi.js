import api from './config';

const forumModerationApi = {
  // Get all forum topics with filters
  getTopics: (params = {}) => {
    return api.get('/admin/forum-moderation/topics', { params });
  },

  // Get all forum posts with filters
  getPosts: (params = {}) => {
    return api.get('/admin/forum-moderation/posts', { params });
  },

  // Get pending content (awaiting approval)
  getPendingContent: (params = {}) => {
    return api.get('/admin/forum-moderation/pending-content', { params });
  },

  // Get flagged content
  getFlaggedContent: (type = 'both') => {
    return api.get('/admin/forum-moderation/flagged-content', { 
      params: { type } 
    });
  },

  // Moderate a topic
  moderateTopic: (topicId, data) => {
    return api.put(`/admin/forum-moderation/topics/${topicId}/moderate`, data);
  },

  // Moderate a post
  moderatePost: (postId, data) => {
    return api.put(`/admin/forum-moderation/posts/${postId}/moderate`, data);
  },

  // Restrict a user
  restrictUser: (userId, data) => {
    return api.post(`/admin/forum-moderation/users/${userId}/restrict`, data);
  },

  // Get user restrictions
  getRestrictions: (params = {}) => {
    return api.get('/admin/forum-moderation/restrictions', { params });
  },

  // Lift a user restriction
  liftRestriction: (restrictionId, data) => {
    return api.put(`/admin/forum-moderation/restrictions/${restrictionId}/lift`, data);
  },

  // Get moderation statistics
  getStats: () => {
    return api.get('/admin/forum-moderation/stats');
  },

  // Get user escalation reports (posts/topics reported by users)
  getUserEscalations: (params = {}) => {
    return api.get('/admin/forum-moderation/user-escalations', { params });
  },

  // Admin notifications (auto-flagged content)
  getNotifications: (params = {}) => {
    return api.get('/admin/forum-moderation/notifications', { params });
  },
  markNotificationRead: (notificationId) => {
    return api.patch(`/admin/forum-moderation/notifications/${notificationId}/read`);
  },
  markAllNotificationsRead: () => {
    return api.patch('/admin/forum-moderation/notifications/read-all');
  }
};

export { forumModerationApi };
