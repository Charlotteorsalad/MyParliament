import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks';
import { useAdminAuth } from '../hooks/useAdminAuth.jsx';

// Protected Route component for users who need to complete profile
export const ProtectedRoute = ({ children, requireCompleteProfile = false }) => {
  const { isAuthenticated, hasCompletedProfile, isProfilePending, user } = useAuth();
  
  console.log('ProtectedRoute check:', { 
    isAuthenticated, 
    hasCompletedProfile, 
    isProfilePending, 
    requireCompleteProfile,
    user: !!user,
    token: !!(localStorage.getItem('token') || sessionStorage.getItem('token'))
  });
  
  if (!isAuthenticated) {
    console.log('Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }
  
  if (requireCompleteProfile && !hasCompletedProfile) {
    console.log('Profile not completed, redirecting to complete-profile');
    return <Navigate to="/complete-profile" replace />;
  }
  
  console.log('Access granted to protected route');
  return children;
};

// Admin Route component for admin-only access
export const AdminRoute = ({ children }) => {
  const { isAuthenticated, loading, admin } = useAdminAuth();
  
  console.log('AdminRoute: isAuthenticated:', isAuthenticated, 'loading:', loading, 'admin:', admin);
  
  // Show loading while checking authentication
  if (loading) {
    console.log('AdminRoute: Showing loading state');
    return (
      <div className="min-h-screen bg-green-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying admin access...</p>
        </div>
      </div>
    );
  }
  
  // Check if user is authenticated as admin
  if (!isAuthenticated || !admin) {
    console.log('AdminRoute: Not authenticated as admin, redirecting to admin login');
    return <Navigate to="/admin/login" replace />;
  }
  
  // Additional security check - ensure admin has active status
  if (admin.status && admin.status !== 'active') {
    console.log('AdminRoute: Admin account not active, redirecting to admin login');
    return <Navigate to="/admin/login" replace />;
  }
  
  console.log('AdminRoute: Authenticated as admin, rendering children');
  return children;
};
