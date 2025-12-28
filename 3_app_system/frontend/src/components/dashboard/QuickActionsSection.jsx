import React from 'react';
import PropTypes from 'prop-types';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../ui';
import QuickActionCard from './QuickActionCard';

const QuickActionsSection = ({ 
  isAuthenticated, 
  onNavigation,
  pinnedTabs = [],
  togglePin,
  isPinned,
  PinButton
}) => {
  const { t } = useLanguage();
  
  const actions = [
    {
      id: 'mp-dashboard',
      title: t('mpDashboard'),
      description: t('exploreMembersOfParliament'),
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      path: '/mps'
    },
    {
      id: 'edu-content',
      title: t('educationalContent'),
      description: t('learnAboutParliamentaryProcesses'),
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      path: '/edu'
    },
    {
      id: 'forum-discussions',
      title: t('discussionForum'),
      description: t('joinPoliticalDiscussions'),
      icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      path: '/forum'
    }
  ];

  // Helper functions for pinned items
  const getTabIcon = (tabId) => {
    const iconMap = {
      'mp-dashboard': 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      'mp-featured': 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
      'mp-all': 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      'edu-content': 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      'forum-discussions': 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      'forum-created': 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      'forum-notifications': 'M15 17h5l-5 5v-5zM9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      'reports-overview': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      'reports-my': 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      'nav-issues': 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      'nav-mps': 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      'nav-edu': 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      'nav-forum': 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      'nav-reports': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      'nav-feedback': 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
    };
    return iconMap[tabId] || 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
  };

  const getTabDescription = (tabId) => {
    const descriptions = {
      'mp-dashboard': t('exploreMembersOfParliament'),
      'mp-featured': 'Top 10 most active MPs',
      'mp-all': 'Complete directory of all MPs',
      'edu-content': t('learnAboutParliamentaryProcesses'),
      'forum-discussions': t('joinPoliticalDiscussions'),
      'forum-created': 'Your created discussions',
      'forum-notifications': 'Forum notifications',
      'reports-overview': 'Analytics and insights overview',
      'reports-my': 'Your personal reports',
      'nav-issues': 'Issue Portal - Submit and track issues',
      'nav-mps': t('mpDashboard') + ' - ' + t('exploreMembersOfParliament'),
      'nav-edu': t('educationalContent') + ' - Learn about governance',
      'nav-forum': t('discussionForum') + ' - ' + t('joinPoliticalDiscussions'),
      'nav-reports': 'Reports - Analytics and insights',
      'nav-feedback': 'Feedback - Share your thoughts'
    };
    return descriptions[tabId] || 'Quick access to this feature';
  };

  const handleTabClick = (tab) => {
    // Map tab IDs to navigation paths
    const pathMap = {
      'mp-dashboard': '/mps',
      'mp-featured': '/mps#featured',
      'mp-all': '/mps#all',
      'edu-content': '/edu',
      'forum-discussions': '/forum',
      'forum-created': '/forum#created',
      'forum-notifications': '/forum#notifications',
      'reports-overview': '/reports',
      'reports-my': '/reports#my-reports',
      'nav-issues': '/issues',
      'nav-mps': '/mps',
      'nav-edu': '/edu',
      'nav-forum': '/forum',
      'nav-reports': '/reports',
      'nav-feedback': '/feedback'
    };
    const path = pathMap[tab.id] || '/';
    onNavigation(path);
  };

  return (
    <Card className="bg-white/80 border-indigo-200/60">
      <Card.Header className="bg-gradient-to-r from-indigo-50/50 to-indigo-100/50">
        <h2 className="text-xl font-bold text-gray-900">
          {isAuthenticated ? t('quickActions') : t('exploreMyParliament')}
        </h2>
        <p className="text-gray-600 mt-1">
          {isAuthenticated 
            ? (pinnedTabs.length > 0 
                ? `${t('yourPinnedTabs')} (${pinnedTabs.length})` 
                : t('pinTabsForQuickAccess'))
            : t('discoverOurFeatures')
          }
        </p>
      </Card.Header>
      
      <Card.Body>
        {isAuthenticated && pinnedTabs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pinnedTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className="group p-6 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 hover:border-indigo-300 rounded-lg transition-all duration-300 text-left hover:shadow-lg"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="h-12 w-12 bg-indigo-500 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getTabIcon(tab.id)} />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                        {tab.name}
                        {tab.module && <span className="text-xs text-gray-500 ml-2">({tab.module})</span>}
                      </h3>
                      <p className="text-sm text-gray-600">{getTabDescription(tab.id)}</p>
                    </div>
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(tab.id, tab.name, tab.module);
                    }}
                    className="p-1 rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
                    title={t('unpinFromQuickActions')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        togglePin(tab.id, tab.name, tab.module);
                      }
                    }}
                  >
                    <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-center text-indigo-600 text-sm font-medium">
                  <span>{t('quickAccess')}</span>
                  <svg className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        ) : isAuthenticated ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noPinnedTabsYet')}</h3>
            <p className="text-gray-600">{t('clickPinIconToAdd')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {actions.map((action, index) => (
              <QuickActionCard
                key={index}
                title={action.title}
                description={action.description}
                icon={action.icon}
                onClick={() => onNavigation(action.path)}
              />
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

QuickActionsSection.propTypes = {
  isAuthenticated: PropTypes.bool.isRequired,
  onNavigation: PropTypes.func.isRequired,
  pinnedTabs: PropTypes.array,
  togglePin: PropTypes.func,
  isPinned: PropTypes.func,
  PinButton: PropTypes.elementType
};

export default QuickActionsSection;
