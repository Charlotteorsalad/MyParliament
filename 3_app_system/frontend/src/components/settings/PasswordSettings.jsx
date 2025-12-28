import React from 'react';
import PropTypes from 'prop-types';
import { useLanguage } from '../../contexts/LanguageContext';
import { Input, Button } from '../ui';

const PasswordSettings = ({ 
  passwordData, 
  onPasswordChange, 
  onChangePassword, 
  loading 
}) => {
  const { t } = useLanguage();
  
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-gray-900">{t('changePassword')}</h3>
      
      <div className="space-y-4 max-w-md">
        <Input
          label={t('currentPassword')}
          type="password"
          value={passwordData.currentPassword}
          onChange={(e) => onPasswordChange('currentPassword', e.target.value)}
        />
        
        <Input
          label={t('newPassword')}
          type="password"
          value={passwordData.newPassword}
          onChange={(e) => onPasswordChange('newPassword', e.target.value)}
        />
        
        <Input
          label={t('confirmNewPassword')}
          type="password"
          value={passwordData.confirmPassword}
          onChange={(e) => onPasswordChange('confirmPassword', e.target.value)}
        />
      </div>

      <Button
        onClick={onChangePassword}
        disabled={loading}
        variant="gradient"
        loading={loading}
      >
        {loading ? t('changing') : t('changePassword')}
      </Button>
    </div>
  );
};

PasswordSettings.propTypes = {
  passwordData: PropTypes.object.isRequired,
  onPasswordChange: PropTypes.func.isRequired,
  onChangePassword: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired
};

export default PasswordSettings;

