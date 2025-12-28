import React from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import AnalyticsChart from './AnalyticsChart';

const UserActivitySummary = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const activities = [
    {
      title: t('topicsBookmarked'),
      description: t('topicsBookmarkedDesc'),
      value: 12,
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: t('forumDiscussions'),
      description: t('forumDiscussionsDesc'),
      value: 8,
      icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: t('educationalResources'),
      description: t('educationalResourcesDesc'),
      value: 15,
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: t('feedbackSubmitted'),
      description: t('feedbackSubmittedDesc'),
      value: 3,
      icon: 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ];

  return (
    <AnalyticsChart 
      title={t('myActivitySummary')}
      onClick={() => navigate('/reports/activity-summary')}
    >
      <div className="space-y-4">
        {activities.map((activity, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 ${activity.bgColor} rounded-full flex items-center justify-center`}>
                <svg className={`w-4 h-4 ${activity.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={activity.icon} />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                <p className="text-xs text-gray-500">{activity.description}</p>
              </div>
            </div>
            <span className={`text-lg font-bold ${activity.color}`}>{activity.value}</span>
          </div>
        ))}
      </div>
    </AnalyticsChart>
  );
};

export default UserActivitySummary;

