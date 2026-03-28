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

  // Explicit unbookmark helper (same endpoint, for clarity)
  unbookmarkEduContent: async (eduId) => {
    const response = await api.patch('/user/edubookmark', { eduId });
    return response.data;
  },

  // Get user by ID (if needed for admin purposes)
  getUserById: async (userId) => {
    const response = await api.get(`/user/${userId}`);
    return response.data;
  },

  followMP: async (mpId) => {
    const response = await api.patch('/user/followmp', { mpId });
    return response.data;
  },

  unfollowMP: async (mpId) => {
    const response = await api.patch('/user/unfollowmp', { mpId });
    return response.data;
  },

  followTopic: async (topicId) => {
    const response = await api.patch('/user/followtopic', { topicId });
    return response.data;
  },

  unfollowTopic: async (topicId) => {
    const response = await api.patch('/user/unfollowtopic', { topicId });
    return response.data;
  },

  // Get personal activity feed
  getMyActivities: async () => {
    const response = await api.get('/user/activities');
    return response.data;
  },

  // Get viewed and quiz-completed edu resource IDs (for badges on Edu content cards)
  getEduActivity: async () => {
    const response = await api.get('/user/edu-activity');
    return response.data;
  },

  // Notification preferences (saved in User.preferences.notificationPreferences)
  updateNotificationPreferences: async (prefs) => {
    const response = await api.patch('/user/notification-preferences', prefs);
    return response.data;
  },

  // Mark one user notification as read
  markNotificationRead: async (notificationId) => {
    await api.patch(`/user/notifications/${notificationId}/read`);
  },

  // Mark all user notifications as read
  markAllNotificationsRead: async () => {
    await api.patch('/user/notifications/read-all');
  },

  // Web Push: get VAPID public key (for browser subscribe)
  getVapidPublicKey: async () => {
    const response = await api.get('/user/push-vapid-public');
    return response.data?.publicKey ?? null;
  },

  // Save push subscription to backend
  savePushSubscription: async (subscription) => {
    const response = await api.post('/user/push-subscription', { subscription });
    return response.data;
  },

  // Remove push subscription
  removePushSubscription: async (endpoint) => {
    await api.delete('/user/push-subscription', { data: { endpoint } });
  },

  // Log a view event (type: 'edu' | 'mp' | 'issue' | 'forum')
  logView: async (type, resourceId, title) => {
    try {
      await api.post('/user/log-view', { type, resourceId, title });
    } catch {
      // silent fail — logging should never break UX
    }
  },
};
