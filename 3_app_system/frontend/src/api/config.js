import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add the correct auth token (supports coexistence of admin and user login)
api.interceptors.request.use(
  (config) => {
    const adminToken = localStorage.getItem('adminToken');
    const userToken = localStorage.getItem('token') || localStorage.getItem('tempToken');

    // Determine if this request is intended for admin endpoints
    const isAdminRequest =
      (typeof config.url === 'string' && config.url.startsWith('/admin')) ||
      (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin'));

    const tokenToUse = isAdminRequest ? (adminToken || userToken) : (userToken || adminToken);

    if (tokenToUse) {
      config.headers.Authorization = `Bearer ${tokenToUse}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - check if this is an admin route
      const currentPath = window.location.pathname;
      const isAdminRoute = currentPath.startsWith('/admin');
      
      if (isAdminRoute) {
        // Clear admin tokens and redirect to admin login
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminData');
        window.location.href = '/admin/login';
      } else {
        // Clear regular user tokens and redirect to user login
        localStorage.removeItem('token');
        localStorage.removeItem('tempToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
