import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks';
import { useAdminAuth } from '../hooks/useAdminAuth';

const AdminEntryPoint = () => {
  const { isAdmin } = useAuth();
  const { isAuthenticated: isAdminAuthenticated } = useAdminAuth();
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');

  // Only show admin access to users who are already authenticated as admins
  const isAdminUser = isAdmin || isAdminAuthenticated;

  // Don't show on admin pages
  if (isAdminPage) {
    return null;
  }

  // Only show to authenticated admin users
  if (!isAdminUser) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Link 
        to="/admin/dashboard" 
        className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Admin Dashboard
      </Link>
    </div>
  );
};

export default AdminEntryPoint;
