import React from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import AnalyticsChart from './AnalyticsChart';

const ActivityTimeline = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const activities = [
    { 
      action: t('bookmarkedTopic'), 
      details: 'Healthcare Reform Bill 2024', 
      time: '2 hours ago',
      icon: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    { 
      action: t('postedDiscussion'), 
      details: 'Thoughts on Education Budget Allocation', 
      time: '1 day ago',
      icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    { 
      action: t('completedQuiz'), 
      details: `Parliamentary Procedures - ${t('score')}: 85%`, 
      time: '2 days ago',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    { 
      action: t('submittedFeedback'), 
      details: 'Platform Usability Improvement', 
      time: '3 days ago',
      icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    }
  ];

  return (
    <AnalyticsChart 
      title={t('yourRecentActivity')}
      onClick={() => navigate('/reports/activity-timeline')}
      className="lg:col-span-2"
    >
      <div className="space-y-4">
        {activities.map((activity, index) => (
          <div key={index} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
            <div className={`w-8 h-8 ${activity.bgColor} rounded-full flex items-center justify-center flex-shrink-0`}>
              <svg className={`w-4 h-4 ${activity.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={activity.icon} />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{activity.action}</p>
              <p className="text-sm text-gray-600 truncate">{activity.details}</p>
              <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </AnalyticsChart>
  );
};

export default ActivityTimeline;

