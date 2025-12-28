import React from 'react';
import PropTypes from 'prop-types';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../ui';

const HelpSupport = () => {
  const { t } = useLanguage();
  
  const helpItems = [
    {
      title: t('frequentlyAskedQuestions'),
      description: t('faqDescription'),
      action: t('viewFaq')
    },
    {
      title: t('contactSupport'),
      description: t('contactSupportDescription'),
      action: t('contactUs')
    },
    {
      title: t('userGuide'),
      description: t('userGuideDescription'),
      action: t('readGuide')
    },
    {
      title: t('feedback'),
      description: t('feedbackDescription'),
      action: t('sendFeedback')
    }
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-gray-900">{t('helpSupport')}</h3>
      
      <div className="space-y-4">
        {helpItems.map((item, index) => (
          <Card key={index} variant="flat" className="p-4">
            <h4 className="font-medium text-gray-900 mb-2">{item.title}</h4>
            <p className="text-sm text-gray-600 mb-3">{item.description}</p>
            <button className="text-indigo-600 hover:text-indigo-700 font-medium">
              {item.action}
            </button>
          </Card>
        ))}

        <Card variant="flat" className="p-4">
          <h4 className="font-medium text-gray-900 mb-2">{t('aboutMyParliament')}</h4>
          <p className="text-sm text-gray-600 mb-2">{t('version')}</p>
          <p className="text-sm text-gray-600">{t('copyright')}</p>
        </Card>
      </div>
    </div>
  );
};

export default HelpSupport;

