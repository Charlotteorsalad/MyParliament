import { useState, useEffect, useCallback } from "react";
import { useApi } from "../../hooks";
import { userApi } from "../../api";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../hooks";
import { usePin } from "../../contexts/PinContext";
import { useSSEEvent } from "../../contexts/SSEContext";
import { LoadingSpinner, Button } from "../../components/ui";
import { 
  StatsGrid, 
  QuickActionsSection, 
  UserProfileSection 
} from "../../components/dashboard";
import FollowerListModal from "../../components/FollowerListModal";

function UserDashboard() {
  const { isAuthenticated, user: authUser } = useAuth();
  const [user, setUser] = useState(authUser || null);
  const { executeApiCall, loading, error } = useApi();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { pinnedTabs, togglePin, isPinned, PinButton } = usePin();
  const [stats, setStats] = useState({
    followedMPs: 0,
    followedTopics: 0,
    bookmarkedEduContent: 0,
    bookmarkedEdu: 0,
    bookmarkedDiscussions: 0,
    discussions: 0
  });
  // Persist active profile tab across refresh / navigation
  const [activeProfileTab, setActiveProfileTab] = useState(() => {
    if (typeof window === 'undefined') return 'discussions';
    const stored = window.localStorage.getItem('userProfileActiveTab');
    return stored || 'discussions';
  });
  const [showFollowerModal, setShowFollowerModal] = useState(false);
  const [followerModalType, setFollowerModalType] = useState('mps');
  const [followedMPs, setFollowedMPs] = useState([]);
  const [followedTopics, setFollowedTopics] = useState([]);
  const [bookmarkedEduContent, setBookmarkedEduContent] = useState([]);
  const [bookmarkedDiscussions, setBookmarkedDiscussions] = useState([]);
  const [userActivities, setUserActivities] = useState([]);

  // Sync local user state with auth context (in case login just happened)
  useEffect(() => {
    if (authUser) {
      setUser(authUser);
    }
  }, [authUser]);

  // Keep activeProfileTab in localStorage so coming back to dashboard restores same tab
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('userProfileActiveTab', activeProfileTab);
  }, [activeProfileTab]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!isAuthenticated) {
        setStats({
          followedMPs: 0,
          followedTopics: 0,
          bookmarkedEduContent: 0,
          bookmarkedEdu: 0,
          bookmarkedDiscussions: 0,
          discussions: 0
        });
        return;
      }

      try {
        const [userData, activitiesData] = await Promise.all([
          executeApiCall(userApi.getProfile),
          userApi.getMyActivities().catch(() => ({ activities: [] })),
        ]);
        setUser(userData);
        setFollowedMPs(userData.followedMPs || []);
        setFollowedTopics(userData.followedTopics || []);
        setBookmarkedEduContent(userData.bookmarkedEduContent || []);
        setBookmarkedDiscussions(userData.bookmarkedDiscussions || []);
        setUserActivities(activitiesData.activities || []);
        setStats({
          followedMPs: userData.stats?.followedMPs || 0,
          followedTopics: userData.stats?.followedTopics || 0,
          bookmarkedEduContent: userData.stats?.bookmarkedEduContent || 0,
          bookmarkedEdu: userData.stats?.bookmarkedEdu || 0,
          bookmarkedDiscussions: userData.stats?.bookmarkedDiscussions || 0,
          discussions: userData.stats?.discussions || 0
        });
      } catch (err) {
        console.error("Failed to fetch user profile:", err);
        setStats({
          followedMPs: 0,
          followedTopics: 0,
          bookmarkedEduContent: 0,
          bookmarkedEdu: 0,
          bookmarkedDiscussions: 0,
          discussions: 0
        });
      }
    };

    fetchUserProfile();
  }, [executeApiCall, isAuthenticated]);

  // Real-time: when admin sends a notification (e.g. moderation, reply), refresh dashboard data
  useSSEEvent('notification', useCallback(() => {
    if (isAuthenticated) {
      executeApiCall(userApi.getProfile).then(setUser).catch(() => {});
    }
  }, [isAuthenticated, executeApiCall]));

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

  // While authenticated but user profile not yet loaded, show loading state (avoid blank or "please login" flash)
  if (!user && isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <LoadingSpinner size="lg" text={t('loadingDashboard')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white min-w-0 max-w-full">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 w-full max-w-full min-w-0">
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
              userDiscussions={user?.discussions || []}
              userReplies={user?.replies || []}
              userActivities={userActivities}
            />
          </div>
        )}
      </div>

      {/* Follower List Modal */}
      <FollowerListModal
        isOpen={showFollowerModal}
        onClose={handleCloseFollowerModal}
        type={followerModalType}
        title={
          followerModalType === 'mps' ? t('followedMPs') :
          followerModalType === 'topics' ? t('followedTopics') :
          followerModalType === 'eduContent' ? t('bookmarkedEduContent') :
          followerModalType === 'discussions' ? t('bookmarkedDiscussions') :
          t('followedMPs')
        }
        items={
          followerModalType === 'mps' ? followedMPs :
          followerModalType === 'topics' ? followedTopics :
          followerModalType === 'eduContent' ? bookmarkedEduContent :
          followerModalType === 'discussions' ? bookmarkedDiscussions :
          []
        }
        onItemRemoved={(modalType, item) => {
          const id = item?.id ?? item?._id;
          if (modalType === 'mps') setFollowedMPs((prev) => prev.filter((i) => (i?.id ?? i?._id) !== id));
          if (modalType === 'topics') {
            setFollowedTopics((prev) => prev.filter((i) => String(i?.id ?? i?._id) !== String(id)));
            setStats((s) => ({ ...s, followedTopics: Math.max(0, (s.followedTopics || 0) - 1) }));
          }
          if (modalType === 'eduContent') setBookmarkedEduContent((prev) => prev.filter((i) => (i?.id ?? i?._id) !== id));
          if (modalType === 'discussions') setBookmarkedDiscussions((prev) => prev.filter((i) => (i?.id ?? i?._id) !== id));
        }}
      />
    </div>
  );
}

export default UserDashboard;
