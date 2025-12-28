import React from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import AnalyticsChart from './AnalyticsChart';

const TopicCategoriesChart = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const categories = [
    { name: t('healthcare'), count: 45, color: 'bg-blue-500', percentage: 29 },
    { name: t('education'), count: 38, color: 'bg-green-500', percentage: 24 },
    { name: t('environment'), count: 32, color: 'bg-emerald-500', percentage: 21 },
    { name: t('economy'), count: 28, color: 'bg-yellow-500', percentage: 18 },
    { name: t('security'), count: 13, color: 'bg-red-500', percentage: 8 }
  ];

  return (
    <AnalyticsChart 
      title={t('topicCategoriesDistribution')}
      onClick={() => navigate('/reports/topic-categories')}
    >
      <div className="space-y-4">
        {categories.map((category, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${category.color}`}></div>
              <span className="text-sm font-medium text-gray-700">{category.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${category.color}`} 
                  style={{width: `${category.percentage}%`}}
                ></div>
              </div>
              <span className="text-sm text-gray-600 w-8 text-right">{category.count}</span>
            </div>
          </div>
        ))}
      </div>
    </AnalyticsChart>
  );
};

export default TopicCategoriesChart;

