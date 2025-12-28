import api from './config';

export const eduApi = {
  // Get all published educational resources
  getAll: async () => {
    const response = await api.get('/edu');
    return response.data;
  },

  // Get educational resource by ID
  getById: async (eduId) => {
    const response = await api.get(`/edu/${eduId}`);
    return response.data;
  },

  // Get educational resources by status
  getByStatus: async (status) => {
    const response = await api.get(`/edu/status/${status}`);
    return response.data;
  },

  // Search educational resources
  search: async (query, filters = {}) => {
    const params = { q: query, ...filters };
    const response = await api.get('/edu/search', { params });
    return response.data;
  },

  // Get educational resources by category
  getByCategory: async (category) => {
    const response = await api.get(`/edu/category/${category}`);
    return response.data;
  },

  // Get featured educational resources
  getFeatured: async () => {
    const response = await api.get('/edu/featured');
    return response.data;
  },
};
