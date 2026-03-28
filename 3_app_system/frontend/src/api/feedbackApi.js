import api from './config';

export const feedbackApi = {
  // Submit new feedback (supports optional file attachments as File objects in feedbackData.attachments)
  submitFeedback: async (feedbackData) => {
    const { attachments, ...fields } = feedbackData;
    const hasFiles = Array.isArray(attachments) && attachments.some((f) => f instanceof File);

    if (hasFiles) {
      const form = new FormData();
      Object.entries(fields).forEach(([key, value]) => {
        if (value != null) form.append(key, value);
      });
      attachments.forEach((file) => {
        if (file instanceof File) form.append('attachments', file);
      });
      const response = await api.post('/feedback', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    }

    const response = await api.post('/feedback', fields);
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
  },

  // Surveys
  getActiveSurveys: async () => {
    const response = await api.get('/surveys/active');
    return response.data;
  },

  submitSurveyResponse: async (surveyId, answers) => {
    const response = await api.post(`/surveys/${surveyId}/respond`, { answers });
    return response.data;
  }
};
