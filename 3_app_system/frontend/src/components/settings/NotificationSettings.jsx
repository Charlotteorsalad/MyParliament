import React from 'react';
import PropTypes from 'prop-types';
import { useLanguage } from '../../contexts/LanguageContext';
import { ToggleSwitch, Input, Button } from '../ui';

const NotificationSettings = ({ 
  notifications, 
  onNotificationChange, 
  onSave, 
  loading, 
  hasChanges 
}) => {
  const { t } = useLanguage();
  
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-gray-900">{t('notificationPreferences')}</h3>

      {/* Group 1: Channels (how to receive) */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          {t('notificationChannels')}
        </h4>
        <p className="text-sm text-gray-500">{t('notificationChannelsDesc')}</p>
        <div className="space-y-4 pl-0">
          <ToggleSwitch
            checked={notifications.emailNotifications}
            onChange={(e) => onNotificationChange('emailNotifications', e.target.checked)}
            label={t('emailNotifications')}
            description={t('emailNotificationsDesc')}
          />
          <ToggleSwitch
            checked={notifications.pushNotifications}
            onChange={(e) => onNotificationChange('pushNotifications', e.target.checked)}
            label={t('pushNotifications')}
            description={t('pushNotificationsDesc')}
          />
        </div>
      </div>

      {/* Group 2: Content types (what to receive) */}
      <div className="space-y-3 pt-2 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          {t('notificationContent')}
        </h4>
        <p className="text-sm text-gray-500">{t('notificationContentDesc')}</p>
        <div className="space-y-4 pl-0">
          <ToggleSwitch
            checked={notifications.mpActivities}
            onChange={(e) => onNotificationChange('mpActivities', e.target.checked)}
            label={t('mpActivities')}
            description={t('mpActivitiesDesc')}
          />
          <ToggleSwitch
            checked={notifications.discussionUpdates}
            onChange={(e) => onNotificationChange('discussionUpdates', e.target.checked)}
            label={t('discussionUpdates')}
            description={t('discussionUpdatesDesc')}
          />
          <ToggleSwitch
            checked={notifications.moderationNotices}
            onChange={(e) => onNotificationChange('moderationNotices', e.target.checked)}
            label={t('moderationNotices')}
            description={t('moderationNoticesDesc')}
          />
          <ToggleSwitch
            checked={notifications.educationalContent}
            onChange={(e) => onNotificationChange('educationalContent', e.target.checked)}
            label={t('educationalContent')}
            description={t('educationalContentDesc')}
          />
        </div>
      </div>

      <Button
        onClick={onSave}
        disabled={loading || !hasChanges}
        variant="gradient"
        loading={loading}
      >
        {loading ? t('saving') : t('savePreferences')}
      </Button>
    </div>
  );
};

NotificationSettings.propTypes = {
  notifications: PropTypes.object.isRequired,
  onNotificationChange: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  hasChanges: PropTypes.bool.isRequired
};

export default NotificationSettings;

