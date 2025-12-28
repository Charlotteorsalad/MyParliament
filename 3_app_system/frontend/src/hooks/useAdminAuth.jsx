import { useState, useEffect, createContext, useContext } from 'react';
import { authApi } from '../api';

// Create Admin Auth Context
const AdminAuthContext = createContext();

// Admin Auth Provider
export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAdminAuth();
  }, []);

  const checkAdminAuth = async () => {
    try {
      console.log('AdminAuthProvider: Checking admin auth...');
      const adminToken = localStorage.getItem('adminToken');
      const adminData = localStorage.getItem('adminData');
      
      console.log('AdminAuthProvider: Token exists:', !!adminToken);
      console.log('AdminAuthProvider: Data exists:', !!adminData);

      if (adminToken && adminData) {
        // Verify token is still valid by getting profile
        try {
          console.log('AdminAuthProvider: Verifying token with backend...');
          const response = await authApi.getAdminProfile();
          console.log('AdminAuthProvider: Profile response:', response);
          if (response.success) {
            setAdmin(response.admin);
            setIsAuthenticated(true);
            console.log('AdminAuthProvider: Authentication successful');
          } else {
            console.log('AdminAuthProvider: Profile verification failed');
            clearAdminAuth();
          }
        } catch (error) {
          console.log('AdminAuthProvider: Profile verification error:', error);
          clearAdminAuth();
        }
      } else {
        console.log('AdminAuthProvider: No token or data found');
        clearAdminAuth();
      }
    } catch (error) {
      console.error('AdminAuthProvider: Error checking admin auth:', error);
      clearAdminAuth();
    } finally {
      setLoading(false);
      console.log('AdminAuthProvider: Auth check complete, loading set to false');
    }
  };

  const clearAdminAuth = () => {
    console.log('AdminAuthProvider: Clearing admin auth');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    setAdmin(null);
    setIsAuthenticated(false);
  };

  const login = async (credentials) => {
    try {
      console.log('AdminAuthProvider: Attempting login...');
      const response = await authApi.adminLogin(credentials);
      console.log('AdminAuthProvider: Login response:', response);
      if (response.success) {
        localStorage.setItem('adminToken', response.token);
        localStorage.setItem('adminData', JSON.stringify(response.admin));
        setAdmin(response.admin);
        setIsAuthenticated(true);
        console.log('AdminAuthProvider: Login successful, state updated');
        return response;
      }
      throw new Error(response.message || 'Login failed');
    } catch (error) {
      console.log('AdminAuthProvider: Login error:', error);
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
