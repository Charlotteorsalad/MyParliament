import { useState, useEffect } from "react";
import { useAuth } from "../hooks";
import { useLanguage } from "../contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { TabNavigation } from "./ui";
import { userApi } from "../api/userApi";
import { subscribePush, unsubscribePush } from "../utils/pushNotifications";
import { 
  NotificationSettings, 
  ProfileSettings, 
  PasswordSettings, 
  LogoutConfirmation 
} from "./settings";

const DEFAULT_NOTIFICATION_PREFS = {
  emailNotifications: true,
  pushNotifications: true,
  mpActivities: true,
  discussionUpdates: true,
  educationalContent: false,
  moderationNotices: true,
  frequency: 'daily'
};

function SettingsModal({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('notifications');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Notification preferences state
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    pushNotifications: true,
    mpActivities: true,
    discussionUpdates: true,
    educationalContent: false,
    moderationNotices: true,
    frequency: 'daily'
  });

  // Original notification preferences to track changes
  const [originalNotifications, setOriginalNotifications] = useState({
    emailNotifications: true,
    pushNotifications: true,
    mpActivities: true,
    discussionUpdates: true,
    educationalContent: false,
    moderationNotices: true,
    frequency: 'daily'
  });

  // Profile edit state
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    BOD: null,
    state: '',
    constituency: ''
  });

  // Original profile data to track changes
  const [originalProfileData, setOriginalProfileData] = useState({
    firstName: '',
    lastName: '',
    BOD: null,
    state: '',
    constituency: ''
  });

  // Profile data loading (so form shows data once fetched)
  const [profileDataLoading, setProfileDataLoading] = useState(false);
  // Validation errors for profile
  const [validationErrors, setValidationErrors] = useState({});
  // Shake effect for profile form when validation fails
  const [shakeProfileForm, setShakeProfileForm] = useState(false);

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  // Validation errors for password form
  const [passwordValidationErrors, setPasswordValidationErrors] = useState({});
  // Shake effect for password form when validation fails
  const [shakePasswordForm, setShakePasswordForm] = useState(false);

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Build profile form state from any user/profile object (API or auth context)
  const buildProfileFormData = (source) => {
    if (!source) return { firstName: '', lastName: '', BOD: null, state: '', constituency: '' };
    const p = source.profile ?? source;
    const rawBOD = p?.BOD ?? source?.BOD;
    return {
      firstName: String(p?.firstName ?? source?.firstName ?? '').trim(),
      lastName: String(p?.lastName ?? source?.lastName ?? '').trim(),
      BOD: rawBOD ? new Date(rawBOD) : null,
      state: String(p?.state ?? source?.state ?? '').trim(),
      constituency: String(p?.constituency ?? source?.constituency ?? '').trim()
    };
  };

  // Load user data when modal opens: seed from auth user first, then fetch from API and overwrite
  useEffect(() => {
    if (!isOpen || !user) return;
    // Immediately show whatever we have from auth context (e.g. from getMe on page load)
    const fromAuth = buildProfileFormData(user);
    setProfileData(fromAuth);
    setOriginalProfileData(fromAuth);

    let cancelled = false;
    const loadProfile = async () => {
      setProfileDataLoading(true);
      try {
        const profile = await userApi.getProfile();
        if (cancelled) return;
        const userProfileData = buildProfileFormData(profile);
        setProfileData(userProfileData);
        setOriginalProfileData(userProfileData);
        const np = profile?.preferences?.notificationPreferences;
        if (np && typeof np === 'object') {
          const prefs = {
            ...DEFAULT_NOTIFICATION_PREFS,
            emailNotifications: np.emailNotifications !== false,
            pushNotifications: np.pushNotifications !== false,
            mpActivities: np.mpActivities !== false,
            discussionUpdates: np.discussionUpdates !== false,
            educationalContent: !!np.educationalContent,
            moderationNotices: np.moderationNotices !== false
          };
          setNotifications(prefs);
          setOriginalNotifications(prefs);
        }
      } catch (err) {
        if (!cancelled) console.warn('[SettingsModal] Failed to load profile for preferences:', err);
      } finally {
        if (!cancelled) setProfileDataLoading(false);
      }
    };
    loadProfile();
    return () => { cancelled = true; };
  }, [isOpen, user]);

  const handleNotificationChange = (key, value) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
  };

  const handleProfileChange = (key, value) => {
    setProfileData(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'state') next.constituency = '';
      return next;
    });
    if (validationErrors[key]) {
      setValidationErrors(prev => ({ ...prev, [key]: "" }));
    }
    if (key === 'state' && validationErrors.constituency) {
      setValidationErrors(prev => ({ ...prev, constituency: "" }));
    }
  };

  // Validate profile form
  const validateProfileForm = () => {
    const errors = {};
    
    if (!profileData.firstName.trim()) {
      errors.firstName = t('firstNameRequired');
    }
    
    if (!profileData.lastName.trim()) {
      errors.lastName = t('lastNameRequired');
    }
    
    if (!profileData.BOD) {
      errors.BOD = t('birthDateRequired');
    }
    
    if (!profileData.state) {
      errors.state = t('stateRequired');
    }
    
    if (!profileData.constituency) {
      errors.constituency = t('constituencyRequired');
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Check if profile data has changed
  const hasProfileChanges = () => {
    return Object.keys(profileData).some(key => {
      if (key === 'BOD') {
        // Handle date comparison
        const originalDate = originalProfileData[key];
        const currentDate = profileData[key];
        if (!originalDate && !currentDate) return false;
        if (!originalDate || !currentDate) return true;
        return originalDate.getTime() !== currentDate.getTime();
      }
      return profileData[key] !== originalProfileData[key];
    });
  };

  const handlePasswordChange = (key, value) => {
    setPasswordData(prev => ({ ...prev, [key]: value }));
    if (passwordValidationErrors[key]) {
      setPasswordValidationErrors(prev => ({ ...prev, [key]: '' }));
    }
    if (key === 'currentPassword' && passwordValidationErrors.newPassword) {
      setPasswordValidationErrors(prev => ({ ...prev, newPassword: '' }));
    }
    if (key === 'newPassword' && passwordValidationErrors.confirmPassword) {
      setPasswordValidationErrors(prev => ({ ...prev, confirmPassword: '' }));
    }
    if (key === 'confirmPassword' && passwordValidationErrors.confirmPassword) {
      setPasswordValidationErrors(prev => ({ ...prev, confirmPassword: '' }));
    }
  };

  // New password must meet all 5 requirements (same as PasswordSettings UI)
  const newPasswordMeetsRequirements = (pwd) => {
    if (!pwd || pwd.length < 8) return false;
    return /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /\d/.test(pwd) && /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
  };

  // Validate password form
  const validatePasswordForm = () => {
    const errors = {};
    if (!passwordData.currentPassword.trim()) {
      errors.currentPassword = t('currentPasswordRequired');
    }
    if (!passwordData.newPassword.trim()) {
      errors.newPassword = t('newPasswordRequired');
    } else if (passwordData.newPassword.length < 8) {
      errors.newPassword = t('newPasswordTooShort');
    } else if (!newPasswordMeetsRequirements(passwordData.newPassword)) {
      errors.newPassword = t('newPasswordRequirementsNotMet');
    } else if (passwordData.currentPassword.trim() && passwordData.newPassword === passwordData.currentPassword) {
      errors.newPassword = t('newPasswordSameAsCurrent');
    }
    if (!passwordData.confirmPassword.trim()) {
      errors.confirmPassword = t('confirmPasswordRequired');
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = t('passwordsDoNotMatch');
    }
    setPasswordValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveNotifications = async () => {
    setLoading(true);
    try {
      await userApi.updateNotificationPreferences({
        emailNotifications: notifications.emailNotifications,
        pushNotifications: notifications.pushNotifications,
        mpActivities: notifications.mpActivities,
        discussionUpdates: notifications.discussionUpdates,
        educationalContent: notifications.educationalContent,
        moderationNotices: notifications.moderationNotices
      });
      setOriginalNotifications({ ...notifications });
      if (notifications.pushNotifications) {
        const result = await subscribePush(userApi.getVapidPublicKey, userApi.savePushSubscription);
        if (result.ok) {
          setMessage('Notification preferences saved. Push notifications enabled.');
        } else {
          setMessage(`Preferences saved. Push could not be enabled: ${result.error || 'unsupported'}.`);
        }
      } else {
        await unsubscribePush(userApi.removePushSubscription);
        setMessage('Notification preferences saved successfully!');
      }
      setTimeout(() => setMessage(''), 4000);
    } catch (error) {
      setMessage('Failed to save notification preferences');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!validateProfileForm()) {
      setShakeProfileForm(true);
      setTimeout(() => setShakeProfileForm(false), 500);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        firstName: profileData.firstName?.trim() ?? '',
        lastName: profileData.lastName?.trim() ?? '',
        BOD: profileData.BOD ? (profileData.BOD instanceof Date ? profileData.BOD.toISOString() : profileData.BOD) : null,
        state: profileData.state?.trim() ?? '',
        constituency: profileData.constituency?.trim() ?? ''
      };
      await userApi.updateProfile(payload);
      setMessage('Profile updated successfully!');
      setOriginalProfileData({ ...profileData });
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(error?.response?.data?.message || 'Failed to update profile');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    if (!validatePasswordForm()) {
      setShakePasswordForm(true);
      setTimeout(() => setShakePasswordForm(false), 500);
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement API call to change password
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setMessage('Password changed successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordValidationErrors({});
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Failed to change password');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    try {
      logout();
      setShowLogoutConfirm(false);
      onClose();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  // Check if notification preferences have changed
  const hasNotificationChanges = () => {
    return Object.keys(notifications).some(key => 
      notifications[key] !== originalNotifications[key]
    );
  };

  const tabs = [
    { id: 'notifications', label: t('notificationSettings'), icon: '' },
    { id: 'profile', label: t('profileSettings'), icon: '' },
    { id: 'password', label: t('passwordSettings'), icon: '' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal - fixed height so all tabs show consistent modal size */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-[1200px] max-w-[95vw] mx-4 h-[85vh] min-h-[480px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">{t('settings')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            {message}
          </div>
        )}

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Sidebar */}
          <div className="flex-shrink-0 w-64 bg-gray-50 border-r border-gray-200 p-4 flex flex-col">
            <TabNavigation
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              orientation="vertical"
              className="flex-1"
            />
            
            {/* Logout Button */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg border-2 border-red-500 bg-red-50 text-red-700 hover:bg-red-100 transition-colors font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>{t('logout')}</span>
              </button>
            </div>
          </div>

          {/* Content - fills remaining height, scrolls per tab */}
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            <TabNavigation.Content activeTab={activeTab} tabId="notifications">
              <NotificationSettings
                notifications={notifications}
                onNotificationChange={handleNotificationChange}
                onSave={saveNotifications}
                loading={loading}
                hasChanges={hasNotificationChanges()}
              />
            </TabNavigation.Content>

            <TabNavigation.Content activeTab={activeTab} tabId="profile">
              <ProfileSettings
                profileData={profileData}
                onProfileChange={handleProfileChange}
                onSave={saveProfile}
                loading={loading}
                profileDataLoading={profileDataLoading}
                hasChanges={hasProfileChanges()}
                validationErrors={validationErrors}
                shakeForm={shakeProfileForm}
              />
            </TabNavigation.Content>

            <TabNavigation.Content activeTab={activeTab} tabId="password">
              <PasswordSettings
                passwordData={passwordData}
                onPasswordChange={handlePasswordChange}
                onChangePassword={changePassword}
                loading={loading}
                validationErrors={passwordValidationErrors}
                shakeForm={shakePasswordForm}
              />
            </TabNavigation.Content>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmation
        isOpen={showLogoutConfirm}
        onConfirm={confirmLogout}
        onCancel={cancelLogout}
      />
    </div>
  );
}

export default SettingsModal;
