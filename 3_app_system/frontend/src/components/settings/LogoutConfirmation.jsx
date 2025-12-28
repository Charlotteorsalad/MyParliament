import React from 'react';
import PropTypes from 'prop-types';
import { useLanguage } from '../../contexts/LanguageContext';
import { Modal, Button } from '../ui';

const LogoutConfirmation = ({ 
  isOpen, 
  onConfirm, 
  onCancel 
}) => {
  const { t } = useLanguage();
  
  return (
    <Modal isOpen={isOpen} onClose={onCancel} size="sm">
      <Modal.Header onClose={onCancel}>
        <div className="text-center">
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
      </Modal.Header>
      
      <Modal.Footer>
        <Button
          onClick={onCancel}
          variant="outline"
          className="flex-1"
        >
          {t('cancel')}
        </Button>
        <Button
          onClick={onConfirm}
          variant="danger"
          className="flex-1"
        >
          {t('logout')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

LogoutConfirmation.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
};

export default LogoutConfirmation;

