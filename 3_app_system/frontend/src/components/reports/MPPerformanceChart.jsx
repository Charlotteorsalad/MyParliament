import React from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import AnalyticsChart from './AnalyticsChart';

const MPPerformanceChart = ({ reportData }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <AnalyticsChart 
      title={t('topPerformingMPs')}
      onClick={() => navigate('/reports/mp-performance')}
    >
      <div className="space-y-4">
        {reportData?.mpPerformance?.topPerformers?.map((mp, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-indigo-600">#{index + 1}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{mp.name}</p>
                <p className="text-xs text-gray-500">{mp.party}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{mp.responses} {t('responses')}</p>
              <p className="text-xs text-gray-500">{mp.attendance}% {t('attendance')}</p>
            </div>
          </div>
        ))}
      </div>
    </AnalyticsChart>
  );
};

MPPerformanceChart.propTypes = {
  reportData: PropTypes.object
};

export default MPPerformanceChart;

