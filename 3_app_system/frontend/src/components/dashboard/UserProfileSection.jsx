import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card, TabNavigation } from '../ui';

const EmptyState = ({ message }) => {
  if (!message) return null;
  return (
  <div className="flex flex-col items-center justify-center py-12 text-gray-500">
    <svg className="h-12 w-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    <p className="text-sm font-medium">{message}</p>
  </div>
  );
};

EmptyState.propTypes = { message: PropTypes.string.isRequired };

const UserProfileSection = ({ 
  user, 
  stats, 
  activeTab, 
  onTabChange, 
  onFollowerModalOpen,
  userDiscussions = [],
  userReplies = [],
  userActivities = []
}) => {
  const { t } = useLanguage();
  const [pageByTab, setPageByTab] = useState({
    discussions: 1,
    replies: 1,
    activities: 1,
  });
  const [pageInputByTab, setPageInputByTab] = useState({
    discussions: '1',
    replies: '1',
    activities: '1',
  });
  const itemsPerPage = 5;
  
  const tabs = [
    { id: 'discussions', label: t('discussionCreated'), icon: '' },
    { id: 'replies', label: t('replies'), icon: '' },
    { id: 'activities', label: t('personalActivities'), icon: '' }
  ];

  const renderTabContent = (tabId) => {
    switch (tabId) {
      case 'discussions':
        {
          const tabKey = 'discussions';
          const totalItems = userDiscussions.length;
          const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
          const currentPage = Math.min(pageByTab[tabKey] || 1, totalPages);
          const startIndex = (currentPage - 1) * itemsPerPage;
          const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
          const visibleItems = userDiscussions.slice(startIndex, endIndex);

          const setPage = (newPage) => {
            const safePage = Math.min(Math.max(newPage, 1), totalPages);
            setPageByTab((prev) => ({ ...prev, [tabKey]: safePage }));
            setPageInputByTab((prev) => ({ ...prev, [tabKey]: String(safePage) }));
          };

          const handlePageChange = (delta) => setPage(currentPage + delta);
          const goToFirstPage = () => setPage(1);
          const goToLastPage = () => setPage(totalPages);
          const handleInputChange = (e) => {
            const value = e.target.value;
            setPageInputByTab((prev) => ({ ...prev, [tabKey]: value }));
          };
          const handleInputKeyPress = (e) => {
            if (e.key === 'Enter') {
              const parsed = parseInt(pageInputByTab[tabKey], 10);
              if (!isNaN(parsed) && parsed > 0) setPage(parsed);
              else setPageInputByTab((prev) => ({ ...prev, [tabKey]: String(currentPage) }));
            }
          };
          const handleInputBlur = () => {
            const parsed = parseInt(pageInputByTab[tabKey], 10);
            if (isNaN(parsed) || parsed < 1) {
              setPageInputByTab((prev) => ({ ...prev, [tabKey]: String(currentPage) }));
            } else {
              setPage(parsed);
            }
          };

          return (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('yourDiscussions')}</h3>
              {totalItems === 0 ? (
                <EmptyState message={t('noData')} />
              ) : (
                <>
                  <div className="space-y-3">
                    {visibleItems.map((d) => (
                      <div key={d.id || d._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{d.title}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            {d.category && t(d.category)} · {d.createdAt && new Date(d.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Link
                          to={`/forum/reply/${d._id || d.id}`}
                          className="ml-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors duration-200 flex-shrink-0 inline-block"
                        >
                          {t('view')}
                        </Link>
                      </div>
                    ))}
                  </div>

                  {totalItems > 0 && (
                    <div className="mt-4 bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-gray-600">
                          {t('showing')} {startIndex + 1} {t('to')} {endIndex} {t('of')} {totalItems} {t('discussions')}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            disabled={currentPage <= 1}
                            onClick={() => handlePageChange(-1)}
                            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {t('previous')}
                          </button>
                          <form onSubmit={(e) => { e.preventDefault(); const parsed = parseInt(pageInputByTab[tabKey], 10); if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) setPage(parsed); }}>
                            <input
                              type="number"
                              min={1}
                              max={totalPages}
                              value={pageInputByTab[tabKey]}
                              onChange={handleInputChange}
                              onKeyDown={handleInputKeyPress}
                              onBlur={handleInputBlur}
                              className="w-12 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center disabled:bg-gray-100 disabled:cursor-not-allowed focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder={currentPage}
                              aria-label="Page number"
                            />
                          </form>
                          <button
                            disabled={currentPage >= totalPages}
                            onClick={() => handlePageChange(1)}
                            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {t('next')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        }
      
      case 'replies':
        {
          const tabKey = 'replies';
          const totalItems = userReplies.length;
          const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
          const currentPage = Math.min(pageByTab[tabKey] || 1, totalPages);
          const startIndex = (currentPage - 1) * itemsPerPage;
          const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
          const visibleItems = userReplies.slice(startIndex, endIndex);

          const setPage = (newPage) => {
            const safePage = Math.min(Math.max(newPage, 1), totalPages);
            setPageByTab((prev) => ({ ...prev, [tabKey]: safePage }));
            setPageInputByTab((prev) => ({ ...prev, [tabKey]: String(safePage) }));
          };

          const handlePageChange = (delta) => setPage(currentPage + delta);
          const goToFirstPage = () => setPage(1);
          const goToLastPage = () => setPage(totalPages);
          const handleInputChange = (e) => {
            const value = e.target.value;
            setPageInputByTab((prev) => ({ ...prev, [tabKey]: value }));
          };
          const handleInputKeyPress = (e) => {
            if (e.key === 'Enter') {
              const parsed = parseInt(pageInputByTab[tabKey], 10);
              if (!isNaN(parsed) && parsed > 0) setPage(parsed);
              else setPageInputByTab((prev) => ({ ...prev, [tabKey]: String(currentPage) }));
            }
          };
          const handleInputBlur = () => {
            const parsed = parseInt(pageInputByTab[tabKey], 10);
            if (isNaN(parsed) || parsed < 1) {
              setPageInputByTab((prev) => ({ ...prev, [tabKey]: String(currentPage) }));
            } else {
              setPage(parsed);
            }
          };

          return (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('yourReplies')}</h3>
              {totalItems === 0 ? (
                <EmptyState message={t('noData')} />
              ) : (
                <>
                  <div className="space-y-3">
                    {visibleItems.map((r) => (
                      <div key={r.id || r._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {r.topicTitle || r.discussionTitle || t('reply')}
                          </p>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{r.contentPreview || r.content}</p>
                          <p className="text-sm text-gray-500 mt-1">{r.createdAt && new Date(r.createdAt).toLocaleDateString()}</p>
                        </div>
                        {r.topicId ? (
                          <Link
                            to={`/forum/reply/${r.topicId}`}
                            className="ml-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors duration-200 flex-shrink-0 inline-block"
                          >
                            {t('view')}
                          </Link>
                        ) : (
                          <span className="ml-4 px-4 py-2 bg-gray-300 text-gray-500 text-sm font-medium rounded-lg flex-shrink-0 inline-block cursor-default">
                            {t('view')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {totalItems > 0 && (
                    <div className="mt-4 bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-gray-600">
                          {t('showing')} {startIndex + 1} {t('to')} {endIndex} {t('of')} {totalItems} {t('replies')}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            disabled={currentPage <= 1}
                            onClick={() => handlePageChange(-1)}
                            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {t('previous')}
                          </button>
                          <form onSubmit={(e) => { e.preventDefault(); const parsed = parseInt(pageInputByTab[tabKey], 10); if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) setPage(parsed); }}>
                            <input
                              type="number"
                              min={1}
                              max={totalPages}
                              value={pageInputByTab[tabKey]}
                              onChange={handleInputChange}
                              onKeyDown={handleInputKeyPress}
                              onBlur={handleInputBlur}
                              className="w-12 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center disabled:bg-gray-100 disabled:cursor-not-allowed focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder={currentPage}
                              aria-label="Page number"
                            />
                          </form>
                          <button
                            disabled={currentPage >= totalPages}
                            onClick={() => handlePageChange(1)}
                            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {t('next')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        }
      
      case 'activities':
        {
          const tabKey = 'activities';

          // Badge colour + label; icon rendered with SVG instead of emoji
          const activityConfig = {
            edu_view:           { label: 'Viewed education',     color: 'bg-blue-100 text-blue-800' },
            mp_view:            { label: 'Viewed MP profile',    color: 'bg-purple-100 text-purple-800' },
            issue_view:         { label: 'Viewed issue topic',   color: 'bg-indigo-100 text-indigo-800' },
            forum_view:         { label: 'Viewed discussion',    color: 'bg-cyan-100 text-cyan-800' },
            quiz_submit:        { label: 'Completed quiz',       color: 'bg-green-100 text-green-800' },
            forum_reply:        { label: 'Replied',              color: 'bg-orange-100 text-orange-800' },
            forum_topic_create: { label: 'Created discussion',   color: 'bg-pink-100 text-pink-800' },
            feedback_submit:    { label: 'Submitted feedback',   color: 'bg-yellow-100 text-yellow-800' },
            mp_follow:          { label: 'Followed MP',          color: 'bg-emerald-100 text-emerald-800' },
            mp_unfollow:        { label: 'Unfollowed MP',        color: 'bg-gray-100 text-gray-600' },
            topic_follow:       { label: 'Followed topic',       color: 'bg-teal-100 text-teal-800' },
            topic_unfollow:     { label: 'Unfollowed topic',     color: 'bg-gray-100 text-gray-600' },
            bookmark_add:       { label: 'Bookmarked',           color: 'bg-amber-100 text-amber-800' },
            bookmark_remove:    { label: 'Removed bookmark',     color: 'bg-gray-100 text-gray-600' },
            profile_update:     { label: 'Updated profile',      color: 'bg-slate-100 text-slate-700' },
            password_change:    { label: 'Changed password',     color: 'bg-red-100 text-red-700' },
            content_view:       { label: 'Viewed content',       color: 'bg-blue-100 text-blue-700' },
            content_search:     { label: 'Searched',             color: 'bg-gray-100 text-gray-700' },
          };

          const getNavLink = (a) => {
            const meta = a.metadata || {};

            // From activities we normally come from profile, so include returnTo=/profile
            if (a.type === 'edu_view' && meta.resourceId) {
              return `/edu/${meta.resourceId}?returnTo=/profile`;
            }
            if (a.type === 'issue_view' && meta.resourceId) {
              return `/topic/${meta.resourceId}?returnTo=/profile`;
            }
            if (a.type === 'forum_view' && meta.resourceId) {
              return `/forum/reply/${meta.resourceId}?returnTo=/profile`;
            }
            if (a.type === 'forum_reply' && meta.topicId) {
              return `/forum/reply/${meta.topicId}?returnTo=/profile`;
            }
            if (a.type === 'forum_topic_create' && meta.topicId) {
              return `/forum/reply/${meta.topicId}?returnTo=/profile`;
            }
            if (a.type === 'mp_view') {
              // Use MP name for lookup – MpDashboard supports ?name=... and will open detail via getDetailByName
              const name = meta.title || a.description?.replace(/^Viewed MP profile:\s*/, '') || '';
              if (!name) return null;
              return `/mps?name=${encodeURIComponent(name)}&returnTo=/profile`;
            }
            return null;
          };

          const totalItems = userActivities.length;
          const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
          const currentPage = Math.min(pageByTab[tabKey] || 1, totalPages);
          const startIndex = (currentPage - 1) * itemsPerPage;
          const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
          const visibleItems = userActivities.slice(startIndex, endIndex);

          const setPage = (newPage) => {
            const safePage = Math.min(Math.max(newPage, 1), totalPages);
            setPageByTab((prev) => ({ ...prev, [tabKey]: safePage }));
            setPageInputByTab((prev) => ({ ...prev, [tabKey]: String(safePage) }));
          };

          const handlePageChange = (delta) => setPage(currentPage + delta);
          const goToFirstPage = () => setPage(1);
          const goToLastPage = () => setPage(totalPages);
          const handleInputChange = (e) => {
            const value = e.target.value;
            setPageInputByTab((prev) => ({ ...prev, [tabKey]: value }));
          };
          const handleInputKeyPress = (e) => {
            if (e.key === 'Enter') {
              const parsed = parseInt(pageInputByTab[tabKey], 10);
              if (!isNaN(parsed) && parsed > 0) setPage(parsed);
              else setPageInputByTab((prev) => ({ ...prev, [tabKey]: String(currentPage) }));
            }
          };
          const handleInputBlur = () => {
            const parsed = parseInt(pageInputByTab[tabKey], 10);
            if (isNaN(parsed) || parsed < 1) {
              setPageInputByTab((prev) => ({ ...prev, [tabKey]: String(currentPage) }));
            } else {
              setPage(parsed);
            }
          };

          return (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('personalActivities')}</h3>
              {totalItems === 0 ? (
                <EmptyState message={t('noData')} />
              ) : (
                <>
                  <div className="space-y-3">
                    {visibleItems.map((a, idx) => {
                      const cfg = activityConfig[a.type] || { label: a.label || a.type, color: 'bg-gray-100 text-gray-700' };
                      const navLink = getNavLink(a);
                      return (
                        <div key={a._id || idx} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="flex-shrink-0 mt-0.5">
                              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-indigo-50 text-indigo-600">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{a.description || cfg.label}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {a.createdAt && new Date(a.createdAt).toLocaleString('en-MY', {
                                  year: 'numeric', month: 'short', day: 'numeric',
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            {navLink && (
                              <Link
                                to={navLink}
                                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                              >
                                {t('view')}
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {totalItems > 0 && (
                    <div className="mt-4 bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-gray-600">
                          {t('showing')} {startIndex + 1} {t('to')} {endIndex} {t('of')} {totalItems} {t('activities') || t('personalActivities')}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            disabled={currentPage <= 1}
                            onClick={() => handlePageChange(-1)}
                            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {t('previous')}
                          </button>
                          <form onSubmit={(e) => { e.preventDefault(); const parsed = parseInt(pageInputByTab[tabKey], 10); if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) setPage(parsed); }}>
                            <input
                              type="number"
                              min={1}
                              max={totalPages}
                              value={pageInputByTab[tabKey]}
                              onChange={handleInputChange}
                              onKeyDown={handleInputKeyPress}
                              onBlur={handleInputBlur}
                              className="w-12 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center disabled:bg-gray-100 disabled:cursor-not-allowed focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder={currentPage}
                              aria-label="Page number"
                            />
                          </form>
                          <button
                            disabled={currentPage >= totalPages}
                            onClick={() => handlePageChange(1)}
                            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {t('next')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        }
      
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
                onClick={() => onFollowerModalOpen('discussions')}
                className="flex items-center text-xs sm:text-sm text-gray-600 hover:text-indigo-600 transition-colors duration-200 group min-w-0"
              >
                <svg className="h-4 w-4 mr-1 group-hover:scale-110 transition-transform duration-200 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 10c0-3.314-2.686-6-6-6S6 6.686 6 10c0 1.657.672 3.157 1.757 4.243L6 18v1h12v-1l-1.757-3.757A5.985 5.985 0 0018 10z" />
                </svg>
                <span className="font-medium group-hover:underline truncate">{stats.bookmarkedDiscussions || 0} {t('bookmarkedDiscussions')}</span>
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
    bookmarkedIssues: PropTypes.number,
    bookmarkedDiscussions: PropTypes.number,
  }).isRequired,
  activeTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
  onFollowerModalOpen: PropTypes.func.isRequired,
  userDiscussions: PropTypes.array,
  userReplies: PropTypes.array,
  userActivities: PropTypes.array
};

export default UserProfileSection;

