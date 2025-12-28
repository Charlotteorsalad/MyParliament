import api from './config';

export const feedbackApi = {
  // Submit new feedback
  submitFeedback: async (feedbackData) => {
    const response = await api.post('/feedback', feedbackData);
    return response.data;
  },

  // Get user's own feedback
  getUserFeedback: async (params = {}) => {
    const response = await api.get('/feedback/my', { params });
    return response.data;
  },

  // Get specific feedback by ID
  getFeedbackById: async (feedbackId) => {
    const response = await api.get(`/feedback/${feedbackId}`);
    return response.data;
  }
};
