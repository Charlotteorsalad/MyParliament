import axios from 'axios';

const getUserToken = () =>
  localStorage.getItem('token') ||
  sessionStorage.getItem('token') ||
  localStorage.getItem('tempToken');

const clearUserAuthStorage = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('tempToken');
  sessionStorage.removeItem('token');
};

// Create axios instance with default config
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 60000, // Increased timeout to 60 seconds for complex queries
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add the correct auth token (supports coexistence of admin and user login)
api.interceptors.request.use(
  (config) => {
    const adminToken = localStorage.getItem('adminToken');
    const userToken = getUserToken();

    // Use request URL only (not window.location) to decide which token to attach.
    // This prevents user-endpoint requests made from admin pages from accidentally
    // picking up the admin token and triggering admin logout on 401.
    const isAdminRequest =
      typeof config.url === 'string' && config.url.startsWith('/admin');

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
    if (error.response?.status === 503 && error.response?.data?.maintenanceMode) {
      clearUserAuthStorage();
      window.dispatchEvent(new CustomEvent('user:logout'));
      window.dispatchEvent(new CustomEvent('maintenance:active', {
        detail: error.response.data
      }));
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || '';
      const isLoginRequest =
        requestUrl.includes('/admin-auth/login') ||
        requestUrl.includes('/auth/login');
      // Don't redirect on 401 from login itself – let the login page show the error
      if (isLoginRequest) {
        return Promise.reject(error);
      }
      // Only clear admin session on 401 from session-check endpoints (same as adminConfig),
      // so back/forward or stats/notifications 401s don't log admin out.
      const adminSessionPaths = ['/admin-auth/profile', '/admin-auth/me'];
      const isAdminSessionRequest = requestUrl.startsWith('/admin') && adminSessionPaths.some((p) => requestUrl.includes(p));
      const isSuspended = error.response?.data?.code === 'ACCOUNT_SUSPENDED';
      if (isAdminSessionRequest) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminData');
        window.dispatchEvent(new CustomEvent('admin:logout'));
      } else if (isSuspended) {
        clearUserAuthStorage();
        // Only show suspended modal and redirect when not on admin page (same browser can have admin + user)
        const onAdminPage = typeof window !== 'undefined' && window.location?.pathname?.startsWith('/admin');
        if (!onAdminPage) {
          window.dispatchEvent(new CustomEvent('user:suspended'));
        } else {
          window.dispatchEvent(new CustomEvent('user:logout'));
        }
      } else {
        clearUserAuthStorage();
        window.dispatchEvent(new CustomEvent('user:logout'));
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Public: check if maintenance is active – no auth token needed.
// Returns { type, title, message, startTime, endTime } or null.
export const fetchActiveNotice = async () => {
  try {
    const res = await api.get('/admin/technical-support/active-maintenance');
    return res.data?.active || null;
  } catch {
    return null;
  }
};
