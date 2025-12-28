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
    // Check for admin token
    const adminToken = localStorage.getItem('adminToken');
    console.log('AdminConfig: Request interceptor - Token exists:', !!adminToken);
    console.log('AdminConfig: Request URL:', config.url);
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
      console.log('AdminConfig: Authorization header set');
    } else {
      console.log('AdminConfig: No admin token found');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log('Admin API Error:', error.response?.status, error.message);
    if (error.response?.status === 401) {
      // Only redirect if we're not already on an admin page to avoid loops
      const currentPath = window.location.pathname;
      console.log('401 Error, current path:', currentPath);
      if (!currentPath.startsWith('/admin/login') && !currentPath.startsWith('/admin/dashboard')) {
        console.log('Redirecting to admin login...');
        // Unauthorized - clear admin token and redirect to admin login
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminData');
        window.location.href = '/admin/login';
      } else {
        console.log('Already on admin page, not redirecting');
      }
    }
    return Promise.reject(error);
  }
);

export default adminApi;
