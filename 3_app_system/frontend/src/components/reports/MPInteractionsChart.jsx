import React from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import AnalyticsChart from './AnalyticsChart';

const MPInteractionsChart = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const followedMPs = [
    { name: 'Ahmad', party: 'PH', color: 'bg-blue-500' },
    { name: 'Sarah', party: 'BN', color: 'bg-red-500' },
    { name: 'Lim', party: 'DAP', color: 'bg-green-500' },
    { name: 'Hassan', party: 'PAS', color: 'bg-purple-500' },
    { name: 'Priya', party: 'PKR', color: 'bg-yellow-500' }
  ];

  return (
    <AnalyticsChart 
      title={t('myMPInteractions')}
      onClick={() => navigate('/reports/mp-interactions')}
    >
      <div className="space-y-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-900">{t('mpsYouFollow')}</h4>
            <span className="text-sm text-gray-500">5 {t('mps')}</span>
          </div>
          <div className="flex -space-x-2">
            {followedMPs.map((mp, index) => (
              <div key={index} className={`w-8 h-8 rounded-full ${mp.color} flex items-center justify-center text-white text-xs font-bold border-2 border-white`}>
                {mp.name[0]}
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-indigo-50 rounded-lg">
            <div className="text-lg font-bold text-indigo-600">12</div>
            <div className="text-xs text-gray-600">{t('questionsAsked')}</div>
          </div>
          <div className="text-center p-3 bg-emerald-50 rounded-lg">
            <div className="text-lg font-bold text-emerald-600">8</div>
            <div className="text-xs text-gray-600">{t('responsesReceived')}</div>
          </div>
        </div>
      </div>
    </AnalyticsChart>
  );
};

export default MPInteractionsChart;

