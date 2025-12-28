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
      
      <div className="space-y-4">
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
          checked={notifications.educationalContent}
          onChange={(e) => onNotificationChange('educationalContent', e.target.checked)}
          label={t('educationalContent')}
          description={t('educationalContentDesc')}
        />

        <div>
          <Input.Select
            label={t('notificationFrequency')}
            value={notifications.frequency}
            onChange={(e) => onNotificationChange('frequency', e.target.value)}
            options={[
              { value: 'instant', label: t('instant') },
              { value: 'daily', label: t('dailyDigest') },
              { value: 'weekly', label: t('weeklySummary') },
              { value: 'off', label: t('off') }
            ]}
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

