import { useState, useEffect } from "react";
import { useAuth } from "../hooks";
import { useLanguage } from "../contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { TabNavigation } from "./ui";
import { 
  NotificationSettings, 
  ProfileSettings, 
  PasswordSettings, 
  HelpSupport, 
  LogoutConfirmation 
} from "./settings";

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
    frequency: 'daily'
  });

  // Original notification preferences to track changes
  const [originalNotifications, setOriginalNotifications] = useState({
    emailNotifications: true,
    pushNotifications: true,
    mpActivities: true,
    discussionUpdates: true,
    educationalContent: false,
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

  // Validation errors for profile
  const [validationErrors, setValidationErrors] = useState({});

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

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

  // Load user data when modal opens
  useEffect(() => {
    if (isOpen && user) {
      const userProfileData = {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        BOD: user.BOD ? new Date(user.BOD) : null,
        state: user.state || '',
        constituency: user.constituency || ''
      };
      setProfileData(userProfileData);
      setOriginalProfileData(userProfileData);
    }
  }, [isOpen, user]);

  const handleNotificationChange = (key, value) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
  };

  const handleProfileChange = (key, value) => {
    setProfileData(prev => ({ ...prev, [key]: value }));
    // Clear validation error when user starts typing
    if (validationErrors[key]) {
      setValidationErrors(prev => ({ ...prev, [key]: "" }));
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
  };

  const saveNotifications = async () => {
    setLoading(true);
    try {
      // TODO: Implement API call to save notification preferences
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setMessage('Notification preferences saved successfully!');
      // Update original state to match current state after successful save
      setOriginalNotifications({ ...notifications });
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Failed to save notification preferences');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!validateProfileForm()) {
      return;
    }
    
    setLoading(true);
    try {
      // TODO: Implement API call to update profile
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setMessage('Profile updated successfully!');
      // Update original state to match current state after successful save
      setOriginalProfileData({ ...profileData });
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Failed to update profile');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage('New passwords do not match');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    
    setLoading(true);
    try {
      // TODO: Implement API call to change password
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setMessage('Password changed successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Failed to change password');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    console.log('Logout button clicked');
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
    { id: 'notifications', label: t('notificationSettings'), icon: '🔔' },
    { id: 'profile', label: t('profileSettings'), icon: '👤' },
    { id: 'password', label: t('passwordSettings'), icon: '🔒' },
    { id: 'help', label: t('helpSupport'), icon: '❓' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-6xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
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

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 flex flex-col">
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
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>{t('logout')}</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
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
                hasChanges={hasProfileChanges()}
                validationErrors={validationErrors}
              />
            </TabNavigation.Content>

            <TabNavigation.Content activeTab={activeTab} tabId="password">
              <PasswordSettings
                passwordData={passwordData}
                onPasswordChange={handlePasswordChange}
                onChangePassword={changePassword}
                loading={loading}
              />
            </TabNavigation.Content>

            <TabNavigation.Content activeTab={activeTab} tabId="help">
              <HelpSupport />
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
