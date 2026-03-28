import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate, Navigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import LoginPage from "./pages/auth/LoginPage";
import UserRegisterPage from "./pages/auth/UserRegisterPage";
import CompleteProfilePage from "./pages/user/CompleteProfilePage";
import UserDashboard from "./pages/user/UserDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminUserManagement from "./pages/admin/AdminUserManagement";
import HomePage from "./pages/public/HomePage";
import EduContentPage from "./pages/public/EduContentPage";
import EduDetailPage from "./pages/public/EduDetailPage";
import TopicDetailPage from "./pages/public/TopicDetailPage";
import MpDashboard from "./pages/public/MpDashboard.jsx";
import DiscussionForumPage from "./pages/public/DiscussionForumPage";
import ReplyDiscussionPage from "./pages/user/ReplyDiscussionPage";
import DeleteDiscussionPage from "./pages/user/DeleteDiscussionPage";
import FeedbackPage from "./pages/user/FeedbackPage";
import ReportModule from "./pages/user/ReportModule.jsx";
import BookmarkCollectionReport from "./pages/user/BookmarkCollectionReport";
import MPPerformanceReport from "./pages/user/MPPerformanceReport";
import TopicCategoriesReport from "./pages/public/TopicCategoriesReport";
import MostViewedTopicsReport from "./pages/public/MostViewedTopicsReport";
import IssuePortal from "./pages/public/IssuePortal";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import AdminResetPasswordPage from "./pages/admin/AdminResetPasswordPage";
import { useAuth } from "./hooks";
import { AuthProvider } from "./hooks/useAuth";
import { AdminAuthProvider } from "./hooks/useAdminAuth.jsx";
import { ProtectedRoute, AdminRoute } from "./components/ProtectedRoute";
import AdminAccessLink from "./components/AdminAccessLink";
import AdminEntryPoint from "./components/AdminEntryPoint";
import AdminRouteGuard from "./components/AdminRouteGuard";
import MaintenanceBanner from "./components/MaintenanceBanner";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";
import { PinProvider, usePin } from "./contexts/PinContext";
import { SettingsProvider, useSettings } from "./contexts/SettingsContext";
import { SSEProvider } from "./contexts/SSEContext";
import SettingsModal from "./components/SettingsModal";
import { userApi } from "./api/userApi";
import { useSSEEvent } from "./contexts/SSEContext";
import "./utils/grammarlyDisable";

const SCROLL_THRESHOLD = 400;

// Global: scroll to top and restore body scroll on every route change (user + admin)
function ScrollToTopOnRouteChange() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    // Restore scroll: remove modal-open and inline overflow so scrollbar returns on all pages
    document.body.classList.remove("modal-open");
    document.documentElement.classList.remove("modal-open");
    document.body.style.overflow = "";
  }, [pathname]);

  return null;
}

function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SCROLL_THRESHOLD);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={scrollToTop}
      className="fixed bottom-20 right-6 z-[100] flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 print:hidden"
      aria-label="Back to top"
    >
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    </button>
  );
}

