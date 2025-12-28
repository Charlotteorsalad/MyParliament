import React from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import QuickStatsCard from './QuickStatsCard';

const QuickStatsGrid = ({ userSummary, isAuthenticated }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  if (!isAuthenticated || !userSummary) return null;

  const statsCards = [
    {
      title: t('myBookmarks'),
      value: userSummary.quickStats?.bookmarks || 0,
      icon: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
      onClick: () => navigate('/reports/bookmarks'),
      stats: [
        { label: t('topics'), value: userSummary.quickStats?.bookmarks || 0, color: 'text-indigo-600' },
        { label: t('mps'), value: 0, color: 'text-emerald-600' }
      ]
    },
    {
      title: t('myDiscussions'),
      value: userSummary.quickStats?.discussions || 0,
      icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
      onClick: () => navigate('/reports/discussions'),
      stats: [
        { label: t('replies'), value: 23, color: 'text-emerald-600' },
        { label: t('views'), value: 156, color: 'text-blue-600' }
      ]
    },
    {
      title: t('myLearning'),
      value: userSummary.quickStats?.learning || 0,
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      onClick: () => navigate('/reports/learning'),
      stats: [
        { label: t('resources'), value: 15, color: 'text-purple-600' },
        { label: t('quizzes'), value: 8, color: 'text-indigo-600' }
      ]
    },
    {
      title: t('myActivity'),
      value: userSummary.quickStats?.activities || 0,
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      onClick: () => navigate('/reports/activity'),
      stats: [
        { label: 'This Month', value: '+5', color: 'text-orange-600' },
        { label: 'Last Activity', value: '2h ago', color: 'text-green-600' }
      ]
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {statsCards.map((card, index) => (
        <QuickStatsCard key={index} {...card} />
      ))}
    </div>
  );
};

QuickStatsGrid.propTypes = {
  userSummary: PropTypes.object,
  isAuthenticated: PropTypes.bool.isRequired
};

export default QuickStatsGrid;

