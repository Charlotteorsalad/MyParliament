import api from './config';

export const bookmarkApi = {
  // Get user's bookmarks
  getBookmarks: async (params = {}) => {
    const response = await api.get('/bookmarks', { params });
    return response.data;
  },

  // Add bookmark
  addBookmark: async (bookmarkData) => {
    const response = await api.post('/bookmarks', bookmarkData);
    return response.data;
  },

  // Remove bookmark
  removeBookmark: async (bookmarkId) => {
    const response = await api.delete(`/bookmarks/${bookmarkId}`);
    return response.data;
  },

  // Toggle bookmark (add if not exists, remove if exists)
  toggleBookmark: async (bookmarkData) => {
    const response = await api.patch('/bookmarks/toggle', bookmarkData);
    return response.data;
  }
};
