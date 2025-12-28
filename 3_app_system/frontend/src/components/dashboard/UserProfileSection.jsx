import React from 'react';
import PropTypes from 'prop-types';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card, TabNavigation } from '../ui';

const UserProfileSection = ({ 
  user, 
  stats, 
  activeTab, 
  onTabChange, 
  onFollowerModalOpen 
}) => {
  const { t } = useLanguage();
  
  const tabs = [
    { id: 'discussions', label: t('discussionCreated'), icon: '💬' },
    { id: 'replies', label: t('replies'), icon: '💭' },
    { id: 'activities', label: t('personalActivities'), icon: '📋' }
  ];

  const renderTabContent = (tabId) => {
    switch (tabId) {
      case 'discussions':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('yourDiscussions')}</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-gray-600">Discussion id: Dis1003</span>
                    <span className="text-sm text-gray-500">Topic: Death Penalty</span>
                    <span className="text-sm text-gray-500">Date: 2/8/2024</span>
                  </div>
                </div>
                <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors duration-200">
                  {t('view')}
                </button>
              </div>
              <div className="text-center text-gray-500 text-sm py-4">
                {t('noMoreDiscussions')}
              </div>
            </div>
          </div>
        );
      
      case 'replies':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('yourReplies')}</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-gray-600">Reply to: Dis1003</span>
                    <span className="text-sm text-gray-500">Topic: Death Penalty</span>
                    <span className="text-sm text-gray-500">Date: 3/8/2024</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-2">I think the death penalty should be abolished because...</p>
                </div>
                <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors duration-200">
                  {t('view')}
                </button>
              </div>
              <div className="text-center text-gray-500 text-sm py-4">
                {t('noMoreReplies')}
              </div>
            </div>
          </div>
        );
      
      case 'activities':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('personalActivities')}</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-gray-600">Followed MP: John Doe</span>
                    <span className="text-sm text-gray-500">Date: 1/8/2024</span>
                  </div>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                  {t('following')}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-gray-600">Bookmarked: Parliamentary Process Guide</span>
                    <span className="text-sm text-gray-500">Date: 30/7/2024</span>
                  </div>
                </div>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                  {t('bookmarked')}
                </span>
              </div>
              <div className="text-center text-gray-500 text-sm py-4">
                {t('noMoreActivities')}
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <Card className="bg-white/80 border-indigo-200/60">
      {/* Profile Header */}
      <Card.Header className="bg-gradient-to-r from-indigo-50/50 to-indigo-100/50">
        <div className="flex items-center space-x-4">
          <div className="h-16 w-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
            <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{user?.username || 'User'}</h2>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 lg:gap-6 mt-2">
              <button
                onClick={() => onFollowerModalOpen('mps')}
                className="flex items-center text-xs sm:text-sm text-gray-600 hover:text-indigo-600 transition-colors duration-200 group min-w-0"
              >
                <svg className="h-4 w-4 mr-1 group-hover:scale-110 transition-transform duration-200 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="font-medium group-hover:underline truncate">{stats.followedMPs} {t('followedMPs')}</span>
              </button>
              <button
                onClick={() => onFollowerModalOpen('topics')}
                className="flex items-center text-xs sm:text-sm text-gray-600 hover:text-indigo-600 transition-colors duration-200 group min-w-0"
              >
                <svg className="h-4 w-4 mr-1 group-hover:scale-110 transition-transform duration-200 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="font-medium group-hover:underline truncate">{stats.followedTopics} {t('followedTopics')}</span>
              </button>
              <button
                onClick={() => onFollowerModalOpen('eduContent')}
                className="flex items-center text-xs sm:text-sm text-gray-600 hover:text-indigo-600 transition-colors duration-200 group min-w-0"
              >
                <svg className="h-4 w-4 mr-1 group-hover:scale-110 transition-transform duration-200 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="font-medium group-hover:underline truncate">{stats.bookmarkedEduContent || 0} {t('bookmarkedEduContent')}</span>
              </button>
              <button
                onClick={() => onFollowerModalOpen('issues')}
                className="flex items-center text-xs sm:text-sm text-gray-600 hover:text-indigo-600 transition-colors duration-200 group min-w-0"
              >
                <svg className="h-4 w-4 mr-1 group-hover:scale-110 transition-transform duration-200 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="font-medium group-hover:underline truncate">{stats.bookmarkedIssues || 0} {t('bookmarkedIssues')}</span>
              </button>
            </div>
          </div>
        </div>
      </Card.Header>

      {/* Profile Tabs */}
      <div className="border-b border-gray-200">
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      </div>

      {/* Tab Content */}
      <Card.Body>
        {renderTabContent(activeTab)}
      </Card.Body>
    </Card>
  );
};

UserProfileSection.propTypes = {
  user: PropTypes.object,
  stats: PropTypes.shape({
    followedMPs: PropTypes.number.isRequired,
    followedTopics: PropTypes.number.isRequired,
    bookmarkedEduContent: PropTypes.number,
    bookmarkedIssues: PropTypes.number
  }).isRequired,
  activeTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
  onFollowerModalOpen: PropTypes.func.isRequired
};

export default UserProfileSection;

