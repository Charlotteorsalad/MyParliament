import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks';
import { useAdminAuth } from '../hooks/useAdminAuth';

const AdminAccessLink = () => {
  const { isAdmin } = useAuth();
  const { isAuthenticated: isAdminAuthenticated } = useAdminAuth();
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');

  // Check if user is admin through either regular auth or admin auth
  const isAdminUser = isAdmin || isAdminAuthenticated;

  if (isAdminUser) {
    return (
      <Link 
        to="/admin/dashboard" 
        className={`text-indigo-50 hover:text-white transition-colors font-medium px-3 py-2 rounded-md hover:bg-indigo-600/20 ${
          isAdminPage 
            ? 'text-white hover:text-green-100' 
            : 'text-indigo-50 hover:text-white'
        }`}
      >
        Admin Dashboard
      </Link>
    );
  }

  return (
    <Link 
      to="/admin/login" 
      className={`text-indigo-50 hover:text-white transition-colors font-medium px-3 py-2 rounded-md hover:bg-indigo-600/20 ${
        isAdminPage 
          ? 'text-green-50 hover:text-white' 
          : 'text-indigo-50 hover:text-white'
      }`}
    >
      Admin Access
    </Link>
  );
};

export default AdminAccessLink;
