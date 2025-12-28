import React from 'react';
import PropTypes from 'prop-types';
import { useLanguage } from '../../contexts/LanguageContext';
import ReportCard from './ReportCard';

const UserReportsList = () => {
  const { t } = useLanguage();
  
  const reports = [
    {
      title: t('myActivitySummary'),
      description: t('myActivitySummaryDesc'),
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      lastUpdated: '2 hours ago',
      dataPoints: ['12 bookmarks', '8 discussions', '15 resources', '23 total activities']
    },
    {
      title: t('myLearningProgress'),
      description: t('myLearningProgressDesc'),
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      lastUpdated: '1 day ago',
      dataPoints: ['15 resources', '8 quizzes', '85% avg score', '3 certificates']
    },
    {
      title: t('myMPInteractions'),
      description: t('myMPInteractionsDesc'),
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      lastUpdated: '3 hours ago',
      dataPoints: ['5 MPs followed', '12 questions', '8 responses', '4 parties']
    },
    {
      title: t('myDiscussionHistory'),
      description: t('myDiscussionHistoryDesc'),
      icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      lastUpdated: '5 hours ago',
      dataPoints: ['8 discussions', '23 replies', '156 views', '3 topics']
    },
    {
      title: t('myBookmarkCollection'),
      description: t('myBookmarkCollectionDesc'),
      icon: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
      lastUpdated: '1 hour ago',
      dataPoints: ['8 topics', '4 MPs', '3 categories', '12 total']
    },
    {
      title: 'My Feedback & Surveys',
      description: 'All feedback submitted, surveys completed, and suggestions provided',
      icon: 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      lastUpdated: '2 days ago',
      dataPoints: ['3 feedback', '2 surveys', '1 suggestion', '4.2 rating']
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">My Reports</h2>
        <p className="text-gray-600">View and export your personal parliamentary activity reports.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report, index) => (
          <ReportCard key={index} report={report} />
        ))}
      </div>
    </div>
  );
};

export default UserReportsList;

