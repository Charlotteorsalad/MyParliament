import { api } from './index';

const topicApi = {
  // Get all topics with optional filtering
  getAll: async (params = {}) => {
    const queryParams = new URLSearchParams();
    
    if (params.category && params.category !== 'All') {
      queryParams.append('category', params.category);
    }
    
    if (params.search) {
      queryParams.append('search', params.search);
    }
    
    if (params.featured !== undefined) {
      queryParams.append('featured', params.featured);
    }
    
    const queryString = queryParams.toString();
    const url = queryString ? `/topics?${queryString}` : '/topics';
    
    return api.get(url);
  },

  // Get topic by ID
  getById: async (id) => {
    return api.get(`/topics/${id}`);
  },

  // Get topic statistics
  getStats: async () => {
    return api.get('/topics/stats');
  },

  // Get categories
  getCategories: async () => {
    return api.get('/topics/categories');
  },

  // Toggle bookmark (requires authentication)
  toggleBookmark: async (id) => {
    return api.post(`/topics/${id}/bookmark`);
  },

  // Admin functions (require admin authentication)
  create: async (topicData) => {
    return api.post('/topics', topicData);
  },

  update: async (id, topicData) => {
    return api.put(`/topics/${id}`, topicData);
  },

  delete: async (id) => {
    return api.delete(`/topics/${id}`);
  }
};

export default topicApi;
