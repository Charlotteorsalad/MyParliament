import api from './config';

export const mpApi = {
  // Get featured MPs with scoring
  getFeatured: async () => {
    const response = await api.get('/mps/featured');
    return response.data;
  },

  // Get MP statistics and distributions
  getStats: async () => {
    const response = await api.get('/mps/stats');
    return response.data;
  },

  // Get MP list with filtering, pagination, and sorting
  getList: async (params = {}) => {
    const response = await api.get('/mps', { params });
    return response.data;
  },

  // Get MP details by ID
  getDetail: async (mpId) => {
    const response = await api.get(`/mps/detail/${mpId}`);
    return response.data;
  },

  // Search MPs by query
  search: async (query, filters = {}) => {
    const params = { q: query, ...filters };
    const response = await api.get('/mps', { params });
    return response.data;
  },
};
