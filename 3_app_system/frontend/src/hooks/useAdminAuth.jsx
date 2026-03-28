import { useState, useEffect, createContext, useContext } from 'react';
import { authApi } from '../api';

// Create Admin Auth Context
const AdminAuthContext = createContext();

// Restore admin from localStorage so refresh doesn't log out before verification
const getStoredAdmin = () => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('adminData') : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const hasStoredToken = () => {
  try {
    return !!(typeof localStorage !== 'undefined' && localStorage.getItem('adminToken'));
  } catch {
    return false;
  }
};

// Admin Auth Provider
export const AdminAuthProvider = ({ children }) => {
  const storedAdmin = getStoredAdmin();
  const hasToken = hasStoredToken();
  const [admin, setAdmin] = useState(storedAdmin);
  const hasStoredCredentials = !!(hasToken && storedAdmin);
  const [loading, setLoading] = useState(hasStoredCredentials);
  const [isAuthenticated, setIsAuthenticated] = useState(hasStoredCredentials);

  // On mount: if we have stored credentials, verify once (catches expired tokens).
  // Also listen for admin:logout events fired by Axios interceptors on 401.
  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken');
    const adminData = localStorage.getItem('adminData');
    if (!adminToken || !adminData) {
      clearAdminAuth();
    } else {
      checkAdminAuth().finally(() => setLoading(false));
    }

    const handleForceLogout = () => clearAdminAuth();
    window.addEventListener('admin:logout', handleForceLogout);
    return () => window.removeEventListener('admin:logout', handleForceLogout);
  }, []);

  const checkAdminAuth = async () => {
    const adminToken = localStorage.getItem('adminToken');
    const adminData = localStorage.getItem('adminData');
    if (!adminToken || !adminData) {
      clearAdminAuth();
      return;
    }
    try {
      const response = await authApi.getAdminProfile();
      if (response.success && response.admin) {
        setAdmin(response.admin);
        setIsAuthenticated(true);
        localStorage.setItem('adminData', JSON.stringify(response.admin));
      } else {
        clearAdminAuth();
      }
    } catch (error) {
      clearAdminAuth();
    }
  };

  const clearAdminAuth = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    setAdmin(null);
    setIsAuthenticated(false);
  };

  const login = async (credentials) => {
    try {
      const response = await authApi.adminLogin(credentials);
      if (response.success) {
        localStorage.setItem('adminToken', response.token);
        localStorage.setItem('adminData', JSON.stringify(response.admin));
        setAdmin(response.admin);
        setIsAuthenticated(true);
        return response;
      }
      throw new Error(response.message || 'Login failed');
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    clearAdminAuth();
  };

  const updateAdminProfile = async (profileData) => {
    try {
      const response = await authApi.updateAdminProfile(profileData);
      if (response.success) {
        setAdmin(response.admin);
        localStorage.setItem('adminData', JSON.stringify(response.admin));
        return response;
      }
      throw new Error(response.message || 'Update failed');
    } catch (error) {
      throw error;
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await authApi.changeAdminPassword(currentPassword, newPassword);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const value = {
    admin,
    isAuthenticated,
    loading,
    login,
    logout,
    updateAdminProfile,
    changePassword,
    checkAdminAuth
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};

// Custom hook to use admin auth
export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

export default useAdminAuth;
