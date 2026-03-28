import { createContext, useContext, useState, useCallback, useEffect, createElement } from 'react';
import { flushSync } from 'react-dom';
import { authApi } from '../api';

// User Auth Context
const AuthContext = createContext(null);

// Provider that holds shared auth state for the whole app
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(() => {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || null;
  });

  const fetchUserProfile = useCallback(async () => {
    try {
      const data = await authApi.getMe();
      setUser(data);
    } catch (err) {
      console.error('Error fetching user profile:', err);
      localStorage.removeItem('token');
      localStorage.removeItem('tempToken');
      sessionStorage.removeItem('token');
      setToken(null);
      setUser(null);
    }
  }, []);

  // On mount, if we already have a token, load the user profile once
  useEffect(() => {
    if (token && !user) {
      fetchUserProfile();
    }
  }, [token, user, fetchUserProfile]);

  const login = useCallback(async (credentials) => {
    try {
      setLoading(true);
      setError(null);
      const result = await authApi.login(credentials);

      if (credentials?.remember) {
        localStorage.setItem('token', result.token);
        sessionStorage.removeItem('token');
      } else {
        sessionStorage.setItem('token', result.token);
        localStorage.removeItem('token');
      }

      // Flush auth state so navigation to /profile sees updated context (avoids blank page)
      flushSync(() => {
        setToken(result.token);
        setUser(result.user);
      });
      // Fetch full profile (with profile.firstName etc.) so Settings and other screens have it
      const fullProfile = await authApi.getMe().catch(() => null);
      if (fullProfile) flushSync(() => setUser(fullProfile));
      // Tell SSEContext to reconnect with the new token
      window.dispatchEvent(new CustomEvent('user:login'));
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

      const tempToken = localStorage.getItem('tempToken');
      if (!tempToken) {
        throw new Error('No registration token found. Please start registration again.');
      }

      const result = await authApi.completeProfile(profileData, tempToken);

      // Replace temp token with final token
      localStorage.removeItem('tempToken');
      localStorage.setItem('token', result.token);
      sessionStorage.removeItem('token');

      setToken(result.token);
      const updatedUser = {
        ...result.user,
        registrationStatus: 'completed',
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
    setToken(null);
    setUser(null);
    setError(null);
  }, []);

  // Listen for user:logout events from Axios interceptors (401 on user endpoints)
  useEffect(() => {
    const handleForceLogout = () => logout();
    window.addEventListener('user:logout', handleForceLogout);
    return () => window.removeEventListener('user:logout', handleForceLogout);
  }, [logout]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const updateProfileStatus = useCallback((status) => {
    if (user) {
      setUser((prev) => ({
        ...prev,
        registrationStatus: status,
      }));
    }
  }, [user]);

  const isAuthenticated = !!token;
  const hasCompletedProfile = user?.registrationStatus === 'completed';
  const isProfilePending = user?.registrationStatus === 'pending';
  const isAdmin = user?.role === 'admin';

  const value = {
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

  // Use createElement instead of JSX so this file stays valid plain JS
  return createElement(AuthContext.Provider, { value }, children);
};

// Hook used throughout the app
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default useAuth;
