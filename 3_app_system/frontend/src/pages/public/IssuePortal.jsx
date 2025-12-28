import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { topicApi, bookmarkApi } from '../../api';
import { useApi } from '../../hooks';
import { useAuth } from '../../hooks';
import { useLanguage } from '../../contexts/LanguageContext';

function IssuePortal() {
  const navigate = useNavigate();
  const { executeApiCall, loading, error } = useApi();
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [topics, setTopics] = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [bookmarkedTopics, setBookmarkedTopics] = useState(new Set());
  const [stats, setStats] = useState({
    totalTopics: 0,
    totalViews: 0,
    totalBookmarks: 0
  });

  // Fetch topics data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch topics, categories, and stats in parallel
        const [topicsData, categoriesData, statsData] = await Promise.all([
          executeApiCall(() => topicApi.getAll({ 
            category: selectedCategory, 
            search: searchTerm 
          })),
          executeApiCall(() => topicApi.getCategories()),
          executeApiCall(() => topicApi.getStats())
        ]);

        setTopics(Array.isArray(topicsData) ? topicsData : []);
        setCategories(Array.isArray(categoriesData) ? categoriesData : [t('all')]);
        setStats(statsData || { totalTopics: 0, totalViews: 0, totalBookmarks: 0 });
      } catch (err) {
        console.error('Failed to fetch topics data:', err);
        // Set fallback data
        setTopics([]);
        setCategories([t('all')]);
        setStats({ totalTopics: 0, totalViews: 0, totalBookmarks: 0 });
      }
    };

    fetchData();
  }, [executeApiCall, selectedCategory, searchTerm]);

  // Since filtering is now done on the backend, we can use topics directly
  const filteredTopics = Array.isArray(topics) ? topics : [];

  // Handle bookmark toggle
  const handleBookmarkToggle = async (topicId) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      const topic = topics.find(t => t._id === topicId);
      const result = await executeApiCall(() => 
        bookmarkApi.toggleBookmark({
          resourceId: topicId,
          type: 'topic',
          title: topic?.title || 'Topic',
          description: topic?.description || ''
        })
      );

      if (result.action === 'added') {
        setBookmarkedTopics(prev => new Set([...prev, topicId]));
      } else {
        setBookmarkedTopics(prev => {
          const newSet = new Set(prev);
          newSet.delete(topicId);
          return newSet;
        });
      }
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    }
  };

  return (
    <div className="w-full bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            {t('issuePortal')}
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl">
            {t('issuePortalDescription')}
          </p>
        </div>

        {/* Statistics Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{t('activeTopics')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTopics || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{t('totalViews')}</p>
                <p className="text-2xl font-bold text-gray-900">{(stats.totalViews || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{t('totalBookmarks')}</p>
                <p className="text-2xl font-bold text-gray-900">{(stats.totalBookmarks || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder={t('searchTopicsPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {Array.isArray(categories) ? categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                )) : (
                  <option value="All">{t('all')}</option>
                )}
              </select>
              <button className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 flex items-center">
                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {t('search')}
              </button>
            </div>
          </div>
        </div>

        {/* Featured Topics */}
        <div className="mb-8">
          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{t('featuredTopics')}</h2>
            <p className="text-gray-600">{t('featuredTopicsDescription')}</p>
          </div>
          
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{t('failedToLoadTopics')}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                {t('retry')}
              </button>
            </div>
          ) : !Array.isArray(filteredTopics) || filteredTopics.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">{t('noTopicsFound')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.isArray(filteredTopics) ? filteredTopics.map((topic) => (
              <div key={topic._id || topic.id} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
                <div className="relative">
                  <div className="h-48 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center mx-auto mb-2">
                        <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-600">{t('topicImage')}</p>
                    </div>
                  </div>
                  <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {topic.category}
                    </span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <button 
                      onClick={() => handleBookmarkToggle(topic._id || topic.id)}
                      className={`p-2 transition-colors ${
                        bookmarkedTopics.has(topic._id || topic.id) 
                          ? 'text-indigo-600' 
                          : 'text-gray-400 hover:text-indigo-600'
                      }`}
                    >
                      <svg className="w-5 h-5" fill={bookmarkedTopics.has(topic._id || topic.id) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{topic.title}</h3>
                  <p className="text-gray-600 text-sm mb-4">{topic.description}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{topic.views?.toLocaleString() || 0} {t('viewsCount')}</span>
                    <span>{topic.bookmarkCount || topic.bookmarks?.length || 0} {t('bookmarksCount')}</span>
                  </div>
                </div>
              </div>
            )) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default IssuePortal;
