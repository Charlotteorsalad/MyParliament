import api from './config';

const forumModerationApi = {
  // Get all forum topics with filters
  getTopics: (params = {}) => {
    return api.get('/admin/forum-moderation/topics', { params });
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
  }
};

export { forumModerationApi };
