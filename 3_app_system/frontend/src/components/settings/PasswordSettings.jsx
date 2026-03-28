import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useLanguage } from '../../contexts/LanguageContext';
import { Button } from '../ui';

const PasswordSettings = ({ 
  passwordData, 
  onPasswordChange, 
  onChangePassword, 
  loading,
  validationErrors = {},
  shakeForm = false
}) => {
  const { t } = useLanguage();

  // Show/hide password toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Same strength & requirements logic as sign-up (UserRegisterPage)
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: '', color: 'text-gray-400' });
  const [requirements, setRequirements] = useState({ length: false, uppercase: false, lowercase: false, number: false, special: false });

  const EyeIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
  const EyeOffIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
    </svg>
  );

  useEffect(() => {
    const password = passwordData.newPassword || '';
    const req = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
    setRequirements(req);

    let score = 0;
    Object.values(req).forEach((v) => v && score++);
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    let feedback = '';
    let color = 'text-gray-400';
    if (score <= 2) {
      feedback = 'Weak';
      color = 'text-red-500';
    } else if (score <= 4) {
      feedback = 'Fair';
      color = 'text-yellow-500';
    } else if (score <= 6) {
      feedback = 'Good';
      color = 'text-blue-500';
    } else {
      feedback = 'Strong';
      color = 'text-green-500';
    }
    setPasswordStrength({ score, feedback, color });
  }, [passwordData.newPassword]);
  
  return (
    <div className={`space-y-6 ${shakeForm ? 'form-shake' : ''}`}>
      <h3 className="text-xl font-semibold text-gray-900">{t('changePassword')}</h3>
      
      <div className="space-y-4 max-w-md">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">{t('currentPassword')}</label>
          <div className="relative">
            <input
              type={showCurrentPassword ? 'text' : 'password'}
              value={passwordData.currentPassword}
              onChange={(e) => onPasswordChange('currentPassword', e.target.value)}
              disabled={loading}
              className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                validationErrors.currentPassword ? 'border-red-500' : 'border-gray-300'
              } ${loading ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword((s) => !s)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
              aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
            >
              {showCurrentPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {validationErrors.currentPassword && (
            <p className="text-sm text-red-600">{validationErrors.currentPassword}</p>
          )}
        </div>

        <div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{t('newPassword')}</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={passwordData.newPassword}
                onChange={(e) => onPasswordChange('newPassword', e.target.value)}
                disabled={loading}
                className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  validationErrors.newPassword ? 'border-red-500' : 'border-gray-300'
                } ${loading ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((s) => !s)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {validationErrors.newPassword && (
              <p className="text-sm text-red-600">{validationErrors.newPassword}</p>
            )}
          </div>
          {passwordData.newPassword && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600">Password strength</span>
                <span className={`text-xs font-semibold ${passwordStrength.color}`}>{passwordStrength.feedback}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`${passwordStrength.score <= 2 ? 'bg-red-500' : passwordStrength.score <= 4 ? 'bg-yellow-500' : passwordStrength.score <= 6 ? 'bg-blue-500' : 'bg-green-500'} h-2 rounded-full transition-all duration-300`}
                  style={{ width: `${(passwordStrength.score / 7) * 100}%` }}
                />
              </div>
            </div>
          )}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Password Requirements:</h4>
            <div className="space-y-2">
              <div className="flex items-center">
                <div className={`${requirements.length ? 'bg-green-500' : 'bg-gray-300'} w-4 h-4 rounded-full mr-3 flex items-center justify-center`}>
                  {requirements.length && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className={`${requirements.length ? 'text-green-700' : 'text-gray-500'} text-sm`}>
                  At least 8 characters long
                </span>
              </div>
              <div className="flex items-center">
                <div className={`${requirements.uppercase ? 'bg-green-500' : 'bg-gray-300'} w-4 h-4 rounded-full mr-3 flex items-center justify-center`}>
                  {requirements.uppercase && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className={`${requirements.uppercase ? 'text-green-700' : 'text-gray-500'} text-sm`}>
                  One uppercase letter (A-Z)
                </span>
              </div>
              <div className="flex items-center">
                <div className={`${requirements.lowercase ? 'bg-green-500' : 'bg-gray-300'} w-4 h-4 rounded-full mr-3 flex items-center justify-center`}>
                  {requirements.lowercase && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className={`${requirements.lowercase ? 'text-green-700' : 'text-gray-500'} text-sm`}>
                  One lowercase letter (a-z)
                </span>
              </div>
              <div className="flex items-center">
                <div className={`${requirements.number ? 'bg-green-500' : 'bg-gray-300'} w-4 h-4 rounded-full mr-3 flex items-center justify-center`}>
                  {requirements.number && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className={`${requirements.number ? 'text-green-700' : 'text-gray-500'} text-sm`}>
                  One number (0-9)
                </span>
              </div>
              <div className="flex items-center">
                <div className={`${requirements.special ? 'bg-green-500' : 'bg-gray-300'} w-4 h-4 rounded-full mr-3 flex items-center justify-center`}>
                  {requirements.special && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className={`${requirements.special ? 'text-green-700' : 'text-gray-500'} text-sm`}>
                  One special character (!@#$%^&*)
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">{t('confirmNewPassword')}</label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={passwordData.confirmPassword}
              onChange={(e) => onPasswordChange('confirmPassword', e.target.value)}
              disabled={loading}
              className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                validationErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
              } ${loading ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((s) => !s)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {validationErrors.confirmPassword && (
            <p className="text-sm text-red-600">{validationErrors.confirmPassword}</p>
          )}
        </div>
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
  loading: PropTypes.bool.isRequired,
  validationErrors: PropTypes.object,
  shakeForm: PropTypes.bool
};

export default PasswordSettings;

