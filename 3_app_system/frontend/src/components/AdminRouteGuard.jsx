import React, { useEffect } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';

// Admin Route Guard - Additional security layer
const AdminRouteGuard = ({ children }) => {
  const { isAuthenticated, loading, admin } = useAdminAuth();
  const location = useLocation();

  useEffect(() => {
    // Log access attempts for security monitoring
    console.log('AdminRouteGuard: Access attempt to:', location.pathname);
    console.log('AdminRouteGuard: Auth status:', { isAuthenticated, loading, admin: !!admin });
  }, [location.pathname, isAuthenticated, loading, admin]);

  // Show loading while checking authentication
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

  // Check if user is authenticated as admin
  if (!isAuthenticated || !admin) {
    console.warn('AdminRouteGuard: Unauthorized access attempt to admin route:', location.pathname);
    return <Navigate to="/admin/login" replace />;
  }

  // Additional security check - ensure admin has active status
  if (admin.status && admin.status !== 'active') {
    console.warn('AdminRouteGuard: Inactive admin account attempting access:', location.pathname);
    return <Navigate to="/admin/login" replace />;
  }

  // Check if admin has necessary permissions (if permissions are implemented)
  if (admin.role && admin.role === 'disabled') {
    console.warn('AdminRouteGuard: Disabled admin account attempting access:', location.pathname);
    return <Navigate to="/admin/login" replace />;
  }

  // All security checks passed
  return children;
};

export default AdminRouteGuard;