// Component to conditionally render header
function ConditionalHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();
  const { openSettingsModal } = useSettings();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserNotifications, setShowUserNotifications] = useState(false);
  const [userNotifications, setUserNotifications] = useState([]);
  const [userNotificationPosition, setUserNotificationPosition] = useState({ top: 0, right: 0 });
  const userNotificationButtonRef = useRef(null);
  const userNotificationMobileRef = useRef(null);
  const userNotificationDropdownRef = useRef(null);
  const { PinButton } = usePin();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const isAdminPage = location.pathname.startsWith('/admin');
  const isAdminLoginPage = location.pathname === '/admin/login';
  const isAdminDashboardPage = isAdminPage && !isAdminLoginPage; // Admin pages except login
  const isProfilePage = location.pathname === '/profile';

  const handleUserClick = () => {
    if (isAuthenticated) {
      navigate("/profile");
    } else {
      navigate("/login");
    }
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const fetchUserNotifications = async () => {
    if (!isAuthenticated) return;
    try {
      const profile = await userApi.getProfile();
      const list = profile.notifications || [];
      setUserNotifications(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('[Header] fetch user notifications failed:', err);
      setUserNotifications([]);
    }
  };

  const markUserNotificationRead = async (notifId) => {
    try {
      await userApi.markNotificationRead(notifId);
      await fetchUserNotifications();
    } catch (e) {
      console.warn('Mark read failed:', e);
    }
  };

  const markAllUserNotificationsRead = async () => {
    try {
      await userApi.markAllNotificationsRead();
      await fetchUserNotifications();
    } catch (e) {
      console.warn('Mark all read failed:', e);
    }
  };

  // Real-time: refresh bell on any notification-related SSE event
  useSSEEvent('notification', () => {
    if (isAuthenticated) fetchUserNotifications();
  });
  useSSEEvent('feedback_reply', () => {
    if (isAuthenticated) fetchUserNotifications();
  });

  // All hooks must run unconditionally (before any early return) to satisfy Rules of Hooks
  useEffect(() => {
    if (isAuthenticated) fetchUserNotifications();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    // SSE handles real-time updates; this is a fallback in case SSE disconnects
    const interval = setInterval(fetchUserNotifications, 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!showUserNotifications) return;
    fetchUserNotifications();
  }, [showUserNotifications]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const btnDesktop = userNotificationButtonRef.current;
      const btnMobile = userNotificationMobileRef.current;
      const drop = userNotificationDropdownRef.current;
      if (
        btnDesktop?.contains(e.target) ||
        btnMobile?.contains(e.target) ||
        drop?.contains(e.target)
      ) return;
      setShowUserNotifications(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const activeRef = userNotificationButtonRef.current?.offsetParent
      ? userNotificationButtonRef.current
      : userNotificationMobileRef.current;
    if (!showUserNotifications || !activeRef) return;
    const update = () => {
      const ref = userNotificationButtonRef.current?.offsetParent
        ? userNotificationButtonRef.current
        : userNotificationMobileRef.current;
      if (!ref) return;
      const rect = ref.getBoundingClientRect();
      setUserNotificationPosition({
        top: rect.bottom + 8,
        right: Math.max(0, window.innerWidth - rect.right - 16)
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [showUserNotifications]);

  if (isAuthPage) {
    return null; // Don't show header on auth pages
  }

  if (isAdminDashboardPage) {
    return null; // Don't show header on admin dashboard pages
  }

  // Show admin header for admin login page
  if (isAdminLoginPage) {
    return (
      <header className="bg-gradient-to-r from-green-600 to-green-700 shadow-sm sticky top-0 z-50 print:hidden">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <Link to="/" className="text-lg font-semibold text-white hover:text-green-100 transition-colors">
              MY Parliament
            </Link>

            {/* Admin Login Header - Simple and clean */}
            <div className="text-green-50 text-sm font-medium">
              {t('adminAccess')}
            </div>
          </div>
        </div>
      </header>
    );
  }

  const handleUserNotificationClick = async (notif) => {
    if (!notif.read && notif._id) {
      await markUserNotificationRead(notif._id);
    }
    setShowUserNotifications(false);
    if (notif.link) {
      const path = notif.link.startsWith('http') ? notif.link : notif.link.startsWith('/') ? notif.link : `/${notif.link}`;
      if (path.startsWith('http')) window.location.href = path;
      else navigate(path);
    }
  };

  const getUserNotifIcon = (type) => {
    if (type === 'moderation' || type === 'moderation_notice' || type === 'forum_flagged' || type === 'forum_flagged_reply') {
      return (
        <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
      );
    }
    if (type === 'forum' || type === 'forum_reply' || type === 'forum_mention' || type === 'forum_pending') {
      return (
        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
      );
    }
    if (type === 'education' || type === 'edu') {
      return (
        <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
          <svg className="h-4 w-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422A12.083 12.083 0 0121 13c0 5.523-4.477 10-10 10S1 18.523 1 13c0-.34.016-.678.048-1.01L12 14z" />
          </svg>
        </div>
      );
    }
    if (type === 'mp' || type === 'mp_activity') {
      return (
        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <svg className="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      );
    }
    if (type === 'announcement') {
      return (
        <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <svg className="h-4 w-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
        </div>
      );
    }
    return (
      <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
        <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </div>
    );
  };

  const userUnreadCount = userNotifications.filter((n) => !n.read).length;
  const displayText = isAuthenticated ? t('profile') : t('login');

  // Forum-only restriction: user can use the app but cannot create or reply in the forum
  const showForumRestrictionBanner = isAuthenticated && user?.isRestricted && user?.restrictionEndDate && new Date(user.restrictionEndDate) > new Date();

  // Default theme for regular pages
  return (
    <header className="bg-gradient-to-r from-indigo-600 to-indigo-700 shadow-sm sticky top-0 z-50 print:hidden">
      {showForumRestrictionBanner && (
        <div className="bg-amber-600 text-white px-4 py-2.5 text-center text-sm">
          <strong>Forum posting restricted</strong>
          {user.restrictionEndDate && (
            <span> until {new Date(user.restrictionEndDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          )}
          <span> — You cannot create new discussions or reply in the forum.</span>
          {user.restrictionReason && (
            <span> Reason: {user.restrictionReason}</span>
          )}
        </div>
      )}
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4 gap-2 min-w-0" style={{ minHeight: '84px' }}>
          <div className="flex flex-col min-w-0 flex-shrink-0">
            <Link to="/" className="text-2xl font-bold text-white hover:text-indigo-100 transition-colors leading-tight">
              MY Parliament
            </Link>
            {isAuthenticated && user && (
              <p className="text-sm text-indigo-100 mt-1">
                {language === 'bm'
                  ? <>Selamat datang kembali, <span className="font-semibold text-white">{user.username}</span></>
                  : <>Welcome back, <span className="font-semibold text-white">{user.username}</span></>}
              </p>
            )}
          </div>
          
          {/* Right side: icons / mobile menu (desktop nav moved to secondary bar) */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Desktop: login/profile + notifications + language/settings */}
            <div className="hidden lg:flex items-center space-x-4 min-w-0">
              {/* Login/Profile button - transparent, left of language */}
              <button
                onClick={handleUserClick}
                className="text-indigo-50 hover:text-white transition-colors font-medium px-3 py-2 bg-transparent border-none cursor-pointer"
              >
                {displayText}
              </button>

              {/* User Notifications Dropdown (portal) */}
              {showUserNotifications && createPortal(
                <>
                  <div className="fixed inset-0 z-[9998]" onClick={() => setShowUserNotifications(false)} />
                  <div
                    ref={userNotificationDropdownRef}
                    className="fixed w-96 z-[9999] max-h-[32rem] flex flex-col"
                    style={{
                      top: `${userNotificationPosition.top}px`,
                      right: `${userNotificationPosition.right}px`
                    }}
                  >
                    <div className="absolute -top-2 right-6 w-4 h-2 flex justify-center" aria-hidden>
                      <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent border-b-white drop-shadow-[0_-1px_1px_rgba(0,0,0,0.08)]" />
                    </div>
                    <div className="bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col flex-1 min-h-0 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center flex-wrap gap-2">
                        <h3 className="font-semibold text-gray-900">{t('notifications')}</h3>
                        <div className="flex items-center gap-2">
                          {userUnreadCount > 0 && (
                            <>
                              <span className="text-xs text-gray-500">{userUnreadCount} unread</span>
                              <button
                                type="button"
                                onClick={() => markAllUserNotificationsRead()}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                              >
                                Mark all as read
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {userNotifications.length === 0 ? (
                          <div className="p-8 text-center text-gray-500">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            <p className="mt-2">{t('noNotifications')}</p>
                          </div>
                        ) : (
                          userNotifications.map((notif) => (
                            <div
                              key={notif._id || notif.id || notif.createdAt}
                              onClick={() => handleUserNotificationClick(notif)}
                              className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${!notif.read ? 'bg-blue-50' : ''}`}
                            >
                              <div className="flex items-start">
                                {getUserNotifIcon(notif.type)}
                                <div className="ml-3 flex-1 min-w-0">
                                  <p className={`text-sm ${!notif.read ? 'font-semibold text-gray-900' : 'text-gray-900'}`}>
                                    {notif.title}
                                  </p>
                                  {notif.message && <p className="text-xs text-gray-600 mt-1">{notif.message}</p>}
                                  <p className="text-xs text-gray-400 mt-1">
                                    {notif.createdAt ? new Date(notif.createdAt).toLocaleString() : ''}
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
                                          markUserNotificationRead(notif._id || notif.id);
                                        }}
                                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
                                      >
                                        Mark as read
                                      </button>
                                      <div className="h-2 w-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
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

              {/* Language | Bell (middle) | Settings - desktop */}
              <div className="flex items-center space-x-4">
              {/* Language Toggle */}
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-medium transition-colors duration-300 ${
                  language === 'en' ? 'text-indigo-100 font-semibold' : 'text-indigo-200'
                }`}>
                  EN
                </span>
                <button
                  onClick={toggleLanguage}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 ${
                    language === 'bm' 
                      ? 'bg-white/30' 
                      : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-lg transition-transform duration-300 ${
                      language === 'bm' ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className={`text-sm font-medium transition-colors duration-300 ${
                  language === 'bm' ? 'text-indigo-100 font-semibold' : 'text-indigo-200'
                }`}>
                  BM
                </span>
              </div>
              {/* Bell - middle */}
              {isAuthenticated && (
                <div className="relative" ref={userNotificationButtonRef}>
                  <button
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setUserNotificationPosition({
                        top: rect.bottom + 8,
                        right: Math.max(0, window.innerWidth - rect.right - 16)
                      });
                      setShowUserNotifications(!showUserNotifications);
                    }}
                    className="relative p-2 rounded-md bg-white/20 text-white border border-white/30 hover:bg-white/30 transition-colors"
                    title={t('notifications')}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {userUnreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full text-xs font-bold bg-red-500 text-white">
                        {userUnreadCount > 99 ? '99+' : userUnreadCount}
                      </span>
                    )}
                  </button>
                </div>
              )}
              {/* Settings - icon only */}
              {isAuthenticated && (
                <button
                  onClick={openSettingsModal}
                  title={t('settings') || 'Settings'}
                  className="p-2 rounded-md bg-white/20 text-white border border-white/30 hover:bg-white/30 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}
              </div>
            </div>

            {/* Mobile: Language | Bell | Settings – shown to the left of hamburger */}
            <div className="flex items-center space-x-3 lg:hidden mr-1">
              {/* Mobile Login/Profile button – keep same readable size */}
              <button
                onClick={handleUserClick}
                className="text-sm font-medium text-indigo-50 hover:text-white bg-transparent border-none cursor-pointer"
              >
                {displayText}
              </button>

              {/* Language Toggle */}
              <div className="flex items-center space-x-2">
                <span className={`text-xs font-medium transition-colors duration-300 ${
                  language === 'en' ? 'text-indigo-100 font-semibold' : 'text-indigo-200'
                }`}>
                  EN
                </span>
                <button
                  onClick={toggleLanguage}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 ${
                    language === 'bm' 
                      ? 'bg-white/30' 
                      : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-lg transition-transform duration-300 ${
                      language === 'bm' ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className={`text-xs font-medium transition-colors duration-300 ${
                  language === 'bm' ? 'text-indigo-100 font-semibold' : 'text-indigo-200'
                }`}>
                  BM
                </span>
              </div>
              {/* Bell */}
              {isAuthenticated && (
                <div className="relative" ref={userNotificationMobileRef}>
                  <button
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setUserNotificationPosition({
                        top: rect.bottom + 8,
                        right: Math.max(0, window.innerWidth - rect.right - 16)
                      });
                      setShowUserNotifications(!showUserNotifications);
                    }}
                    className="relative p-1.5 rounded-md bg-white/20 text-white border border-white/30 hover:bg-white/30 transition-colors"
                    title={t('notifications')}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {userUnreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-4 px-0.5 flex items-center justify-center rounded-full text-[10px] font-bold bg-red-500 text-white">
                        {userUnreadCount > 99 ? '99+' : userUnreadCount}
                      </span>
                    )}
                  </button>
                </div>
              )}
              {/* Settings */}
              {isAuthenticated && (
                <button
                  onClick={openSettingsModal}
                  title={t('settings') || 'Settings'}
                  className="p-1.5 rounded-md bg-white/20 text-white border border-white/30 hover:bg-white/30 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Mobile Menu Button - visible below lg so half-window layout doesn't overflow */}
            <button
              onClick={toggleMobileMenu}
              className="lg:hidden text-indigo-50 hover:text-white transition-colors p-2 rounded-md hover:bg-indigo-600/20"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-white/95 border-t border-indigo-200 shadow-md pt-4 pb-4 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6">
            <nav className="flex flex-col space-y-2">
              {/* Issue Portal */}
              <div
                className={`flex items-center justify-between rounded-md transition-colors ${
                  location.pathname === "/" || location.pathname.startsWith("/issues")
                    ? "bg-indigo-50 text-indigo-900"
                    : "text-gray-800 hover:bg-indigo-400"
                }`}
              >
                <Link
                  to={isAuthenticated ? "/issues" : "/"}
                  className={`flex-1 text-sm font-medium py-2`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19h3V8H4v11zm6 0h3V4h-3v15zm6 0h3v-7h-3v7z" />
                      </svg>
                    </span>
                    <span>{t('issuePortal')}</span>
                  </span>
                </Link>
                {isAuthenticated && (
                  <PinButton
                    tabId="nav-issues"
                    tabName={t('issuePortal')}
                    module="Navigation"
                    className="text-indigo-600 ml-2"
                  />
                )}
              </div>

              {/* MP Dashboard */}
              <div
                className={`flex items-center justify-between rounded-md transition-colors ${
                  location.pathname.startsWith("/mps")
                    ? "bg-indigo-50 text-indigo-900"
                    : "text-gray-800 hover:bg-indigo-400"
                }`}
              >
                <Link
                  to="/mps"
                  className="flex-1 text-sm font-medium py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 14a4 4 0 10-8 0v4h8v-4z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4a3 3 0 110 6 3 3 0 010-6z" />
                      </svg>
                    </span>
                    <span>{t('mpDashboard')}</span>
                  </span>
                </Link>
                {isAuthenticated && (
                  <PinButton
                    tabId="nav-mps"
                    tabName="MP Dashboard"
                    module="Navigation"
                    className="text-indigo-600 ml-2"
                  />
                )}
              </div>

              {/* Educational Content */}
              <div
                className={`flex items-center justify-between rounded-md transition-colors ${
                  location.pathname.startsWith("/edu")
                    ? "bg-indigo-50 text-indigo-900"
                    : "text-gray-800 hover:bg-indigo-400"
                }`}
              >
                <Link
                  to="/edu"
                  className="flex-1 text-sm font-medium py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16v14H4V5z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6M9 13h4" />
                      </svg>
                    </span>
                    <span>{t('eduContent')}</span>
                  </span>
                </Link>
                {isAuthenticated && (
                  <PinButton
                    tabId="nav-edu"
                    tabName={t('eduContent')}
                    module="Navigation"
                    className="text-indigo-600 ml-2"
                  />
                )}
              </div>

              {/* Forum */}
              <div
                className={`flex items-center justify-between rounded-md transition-colors ${
                  location.pathname.startsWith("/forum")
                    ? "bg-indigo-50 text-indigo-900"
                    : "text-gray-800 hover:bg-indigo-400"
                }`}
              >
                <Link
                  to="/forum"
                  className="flex-1 text-sm font-medium py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </span>
                    <span>{t('forum')}</span>
                  </span>
                </Link>
                {isAuthenticated && (
                  <PinButton
                    tabId="nav-forum"
                    tabName={t('forum')}
                    module="Navigation"
                    className="text-indigo-600 ml-2"
                  />
                )}
              </div>
              {isAuthenticated && (
                <>
                {/* Reports */}
                <div
                  className={`flex items-center justify-between rounded-md transition-colors ${
                    location.pathname.startsWith("/reports")
                      ? "bg-indigo-50 text-indigo-900"
                      : "text-gray-800 hover:bg-indigo-400"
                  }`}
                >
                  <Link
                    to="/reports"
                    className="flex-1 text-sm font-medium py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6h2v6H9zm4 0v-4h2v4h-2zM5 21h14a2 2 0 002-2V7a2 2 0 00-2-2h-3.382a2 2 0 01-1.447-.553L12.447 3.553A2 2 0 0011 3H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </span>
                      <span>{t('reports')}</span>
                    </span>
                  </Link>
                  <PinButton
                    tabId="nav-reports"
                    tabName={t('reports')}
                    module="Navigation"
                    className="text-indigo-600 ml-2"
                  />
                </div>

                {/* Feedback */}
                <div
                  className={`flex items-center justify-between rounded-md transition-colors ${
                    location.pathname.startsWith("/feedback")
                      ? "bg-indigo-50 text-indigo-900"
                      : "text-gray-800 hover:bg-indigo-400"
                  }`}
                >
                  <Link
                    to="/feedback"
                    className="flex-1 text-sm font-medium py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h6M5 20l2-4h10a2 2 0 002-2V6a2 2 0 00-2-2H7a2 2 0 00-2 2v12z" />
                        </svg>
                      </span>
                      <span>{t('feedback')}</span>
                    </span>
                  </Link>
                  <PinButton
                    tabId="nav-feedback"
                    tabName={t('feedback')}
                    module="Navigation"
                    className="text-indigo-600 ml-2"
                  />
                </div>
                </>
              )}
            </nav>
          </div>
        )}
      </div>

      {/* Desktop primary navigation bar (second layer) */}
      <div
        className="hidden lg:block bg-[#e0f0ff]/90 backdrop-blur-sm border-t border-b"
        style={{ borderTopColor: '#a5b4fc', borderBottomColor: '#e2e8f0' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Desktop / wide-screen navigation tabs (match admin layout) */}
          <nav className="flex flex-wrap gap-1 py-3 overflow-x-auto scrollbar-hide overflow-y-visible min-w-0 text-base">
            {/* Issue Portal */}
            <Link
              to={isAuthenticated ? "/issues" : "/"}
              className={`relative flex items-center space-x-2 py-2.5 px-4 rounded-md font-medium transition-all duration-200 group whitespace-nowrap border-b-2 ${
                location.pathname === "/" || location.pathname.startsWith("/issues")
                  ? "text-indigo-800 border-indigo-500"
                  : "text-gray-700 hover:text-indigo-800 hover:bg-indigo-50 border-transparent"
              }`}
            >
              <span
                className={`p-1.5 rounded transition-all duration-200 inline-flex items-center justify-center ${
                  location.pathname === "/" || location.pathname.startsWith("/issues")
                    ? "bg-indigo-100"
                    : "bg-gray-100 group-hover:bg-indigo-100"
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19h3V8H4v11zm6 0h3V4h-3v15zm6 0h3v-7h-3v7z" />
                </svg>
              </span>
              <span>{t('issuePortal')}</span>
            </Link>

            {/* MP Dashboard */}
            <Link
              to="/mps"
              className={`relative flex items-center space-x-2 py-2.5 px-4 rounded-md font-medium transition-all duration-200 group whitespace-nowrap border-b-2 ${
                location.pathname.startsWith("/mps")
                  ? "text-indigo-800 border-indigo-500"
                  : "text-gray-700 hover:text-indigo-800 hover:bg-indigo-50 border-transparent"
              }`}
            >
              <span
                className={`p-1.5 rounded transition-all duration-200 inline-flex items-center justify-center ${
                  location.pathname.startsWith("/mps")
                    ? "bg-indigo-100"
                    : "bg-gray-100 group-hover:bg-indigo-100"
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 14a4 4 0 10-8 0v4h8v-4z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4a3 3 0 110 6 3 3 0 010-6z" />
                </svg>
              </span>
              <span>{t('mpDashboard')}</span>
            </Link>

            {/* Educational Content */}
            <Link
              to="/edu"
              className={`relative flex items-center space-x-2 py-2.5 px-4 rounded-md font-medium transition-all duration-200 group whitespace-nowrap border-b-2 ${
                location.pathname.startsWith("/edu")
                  ? "text-indigo-800 border-indigo-500"
                  : "text-gray-700 hover:text-indigo-800 hover:bg-indigo-50 border-transparent"
              }`}
            >
              <span
                className={`p-1.5 rounded transition-all duration-200 inline-flex items-center justify-center ${
                  location.pathname.startsWith("/edu")
                    ? "bg-indigo-100"
                    : "bg-gray-100 group-hover:bg-indigo-100"
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16v14H4V5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6M9 13h4" />
                </svg>
              </span>
              <span>{t('eduContent')}</span>
            </Link>

            {/* Forum */}
            <Link
              to="/forum"
              className={`relative flex items-center space-x-2 py-2.5 px-4 rounded-md font-medium transition-all duration-200 group whitespace-nowrap border-b-2 ${
                location.pathname.startsWith("/forum")
                  ? "text-indigo-800 border-indigo-500"
                  : "text-gray-700 hover:text-indigo-800 hover:bg-indigo-50 border-transparent"
              }`}
            >
              <span
                className={`p-1.5 rounded transition-all duration-200 inline-flex items-center justify-center ${
                  location.pathname.startsWith("/forum")
                    ? "bg-indigo-100"
                    : "bg-gray-100 group-hover:bg-indigo-100"
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <span>{t('forum')}</span>
            </Link>

            {/* Extra tabs only after login */}
            {isAuthenticated && (
              <>
                {/* Reports */}
                <Link
                  to="/reports"
                  className={`relative flex items-center space-x-2 py-2.5 px-4 rounded-md font-medium transition-all duration-200 group whitespace-nowrap border-b-2 ${
                    location.pathname.startsWith("/reports")
                      ? "text-indigo-800 border-indigo-500"
                      : "text-gray-700 hover:text-indigo-800 hover:bg-indigo-50 border-transparent"
                  }`}
                >
                  <span
                    className={`p-1.5 rounded transition-all duration-200 inline-flex items-center justify-center ${
                      location.pathname.startsWith("/reports")
                        ? "bg-indigo-100"
                        : "bg-gray-100 group-hover:bg-indigo-100"
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6h2v6H9zm4 0v-4h2v4h-2zM5 21h14a2 2 0 002-2V7a2 2 0 00-2-2h-3.382a2 2 0 01-1.447-.553L12.447 3.553A2 2 0 0011 3H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <span>{t('reports')}</span>
                </Link>

                {/* Feedback */}
                <Link
                  to="/feedback"
                  className={`relative flex items-center space-x-2 py-2.5 px-4 rounded-md font-medium transition-all duration-200 group whitespace-nowrap border-b-2 ${
                    location.pathname.startsWith("/feedback")
                      ? "text-indigo-800 border-indigo-500"
                      : "text-gray-700 hover:text-indigo-800 hover:bg-indigo-50 border-transparent"
                  }`}
                >
                  <span
                    className={`p-1.5 rounded transition-all duration-200 inline-flex items-center justify-center ${
                      location.pathname.startsWith("/feedback")
                        ? "bg-indigo-100"
                        : "bg-gray-100 group-hover:bg-indigo-100"
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h6M5 20l2-4h10a2 2 0 002-2V6a2 2 0 00-2-2H7a2 2 0 00-2 2v12z" />
                    </svg>
                  </span>
                  <span>{t('feedback')}</span>
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}



function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AdminAuthProvider>
          <SettingsProvider>
            <PinProvider>
              <SSEProvider>
              <Router
                future={{
                  v7_startTransition: true,
                  v7_relativeSplatPath: true
                }}
              >
                <AppContent />
              </Router>
              </SSEProvider>
            </PinProvider>
          </SettingsProvider>
        </AdminAuthProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

function SuspendedModalListener() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    const handle = () => {
      if (shownRef.current) return;
      shownRef.current = true;
      setShow(true);
    };
    window.addEventListener('user:suspended', handle);
    return () => window.removeEventListener('user:suspended', handle);
  }, []);

  const onOk = () => {
    setShow(false);
    shownRef.current = false;
    logout();
    navigate('/login', { replace: true });
  };

  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="suspended-title">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-center">
        <h2 id="suspended-title" className="text-xl font-semibold text-gray-900 mb-2">Account suspended</h2>
        <p className="text-gray-600 mb-6">Your account has been suspended. You have been logged out. Contact support if you believe this is an error.</p>
        <button
          type="button"
          onClick={onOk}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
        >
          OK
        </button>
      </div>
    </div>,
    document.body
  );
}

function AppContent() {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');
  const { isSettingsModalOpen, closeSettingsModal } = useSettings();

  return (
    <>
      <SuspendedModalListener />
      <ScrollToTopOnRouteChange />
      {/* Maintenance / pre-maintenance notice banner – shown on all public pages */}
      {!isAdminPage && <MaintenanceBanner />}
      <ConditionalHeader />
      {/* Global Settings Modal - openable from any tab after login */}
      {isSettingsModalOpen && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={closeSettingsModal}
        />
      )}
      <main className={isAdminPage ? "content-admin" : "content print:max-w-none print:px-0 print:pt-0"}>
            <Routes>
              <Route path="/" element={<IssuePortal />} />
              <Route path="/edu" element={<EduContentPage />} />
              <Route path="/edu/:resourceId" element={<EduDetailPage />} />
              <Route path="/topic/:topicId" element={<TopicDetailPage />} />
              <Route path="/forum/topic/:topicId" element={<TopicDetailPage />} />
              <Route path="/forum" element={<DiscussionForumPage />} />
              <Route path="/forum/reply/:discussionId" element={<ReplyDiscussionPage />} />
              <Route path="/forum/delete/:discussionId" element={
                <ProtectedRoute>
                  <DeleteDiscussionPage />
                </ProtectedRoute>
              } />
              <Route path="/feedback" element={
                <ProtectedRoute>
                  <FeedbackPage />
                </ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute>
                  <ReportModule />
                </ProtectedRoute>
              } />
              <Route path="/reports/bookmarks" element={
                <ProtectedRoute>
                  <BookmarkCollectionReport />
                </ProtectedRoute>
              } />
              <Route path="/reports/bookmark-collection" element={
                <ProtectedRoute>
                  <BookmarkCollectionReport />
                </ProtectedRoute>
              } />
              <Route path="/reports/mp-performance" element={
                <ProtectedRoute>
                  <MPPerformanceReport />
                </ProtectedRoute>
              } />
              <Route path="/reports/topic-categories" element={<TopicCategoriesReport />} />
              <Route path="/reports/most-viewed-topics" element={<MostViewedTopicsReport />} />
              <Route path="/issues" element={<IssuePortal />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/admin/reset-password" element={<AdminResetPasswordPage />} />
              <Route path="/admin" element={<AdminLoginPage />} />
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin/dashboard" element={
                <AdminRouteGuard>
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                </AdminRouteGuard>
              } />
              <Route path="/admin/users" element={
                <AdminRouteGuard>
                  <AdminRoute>
                    <AdminUserManagement />
                  </AdminRoute>
                </AdminRouteGuard>
              } />
              {/* Catch-all route for any other admin paths - redirect to admin login */}
              <Route path="/admin/*" element={<Navigate to="/admin/login" replace />} />
              <Route path="/register" element={<UserRegisterPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/profile" element={
                <ProtectedRoute requireCompleteProfile={false}>
                  <UserDashboard />
                </ProtectedRoute>
              } />
              <Route path="/complete-profile" element={<CompleteProfilePage />} />
              <Route path="/mps" element={<MpDashboard />} />
            </Routes>
          </main>
          <BackToTop />
          <AdminEntryPoint />
    </>
  );
}

export default App;
