import api from './config';

export const userApi = {
  // Get current user profile with bookmarks
  getProfile: async () => {
    const response = await api.get('/user/me');
    return response.data;
  },

  // Update user profile
  updateProfile: async (profileData) => {
    const response = await api.patch('/user/profile', { profile: profileData });
    return response.data;
  },

  // Toggle bookmark for educational resource
  toggleBookmark: async (eduId) => {
    const response = await api.patch('/user/edubookmark', { eduId });
    return response.data;
  },

  // Get user by ID (if needed for admin purposes)
  getUserById: async (userId) => {
    const response = await api.get(`/user/${userId}`);
    return response.data;
  },
};
