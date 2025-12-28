import { useState, useEffect } from "react";
import { useApi } from "../../hooks";
import { userApi } from "../../api";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../hooks";
import { usePin } from "../../contexts/PinContext";
import { LoadingSpinner, Button } from "../../components/ui";
import { 
  DashboardHeader, 
  StatsGrid, 
  QuickActionsSection, 
  UserProfileSection 
} from "../../components/dashboard";
import SettingsModal from "../../components/SettingsModal";
import FollowerListModal from "../../components/FollowerListModal";

function UserDashboard() {
  const [user, setUser] = useState(null);
  const { executeApiCall, loading, error } = useApi();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { language, toggleLanguage, t } = useLanguage();
  const { pinnedTabs, togglePin, isPinned, PinButton } = usePin();
  const [stats, setStats] = useState({
    followedMPs: 0,
    followedTopics: 0,
    bookmarkedEduContent: 0,
    bookmarkedIssues: 0,
    bookmarkedEdu: 0,
    discussions: 0
  });
  const [activeProfileTab, setActiveProfileTab] = useState('discussions');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showFollowerModal, setShowFollowerModal] = useState(false);
  const [followerModalType, setFollowerModalType] = useState('mps');
  const [followedMPs, setFollowedMPs] = useState([]);
  const [followedTopics, setFollowedTopics] = useState([]);
  const [bookmarkedEduContent, setBookmarkedEduContent] = useState([]);
  const [bookmarkedIssues, setBookmarkedIssues] = useState([]);

  // Debug: Log when modal state changes
  useEffect(() => {
    console.log('showSettingsModal changed to:', showSettingsModal);
  }, [showSettingsModal]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!isAuthenticated) {
        // Set default stats for non-authenticated users
        setStats({
          followedMPs: 0,
          followedTopics: 0,
          bookmarkedEduContent: 0,
          bookmarkedIssues: 0,
          bookmarkedEdu: 0,
          discussions: 0
        });
        return;
      }

      try {
        const userData = await executeApiCall(userApi.getProfile);
        setUser(userData);
        setFollowedMPs(userData.followedMPs || []);
        setFollowedTopics(userData.followedTopics || []);
        setBookmarkedEduContent(userData.bookmarkedEduContent || []);
        setBookmarkedIssues(userData.bookmarkedIssues || []);
        setStats({
          followedMPs: userData.stats?.followedMPs || 0,
          followedTopics: userData.stats?.followedTopics || 0,
          bookmarkedEduContent: userData.stats?.bookmarkedEduContent || 0,
          bookmarkedIssues: userData.stats?.bookmarkedIssues || 0,
          bookmarkedEdu: userData.stats?.bookmarkedEdu || 0,
          discussions: userData.stats?.discussions || 0
        });
      } catch (err) {
        console.error("Failed to fetch user profile:", err);
        // Set default stats on error
        setStats({
          followedMPs: 0,
          followedTopics: 0,
          bookmarkedEduContent: 0,
          bookmarkedIssues: 0,
          bookmarkedEdu: 0,
          discussions: 0
        });
      }
    };

    fetchUserProfile();
  }, [executeApiCall, isAuthenticated]);

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleOpenFollowerModal = (type) => {
    setFollowerModalType(type);
    setShowFollowerModal(true);
  };

  const handleCloseFollowerModal = () => {
    setShowFollowerModal(false);
  };

  const handleSettingsClick = () => {
    console.log('Settings button clicked, isAuthenticated:', isAuthenticated);
    if (isAuthenticated) {
      setShowSettingsModal(true);
    } else {
      navigate('/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <LoadingSpinner size="lg" text={t('loadingDashboard')} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('errorLoadingDashboard')}</h2>
          <p className="text-gray-600 mb-4">{t('unableToLoadDashboard')}</p>
          <Button
            onClick={() => window.location.reload()}
            variant="primary"
          >
            {t('tryAgain')}
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('noUserData')}</h2>
          <p className="text-gray-600 mb-4">{t('pleaseLoginToAccess')}</p>
          <Button
            onClick={() => navigate('/login')}
            variant="primary"
          >
            {t('goToLogin')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#e0f2fe' }}>
      <DashboardHeader
        user={user}
        isAuthenticated={isAuthenticated}
        language={language}
        toggleLanguage={toggleLanguage}
        onSettingsClick={handleSettingsClick}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Stats Grid */}
        <StatsGrid stats={stats} />

        {/* Quick Actions Section */}
        <QuickActionsSection
          isAuthenticated={isAuthenticated}
          onNavigation={handleNavigation}
          pinnedTabs={pinnedTabs}
          togglePin={togglePin}
          isPinned={isPinned}
          PinButton={PinButton}
        />

        {/* User Profile Section - Only for authenticated users */}
        {isAuthenticated && (
          <div className="mt-8">
            <UserProfileSection
              user={user}
              stats={stats}
              activeTab={activeProfileTab}
              onTabChange={setActiveProfileTab}
              onFollowerModalOpen={handleOpenFollowerModal}
            />
          </div>
        )}
      </div>
      
      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Follower List Modal */}
      <FollowerListModal
        isOpen={showFollowerModal}
        onClose={handleCloseFollowerModal}
        type={followerModalType}
        title={
          followerModalType === 'mps' ? t('followedMPs') :
          followerModalType === 'topics' ? t('followedTopics') :
          followerModalType === 'eduContent' ? t('bookmarkedEduContent') :
          followerModalType === 'issues' ? t('bookmarkedIssues') :
          t('followedMPs')
        }
        items={
          followerModalType === 'mps' ? followedMPs :
          followerModalType === 'topics' ? followedTopics :
          followerModalType === 'eduContent' ? bookmarkedEduContent :
          followerModalType === 'issues' ? bookmarkedIssues :
          []
        }
      />
    </div>
  );
}

export default UserDashboard;
