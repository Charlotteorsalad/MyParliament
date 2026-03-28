import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth.jsx';
import { adminApi, authApi } from '../../api';
import { forumModerationApi } from '../../api';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useSSEEvent } from '../../contexts/SSEContext';
import AdminUserManagement from './AdminUserManagement';
import UserManagement from './UserManagement';
import AdminEduContentManagement from './AdminEduContentManagement';
import UserMonitoring from './UserMonitoring';
import UserFeedbackManagement from './UserFeedbackManagement';
import SurveyManagement from './SurveyManagement';
import AdminMPManagement from './AdminMPManagement';
import AdminAnalytics from './AdminAnalytics';
import ForumModeration from './ForumModeration';
import TechnicalSupport from './TechnicalSupport';
import LogoutConfirmation from '../../components/settings/LogoutConfirmation';

const VALID_TABS = ['overview', 'users', 'admin-management', 'content', 'mp-management', 'analytics', 'forum-moderation', 'technical-support'];
const VALID_USER_SUBTABS = ['user-list', 'user-monitor', 'user-feedback', 'surveys'];

function hasPermission(admin, permission) {
  if (!admin) return false;
  if (admin.role === 'superadmin') return true;
  return Array.isArray(admin.permissions) && admin.permissions.includes(permission);
}
function hasAnyPermission(admin, permissions) {
  if (!admin) return false;
  if (admin.role === 'superadmin') return true;
  return Array.isArray(admin.permissions) && permissions.some(p => admin.permissions.includes(p));
}

function getInitialTabFromUrl() {
  if (typeof window === 'undefined') return 'overview';
  const tab = new URLSearchParams(window.location.search).get('tab');
  return tab && VALID_TABS.includes(tab) ? tab : 'overview';
}

function getInitialUserSubTabFromUrl() {
  if (typeof window === 'undefined') return 'user-list';
  const sub = new URLSearchParams(window.location.search).get('sub');
  return sub && VALID_USER_SUBTABS.includes(sub) ? sub : 'user-list';
}

