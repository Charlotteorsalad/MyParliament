import adminApiInstance from './adminConfig';

export const adminApi = {
  // User management (regular users)
  getAllUsers: (page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', searchTerm = '', filterStatus = 'all') => {
    let url = `/admin/regular-users?page=${page}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
    if (searchTerm) {
      url += `&search=${encodeURIComponent(searchTerm)}`;
    }
    if (filterStatus && filterStatus !== 'all') {
      url += `&status=${encodeURIComponent(filterStatus)}`;
    }
    return adminApiInstance.get(url);
  },
  
  createUser: (userData) => 
    adminApiInstance.post('/admin/users', userData),
  
  updateUser: (userId, userData) => 
    adminApiInstance.put(`/admin/users/${userId}`, userData),
  
  updateUserRole: (userId, role) => 
    adminApiInstance.patch(`/admin/users/${userId}/role`, { role }),
  
  updateUserStatus: (userId, status) => 
    adminApiInstance.patch(`/admin/users/${userId}/status`, { status }),
  
  deleteUser: (userId) => 
    adminApiInstance.delete(`/admin/users/${userId}`),
  
  bulkUpdateUsers: (userIds, updateData) => 
    adminApiInstance.patch('/admin/users/bulk', { userIds, ...updateData }),
  
  // Admin management (Quick Actions - admin users)
  getAllAdminUsers: (page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', searchTerm = '', filterRole = 'all', filterStatus = 'all') => {
    let url = `/admin/users?page=${page}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
    if (searchTerm) {
      url += `&search=${encodeURIComponent(searchTerm)}`;
    }
    if (filterRole && filterRole !== 'all') {
      url += `&role=${encodeURIComponent(filterRole)}`;
    }
    if (filterStatus && filterStatus !== 'all') {
      url += `&status=${encodeURIComponent(filterStatus)}`;
    }
    return adminApiInstance.get(url);
  },
  
  // Admin management (superadmin only)
  getAllAdmins: () => 
    adminApiInstance.get('/admin/admins'),
  
  createAdmin: (adminData) => 
    adminApiInstance.post('/admin/admins', adminData),
  
  updateAdmin: (adminId, adminData) => 
    adminApiInstance.put(`/admin/admins/${adminId}`, adminData),
  
  deleteAdmin: (adminId) => 
    adminApiInstance.delete(`/admin/admins/${adminId}`),
  
  // Statistics
  getUserStats: () => 
    adminApiInstance.get('/admin/stats/users'),
  
  getSystemStats: () => 
    adminApiInstance.get('/admin/stats/system'),
  
  getMpStats: () => 
    adminApiInstance.get('/admin/stats/mps'),
  
  getEduStats: () => 
    adminApiInstance.get('/admin/stats/education'),

  // Educational Content Management
  getAllEduContent: (params = {}) => 
    adminApiInstance.get('/admin/edu/content', { params }),
  
  getEduContentById: (id) => 
    adminApiInstance.get(`/admin/edu/content/${id}`),
  
  createEduContent: (contentData) => 
    adminApiInstance.post('/admin/edu/content', contentData),
  
  updateEduContent: (id, contentData) => 
    adminApiInstance.put(`/admin/edu/content/${id}`, contentData),
  
  publishEduContent: (id) => 
    adminApiInstance.patch(`/admin/edu/content/${id}/publish`),
  
  archiveEduContent: (id) => 
    adminApiInstance.patch(`/admin/edu/content/${id}/archive`),
  
  deleteEduContent: (id) => 
    adminApiInstance.delete(`/admin/edu/content/${id}`),
  
  uploadAttachment: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return adminApiInstance.post(`/admin/edu/content/${id}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  removeAttachment: (id, attachmentId) => 
    adminApiInstance.delete(`/admin/edu/content/${id}/attachments/${attachmentId}`),
  
  getEduContentStats: () => 
    adminApiInstance.get('/admin/edu/content/stats'),
  
  // Quiz Management
  getAllQuizzes: () => 
    adminApiInstance.get('/admin/edu/quizzes'),
  
  createQuiz: (quizData) => 
    adminApiInstance.post('/admin/edu/quizzes', quizData),
  
  updateQuiz: (id, quizData) => 
    adminApiInstance.put(`/admin/edu/quizzes/${id}`, quizData),
  
  deleteQuiz: (id) => 
    adminApiInstance.delete(`/admin/edu/quizzes/${id}`),
  
  assignQuiz: (contentId, quizId) => 
    adminApiInstance.post(`/admin/edu/content/${contentId}/assign-quiz`, { quizId }),

  // User Monitoring
  searchUsers: (searchTerm) => 
    adminApiInstance.get(`/admin/monitoring/users/search?q=${encodeURIComponent(searchTerm)}`),
  
  getUserActivities: (userId, page = 1, limit = 10) => 
    adminApiInstance.get(`/admin/monitoring/users/${userId}/activities?page=${page}&limit=${limit}`),
  
  restrictUser: (userId, days) => 
    adminApiInstance.post(`/admin/monitoring/users/${userId}/restrict`, { days }),
  
  unrestrictUser: (userId) => 
    adminApiInstance.post(`/admin/monitoring/users/${userId}/unrestrict`),

  // Feedback Management
  getAllFeedback: (params = {}) => 
    adminApiInstance.get('/admin/feedback', { params }),
  
  getFeedbackById: (id) => 
    adminApiInstance.get(`/admin/feedback/${id}`),
  
  updateFeedbackStatus: (id, status) => 
    adminApiInstance.patch(`/admin/feedback/${id}/status`, { status }),
  
  updateFeedbackPriority: (id, priority) => 
    adminApiInstance.patch(`/admin/feedback/${id}/priority`, { priority }),
  
  respondToFeedback: (id, response) => 
    adminApiInstance.post(`/admin/feedback/${id}/respond`, { response }),
  
  deleteFeedback: (id) => 
    adminApiInstance.delete(`/admin/feedback/${id}`),
  
  getFeedbackStats: () => 
    adminApiInstance.get('/admin/feedback/stats'),
  
  bulkUpdateFeedbackStatus: (feedbackIds, status) => 
    adminApiInstance.patch('/admin/feedback/bulk/status', { feedbackIds, status }),

  // MP Management
  getAllMPs: (page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'desc', searchTerm = '', searchField = 'all', filterTerm = '', filterStatus = 'all', filterParty = 'all') => {
    let url = `/admin/mps?page=${page}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
    if (searchTerm) {
      url += `&search=${encodeURIComponent(searchTerm)}`;
    }
    if (searchField && searchField !== 'all') {
      url += `&searchField=${encodeURIComponent(searchField)}`;
    }
    if (filterTerm) {
      url += `&term=${encodeURIComponent(filterTerm)}`;
    }
    if (filterStatus && filterStatus !== 'all') {
      url += `&status=${encodeURIComponent(filterStatus)}`;
    }
    if (filterParty && filterParty !== 'all') {
      url += `&party=${encodeURIComponent(filterParty)}`;
    }
    return adminApiInstance.get(url);
  },

  createMp: (mpData) => 
    adminApiInstance.post('/admin/mps', mpData),

  getMpDetails: (mpId) => 
    adminApiInstance.get(`/admin/mps/${mpId}`),

  updateMp: (mpId, mpData) => 
    adminApiInstance.put(`/admin/mps/${mpId}`, mpData),

  updateMpStatus: (mpId, status) => 
    adminApiInstance.patch(`/admin/mps/${mpId}/status`, { status }),

  deleteMp: (mpId) => 
    adminApiInstance.delete(`/admin/mps/${mpId}`),

  bulkUpdateMPs: (mpIds, updateData) => 
    adminApiInstance.patch('/admin/mps/bulk-update', { mpIds, updates: updateData }),

  bulkDeleteMPs: (mpIds) => 
    adminApiInstance.delete('/admin/mps/bulk-delete', { data: { mpIds } }),

  // Analytics endpoints
  getSystemHealthAnalytics: () => 
    adminApiInstance.get('/admin/analytics/system-health'),

  getModelPerformanceAnalytics: () => 
    adminApiInstance.get('/admin/analytics/model-performance'),

  getContentEngagementAnalytics: () => 
    adminApiInstance.get('/admin/analytics/content-engagement'),

  getUserBehaviourAnalytics: () => 
    adminApiInstance.get('/admin/analytics/user-behaviour'),

  getCiCdAnalytics: () => 
    adminApiInstance.get('/admin/analytics/cicd'),

  getContinuousLearningAnalytics: () => 
    adminApiInstance.get('/admin/analytics/continuous-learning'),

  getCronJobAnalytics: () => 
    adminApiInstance.get('/admin/analytics/cron-jobs'),

  getComprehensiveAnalytics: () => 
    adminApiInstance.get('/admin/analytics/comprehensive'),
  
  // DevOps data management
  createSampleDevOpsData: () => 
    adminApiInstance.post('/admin/devops/create-sample-data'),

  // User Activity Reports - detailed user engagement data
  getUserReportsData: (timeRange = '7days') => 
    adminApiInstance.get(`/admin/user-reports?timeRange=${timeRange}`),

  // ==================== TECHNICAL SUPPORT API ====================
  
  // Incident Management
  getAllIncidents: (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    return adminApiInstance.get(`/admin/technical-support/incidents?${queryParams.toString()}`);
  },

  getIncidentById: (incidentId) => 
    adminApiInstance.get(`/admin/technical-support/incidents/${incidentId}`),

  createIncident: (incidentData) => 
    adminApiInstance.post('/admin/technical-support/incidents', incidentData),

  updateIncident: (incidentId, incidentData) => 
    adminApiInstance.put(`/admin/technical-support/incidents/${incidentId}`, incidentData),

  addWorkNote: (incidentId, noteData) => 
    adminApiInstance.post(`/admin/technical-support/incidents/${incidentId}/notes`, noteData),

  getIncidentStats: () => 
    adminApiInstance.get('/admin/technical-support/incidents/stats'),

  // Change Request Management
  getAllChangeRequests: (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    return adminApiInstance.get(`/admin/technical-support/change-requests?${queryParams.toString()}`);
  },

  getChangeRequestById: (changeRequestId) => 
    adminApiInstance.get(`/admin/technical-support/change-requests/${changeRequestId}`),

  createChangeRequest: (changeRequestData) => 
    adminApiInstance.post('/admin/technical-support/change-requests', changeRequestData),

  updateChangeRequest: (changeRequestId, changeRequestData) => 
    adminApiInstance.put(`/admin/technical-support/change-requests/${changeRequestId}`, changeRequestData),

  updateChangeRequestApproval: (changeRequestId, approvalData) => 
    adminApiInstance.patch(`/admin/technical-support/change-requests/${changeRequestId}/approval`, approvalData),

  getChangeRequestStats: () => 
    adminApiInstance.get('/admin/technical-support/change-requests/stats'),

  // Maintenance Scheduler Management
  getAllMaintenanceTasks: (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    return adminApiInstance.get(`/admin/technical-support/maintenance-tasks?${queryParams.toString()}`);
  },

  getMaintenanceTaskById: (id) => 
    adminApiInstance.get(`/admin/technical-support/maintenance-tasks/${id}`),

  createMaintenanceTask: (maintenanceData) => 
    adminApiInstance.post('/admin/technical-support/maintenance-tasks', maintenanceData),

  updateMaintenanceTask: (id, maintenanceData) => 
    adminApiInstance.put(`/admin/technical-support/maintenance-tasks/${id}`, maintenanceData),

  updateMaintenanceTaskApproval: (id, approvalData) => 
    adminApiInstance.patch(`/admin/technical-support/maintenance-tasks/${id}/approval`, approvalData),

  addMaintenanceWorkNote: (id, noteData) => 
    adminApiInstance.post(`/admin/technical-support/maintenance-tasks/${id}/notes`, noteData),

  getMaintenanceTaskStats: () => 
    adminApiInstance.get('/admin/technical-support/maintenance-tasks/stats'),

  getMaintenanceTasksCalendar: (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return adminApiInstance.get(`/admin/technical-support/maintenance-tasks/calendar?${params.toString()}`);
  },

  // Admin Users for Assignment
  getAdminUsers: () => 
    adminApiInstance.get('/admin/technical-support/admin-users')
};