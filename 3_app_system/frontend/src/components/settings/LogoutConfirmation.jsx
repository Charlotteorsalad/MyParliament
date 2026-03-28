import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { Button } from '../ui';

const LogoutConfirmation = ({ 
  isOpen, 
  onConfirm, 
  onCancel 
}) => {
  const { t } = useLanguage();

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }}
      />

      <div
        className="relative w-full max-w-[900px] bg-white rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="relative flex items-center justify-center p-6 border-b border-gray-200">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }}
          className="absolute right-0 top-0 p-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Close logout confirmation"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="w-full text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('confirmLogout')}</h3>
          <p className="text-gray-600 mb-6">
            {t('logoutConfirmationMessage')}
          </p>
        </div>
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
        <Button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }}
          variant="outline"
          className="flex-1"
        >
          {t('cancel')}
        </Button>
        <Button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onConfirm();
          }}
          variant="outline"
          className="flex-1 border-2 border-red-500 bg-red-50 text-red-700 hover:bg-red-100 focus:ring-red-400"
        >
          {t('logout')}
        </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

LogoutConfirmation.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
};

export default LogoutConfirmation;

