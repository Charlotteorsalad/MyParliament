import { useState, useCallback, useEffect } from 'react';
import { authApi } from '../api';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize from storage if a token exists
  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      // Fetch user profile with token to get role information
      fetchUserProfile(token);
    }
  }, []);

  const fetchUserProfile = async (token) => {
    try {
      const response = await authApi.getMe();
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Clear invalid token
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
    }
  };

  const login = useCallback(async (credentials) => {
    try {
      setLoading(true);
      setError(null);
      console.log('User login: Starting login process...');
      const result = await authApi.login(credentials);
      console.log('User login: API response received:', result);

      // Persist token based on remember flag
      if (credentials?.remember) {
        localStorage.setItem('token', result.token);
        sessionStorage.removeItem('token');
        console.log('User login: Token stored in localStorage');
      } else {
        sessionStorage.setItem('token', result.token);
        localStorage.removeItem('token');
        console.log('User login: Token stored in sessionStorage');
      }

      setUser(result.user);
      setToken(result.token);
      console.log('User login: State updated - user:', result.user, 'token:', !!result.token);
      return result;
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (userData) => {
    try {
      setLoading(true);
      setError(null);
      const result = await authApi.register(userData);

      // Store token temporarily for profile completion
      localStorage.setItem('tempToken', result.token);
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');

      setUser(result.user);
      return result;
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Registration failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const completeProfile = useCallback(async (profileData) => {
    try {
      setLoading(true);
      setError(null);
      
      // Get the temp token for profile completion
      const tempToken = localStorage.getItem('tempToken');
      if (!tempToken) {
        throw new Error('No registration token found. Please start registration again.');
      }
      
      const result = await authApi.completeProfile(profileData, tempToken);

      // Replace temp token with final token
      localStorage.removeItem('tempToken');
      localStorage.setItem('token', result.token);
      sessionStorage.removeItem('token');

      // Ensure the user object has the completed status
      const updatedUser = {
        ...result.user,
        registrationStatus: 'completed'
      };
      setUser(updatedUser);
      return result;
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Profile completion failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('tempToken');
    sessionStorage.removeItem('token');
    setUser(null);
    setToken(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const updateProfileStatus = useCallback((status) => {
    if (user) {
      setUser(prev => ({
        ...prev,
        registrationStatus: status
      }));
    }
  }, [user]);

  const [token, setToken] = useState(localStorage.getItem('token') || sessionStorage.getItem('token'));
  const isAuthenticated = !!token || !!user;
  const hasCompletedProfile = user?.registrationStatus === 'completed';
  const isProfilePending = user?.registrationStatus === 'pending';
  const isAdmin = user?.role === 'admin';

  console.log('User Auth state:', { 
    token: !!token, 
    user: !!user, 
    isAuthenticated, 
    hasCompletedProfile,
    adminToken: !!localStorage.getItem('adminToken'),
    userToken: !!localStorage.getItem('token')
  });

  // Update token state when it changes
  useEffect(() => {
    const newToken = localStorage.getItem('token') || sessionStorage.getItem('token');
    setToken(newToken);
  }, [user]);

  // Force re-render when authentication state changes
  useEffect(() => {
    // This will trigger a re-render when user state changes
  }, [user, isAuthenticated]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    hasCompletedProfile,
    isProfilePending,
    isAdmin,
    login,
    register,
    completeProfile,
    logout,
    clearError,
    updateProfileStatus,
  };
};
