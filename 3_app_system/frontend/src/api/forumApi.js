import api from './config';

export const forumApi = {
  // Get all forum topics with pagination and filtering
  getAllTopics: async (params = {}) => {
    const response = await api.get('/forum/topics', { params });
    return response.data;
  },

  // Get single topic with posts
  getTopicById: async (topicId) => {
    const response = await api.get(`/forum/topics/${topicId}`);
    return response.data;
  },

  // Create new topic
  createTopic: async (topicData) => {
    const response = await api.post('/forum/topics', topicData);
    return response.data;
  },

  // Update topic
  updateTopic: async (topicId, topicData) => {
    const response = await api.put(`/forum/topics/${topicId}`, topicData);
    return response.data;
  },

  // Delete topic
  deleteTopic: async (topicId) => {
    const response = await api.delete(`/forum/topics/${topicId}`);
    return response.data;
  },

  // Get posts for a topic
  getTopicPosts: async (topicId, params = {}) => {
    const response = await api.get(`/forum/topics/${topicId}/posts`, { params });
    return response.data;
  },

  // Create new post in topic
  createPost: async (topicId, postData) => {
    const response = await api.post(`/forum/topics/${topicId}/posts`, postData);
    return response.data;
  },

  // Reply to a post
  replyToPost: async (postId, replyData) => {
    const response = await api.post(`/forum/posts/${postId}/reply`, replyData);
    return response.data;
  },

  // Like/unlike a post
  togglePostLike: async (postId) => {
    const response = await api.post(`/forum/posts/${postId}/like`);
    return response.data;
  },

  // Get user's created topics
  getUserTopics: async (params = {}) => {
    const response = await api.get('/forum/user/topics', { params });
    return response.data;
  },

  // Get forum statistics
  getForumStats: async () => {
    const response = await api.get('/forum/stats');
    return response.data;
  },

  // Search forum
  searchForum: async (query, params = {}) => {
    const response = await api.get('/forum/search', { 
      params: { q: query, ...params } 
    });
    return response.data;
  }
};
