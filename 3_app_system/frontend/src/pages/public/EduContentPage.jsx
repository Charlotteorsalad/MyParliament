import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../hooks";
import { useAuth } from "../../hooks";
import { usePin } from "../../contexts/PinContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { eduApi, bookmarkApi, userApi } from "../../api";
import { useSSEEvent } from "../../contexts/SSEContext";

const RESOURCES_PER_PAGE = 12;

function EduContentPage() {
  const [resources, setResources] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: RESOURCES_PER_PAGE });
  const [pageInputValue, setPageInputValue] = useState('1');
  const [bookmarkedResources, setBookmarkedResources] = useState(new Set());
  const [viewedResourceIds, setViewedResourceIds] = useState(new Set());
  const [quizCompletedResourceIds, setQuizCompletedResourceIds] = useState(new Set());
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { executeApiCall, loading, error } = useApi();              // list fetch
  const { executeApiCall: executeBookmarkCall } = useApi();         // bookmark ops (separate loading state)
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { PinButton } = usePin();
  const { t } = useLanguage();

  // Helper function to check for valid image data (MongoDB Base64 only)
  const hasValidImage = (image) => {
    return image && image.data && image.contentType;
  };

  const fetchResources = useCallback(async () => {
    try {
      const data = await executeApiCall(eduApi.getAll);
      setResources(data);
    } catch (err) {
      console.error("Failed to fetch educational resources:", err);
    }
  }, [executeApiCall]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  // Real-time: refetch when admin creates/updates/publishes/archives/deletes edu content
  useSSEEvent('edu_updated', fetchResources);

  // Load bookmarks and viewed/quiz-completed state when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setBookmarkedResources(new Set());
      setViewedResourceIds(new Set());
      setQuizCompletedResourceIds(new Set());
      return;
    }
    const loadBookmarks = async () => {
      try {
        const data = await bookmarkApi.getBookmarks({ type: 'education', page: 1, limit: 1000 });
        const ids = new Set(
          (data.bookmarks || []).map((b) => {
            const res = b.resourceId;
            if (!res) return null;
            if (typeof res === 'string') return res;
            return String(res._id || res.id);
          }).filter(Boolean)
        );
        setBookmarkedResources(ids);
      } catch (err) {
        console.warn('[EduContentPage] Failed to load bookmarks:', err);
      }
    };
    const loadEduActivity = async () => {
      try {
        const data = await userApi.getEduActivity();
        setViewedResourceIds(new Set(data.viewedResourceIds || []));
        setQuizCompletedResourceIds(new Set(data.quizCompletedResourceIds || []));
      } catch (err) {
        console.warn('[EduContentPage] Failed to load edu activity:', err);
      }
    };
    loadBookmarks();
    loadEduActivity();
  }, [isAuthenticated]);

  const total = resources.length;
  const totalPages = Math.max(1, Math.ceil(total / meta.limit));
  const displayResources = resources.slice((meta.page - 1) * meta.limit, meta.page * meta.limit);

  // Keep page in valid range when total changes
  useEffect(() => {
    if (total > 0 && meta.page > totalPages) {
      setMeta((m) => ({ ...m, page: totalPages }));
    }
  }, [total, totalPages, meta.page]);

  useEffect(() => {
    setPageInputValue(meta.page.toString());
  }, [meta.page]);

  const changePage = (d) => {
    if (loading) return;
    setMeta((m) => ({ ...m, page: Math.max(1, Math.min(m.page + d, totalPages)) }));
  };
  const goToPage = (page) => {
    if (loading) return;
    const valid = Math.max(1, Math.min(Number(page), totalPages));
    setMeta((m) => ({ ...m, page: valid }));
  };
  const goToFirstPage = () => goToPage(1);
  const goToLastPage = () => goToPage(totalPages);
  const handlePageInputChange = (e) => setPageInputValue(e.target.value);
  const handlePageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const p = parseInt(pageInputValue, 10);
      if (!isNaN(p) && p > 0) goToPage(p);
      else setPageInputValue(meta.page.toString());
    }
  };
  const handlePageInputBlur = () => {
    const p = parseInt(pageInputValue, 10);
    if (isNaN(p) || p < 1) setPageInputValue(meta.page.toString());
    else goToPage(p);
  };

  // Lock body scroll when login modal is open
  useEffect(() => {
    if (showLoginModal) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showLoginModal]);

  const handleBookmark = async (resourceId) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    try {
      const result = await executeBookmarkCall(() => 
        bookmarkApi.toggleBookmark({
          resourceId,
          type: 'education',
          title: resources.find(r => r._id === resourceId)?.name || 'Education Resource',
          description: resources.find(r => r._id === resourceId)?.description || ''
        })
      );

      if (result.action === 'added') {
        setBookmarkedResources(prev => new Set([...prev, resourceId]));
      } else {
        setBookmarkedResources(prev => {
          const newSet = new Set(prev);
          newSet.delete(resourceId);
          return newSet;
        });
      }
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    }
  };

  const handleResourceClick = (resource) => {
    // Increment view count on server (fire-and-forget)
    eduApi.incrementView(resource._id).catch(() => {});
    // Update local state so count is correct when user returns to list
    setResources((prev) =>
      prev.map((r) =>
        r._id === resource._id ? { ...r, views: (r.views || 0) + 1 } : r
      )
    );
    navigate(`/edu/${resource._id}`, {
      state: {
        isBookmarked: bookmarkedResources.has(resource._id),
      },
    });
  };

  // Calculate statistics
  const totalResources = resources.length;
  const totalBookmarks = resources.reduce((sum, resource) => sum + (resource.bookmarks || 0), 0);
  const totalViews = resources.reduce((sum, resource) => sum + (resource.views || 0), 0);

  return (
    <>
    <div className="w-full max-w-full min-w-0 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full max-w-full min-w-0">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            {t('educationalContent')}
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl">
            {t('eduContentDescription')}
          </p>
        </div>

        {/* Statistics Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="ml-4">
                <p className='text-sm font-medium text-gray-600'>{t('totalResources')}</p>
                <p className="text-2xl font-bold text-gray-900">{totalResources}</p>
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
                <p className='text-sm font-medium text-gray-600'>{t('totalViews')}</p>
                <p className="text-2xl font-bold text-gray-900">{totalViews.toLocaleString()}</p>
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
                <p className='text-sm font-medium text-gray-600'>{t('totalBookmarks')}</p>
                <p className="text-2xl font-bold text-gray-900">{totalBookmarks.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Educational Resources Section */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{t('learningResources')}</h2>
            <p className="text-gray-600">{t('comprehensiveMaterials')}</p>
          </div>
          {isAuthenticated && (
            <PinButton
              tabId="edu-content"
              tabName={t('learningResources')}
              module="Educational Content"
            />
          )}
        </div>

          {/* Loading State */}
          {loading && (
          <div className="text-center py-12">
            <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-indigo-500 bg-white transition ease-in-out duration-150">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('loadingEducationalResources')}
            </div>
            </div>
          )}

          {/* Error State */}
          {error && (
          <div className="text-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md mx-auto">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">{t('errorLoadingResources')}</h3>
              <p className="text-red-600">{error}</p>
            </div>
            </div>
          )}

          {/* Resources Grid */}
          {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayResources.map((resource) => (
              <div
                key={resource._id}
                className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer group"
                onClick={() => handleResourceClick(resource)}
              >
                {/* Image Section */}
                <div className="relative h-48 bg-gradient-to-br from-emerald-100 to-teal-100 overflow-hidden">
                  {hasValidImage(resource.image) ? (
                    <img 
                      src={resource.image.data} 
                      alt={resource.title || resource.name || 'Educational Resource'}
                      className="w-full h-full object-cover"
                      onError={(e) => console.error('Image failed to load:', e)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-red-100">
                      <p className='text-red-600'>{t('noValidImageData')}</p>
                    </div>
                  )}
                  
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20" style={{display: hasValidImage(resource.image) ? 'none' : 'block'}}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                          <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </div>
                        <p className='text-sm font-medium text-emerald-700'>{t('educationalResource')}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Category Badge */}
                  <div className="absolute top-3 left-3">
                    <span className="bg-white/90 backdrop-blur-sm text-xs font-semibold px-2 py-1 rounded-full text-gray-700">
                      {resource.category || t('education')}
                    </span>
                  </div>

                  {/* Bookmark Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBookmark(resource._id);
                    }}
                    className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors"
                  >
                    <svg 
                      className={`w-5 h-5 transition-colors ${
                        bookmarkedResources.has(resource._id) 
                          ? 'text-yellow-500 fill-current' 
                          : 'text-gray-400 hover:text-yellow-500'
                      }`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                </div>

                {/* Content Section */}
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-emerald-600 transition-colors">
                    {resource.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {resource.description}
                  </p>
                  
                  {/* Footer */}
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {resource.createdAt ? new Date(resource.createdAt).toLocaleDateString('en-MY', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        }) : t('recent')}
                      </span>
                      
                      {/* Quiz Indicator */}
                      {resource.quiz && resource.quiz.questions && resource.quiz.questions.length > 0 && (
                        <span className="flex items-center text-blue-600">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {t('quiz')}
                        </span>
                      )}

                      {/* Viewed badge (only when user has viewed this resource) */}
                      {isAuthenticated && viewedResourceIds.has(String(resource._id)) && (
                        <span className="flex items-center text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full text-xs font-medium">
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {t('viewed')}
                        </span>
                      )}

                      {/* Quiz completed / Answered badge */}
                      {isAuthenticated && quizCompletedResourceIds.has(String(resource._id)) && (
                        <span className="flex items-center text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap">
                          <svg className="w-3.5 h-3.5 mr-1.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {t('answered')}
                        </span>
                      )}
                      
                      {/* Attachments Indicator */}
                      {resource.attachments && resource.attachments.length > 0 && (
                        <span className="flex items-center text-green-600">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          {resource.attachments.length} {resource.attachments.length > 1 ? t('files') : t('file')}
                        </span>
                      )}
                    </div>
                    
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {(resource.views || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && total > 0 && (
          <div className="mt-8 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                {t('showing')} {((meta.page - 1) * meta.limit) + 1} {t('to')} {Math.min(meta.page * meta.limit, total)} {t('of')} {total} {t('resourcesCount')}
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={meta.page <= 1 || loading}
                  onClick={() => changePage(-1)}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t('previous')}
                </button>
                <form onSubmit={(e) => { e.preventDefault(); const n = parseInt(pageInputValue, 10); if (!isNaN(n) && n >= 1 && n <= totalPages) { goToPage(n); setPageInputValue(''); } }}>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={pageInputValue}
                    onChange={handlePageInputChange}
                    onKeyDown={(e) => e.key === 'Enter' && handlePageInputKeyPress(e)}
                    onBlur={handlePageInputBlur}
                    disabled={loading}
                    className="w-12 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center disabled:bg-gray-100 disabled:cursor-not-allowed focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder={meta.page}
                    aria-label="Page number"
                  />
                </form>
                <button
                  disabled={meta.page * meta.limit >= total || loading}
                  onClick={() => changePage(1)}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t('next')}
                </button>
              </div>
            </div>
          </div>
          )}

          {/* Empty State */}
          {!loading && !error && resources.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 max-w-md mx-auto">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-full">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">{t('noResourcesAvailable')}</h3>
              <p className="text-gray-600">{t('resourcesWillAppear')}</p>
            </div>
            </div>
          )}

      </div>
    </div>

    {/* Login required modal — sibling of main container, high z-index */}
    {showLoginModal && (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowLoginModal(false); }}
      >
        <div className="w-full max-w-[600px] bg-white rounded-xl shadow-xl p-6" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <p className="text-gray-700 text-base mb-6">
            {t('loginRequiredForBookmark')}
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowLoginModal(false); }}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowLoginModal(false); navigate('/login'); }}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium"
            >
              {t('login')}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default EduContentPage;
