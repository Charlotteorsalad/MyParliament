import React, { useState, useEffect, useRef } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth.jsx';
import { adminApi } from '../../api';
import { useNavigate, useLocation } from 'react-router-dom';
import AdminUserManagement from './AdminUserManagement';
import UserManagement from './UserManagement';
import AdminEduContentManagement from './AdminEduContentManagement';
import UserMonitoring from './UserMonitoring';
import UserFeedbackManagement from './UserFeedbackManagement';
import AdminMPManagement from './AdminMPManagement';
import AdminAnalytics from './AdminAnalytics';
import ForumModeration from './ForumModeration';
import TechnicalSupport from './TechnicalSupport';

const AdminDashboard = () => {
  const { admin, logout, isAuthenticated, loading } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('overview');
  const [activeUserSubTab, setActiveUserSubTab] = useState('user-list');
  const [isManagementDropdownOpen, setIsManagementDropdownOpen] = useState(false);
  const managementButtonRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAdmins: 0,
    totalMps: 0,
    totalEduResources: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [pinnedTabs, setPinnedTabs] = useState([]);

  // Check authentication
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      console.log('AdminDashboard: Not authenticated, redirecting to login');
      navigate('/admin/login');
    }
  }, [loading, isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
      loadPinnedTabs();
    }
  }, [isAuthenticated]);

  // Load pinned tabs from localStorage
  const loadPinnedTabs = () => {
    try {
      const saved = localStorage.getItem('adminPinnedTabs');
      if (saved) {
        setPinnedTabs(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading pinned tabs:', error);
    }
  };

  // Save pinned tabs to localStorage
  const savePinnedTabs = (tabs) => {
    try {
      localStorage.setItem('adminPinnedTabs', JSON.stringify(tabs));
    } catch (error) {
      console.error('Error saving pinned tabs:', error);
    }
  };

  // Toggle pin status for a tab
  const togglePin = (tabId, tabName, module = null) => {
    const tabInfo = { id: tabId, name: tabName, module };
    const isPinned = pinnedTabs.some(tab => tab.id === tabId);
    
    let newPinnedTabs;
    if (isPinned) {
      newPinnedTabs = pinnedTabs.filter(tab => tab.id !== tabId);
    } else {
      newPinnedTabs = [...pinnedTabs, tabInfo];
    }
    
    setPinnedTabs(newPinnedTabs);
    savePinnedTabs(newPinnedTabs);
  };

  // Check if a tab is pinned
  const isPinned = (tabId) => {
    return pinnedTabs.some(tab => tab.id === tabId);
  };

  // PinButton component
  const PinButton = ({ tabId, tabName, module = null, className = "" }) => {
    const pinned = isPinned(tabId);
    
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          togglePin(tabId, tabName, module);
        }}
        className={`p-1 rounded-full hover:bg-gray-200 transition-colors cursor-pointer ${className}`}
        title={pinned ? 'Unpin from Quick Actions' : 'Pin to Quick Actions'}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            togglePin(tabId, tabName, module);
          }
        }}
      >
        <svg 
          className={`w-4 h-4 transition-colors ${pinned ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}`} 
          fill={pinned ? 'currentColor' : 'none'} 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" 
          />
        </svg>
      </div>
    );
  };

  // Handle resize and scroll for dropdown positioning
  useEffect(() => {
    const handleResize = () => {
      if (isManagementDropdownOpen) {
        calculateDropdownPosition();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
    };
  }, [isManagementDropdownOpen]);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const [systemStats, userStats] = await Promise.all([
        adminApi.getSystemStats().catch(err => {
          console.warn('System stats API error:', err);
          return { data: {} };
        }),
        adminApi.getUserStats().catch(err => {
          console.warn('User stats API error:', err);
          return { data: {} };
        })
      ]);
      
      setStats({
        totalUsers: systemStats.data?.totalUsers || 0,
        totalAdmins: systemStats.data?.totalAdmins || 0,
        totalMps: systemStats.data?.totalMps || 0,
        totalEduResources: systemStats.data?.totalEduResources || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStats({
        totalUsers: 0,
        totalAdmins: 0,
        totalMps: 0,
        totalEduResources: 0
      });
    } finally {
      setStatsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const handleNavigation = (tab) => {
    setActiveTab(tab);
  };

  const handleUserSubTabNavigation = (subTab) => {
    setActiveUserSubTab(subTab);
  };

  const handleManagementNavigation = (tab) => {
    setActiveTab(tab);
    setIsManagementDropdownOpen(false);
  };

  const calculateDropdownPosition = () => {
    if (managementButtonRef.current) {
      const rect = managementButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX + (rect.width / 2) - 128 // 128 is half of dropdown width (256px)
      });
    }
  };

  const toggleManagementDropdown = () => {
    if (!isManagementDropdownOpen) {
      calculateDropdownPosition();
    }
    setIsManagementDropdownOpen(!isManagementDropdownOpen);
  };

  const isActiveTab = (tab) => {
    return activeTab === tab;
  };

  const isActiveUserSubTab = (subTab) => {
    return activeUserSubTab === subTab;
  };

  const isManagementTab = (tab) => {
    return ['admin-management', 'users', 'content', 'mp-management'].includes(tab);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-blue-400 rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <p className="mt-6 text-slate-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">Please log in to access the admin dashboard.</p>
          <button
            onClick={() => navigate('/admin/login')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#e0ffe0' }}>
      {/* Modern Header */}
      <div className="bg-green-600 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
                <p className="text-green-100">Welcome back, <span className="font-semibold text-white">{admin?.username}</span></p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-green-100">Role</p>
                <p className="text-sm font-semibold text-white capitalize">{admin?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-6 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 border border-white/30 transition-all duration-200 flex items-center space-x-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Navigation Tabs */}
      <div className="bg-white/90 backdrop-blur-sm shadow-md border-b border-gray-200 sticky top-16 z-50 overflow-visible">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <nav className="flex space-x-1 py-3 overflow-x-auto scrollbar-hide overflow-y-visible">
            {/* Overview Tab */}
            <button
              onClick={() => handleNavigation('overview')}
              className={`relative flex items-center space-x-2 py-2.5 px-4 rounded-md font-medium text-sm transition-all duration-200 group whitespace-nowrap ${
                isActiveTab('overview') 
                  ? 'text-white bg-green-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <div className={`p-1.5 rounded transition-all duration-200 ${
                isActiveTab('overview') 
                  ? 'bg-white/20' 
                  : 'bg-gray-100 group-hover:bg-gray-200'
              }`}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span>Overview</span>
            </button>

            {/* Management Dropdown */}
            <div className="relative management-dropdown">
            <button
                ref={managementButtonRef}
                onClick={toggleManagementDropdown}
                className={`relative flex items-center space-x-2 py-2.5 px-4 rounded-md font-medium text-sm transition-all duration-200 group whitespace-nowrap ${
                  isManagementTab(activeTab)
                    ? 'text-white bg-green-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <div className={`p-1.5 rounded transition-all duration-200 ${
                  isManagementTab(activeTab)
                    ? 'bg-white/20' 
                    : 'bg-gray-100 group-hover:bg-gray-200'
                }`}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span>Management</span>
                <svg className={`h-4 w-4 transition-transform duration-200 ${isManagementDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            </div>

            {/* Analytic Reports Tab */}
            <button
              onClick={() => handleNavigation('analytics')}
              className={`relative flex items-center space-x-2 py-2.5 px-4 rounded-md font-medium text-sm transition-all duration-200 group whitespace-nowrap ${
                isActiveTab('analytics') 
                  ? 'text-white bg-green-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <div className={`p-1.5 rounded transition-all duration-200 ${
                isActiveTab('analytics') 
                  ? 'bg-white/20' 
                  : 'bg-gray-100 group-hover:bg-gray-200'
              }`}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span>Analytic Reports</span>
              <PinButton tabId="analytics" tabName="Analytic Reports" />
            </button>


            {/* Forum Moderation Tab */}
            <button
              onClick={() => handleNavigation('forum-moderation')}
              className={`relative flex items-center space-x-2 py-2.5 px-4 rounded-md font-medium text-sm transition-all duration-200 group whitespace-nowrap ${
                isActiveTab('forum-moderation') 
                  ? 'text-white bg-green-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <div className={`p-1.5 rounded transition-all duration-200 ${
                isActiveTab('forum-moderation') 
                  ? 'bg-white/20' 
                  : 'bg-gray-100 group-hover:bg-gray-200'
              }`}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <span>Forum Moderation</span>
              <PinButton tabId="forum-moderation" tabName="Forum Moderation" />
            </button>

            {/* Technical Support Tab */}
            <button
              onClick={() => handleNavigation('technical-support')}
              className={`relative flex items-center space-x-2 py-2.5 px-4 rounded-md font-medium text-sm transition-all duration-200 group whitespace-nowrap ${
                isActiveTab('technical-support') 
                  ? 'text-white bg-green-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <div className={`p-1.5 rounded transition-all duration-200 ${
                isActiveTab('technical-support') 
                  ? 'bg-white/20' 
                  : 'bg-gray-100 group-hover:bg-gray-200'
              }`}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span>Technical Support</span>
              <PinButton tabId="technical-support" tabName="Technical Support" />
            </button>
          </nav>
        </div>
      </div>

      {/* Management Dropdown Menu - Positioned under Management button */}
      {isManagementDropdownOpen && (
        <>
          {/* Backdrop for click outside */}
          <div 
            className="fixed inset-0 z-[9998]"
            onClick={() => setIsManagementDropdownOpen(false)}
          />
          {/* Dropdown Menu */}
          <div 
            className="fixed w-64 bg-white rounded-lg shadow-2xl border border-gray-200 py-2 z-[9999]"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`
            }}
          >
            <button
              onClick={() => handleManagementNavigation('admin-management')}
              className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                isActiveTab('admin-management') ? 'bg-green-50 text-green-700' : 'text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-3">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Admin Management</span>
              </div>
              <PinButton tabId="admin-management" tabName="Admin Management" module="Management" />
            </button>
            <button
              onClick={() => handleManagementNavigation('users')}
              className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                isActiveTab('users') ? 'bg-green-50 text-green-700' : 'text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-3">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              <span>User Management</span>
              </div>
              <PinButton tabId="users" tabName="User Management" module="Management" />
            </button>
            <button
              onClick={() => handleManagementNavigation('content')}
              className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                isActiveTab('content') ? 'bg-green-50 text-green-700' : 'text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-3">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>Content Management</span>
              </div>
              <PinButton tabId="content" tabName="Content Management" module="Management" />
            </button>
            <button
              onClick={() => handleManagementNavigation('mp-management')}
              className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                isActiveTab('mp-management') ? 'bg-green-50 text-green-700' : 'text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-3">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>MP Management</span>
              </div>
              <PinButton tabId="mp-management" tabName="MP Management" module="Management" />
            </button>
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Conditional Content Rendering */}
        {activeTab === 'overview' && (
          <>
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Users Card */}
          <div className="group relative bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-blue-200/60 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-100/80 to-blue-200/60"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">{stats.totalUsers.toLocaleString()}</p>
                  <p className="text-sm text-slate-600">Total Users</p>
                </div>
              </div>
              <div className="flex items-center text-sm text-blue-600">
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span className="font-medium">Active users</span>
              </div>
            </div>
          </div>

          {/* Total Admins Card */}
          <div className="group relative bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-emerald-200/60 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-100/80 to-emerald-200/60"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">{stats.totalAdmins.toLocaleString()}</p>
                  <p className="text-sm text-slate-600">Total Admins</p>
                </div>
              </div>
              <div className="flex items-center text-sm text-emerald-600">
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">System administrators</span>
              </div>
            </div>
          </div>

          {/* Total MPs Card */}
          <div className="group relative bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-purple-200/60 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-100/80 to-purple-200/60"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">{stats.totalMps.toLocaleString()}</p>
                  <p className="text-sm text-slate-600">Total MPs</p>
                </div>
              </div>
              <div className="flex items-center text-sm text-purple-600">
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="font-medium">Members of Parliament</span>
              </div>
            </div>
          </div>

          {/* Educational Resources Card */}
          <div className="group relative bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-amber-200/60 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-100/80 to-amber-200/60"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">{stats.totalEduResources.toLocaleString()}</p>
                  <p className="text-sm text-slate-600">Resources</p>
                </div>
              </div>
              <div className="flex items-center text-sm text-amber-600">
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="font-medium">Educational content</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Section */}
        <div className="bg-white/80 rounded-lg shadow-sm border border-green-200/60 overflow-hidden">
        <div className="px-6 py-5 border-b border-green-200/60 bg-gradient-to-r from-green-50/50 to-green-100/50">
          <h2 className="text-xl font-bold text-gray-900">Quick Actions</h2>
          <p className="text-gray-600 mt-1">
            {pinnedTabs.length > 0 
              ? `Your pinned tabs (${pinnedTabs.length})` 
              : 'Pin tabs for quick access'
            }
          </p>
        </div>
          <div className="p-6">
            {pinnedTabs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pinnedTabs.map((tab) => {
                  const getTabIcon = (tabId) => {
                    const iconMap = {
                      'overview': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
                      'analytics': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
                      'forum-moderation': 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
                      'technical-support': 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
                      'admin-management': 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
                      'users': 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
                      'content': 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
                      'mp-management': 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
                      'user-list': 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
                      'user-monitor': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
                      'user-feedback': 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
                      'incidents': 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
                      'changes': 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
                      'maintenance': 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
                      'dashboard': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
                      'topics': 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
                      'flagged': 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
                      'restrictions': 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728'
                    };
                    return iconMap[tabId] || 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z';
                  };

                  const getTabDescription = (tabId) => {
                    const descMap = {
                      'overview': 'System overview and statistics',
                      'analytics': 'System analytics and reports',
                      'forum-moderation': 'Moderate forum discussions',
                      'technical-support': 'Technical support and maintenance',
                      'admin-management': 'Manage admin users and roles',
                      'users': 'Manage users and permissions',
                      'content': 'Manage educational content',
                      'mp-management': 'Manage Members of Parliament',
                      'user-list': 'View and manage user list',
                      'user-monitor': 'Monitor user activity',
                      'user-feedback': 'Manage user feedback',
                      'incidents': 'Manage system incidents',
                      'changes': 'Manage change requests',
                      'maintenance': 'Schedule and manage maintenance',
                      'dashboard': 'Technical support dashboard',
                      'topics': 'Manage forum topics',
                      'flagged': 'Review flagged content',
                      'restrictions': 'Manage user restrictions'
                    };
                    return descMap[tabId] || 'Quick access to this section';
                  };

                  const handleTabClick = () => {
                    if (['user-list', 'user-monitor', 'user-feedback'].includes(tab.id)) {
                      handleNavigation('users');
                      handleUserSubTabNavigation(tab.id);
                    } else if (['incidents', 'changes', 'maintenance', 'dashboard'].includes(tab.id)) {
                      handleNavigation('technical-support');
                      // Note: Technical Support component will handle its own tab switching
                    } else if (['overview', 'topics', 'flagged', 'restrictions'].includes(tab.id)) {
                      handleNavigation('forum-moderation');
                      // Note: Forum Moderation component will handle its own tab switching
                    } else {
                      handleNavigation(tab.id);
                    }
                  };

                  return (
              <button
                      key={tab.id}
                      onClick={handleTabClick}
                className="group p-6 bg-green-50 hover:bg-green-100 border border-green-200 hover:border-green-300 rounded-lg transition-all duration-300 text-left hover:shadow-lg"
              >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                  <div className="h-12 w-12 bg-green-500 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getTabIcon(tab.id)} />
                    </svg>
                  </div>
                  <div className="ml-4">
                            <h3 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors">
                              {tab.name}
                              {tab.module && <span className="text-xs text-gray-500 ml-2">({tab.module})</span>}
                            </h3>
                            <p className="text-sm text-gray-600">{getTabDescription(tab.id)}</p>
                  </div>
                </div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePin(tab.id, tab.name, tab.module);
                          }}
                          className="p-1 rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
                          title="Unpin from Quick Actions"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              togglePin(tab.id, tab.name, tab.module);
                            }
                          }}
                        >
                          <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-center text-green-600 text-sm font-medium">
                  <span>View Details</span>
                  <svg className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
                  );
                })}
                  </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No pinned tabs yet</h3>
                <p className="text-gray-600">Click the pin icon on any tab to add it to your Quick Actions</p>
            </div>
            )}
          </div>
        </div>
          </>
        )}

        {/* User Management Tab */}
        {activeTab === 'users' && (
          <div>
            {/* User Management Sub-tabs */}
            <div className="bg-white/80 rounded-lg shadow-sm border border-green-200/60 mb-6">
              <div className="px-6 py-6 bg-gradient-to-r from-green-500 to-green-600 rounded-t-lg">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mr-4">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">User Management</h2>
                    <p className="text-green-100 mt-1">Manage users, monitor activity, and handle feedback</p>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <nav className="flex space-x-2">
                  <button
                    onClick={() => handleUserSubTabNavigation('user-list')}
                    className={`px-4 py-2 text-sm font-medium transition-all duration-200 relative flex items-center space-x-2 ${
                      isActiveUserSubTab('user-list')
                        ? 'text-green-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span>User List</span>
                    <PinButton tabId="user-list" tabName="User List" module="User Management" />
                    {isActiveUserSubTab('user-list') && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600"></div>
                    )}
                  </button>
                  <button
                    onClick={() => handleUserSubTabNavigation('user-monitor')}
                    className={`px-4 py-2 text-sm font-medium transition-all duration-200 relative flex items-center space-x-2 ${
                      isActiveUserSubTab('user-monitor')
                        ? 'text-green-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span>User Monitor</span>
                    <PinButton tabId="user-monitor" tabName="User Monitor" module="User Management" />
                    {isActiveUserSubTab('user-monitor') && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600"></div>
                    )}
                  </button>
                  <button
                    onClick={() => handleUserSubTabNavigation('user-feedback')}
                    className={`px-4 py-2 text-sm font-medium transition-all duration-200 relative flex items-center space-x-2 ${
                      isActiveUserSubTab('user-feedback')
                        ? 'text-green-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span>User Feedback</span>
                    <PinButton tabId="user-feedback" tabName="User Feedback" module="User Management" />
                    {isActiveUserSubTab('user-feedback') && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600"></div>
                    )}
                  </button>
                </nav>
              </div>
            </div>

            {/* User Management Content */}
            {activeUserSubTab === 'user-list' && (
              <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
                <div className="max-w-7xl mx-auto">
                  {/* Header Section */}
                  <div className="mb-8">
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900 mb-2">User List</h1>
                      <p className="text-gray-600 text-lg">View and manage all registered users</p>
                    </div>
                  </div>
                  <UserManagement />
                </div>
              </div>
            )}
            {activeUserSubTab === 'user-monitor' && <UserMonitoring />}
            {activeUserSubTab === 'user-feedback' && <UserFeedbackManagement />}
          </div>
        )}

        {/* Admin Management Tab */}
        {activeTab === 'admin-management' && (
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-7xl mx-auto">
              {/* Header Section */}
              <div className="mb-8">
                <div className="bg-white/80 rounded-lg shadow-sm border border-green-200/60 mb-6">
                  <div className="px-6 py-6 bg-gradient-to-r from-green-500 to-green-600 rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mr-4">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-white">Admin Management</h2>
                          <p className="text-green-100 mt-1">Manage admin and superadmin users, roles, and permissions</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          // This will be handled by the AdminUserManagement component
                          const event = new CustomEvent('createAdmin');
                          window.dispatchEvent(event);
                        }}
                        className="px-6 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 border border-white/30 transition-all duration-200 flex items-center space-x-2"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span>Create Admin</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <AdminUserManagement />
            </div>
          </div>
        )}

        {/* Content Management Tab */}
        {activeTab === 'content' && (
          <AdminEduContentManagement />
        )}

        {/* MP Management Tab */}
        {activeTab === 'mp-management' && (
          <AdminMPManagement />
        )}

        {/* Analytic Reports Tab */}
        {activeTab === 'analytics' && (
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-7xl mx-auto">
              {/* Header Section */}
              <div className="mb-8">
                <div className="bg-white/80 rounded-lg shadow-sm border border-green-200/60 mb-6">
                  <div className="px-6 py-6 bg-gradient-to-r from-green-500 to-green-600 rounded-t-lg">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mr-4">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Analytic Reports</h2>
                        <p className="text-green-100 mt-1">System health, model performance, and comprehensive analytics</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <AdminAnalytics />
            </div>
          </div>
        )}


        {/* Forum Moderation Tab */}
        {activeTab === 'forum-moderation' && (
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="max-w-7xl mx-auto">
              {/* Header Section */}
              <div className="mb-8">
                <div className="bg-white/80 rounded-lg shadow-sm border border-green-200/60 mb-6">
                  <div className="px-6 py-6 bg-gradient-to-r from-green-500 to-green-600 rounded-t-lg">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mr-4">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Policy and Issue Debate Forum Moderation</h2>
                        <p className="text-green-100 mt-1">Manage forum discussions, moderate content, and restrict users for policy violations</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <ForumModeration 
                togglePin={togglePin}
                isPinned={isPinned}
                PinButton={PinButton}
              />
            </div>
          </div>
        )}

        {/* Technical Support Tab */}
        {activeTab === 'technical-support' && (
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-7xl mx-auto">
              {/* Header Section */}
              <div className="mb-8">
                <div className="bg-white/80 rounded-lg shadow-sm border border-green-200/60 mb-6">
                  <div className="px-6 py-6 bg-gradient-to-r from-green-500 to-green-600 rounded-t-lg">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mr-4">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Technical Support & Maintenance</h2>
                        <p className="text-green-100 mt-1">System maintenance, technical support, and troubleshooting tools</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <TechnicalSupport 
                togglePin={togglePin}
                isPinned={isPinned}
                PinButton={PinButton}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;