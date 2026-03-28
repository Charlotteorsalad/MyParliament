import api from './config';

export const reportApi = {
  // Get platform statistics
  getPlatformStats: async () => {
    const response = await api.get('/reports/platform-stats');
    return response.data;
  },

  // Get topic categories report
  // topViewedLimit: optional, for most-viewed-topics detail page (e.g. 20)
  getTopicCategoriesReport: async (period = '30d', topViewedLimit) => {
    const params = { period };
    if (topViewedLimit != null) params.topViewedLimit = topViewedLimit;
    const response = await api.get('/reports/topic-categories', { params });
    return response.data;
  },

  // Get MP performance report
  // mode: 'current' | 'all'
  getMPPerformanceReport: async (limit = 10, mode = 'current') => {
    const response = await api.get('/reports/mp-performance', { 
      params: { limit, mode } 
    });
    return response.data;
  },

  // Get forum statistics
  getForumStats: async () => {
    const response = await api.get('/reports/forum-stats');
    return response.data;
  },

  // Get education statistics
  getEducationStats: async () => {
    const response = await api.get('/reports/education-stats');
    return response.data;
  },

  // Get feedback statistics
  getFeedbackStats: async () => {
    const response = await api.get('/reports/feedback-stats');
    return response.data;
  },

  // Get comprehensive dashboard data
  getDashboardData: async (period = '30d') => {
    const response = await api.get('/reports/dashboard', { params: { period } });
    return response.data;
  },

  // Get user activity report (authenticated)
  getUserActivityReport: async () => {
    const response = await api.get('/reports/user/activity');
    return response.data;
  },

  // Get user reports summary (authenticated)
  getUserReportsSummary: async () => {
    const response = await api.get('/reports/user/summary');
    return response.data;
  },

  // Export report (authenticated)
  exportReport: async (reportType, format = 'json') => {
    const response = await api.get('/reports/export', { 
      params: { reportType, format } 
    });
    return response.data;
  }
};
