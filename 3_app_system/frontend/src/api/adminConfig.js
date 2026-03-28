import axios from 'axios';

// Create axios instance for admin API calls
const adminApi = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add admin auth token
adminApi.interceptors.request.use(
  (config) => {
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Session-check endpoints: only these 401s should trigger logout (avoids logout on
// back/forward when a non-critical request like stats/notifications returns 401).
const SESSION_CHECK_PATHS = ['/admin-auth/profile', '/admin-auth/me'];

// Response interceptor for error handling
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || '';
      const isSessionCheck = SESSION_CHECK_PATHS.some((p) => requestUrl.includes(p));
      const currentPath = window.location.pathname;
      const isLoginOrReset = currentPath.startsWith('/admin/login') || currentPath.startsWith('/admin/reset-password');
      if (isSessionCheck && !isLoginOrReset) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminData');
        window.dispatchEvent(new CustomEvent('admin:logout'));
      }
    }
    return Promise.reject(error);
  }
);

export default adminApi;
