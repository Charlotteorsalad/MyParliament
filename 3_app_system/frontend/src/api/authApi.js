import api from './config';
import adminApiInstance from './adminConfig';

export const authApi = {
  // User login
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  // User registration
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  // Check if user exists
  checkUserExists: async (email) => {
    const response = await api.post('/auth/check-user', { email });
    return response.data;
  },

  // Complete profile (step 2 of registration)
  completeProfile: async (profileData, token) => {
    const response = await api.post('/auth/complete-profile', profileData, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  },

  // Validate token (optional - for checking if user is still authenticated)
  validateToken: async () => {
    const response = await api.get('/auth/validate');
    return response.data;
  },

  // Get current user profile
  getMe: async () => {
    const response = await api.get('/user/me');
    return response.data;
  },

  async forgotPassword(email) {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  async resetPassword(token, newPassword) {
    const response = await api.post('/auth/reset-password', { token, newPassword });
    return response.data;
  },

  // Admin authentication
  adminLogin: async (credentials) => {
    const response = await api.post('/admin-auth/login', credentials);
    return response.data;
  },

  adminRegister: async (adminData) => {
    const response = await api.post('/admin-auth/register', adminData);
    return response.data;
  },

  adminForgotPassword: async (email) => {
    const response = await api.post('/admin-auth/forgot-password', { email });
    return response.data;
  },

  adminResetPassword: async (token, newPassword) => {
    const response = await api.post('/admin-auth/reset-password', { token, newPassword });
    return response.data;
  },

  getAdminProfile: async () => {
    const response = await adminApiInstance.get('/admin-auth/profile');
    return response.data;
  },

  updateAdminProfile: async (profileData) => {
    const response = await adminApiInstance.put('/admin-auth/profile', profileData);
    return response.data;
  },

  changeAdminPassword: async (currentPassword, newPassword) => {
    const response = await adminApiInstance.put('/admin-auth/change-password', { currentPassword, newPassword });
    return response.data;
  },
};
