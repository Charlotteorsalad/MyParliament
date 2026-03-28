import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks';
import { useAdminAuth } from '../hooks/useAdminAuth.jsx';

// Protected Route component for users who need to complete profile
export const ProtectedRoute = ({ children, requireCompleteProfile = false }) => {
  const { isAuthenticated, hasCompletedProfile } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (requireCompleteProfile && !hasCompletedProfile) {
    return <Navigate to="/complete-profile" replace />;
  }
  
  return children;
};

// Admin Route component for admin-only access
export const AdminRoute = ({ children }) => {
  const { isAuthenticated, loading, admin } = useAdminAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-green-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying admin access...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated || !admin) {
    return <Navigate to="/admin/login" replace />;
  }
  
  if (admin.status && admin.status !== 'active') {
    return <Navigate to="/admin/login" replace />;
  }
  
  return children;
};