const AdminDashboard = () => {
  const { admin, logout, isAuthenticated, loading } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(getInitialTabFromUrl);
  const [activeUserSubTab, setActiveUserSubTab] = useState(getInitialUserSubTabFromUrl);
  const [isManagementDropdownOpen, setIsManagementDropdownOpen] = useState(false);
  const managementButtonRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAdmins: 0,
    totalMps: 0,
    totalEduResources: 0
  });
  const [contentRefreshKey, setContentRefreshKey] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [pinnedTabs, setPinnedTabs] = useState([]);
  const [mfaSetupQr, setMfaSetupQr] = useState(null);
  const [mfaEnableOtp, setMfaEnableOtp] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef(null);
  const notificationButtonRef = useRef(null);
  const notificationDropdownRef = useRef(null);
  const [notificationPosition, setNotificationPosition] = useState({ top: 0, right: 0 });
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobileManagementOpen, setIsMobileManagementOpen] = useState(false);
  const [isMobileOtherOpen, setIsMobileOtherOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDisableMfaModal, setShowDisableMfaModal] = useState(false);

  // Sync tab/sub from URL when search params change (e.g. browser back/forward)
  useEffect(() => {
    const tab = searchParams.get('tab');
    const sub = searchParams.get('sub');
    if (tab && VALID_TABS.includes(tab)) setActiveTab(tab);
    if (sub && VALID_USER_SUBTABS.includes(sub)) setActiveUserSubTab(sub);
  }, [searchParams]);


  // Check authentication
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/admin/login');
    }
  }, [loading, isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
      loadPinnedTabs();
      fetchNotifications();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    // SSE handles real-time bell updates; keep poll as a fallback every 5 min
    const interval = setInterval(fetchNotifications, 300000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Real-time: refresh notification bell and stats when user/admin actions arrive via SSE
  useSSEEvent('forum_activity', () => { fetchNotifications(); fetchStats(); });
  useSSEEvent('feedback_received', () => { fetchStats(); fetchNotifications(); });
  useSSEEvent('user_registered', fetchStats);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const insideButton = notificationsRef.current && notificationsRef.current.contains(event.target);
      const insideDropdown = notificationDropdownRef.current && notificationDropdownRef.current.contains(event.target);
      if (!insideButton && !insideDropdown) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update dropdown position on scroll so it stays under the bell
  useEffect(() => {
    if (!showNotifications || !notificationButtonRef.current) return;
    const updatePosition = () => {
      if (!notificationButtonRef.current) return;
      const rect = notificationButtonRef.current.getBoundingClientRect();
      setNotificationPosition({
        top: rect.bottom + 8,
        right: Math.max(0, window.innerWidth - rect.right - 16)
      });
    };
    updatePosition();
    const handleScroll = () => updatePosition();
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showNotifications]);

  async function fetchNotifications() {
    try {
      const res = await forumModerationApi.getNotifications({ limit: 10, unreadOnly: 'false' });
      setNotifications(res.data.data.notifications || []);
      setUnreadCount(res.data.data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }

  const markAsRead = async (notificationId) => {
    try {
      await forumModerationApi.markNotificationRead(notificationId);
      await fetchNotifications();
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const extractNotificationEntityId = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return value._id || value.id || value.$oid || null;
    return null;
  };

  const getForumModerationDestination = (notification) => {
    const topicId = extractNotificationEntityId(notification?.meta?.topicId);
    const postId = extractNotificationEntityId(notification?.meta?.postId);
    const isUserEscalation = [
      'forum_user_report',
      'forum_user_report_reply',
      'forum_user_report_topic'
    ].includes(notification?.type);

    if (isUserEscalation) {
      return {
        subTab: 'userEscalate',
        targetType: 'escalation',
        targetId: notification?._id
      };
    }

    if (postId) {
      return {
        subTab: 'comments',
        targetType: 'comment',
        targetId: postId
      };
    }

    if (topicId) {
      return {
        subTab: 'topics',
        targetType: 'topic',
        targetId: topicId
      };
    }

    return null;
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification._id);
    }
    setShowNotifications(false);
    const forumDestination = getForumModerationDestination(notification);
    if (forumDestination) {
      setActiveTab('forum-moderation');
      const next = new URLSearchParams(searchParams);
      next.set('tab', 'forum-moderation');
      next.set('fmTargetType', forumDestination.targetType);
      next.set('fmTargetId', String(forumDestination.targetId));
      next.set('fmFlash', 'green');
      setSearchParams(next, { replace: true });
      window.location.hash = forumDestination.subTab;
      return;
    }

    // Technical support notifications → go to technical-support tab
    const supportTypes = ['incident_assigned','cr_assigned','maintenance_assigned','incident_edited','cr_edited','maintenance_edited','maintenance_created'];
    if (supportTypes.includes(notification.type)) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', 'technical-support');
      setActiveTab('technical-support');
      setSearchParams(next, { replace: true });
      return;
    }

    // Feedback notification → go to users > user-feedback
    if (notification.type === 'feedback_received') {
      const next = new URLSearchParams(searchParams);
      next.set('tab', 'users');
      next.set('sub', 'user-feedback');
      setActiveTab('users');
      setSearchParams(next, { replace: true });
      return;
    }

    // Survey notification → go to users > surveys
    if (notification.type === 'survey_submitted') {
      const next = new URLSearchParams(searchParams);
      next.set('tab', 'users');
      next.set('sub', 'surveys');
      setActiveTab('users');
      setSearchParams(next, { replace: true });
      return;
    }

    if (notification.link) {
      const url = new URL(notification.link, window.location.origin);
      const pathname = url.pathname || '';
      const hash = (url.hash || '').replace('#', '');
      const isForumModeration = pathname.includes('forum-moderation') || notification.link.includes('forum-moderation');
      if (isForumModeration) {
        setActiveTab('forum-moderation');
        const subTab = hash === 'flagged' ? 'topics' : (hash && ['userEscalate', 'topics', 'comments', 'restrictions'].includes(hash) ? hash : 'userEscalate');
        window.location.hash = subTab;
      } else {
        navigate(notification.link);
      }
    }
  };

  const markAllAsRead = async () => {
    try {
      await forumModerationApi.markAllNotificationsRead();
      await fetchNotifications();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

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
          className={`w-4 h-4 transition-colors ${pinned ? 'text-green-600' : 'text-gray-400 hover:text-green-600'}`} 
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

  async function fetchStats() {
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
  }

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const updateUrlForTab = (tab, sub = null) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'overview') {
      next.delete('tab');
      next.delete('sub');
    } else {
      next.set('tab', tab);
      if (tab === 'users' && sub) next.set('sub', sub);
      else next.delete('sub');
    }
    setSearchParams(next);
  };

  const handleNavigation = (tab) => {
    setActiveTab(tab);
    setIsMobileNavOpen(false);
    setIsMobileManagementOpen(false);
    setIsMobileOtherOpen(false);
    if (tab === 'users') updateUrlForTab(tab, activeUserSubTab);
    else updateUrlForTab(tab);
  };

  const handleUserSubTabNavigation = (subTab) => {
    setActiveUserSubTab(subTab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'users');
    next.set('sub', subTab);
    setSearchParams(next);
  };

  const handleManagementNavigation = (tab) => {
    setActiveTab(tab);
    setIsManagementDropdownOpen(false);
    setIsMobileNavOpen(false);
    setIsMobileManagementOpen(false);
    setIsMobileOtherOpen(false);
    if (tab === 'users') {
      setActiveUserSubTab('user-list');
      updateUrlForTab(tab, 'user-list');
    } else {
      updateUrlForTab(tab);
    }
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

  // RBAC: tab visibility by role/permissions (superadmin has all)
  const canAccessAdminManagement = admin?.role === 'superadmin';
  const canAccessUserManagement = hasPermission(admin, 'manage_users');
  const canAccessContent = hasPermission(admin, 'manage_content');
  const canAccessMPManagement = hasPermission(admin, 'manage_mps');
  const canAccessAnalytics = hasPermission(admin, 'view_analytics');
  const canAccessForumModeration = hasPermission(admin, 'moderate_forum');
  const canAccessTechnicalSupport = hasPermission(admin, 'manage_support');

  const canAccessTab = (tab) => {
    switch (tab) {
      case 'admin-management': return canAccessAdminManagement;
      case 'users': return canAccessUserManagement;
      case 'content': return canAccessContent;
      case 'mp-management': return canAccessMPManagement;
      case 'analytics': return canAccessAnalytics;
      case 'forum-moderation': return canAccessForumModeration;
      case 'technical-support': return canAccessTechnicalSupport;
      case 'overview': return true;
      default: return false;
    }
  };

  useEffect(() => {
    if (!admin) return;
    if (!canAccessTab(activeTab)) {
      setActiveTab('overview');
      const next = new URLSearchParams(searchParams);
      next.set('tab', 'overview');
      next.delete('sub');
      setSearchParams(next, { replace: true });
    }
  }, [admin, activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-slate-200 border-t-green-600 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-green-400 rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <p className="mt-6 text-slate-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
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
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-w-0 max-w-full overflow-x-hidden" style={{ backgroundColor: '#e0ffe0' }}>
      <LogoutConfirmation
        isOpen={showLogoutConfirm}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          handleLogout();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      {/* Disable MFA Confirmation Modal */}
      {showDisableMfaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDisableMfaModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Disable Two-Factor Authentication</h3>
            </div>
            <p className="text-gray-600 text-sm mb-6">
              Are you sure you want to disable MFA? Your account will be less secure without two-factor authentication.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDisableMfaModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowDisableMfaModal(false);
                  setMfaLoading(true);
                  setMfaError('');
                  try {
                    await authApi.adminMfaDisable();
                    window.location.reload();
                  } catch (e) {
                    setMfaError(e.response?.data?.message || e.message || 'Failed to disable MFA');
                  } finally {
                    setMfaLoading(false);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Disable MFA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Header */}
      <div className="bg-green-600 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full min-w-0">
          <div className="flex items-center py-4 gap-4 flex-wrap min-w-0">
            {/* Left: title only (no logo) */}
            <div className="flex items-start min-w-0">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-white truncate">Admin Dashboard</h1>
                <p className="text-green-100 text-sm truncate">
                  Welcome back, <span className="font-semibold text-white">{admin?.username}</span>
                </p>
              </div>
            </div>
            {/* Right: role + actions — ml-auto pushes it right even when wrapping */}
            <div className="flex items-center space-x-4 min-w-0 ml-auto pl-4">
              <div className="text-right">
                <p className="text-sm text-green-100">Role</p>
                <p className="text-sm font-semibold text-white capitalize">{admin?.role}</p>
              </div>
              {/* Notifications Dropdown */}
              <div className="relative" ref={notificationsRef}>
                <button
                  ref={notificationButtonRef}
                  onClick={() => {
                    if (notificationButtonRef.current) {
                      const rect = notificationButtonRef.current.getBoundingClientRect();
                      setNotificationPosition({
                        top: rect.bottom + 8,
                        right: Math.max(0, window.innerWidth - rect.right - 16)
                      });
                    }
                    setShowNotifications(!showNotifications);
                  }}
                  className="relative p-2 bg-white/20 text-white rounded-lg hover:bg-white/30 border border-white/30 transition-all duration-200"
                  title="Notifications"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-bold bg-red-500 text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              </div>
              {/* Render notification dropdown using Portal to body for highest z-index */}
              {showNotifications && createPortal(
                <>
                  {/* Backdrop to close on click outside */}
                  <div 
                    className="fixed inset-0 z-[9998]" 
                    onClick={() => setShowNotifications(false)}
                  />
                  {/* Dropdown menu - pops out from bell with arrow + animation */}
                  <div 
                    ref={notificationDropdownRef}
                    className="fixed w-96 z-[9999] max-h-[32rem] flex flex-col animate-notification-pop"
                    style={{
                      top: `${notificationPosition.top}px`,
                      right: `${notificationPosition.right}px`
                    }}
                  >
                    {/* Arrow pointing up at the bell */}
                    <div 
                      className="absolute -top-2 right-6 w-4 h-2 flex justify-center"
                      aria-hidden
                    >
                      <div 
                        className="w-0 h-0 border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent border-b-white drop-shadow-[0_-1px_1px_rgba(0,0,0,0.08)]"
                      />
                    </div>
                    <div className="bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col flex-1 min-h-0 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center flex-wrap gap-2">
                      <h3 className="font-semibold text-gray-900">Notifications</h3>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <>
                            <span className="text-xs text-gray-500">{unreadCount} unread</span>
                            <button
                              type="button"
                              onClick={() => markAllAsRead()}
                              className="text-xs font-medium text-green-600 hover:text-green-800"
                            >
                              Mark all as read
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                          <p className="mt-2">No notifications</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif._id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                              !notif.read ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex items-start">
                              <div className="flex-shrink-0">
                                {/* Forum flagged */}
                                {(notif.type === 'forum_flagged' || notif.type === 'forum_flagged_reply') && (
                                  <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                                    <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                  </div>
                                )}
                                {/* Forum user report */}
                                {(notif.type === 'forum_user_report' || notif.type === 'forum_user_report_reply' || notif.type === 'forum_user_report_topic' || notif.type === 'forum_pending') && (
                                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                    <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </div>
                                )}
                                {/* Assigned to you */}
                                {(notif.type === 'incident_assigned' || notif.type === 'cr_assigned' || notif.type === 'maintenance_assigned') && (
                                  <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                    <svg className="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                  </div>
                                )}
                                {/* Edited before in-progress */}
                                {(notif.type === 'incident_edited' || notif.type === 'cr_edited' || notif.type === 'maintenance_edited') && (
                                  <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                                    <svg className="h-4 w-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </div>
                                )}
                                {/* Maintenance created */}
                                {notif.type === 'maintenance_created' && (
                                  <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                                    <svg className="h-4 w-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                  </div>
                                )}
                                {/* Feedback received */}
                                {notif.type === 'feedback_received' && (
                                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                                    <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                    </svg>
                                  </div>
                                )}
                                {/* Survey submitted */}
                                {notif.type === 'survey_submitted' && (
                                  <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                                    <svg className="h-4 w-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                    </svg>
                                  </div>
                                )}
                                {/* Fallback for other/unknown types */}
                                {!['forum_flagged','forum_flagged_reply','forum_user_report','forum_user_report_reply','forum_user_report_topic','forum_pending','incident_assigned','cr_assigned','maintenance_assigned','incident_edited','cr_edited','maintenance_edited','maintenance_created','feedback_received','survey_submitted'].includes(notif.type) && (
                                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                                    <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <div className="ml-3 flex-1">
                                <p className={`text-sm ${!notif.read ? 'font-semibold text-gray-900' : 'text-gray-900'}`}>
                                  {notif.title}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">{notif.message}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {new Date(notif.createdAt).toLocaleString()}
                                </p>
                              </div>
                              <div className="ml-2 flex-shrink-0 flex items-start gap-2">
                                {!notif.read && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        markAsRead(notif._id);
                                      }}
                                      className="text-xs font-medium text-green-600 hover:text-green-800 whitespace-nowrap"
                                    >
                                      Mark as read
                                    </button>
                                    <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5"></div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    </div>
                    </div>
                  </>,
                  document.body
                )}
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="px-6 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 border border-white/30 transition-all duration-200 flex items-center space-x-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
              {/* Mobile nav toggle (hamburger -> X when open, like user side) */}
              <button
                type="button"
                className="xl:hidden inline-flex items-center justify-center p-2 text-white hover:text-green-100 transition-all duration-200"
                onClick={() => setIsMobileNavOpen(prev => !prev)}
                aria-label="Toggle admin navigation"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMobileNavOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Navigation Tabs - only show when xl+ so tabs stay one row; below xl use hamburger */}
      <div className="hidden xl:block bg-[#e0f7f7]/90 backdrop-blur-sm shadow-md border-b border-teal-200 sticky top-16 z-50 overflow-visible">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative w-full min-w-0">
          {/* Desktop / wide-screen navigation tabs - one row, no wrap */}
          <nav className="flex flex-nowrap gap-1 py-3 overflow-x-auto scrollbar-hide overflow-y-visible min-w-0 text-base">
            {/* Overview Tab */}
            <button
              onClick={() => handleNavigation('overview')}
              className={`relative flex items-center space-x-2 py-2.5 px-4 rounded-md font-medium text-sm transition-all duration-200 group whitespace-nowrap ${
                isActiveTab('overview') 
                  ? 'text-teal-700 bg-transparent border-b-2 border-teal-500' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-teal-50'
              }`}
            >
              <div className={`p-1.5 rounded transition-all duration-200 ${
                isActiveTab('overview') 
                  ? 'bg-teal-100' 
                  : 'bg-gray-100 group-hover:bg-teal-100'
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
                    ? 'text-teal-700 bg-transparent border-b-2 border-teal-500' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-teal-50'
                }`}
              >
                <div className={`p-1.5 rounded transition-all duration-200 ${
                  isManagementTab(activeTab)
                    ? 'bg-teal-100' 
                    : 'bg-gray-100 group-hover:bg-teal-100'
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
            {canAccessAnalytics && (
            <button
              onClick={() => handleNavigation('analytics')}
              className={`relative flex items-center space-x-2 py-2.5 px-4 rounded-md font-medium text-sm transition-all duration-200 group whitespace-nowrap ${
                isActiveTab('analytics') 
                  ? 'text-teal-700 bg-transparent border-b-2 border-teal-500' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-teal-50'
              }`}
            >
              <div className={`p-1.5 rounded transition-all duration-200 ${
                isActiveTab('analytics') 
                  ? 'bg-teal-100' 
                  : 'bg-gray-100 group-hover:bg-teal-100'
              }`}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span>Analytic Reports</span>
              <PinButton tabId="analytics" tabName="Analytic Reports" />
            </button>
            )}

            {/* Forum Moderation Tab */}
            {canAccessForumModeration && (
            <button
              onClick={() => handleNavigation('forum-moderation')}
              className={`relative flex items-center space-x-2 py-2.5 px-4 rounded-md font-medium text-sm transition-all duration-200 group whitespace-nowrap ${
                isActiveTab('forum-moderation') 
                  ? 'text-teal-700 bg-transparent border-b-2 border-teal-500' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-teal-50'
              }`}
            >
              <div className={`p-1.5 rounded transition-all duration-200 ${
                isActiveTab('forum-moderation') 
                  ? 'bg-teal-100' 
                  : 'bg-gray-100 group-hover:bg-teal-100'
              }`}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <span>Forum Moderation</span>
              <PinButton tabId="forum-moderation" tabName="Forum Moderation" />
            </button>
            )}

            {/* Technical Support Tab */}
            {canAccessTechnicalSupport && (
            <button
              onClick={() => handleNavigation('technical-support')}
              className={`relative flex items-center space-x-2 py-2.5 px-4 rounded-md font-medium text-sm transition-all duration-200 group whitespace-nowrap ${
                isActiveTab('technical-support') 
                  ? 'text-teal-700 bg-transparent border-b-2 border-teal-500' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-teal-50'
              }`}
            >
              <div className={`p-1.5 rounded transition-all duration-200 ${
                isActiveTab('technical-support') 
                  ? 'bg-teal-100' 
                  : 'bg-gray-100 group-hover:bg-teal-100'
              }`}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span>Technical Support</span>
              <PinButton tabId="technical-support" tabName="Technical Support" />
            </button>
            )}
          </nav>
        </div>
      </div>

      {/* Mobile navigation menu (hamburger dropdown) */}
      {isMobileNavOpen && (
        <div className="xl:hidden bg-white border-t border-teal-200 shadow-md">
          <div className="max-w-7xl mx-auto px-4 py-4 w-full min-w-0">
            <nav className="space-y-2">
              {/* Overview (no submenu) */}
              <button
                type="button"
                onClick={() => handleNavigation('overview')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium ${
                  isActiveTab('overview')
                    ? 'bg-teal-600 text-white'
                    : 'text-gray-800 hover:bg-teal-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-teal-100 text-teal-700">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </span>
                  <span>Overview</span>
                </span>
              </button>

              {/* Management section (collapsible) */}
              <button
                type="button"
                onClick={() => setIsMobileManagementOpen(prev => !prev)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium text-gray-800 hover:bg-teal-50"
              >
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-teal-100 text-teal-700">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    </svg>
                  </span>
                  <span className="tracking-wide uppercase text-[11px] text-gray-600">
                    Management
                  </span>
                </span>
                <svg
                  className={`h-4 w-4 text-gray-500 transform transition-transform ${
                    isMobileManagementOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isMobileManagementOpen && (
                <div className="mt-1 space-y-1 pl-4 border-l border-teal-200">
                  {canAccessAdminManagement && (
                  <button
                    type="button"
                    onClick={() => handleManagementNavigation('admin-management')}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-sm ${
                      isActiveTab('admin-management')
                        ? 'bg-teal-50 text-teal-700 border-l-2 border-teal-500'
                        : 'text-gray-800 hover:bg-teal-50'
                    }`}
                  >
                    Admin Management
                  </button>
                  )}
                  {canAccessUserManagement && (
                  <button
                    type="button"
                    onClick={() => handleManagementNavigation('users')}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-sm ${
                      isActiveTab('users')
                        ? 'bg-teal-50 text-teal-700 border-l-2 border-teal-500'
                        : 'text-gray-800 hover:bg-teal-50'
                    }`}
                  >
                    User Management
                  </button>
                  )}
                  {canAccessContent && (
                  <button
                    type="button"
                    onClick={() => handleManagementNavigation('content')}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-sm ${
                      isActiveTab('content')
                        ? 'bg-teal-50 text-teal-700 border-l-2 border-teal-500'
                        : 'text-gray-800 hover:bg-teal-50'
                    }`}
                  >
                    Content Management
                  </button>
                  )}
                  {canAccessMPManagement && (
                  <button
                    type="button"
                    onClick={() => handleManagementNavigation('mp-management')}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-sm ${
                      isActiveTab('mp-management')
                        ? 'bg-teal-50 text-teal-700 border-l-2 border-teal-500'
                        : 'text-gray-800 hover:bg-teal-50'
                    }`}
                  >
                    MP Management
                  </button>
                  )}
                </div>
              )}

              {/* Other section (collapsible) */}
              <button
                type="button"
                onClick={() => setIsMobileOtherOpen(prev => !prev)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium text-gray-800 hover:bg-teal-50 mt-2"
              >
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-teal-100 text-teal-700">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                    </svg>
                  </span>
                  <span className="tracking-wide uppercase text-[11px] text-gray-600">
                    Other
                  </span>
                </span>
                <svg
                  className={`h-4 w-4 text-gray-500 transform transition-transform ${
                    isMobileOtherOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isMobileOtherOpen && (
                <div className="mt-1 space-y-1 pl-4 border-l border-teal-200">
                  {canAccessAnalytics && (
                  <button
                    type="button"
                    onClick={() => handleNavigation('analytics')}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-sm ${
                      isActiveTab('analytics')
                        ? 'bg-teal-50 text-teal-700 border-l-2 border-teal-500'
                        : 'text-gray-800 hover:bg-teal-50'
                    }`}
                  >
                    Analytic Reports
                  </button>
                  )}
                  {canAccessForumModeration && (
                  <button
                    type="button"
                    onClick={() => handleNavigation('forum-moderation')}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-sm ${
                      isActiveTab('forum-moderation')
                        ? 'bg-teal-50 text-teal-700 border-l-2 border-teal-500'
                        : 'text-gray-800 hover:bg-teal-50'
                    }`}
                  >
                    Forum Moderation
                  </button>
                  )}
                  {canAccessTechnicalSupport && (
                  <button
                    type="button"
                    onClick={() => handleNavigation('technical-support')}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-sm ${
                      isActiveTab('technical-support')
                        ? 'bg-teal-50 text-teal-700 border-l-2 border-teal-500'
                        : 'text-gray-800 hover:bg-teal-50'
                    }`}
                  >
                    Technical Support
                  </button>
                  )}
                </div>
              )}
            </nav>
          </div>
        </div>
      )}

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
            {canAccessAdminManagement && (
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
            )}
            {canAccessUserManagement && (
            <button
              onClick={() => handleManagementNavigation('users')}
              className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                isActiveTab('users') ? 'bg-green-50 text-green-700' : 'text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-3">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>User Management</span>
              </div>
              <PinButton tabId="users" tabName="User Management" module="Management" />
            </button>
            )}
            {canAccessContent && (
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
            )}
            {canAccessMPManagement && (
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
            )}
          </div>
        </>
      )}

      {/* Main Content - full width so MP/User management grid lists use full width */}
      <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-8 relative z-10 min-w-0">
        {/* Conditional Content Rendering */}
        {activeTab === 'overview' && (
          <>
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Users Card */}
          <div className="group relative bg-gradient-to-br from-green-50 to-green-100 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-green-200/60 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-100/80 to-green-200/60"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">{stats.totalUsers.toLocaleString()}</p>
                  <p className="text-sm text-slate-600">Total Users</p>
                </div>
              </div>
              <div className="flex items-center text-sm text-green-600">
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span className="font-medium">Active users</span>
              </div>
            </div>
          </div>

          {/* Total Admins Card */}
          <div className="group relative bg-gradient-to-br from-green-100 to-green-200 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-green-200/60 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-100/80 to-green-200/60"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 bg-gradient-to-br from-green-600 to-green-700 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">{stats.totalAdmins.toLocaleString()}</p>
                  <p className="text-sm text-slate-600">Total Admins</p>
                </div>
              </div>
              <div className="flex items-center text-sm text-green-700">
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">System administrators</span>
              </div>
            </div>
          </div>

          {/* Total MPs Card */}
          <div className="group relative bg-gradient-to-br from-green-50 to-green-100 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-green-200/60 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-100/80 to-green-200/60"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">{stats.totalMps.toLocaleString()}</p>
                  <p className="text-sm text-slate-600">Total MPs</p>
                </div>
              </div>
              <div className="flex items-center text-sm text-green-600">
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="font-medium">Members of Parliament</span>
              </div>
            </div>
          </div>

          {/* Educational Resources Card */}
          <div className="group relative bg-gradient-to-br from-green-50 to-green-100 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-green-200/60 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-100/80 to-green-200/60"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">{stats.totalEduResources.toLocaleString()}</p>
                  <p className="text-sm text-slate-600">Resources</p>
                </div>
              </div>
              <div className="flex items-center text-sm text-green-600">
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
                {pinnedTabs.filter((tab) => canAccessTab(tab.id)).map((tab) => {
                  const getTabIcon = (tabId) => {
                    const iconMap = {
                      'overview': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
                      'analytics': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
                      'forum-moderation': 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
                      'technical-support': 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
                      'admin-management': 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
                      'users': 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
                      'content': 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
                      'mp-management': 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
                      'user-list': 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
                      'user-monitor': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
                      'user-feedback': 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
                      'surveys': 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
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
                      'surveys': 'Create and manage surveys',
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
                          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
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

        {/* Two-Factor Authentication (MFA) */}
        <div className="mt-8 bg-white/80 rounded-lg shadow-sm border border-green-200/60 overflow-hidden">
          <div className="px-6 py-5 border-b border-green-200/60 bg-gradient-to-r from-green-50/50 to-green-100/50">
            <h2 className="text-xl font-bold text-gray-900">Two-Factor Authentication (MFA)</h2>
            <p className="text-gray-600 mt-1">
              {admin?.mfaEnabled ? 'Your account is protected with Google Authenticator.' : 'Add an extra layer of security with Google Authenticator.'}
            </p>
          </div>
          <div className="p-6">
            {mfaError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{mfaError}</div>
            )}
            {admin?.mfaEnabled ? (
              <div className="flex items-center justify-between">
                <span className="text-green-700 font-medium">MFA is enabled</span>
                <button
                  type="button"
                  onClick={() => setShowDisableMfaModal(true)}
                  disabled={mfaLoading}
                  className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md disabled:opacity-50"
                >
                  {mfaLoading ? 'Disabling…' : 'Disable MFA'}
                </button>
              </div>
            ) : mfaSetupQr ? (
              <div>
                <p className="text-gray-700 mb-3">Scan this QR code with Google Authenticator, then enter the 6-digit code below.</p>
                <div className="flex justify-center mb-4">
                  <img src={mfaSetupQr} alt="MFA QR Code" className="w-48 h-48 border border-gray-200 rounded" />
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Verification code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={mfaEnableOtp}
                      onChange={(e) => setMfaEnableOtp(e.target.value.replace(/\D/g, ''))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                      placeholder="000000"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (mfaEnableOtp.length !== 6) { setMfaError('Enter the 6-digit code'); return; }
                      setMfaLoading(true); setMfaError('');
                      try {
                        await authApi.adminMfaEnable(mfaEnableOtp);
                        setMfaSetupQr(null); setMfaEnableOtp('');
                        window.location.reload();
                      } catch (e) {
                        setMfaError(e.response?.data?.message || e.message || 'Invalid code. Try again.');
                      } finally {
                        setMfaLoading(false);
                      }
                    }}
                    disabled={mfaLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
                  >
                    {mfaLoading ? 'Enabling…' : 'Enable MFA'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMfaSetupQr(null); setMfaEnableOtp(''); setMfaError(''); }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  setMfaLoading(true); setMfaError('');
                  try {
                    const res = await authApi.adminMfaSetup();
                    if (res.qrDataUrl) setMfaSetupQr(res.qrDataUrl);
                    else setMfaError('Setup failed');
                  } catch (e) {
                    setMfaError(e.response?.data?.message || e.message || 'Setup failed');
                  } finally {
                    setMfaLoading(false);
                  }
                }}
                disabled={mfaLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
              >
                {mfaLoading ? 'Preparing…' : 'Enable MFA'}
              </button>
            )}
          </div>
        </div>
          </>
        )}

        {/* User Management Tab */}
        {activeTab === 'users' && (
          <div className="min-w-0 max-w-full overflow-x-hidden flex flex-col min-h-0" style={{ maxHeight: 'calc(100vh - 11rem)' }}>
            {/* User Management Sub-tabs */}
            <div className="flex-shrink-0 bg-white/80 rounded-lg shadow-sm border border-green-200/60 mb-4 min-w-0">
              <div className="px-4 sm:px-6 py-6 bg-gradient-to-r from-green-500 to-green-600 rounded-t-lg">
                <div className="flex items-center min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 bg-white/20 rounded-lg flex items-center justify-center mr-3 sm:mr-4">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold text-white truncate">User Management</h2>
                    <p className="text-green-100 mt-1 text-sm sm:text-base break-words">Manage users, monitor activity, and handle feedback</p>
                  </div>
                </div>
              </div>
              <div className="p-4 min-w-0">
                <nav className="flex flex-wrap gap-x-2 gap-y-1">
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
                  <button
                    onClick={() => handleUserSubTabNavigation('surveys')}
                    className={`px-4 py-2 text-sm font-medium transition-all duration-200 relative flex items-center space-x-2 ${
                      isActiveUserSubTab('surveys')
                        ? 'text-green-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span>Surveys</span>
                    <PinButton tabId="surveys" tabName="Surveys" module="User Management" />
                    {isActiveUserSubTab('surveys') && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600"></div>
                    )}
                  </button>
                </nav>
              </div>
            </div>

            {/* User Management Content - scrollable area so scrollbar appears */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {activeUserSubTab === 'user-list' && (
                <div className="min-w-0 max-w-full overflow-x-hidden bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-6">
                  <div className="w-full min-w-0">
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
              {activeUserSubTab === 'user-monitor' && (
                <div className="min-w-0 max-w-full overflow-x-hidden p-4 sm:p-6">
                  <UserMonitoring />
                </div>
              )}
              {activeUserSubTab === 'user-feedback' && <UserFeedbackManagement />}
              {activeUserSubTab === 'surveys' && <SurveyManagement />}
            </div>
          </div>
        )}

        {/* Admin Management Tab */}
        {activeTab === 'admin-management' && (
          <div className="min-h-screen min-w-0 max-w-full overflow-x-hidden bg-gradient-to-br from-slate-50 to-slate-100">
            {/* Header Section - Full Width with rounded corners */}
            <div className="px-4 sm:px-6 py-6 bg-gradient-to-r from-green-500 to-green-600 mb-6 sm:mb-8 rounded-lg">
              <div className="max-w-7xl mx-auto min-w-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center min-w-0 flex-1">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 bg-white/20 rounded-lg flex items-center justify-center mr-3 sm:mr-4">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-xl font-bold text-white truncate">Admin Management</h2>
                      <p className="text-green-100 mt-1 text-sm sm:text-base break-words">Manage admin and superadmin users, roles, and permissions</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const event = new CustomEvent('createAdmin');
                      window.dispatchEvent(event);
                    }}
                    className="flex-shrink-0 px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 border border-white/30 transition-all duration-200 flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Create Admin</span>
                  </button>
                </div>
              </div>
            </div>
            {/* Content Section */}
            <div className="px-4 sm:px-6 min-w-0 max-w-full">
              <div className="max-w-7xl mx-auto min-w-0">
                <AdminUserManagement />
              </div>
            </div>
          </div>
        )}

        {/* Content Management Tab */}
        {activeTab === 'content' && (
          <div className="min-w-0 max-w-full overflow-x-hidden">
            <AdminEduContentManagement onContentChange={() => { fetchStats(); setContentRefreshKey(k => k + 1); }} />
          </div>
        )}

        {/* MP Management Tab - allow horizontal scroll so table (min 900px) and Actions column are not clipped */}
        {activeTab === 'mp-management' && (
          <div className="min-w-0 w-full overflow-x-auto">
            <AdminMPManagement />
          </div>
        )}

        {/* Analytic Reports Tab */}
        {activeTab === 'analytics' && (
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            {/* Header Section - Full Width with rounded corners */}
            <div className="px-6 py-6 bg-gradient-to-r from-green-500 to-green-600 mb-8 rounded-lg">
              <div className="max-w-7xl mx-auto">
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
            {/* Content Section */}
            <div className="px-6">
              <div className="max-w-7xl mx-auto">
                <AdminAnalytics refreshKey={contentRefreshKey} />
              </div>
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
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            {/* Header Section - Full Width with rounded corners */}
            <div className="px-4 sm:px-6 py-5 sm:py-6 bg-gradient-to-r from-green-500 to-green-600 mb-6 sm:mb-8 rounded-lg">
              <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Technical Support & Maintenance</h2>
                    <p className="text-green-100 mt-1">System maintenance, technical support, and troubleshooting tools</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Content Section */}
            <div className="px-3 sm:px-6">
              <div className="max-w-7xl mx-auto">
                <TechnicalSupport 
                  togglePin={togglePin}
                  isPinned={isPinned}
                  PinButton={PinButton}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;