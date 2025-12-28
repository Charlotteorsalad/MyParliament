import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
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
import ReportModule from "./pages/user/ReportModule";
import TopicCategoriesReport from "./pages/public/TopicCategoriesReport";
import IssuePortal from "./pages/public/IssuePortal";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import { useAuth } from "./hooks";
import { AdminAuthProvider } from "./hooks/useAdminAuth.jsx";
import { ProtectedRoute, AdminRoute } from "./components/ProtectedRoute";
import AdminAccessLink from "./components/AdminAccessLink";
import AdminEntryPoint from "./components/AdminEntryPoint";
import AdminRouteGuard from "./components/AdminRouteGuard";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";
import { PinProvider, usePin } from "./contexts/PinContext";
import "./utils/grammarlyDisable";

// Component to conditionally render header
function ConditionalHeader() {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { PinButton } = usePin();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const isAdminPage = location.pathname.startsWith('/admin');
  const isAdminLoginPage = location.pathname === '/admin/login';
  const isAdminDashboardPage = isAdminPage && !isAdminLoginPage; // Admin pages except login
  
  if (isAuthPage) {
    return null; // Don't show header on auth pages
  }
  
  if (isAdminDashboardPage) {
    return null; // Don't show header on admin dashboard pages
  }
  
  // Show admin header for admin login page
  if (isAdminLoginPage) {
    return (
      <header className="bg-gradient-to-r from-green-600 to-green-700 shadow-sm sticky top-0 z-50">
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

  const handleUserClick = () => {
    if (isAuthenticated) {
      window.location.href = "/profile";
    } else {
      window.location.href = "/login";
    }
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const displayText = isAuthenticated ? t('profile') : t('login');
  
  // Default theme for regular pages
  return (
    <header className="bg-gradient-to-r from-indigo-600 to-indigo-700 shadow-sm sticky top-0 z-50">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-3">
          <Link to="/" className="text-lg font-semibold text-white hover:text-indigo-100 transition-colors">
            MY Parliament
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-6 text-sm">
            <div className="flex items-center gap-1">
              <Link 
                to={isAuthenticated ? "/issues" : "/"} 
                className="text-indigo-50 hover:text-white transition-colors font-medium px-3 py-2 rounded-md hover:bg-indigo-600/20"
              >
                {t('issuePortal')}
              </Link>
              {isAuthenticated && (
                <PinButton
                  tabId="nav-issues"
                  tabName={t('issuePortal')}
                  module="Navigation"
                  className="text-white"
                />
              )}
            </div>
            <div className="flex items-center gap-1">
              <Link 
                to="/mps" 
                className="text-indigo-50 hover:text-white transition-colors font-medium px-3 py-2 rounded-md hover:bg-indigo-600/20"
              >
                {t('mpDashboard')}
              </Link>
              {isAuthenticated && (
                <PinButton
                  tabId="nav-mps"
                  tabName="MP Dashboard"
                  module="Navigation"
                  className="text-white"
                />
              )}
            </div>
            <div className="flex items-center gap-1">
              <Link 
                to="/edu" 
                className="text-indigo-50 hover:text-white transition-colors font-medium px-3 py-2 rounded-md hover:bg-indigo-600/20"
              >
                {t('eduContent')}
              </Link>
              {isAuthenticated && (
                <PinButton
                  tabId="nav-edu"
                  tabName={t('eduContent')}
                  module="Navigation"
                  className="text-white"
                />
              )}
            </div>
            <div className="flex items-center gap-1">
              <Link 
                to="/forum" 
                className="text-indigo-50 hover:text-white transition-colors font-medium px-3 py-2 rounded-md hover:bg-indigo-600/20"
              >
                {t('forum')}
              </Link>
              {isAuthenticated && (
                <PinButton
                  tabId="nav-forum"
                  tabName={t('forum')}
                  module="Navigation"
                  className="text-white"
                />
              )}
            </div>
            {isAuthenticated && (
              <div className="flex items-center gap-1">
                <Link 
                  to="/reports" 
                  className="text-indigo-50 hover:text-white transition-colors font-medium px-3 py-2 rounded-md hover:bg-indigo-600/20"
                >
                  {t('reports')}
                </Link>
                <PinButton
                  tabId="nav-reports"
                  tabName={t('reports')}
                  module="Navigation"
                  className="text-white"
                />
              </div>
            )}
            {isAuthenticated && (
              <div className="flex items-center gap-1">
                <Link 
                  to="/feedback" 
                  className="text-indigo-50 hover:text-white transition-colors font-medium px-3 py-2 rounded-md hover:bg-indigo-600/20"
                >
                  {t('feedback')}
                </Link>
                <PinButton
                  tabId="nav-feedback"
                  tabName={t('feedback')}
                  module="Navigation"
                  className="text-white"
                />
              </div>
            )}
            <button
              onClick={handleUserClick}
              className="text-indigo-50 hover:text-white transition-colors font-medium px-3 py-2 rounded-md hover:bg-indigo-600/20 bg-transparent border-none cursor-pointer"
            >
              {displayText}
            </button>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden text-indigo-50 hover:text-white transition-colors p-2 rounded-md hover:bg-indigo-600/20"
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

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-indigo-500/20 pt-4 pb-4">
            <nav className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <Link 
                  to={isAuthenticated ? "/issues" : "/"} 
                  className="text-indigo-50 hover:text-white transition-colors font-medium px-3 py-2 rounded-md hover:bg-indigo-600/20"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t('issuePortal')}
                </Link>
                {isAuthenticated && (
                  <PinButton
                    tabId="nav-issues"
                    tabName={t('issuePortal')}
                    module="Navigation"
                    className="text-white mr-2"
                  />
                )}
              </div>
              <div className="flex items-center justify-between">
                <Link 
                  to="/mps" 
                  className="text-indigo-50 hover:text-white transition-colors font-medium px-3 py-2 rounded-md hover:bg-indigo-600/20"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t('mpDashboard')}
                </Link>
                {isAuthenticated && (
                  <PinButton
                    tabId="nav-mps"
                    tabName="MP Dashboard"
                    module="Navigation"
                    className="text-white mr-2"
                  />
                )}
              </div>
              <div className="flex items-center justify-between">
                <Link 
                  to="/edu" 
                  className="text-indigo-50 hover:text-white transition-colors font-medium px-3 py-2 rounded-md hover:bg-indigo-600/20"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t('eduContent')}
                </Link>
                {isAuthenticated && (
                  <PinButton
                    tabId="nav-edu"
                    tabName={t('eduContent')}
                    module="Navigation"
                    className="text-white mr-2"
                  />
                )}
              </div>
              <div className="flex items-center justify-between">
                <Link 
                  to="/forum" 
                  className="text-indigo-50 hover:text-white transition-colors font-medium px-3 py-2 rounded-md hover:bg-indigo-600/20"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t('forum')}
                </Link>
                {isAuthenticated && (
                  <PinButton
                    tabId="nav-forum"
                    tabName={t('forum')}
                    module="Navigation"
                    className="text-white mr-2"
                  />
                )}
              </div>
              {isAuthenticated && (
                <div className="flex items-center justify-between">
                  <Link 
                    to="/reports" 
                    className="text-indigo-50 hover:text-white transition-colors font-medium px-3 py-2 rounded-md hover:bg-indigo-600/20"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {t('reports')}
                  </Link>
                  <PinButton
                    tabId="nav-reports"
                    tabName={t('reports')}
                    module="Navigation"
                    className="text-white mr-2"
                  />
                </div>
              )}
              {isAuthenticated && (
                <div className="flex items-center justify-between">
                  <Link 
                    to="/feedback" 
                    className="text-indigo-50 hover:text-white transition-colors font-medium px-3 py-2 rounded-md hover:bg-indigo-600/20"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {t('feedback')}
                  </Link>
                  <PinButton
                    tabId="nav-feedback"
                    tabName={t('feedback')}
                    module="Navigation"
                    className="text-white mr-2"
                  />
                </div>
              )}
              <button
                onClick={() => {
                  handleUserClick();
                  setIsMobileMenuOpen(false);
                }}
                className="text-indigo-50 hover:text-white transition-colors font-medium px-3 py-2 rounded-md hover:bg-indigo-600/20 bg-transparent border-none cursor-pointer text-left"
              >
                {displayText}
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}



function App() {
  return (
    <LanguageProvider>
      <AdminAuthProvider>
        <PinProvider>
          <Router>
            <AppContent />
          </Router>
        </PinProvider>
      </AdminAuthProvider>
    </LanguageProvider>
  );
}

function AppContent() {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');

  return (
    <>
      <ConditionalHeader />
      <main className={isAdminPage ? "content-admin" : "content"}>
            <Routes>
              <Route path="/" element={<IssuePortal />} />
              <Route path="/edu" element={<EduContentPage />} />
              <Route path="/edu/:resourceId" element={<EduDetailPage />} />
              <Route path="/topic/:topicId" element={<TopicDetailPage />} />
              <Route path="/forum" element={<DiscussionForumPage />} />
              <Route path="/forum/reply/:discussionId" element={
                <ProtectedRoute>
                  <ReplyDiscussionPage />
                </ProtectedRoute>
              } />
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
              <Route path="/reports/topic-categories" element={<TopicCategoriesReport />} />
              <Route path="/issues" element={<IssuePortal />} />
              <Route path="/login" element={<LoginPage />} />
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
          <AdminEntryPoint />
    </>
  );
}

export default App;
