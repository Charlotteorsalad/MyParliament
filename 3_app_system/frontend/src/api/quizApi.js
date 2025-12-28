import api from './config';

export const quizApi = {
  // Submit quiz answers
  submitQuiz: async (quizData) => {
    const response = await api.post('/quiz/submit', quizData);
    return response.data;
  },

  // Get user's quiz progress
  getQuizProgress: async (params = {}) => {
    const response = await api.get('/quiz/progress', { params });
    return response.data;
  },

  // Get specific quiz results
  getQuizResults: async (quizId) => {
    const response = await api.get(`/quiz/results/${quizId}`);
    return response.data;
  },

  // Get quiz history
  getQuizHistory: async (params = {}) => {
    const response = await api.get('/quiz/history', { params });
    return response.data;
  }
};
