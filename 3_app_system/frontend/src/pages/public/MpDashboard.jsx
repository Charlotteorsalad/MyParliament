import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { mpApi, userApi } from '../../api';
import { useApi } from '../../hooks';
import { usePin } from '../../contexts/PinContext';
import MpCard from '../../components/MpCard.jsx';
import MpDetailWindow from '../../components/MpDetailWindow.jsx';
import { useAuth } from '../../hooks';
import { useLanguage } from '../../contexts/LanguageContext';
import { getDisplayState, getConstituencyDisplay } from '../../utils/mpUtils';
import { getImageSource, handleImageError } from '../../utils/imageUtils';
import { useSSEEvent } from '../../contexts/SSEContext';

export default function MpDashboard({ query }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [featured, setFeatured] = useState([]);
  const [featuredPage, setFeaturedPage] = useState(1);
  const FEATURED_PER_PAGE = 8;
  const [stats, setStats] = useState(null);
  const [list, setList] = useState({ data: [], meta: { total: 0, page: 1, limit: 24 } });
  const [filters, setFilters] = useState({ status: 'current', term: '', party: '', state: '', sort: 'all-current', search: '' });
  const [searchInput, setSearchInput] = useState(''); // Separate state for search input
  const [drawer, setDrawer] = useState({ open: false, mp: null });
  const [returnToUrl, setReturnToUrl] = useState(null);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [bookmarkedMPs, setBookmarkedMPs] = useState(new Set()); // actually followed MP ids
  const [followedLoaded, setFollowedLoaded] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loadingDetailId, setLoadingDetailId] = useState(null); // mp_id or name while fetching detail (modal opens only after load)
  
  const { executeApiCall, loading, error } = useApi();
  const { isAuthenticated } = useAuth();
  const { PinButton } = usePin();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Store current filters/page in refs so SSE callback can access them without stale closure
  const filtersRef = useRef(filters);
  const listMetaRef = useRef(list.meta);
  useEffect(() => { filtersRef.current = filters; }, [filters]);
  useEffect(() => { listMetaRef.current = list.meta; }, [list.meta]);

  const fetchInitialData = useCallback(async () => {
    try {
      const [featuredData, statsData] = await Promise.all([
        executeApiCall(mpApi.getFeatured),
        executeApiCall(mpApi.getStats)
      ]);
      setFeatured(featuredData.data || featuredData || []);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
    }
  }, [executeApiCall]);

  const fetchMpListNow = useCallback(async () => {
    try {
      const params = {
        ...filtersRef.current,
        q: query || '',
        page: listMetaRef.current.page,
        limit: listMetaRef.current.limit
      };
      const listData = await executeApiCall(mpApi.getList, params);
      setList(listData);
    } catch (err) {
      console.error('Failed to fetch MP list (SSE):', err);
    }
  }, [executeApiCall, query]);

  // Stats & Featured
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Initialise followed MPs from user profile so stars persist across reloads
  useEffect(() => {
    const fetchFollowedMps = async () => {
      if (!isAuthenticated) {
        setBookmarkedMPs(new Set());
        setFollowedLoaded(true);
        return;
      }
      try {
        const profile = await executeApiCall(userApi.getProfile);
        // Use _id (ObjectId string) as the canonical key — same strategy as Issue Portal
        const ids = new Set(
          (profile.followedMPs || [])
            .map((mp) => String(mp._id || mp.id))
            .filter(Boolean)
        );
        setBookmarkedMPs(ids);
      } catch (err) {
        console.error('Failed to load followed MPs for stars:', err);
      } finally {
        setFollowedLoaded(true);
      }
    };
    fetchFollowedMps();
  }, [executeApiCall, isAuthenticated]);

  // List
  useEffect(() => {
    const fetchMpList = async () => {
      try {
        const params = {
          ...filters,
          q: query || '',
          page: list.meta.page,
          limit: list.meta.limit
        };
        
        const listData = await executeApiCall(mpApi.getList, params);
        setList(listData);
      } catch (err) {
        console.error('Failed to fetch MP list:', err);
      }
    };

    fetchMpList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filters, list.meta.page, list.meta.limit, executeApiCall]);

  // Real-time: refetch when admin creates/updates/deletes an MP
  useSSEEvent('mp_updated', () => {
    fetchInitialData();
    fetchMpListNow();
  });

  // Update input value when page changes (e.g., from prev/next buttons)
  useEffect(() => {
    setPageInputValue(list.meta.page.toString());
  }, [list.meta.page]);

  const changePage = d => {
    if (loading) return; // Prevent rapid clicks while loading
    setList(s => ({ ...s, meta: { ...s.meta, page: s.meta.page + d } }));
  };

  const goToPage = (page) => {
    if (loading) return; // Prevent rapid clicks while loading
    const totalPages = Math.ceil(list.meta.total / list.meta.limit);
    const validPage = Math.max(1, Math.min(page, totalPages));
    setList(s => ({ ...s, meta: { ...s.meta, page: validPage } }));
  };

  const goToFirstPage = () => goToPage(1);
  
  const goToLastPage = () => {
    const totalPages = Math.ceil(list.meta.total / list.meta.limit);
    goToPage(totalPages);
  };

  const handlePageInputChange = (e) => {
    // Only update the local input value, don't change page yet
    setPageInputValue(e.target.value);
  };

  const handlePageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const page = parseInt(pageInputValue);
      if (!isNaN(page) && page > 0) {
        goToPage(page);
      } else {
        // Reset to current page if invalid input
        setPageInputValue(list.meta.page.toString());
      }
    }
  };

  const handlePageInputBlur = (e) => {
    const page = parseInt(pageInputValue);
    if (isNaN(page) || page < 1) {
      // Reset to current page if invalid input
      setPageInputValue(list.meta.page.toString());
    }
  };

  const handleSearch = () => {
    // Apply the search filter and reset to first page
    setFilters(f => ({ ...f, search: searchInput }));
    setList(s => ({ ...s, meta: { ...s.meta, page: 1 } }));
  };

  const hasActiveFilters = () => {
    // Check if any filters are active (excluding default values)
    return (
      filters.status !== 'current' || // 'current' is default
      filters.sort !== 'all-current' || // 'all-current' is default
      (filters.search && filters.search.trim() !== '') || // search has content
      filters.party || // party filter is set
      filters.state || // state filter is set
      filters.term // term filter is set
    );
  };

  const clearAllFilters = () => {
    // Reset all filters to default values
    setFilters({
      status: 'current',
      term: '',
      party: '',
      state: '',
      sort: 'all-current',
      search: ''
    });
    // Clear search input
    setSearchInput('');
    // Reset to first page
    setList(s => ({ ...s, meta: { ...s.meta, page: 1 } }));
  };

  const handleMpClick = async (mpOrId) => {
    if (!mpOrId) return;

    const loadingId = typeof mpOrId === 'string'
      ? mpOrId
      : (mpOrId.mp_id || mpOrId.name || mpOrId._id || mpOrId.id);
    if (loadingId) setLoadingDetailId(String(loadingId));

    try {
      let detail;
      // Use API directly so global loading stays false — avoids dashboard flashing "Loading MPs" while opening modal
      if (typeof mpOrId === 'object') {
        if (mpOrId.mp_id) {
          detail = await mpApi.getDetail(mpOrId.mp_id);
        } else if (mpOrId.name) {
          detail = await mpApi.getDetailByName(mpOrId.name);
        } else {
          setLoadingDetailId(null);
          return;
        }
      } else {
        detail = await mpApi.getDetail(mpOrId);
      }
      const mpData = detail.data || detail;
      const detailKey = String(mpData._id || mpData.id);
      const followed = !!detailKey && bookmarkedMPs.has(detailKey);
      setDrawer({ open: true, mp: { ...mpData, isFollowed: followed } });
    } catch (err) {
      console.error('Failed to fetch MP details:', err);
    } finally {
      setLoadingDetailId(null);
    }
  };

  // Open MP detail from URL ?mp=mp_id or ?name=... (e.g. from Issue Portal topic detail, Personal Activities)
  useEffect(() => {
    // Wait until we know which MPs are followed so stars are correct
    if (!followedLoaded) return;

    const mpId = searchParams.get('mp');
    const mpName = searchParams.get('name');
    const returnTo = searchParams.get('returnTo');
    if (!drawer.open) {
      if (mpId) {
        window.scrollTo(0, 0);
        if (returnTo) setReturnToUrl(returnTo);
        handleMpClick(mpId);
        setSearchParams((prev) => {
          const p = new URLSearchParams(prev);
          p.delete('mp');
          p.delete('returnTo');
          return p;
        }, { replace: true });
      } else if (mpName && mpName.trim()) {
        window.scrollTo(0, 0);
        if (returnTo) setReturnToUrl(returnTo);
        // Reuse the same detail loader so isFollowed/followerCount are consistent
        handleMpClick({ name: mpName.trim() });
        setSearchParams((prev) => {
          const p = new URLSearchParams(prev);
          p.delete('name');
          p.delete('returnTo');
          return p;
        }, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followedLoaded]);

  // Lock body scroll when login modal is open
  useEffect(() => {
    if (showLoginModal) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showLoginModal]);

  const handleBookmark = async (mp) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    const id = String(mp._id || mp.id);
    if (!id) return;

    setBookmarkedMPs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

    try {
      if (bookmarkedMPs.has(id)) {
        await userApi.unfollowMP(id);
      } else {
        await userApi.followMP(id);
      }
    } catch (err) {
      console.error('Failed to toggle MP follow:', err);
      // Revert on error
      setBookmarkedMPs(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    }
  };

  return (
    <>
    <div className="w-full max-w-full min-w-0 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full max-w-full min-w-0">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            {t('mpDashboard')}
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl">
            {t('mpDashboardDescription')}
          </p>
        </div>

        {/* Statistics Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className='text-sm font-medium text-gray-600'>{t('totalMPs')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.total || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className='text-sm font-medium text-gray-600'>{t('activeMPs')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.active || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="ml-4">
                <p className='text-sm font-medium text-gray-600'>{t('constituencies')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.constituencies || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className='text-sm font-medium text-gray-600'>{t('politicalParties')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.parties || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100 mb-8">
          <div className="flex flex-col xl:flex-row gap-4 xl:gap-6 xl:flex-wrap">
            {/* Search Bar */}
            <div className="flex-1 min-w-[220px]">
              <div className="relative">
                <input
                  type="text"
                  placeholder={t('searchMPsPlaceholder')}
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Search Button */}
            <button
              onClick={handleSearch}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {t('search')}
            </button>

            {/* Status Filter */}
            <div className="w-full sm:w-auto xl:w-48">
              <select 
                value={filters.status} 
                onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white"
              >
                <option value="">{t('allMPs')}</option>
                <option value="current">{t('activeMPsFilter')}</option>
                <option value="historical">{t('inactiveMPs')}</option>
              </select>
            </div>

            {/* Party Filter */}
            <div className="w-full sm:w-auto xl:w-48">
              <select 
                value={filters.sort} 
                onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))}
                disabled={filters.status !== 'current'}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="all-current">{t('allParties')}</option>
                <option value="bn">{t('barisanNasional')}</option>
                <option value="ph">{t('pakatanHarapan')}</option>
                <option value="pn">{t('perikatanNasional')}</option>
                <option value="warisan">{t('warisan')}</option>
                <option value="muda">{t('muda')}</option>
                <option value="independent">{t('independent')}</option>
              </select>
            </div>
          </div>

          {/* Filter Status */}
          {hasActiveFilters() && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {t('filtersActive')} {filters.status && `${t('status')} ${filters.status}`} 
                  {filters.sort !== 'all-current' && `, ${t('party')} ${filters.sort}`}
                  {filters.search && `, ${t('searchFilter')} "${filters.search}"`}
                </p>
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  {t('clearAllFilters')}
                </button>
              </div>
            </div>
          )}
        </div>

      {/* Error Display */}
      {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className='text-sm font-medium text-red-800'>{t('errorLoadingData')}</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
        </div>
      )}

        {/* Featured MPs Section */}
      {list.meta.page === 1 && !hasActiveFilters() ? (
          <div className="mb-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{t('featuredMPs')}</h2>
                <p className="text-gray-600">{t('featuredMPsDescription')}</p>
              </div>
              {isAuthenticated && (
                <PinButton
                  tabId="mp-featured"
                  tabName={t('featuredMPs')}
                  module="MP Dashboard"
                />
              )}
            </div>
            
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-indigo-500 bg-white transition ease-in-out duration-150">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('loadingFeaturedMPs')}
                </div>
              </div>
            ) : featured.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">
                {t('noFeaturedMPs') || 'No MPs with full performance data yet. Run the precompute scripts first.'}
              </div>
            ) : (
              (() => {
                const featuredTotalPages = Math.ceil(featured.length / FEATURED_PER_PAGE);
                const featuredSlice = featured.slice(
                  (featuredPage - 1) * FEATURED_PER_PAGE,
                  featuredPage * FEATURED_PER_PAGE
                );
                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {featuredSlice.map((mp, index) => {
                        const globalRank = (featuredPage - 1) * FEATURED_PER_PAGE + index + 1;
                        return (
                          <div
                            key={mp._id || mp.mp_id || `featured-${globalRank}-${mp.name || 'unknown'}`}
                            className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer group relative"
                            onClick={() => handleMpClick(mp.mp_id)}
                          >
                            {loadingDetailId === String(mp.mp_id) && (
                              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 rounded-xl">
                                <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              </div>
                            )}

                            {/* Rank badge */}
                            <div className="absolute top-3 left-3 z-10">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full shadow-sm ${
                                globalRank === 1 ? 'bg-yellow-400 text-yellow-900' :
                                globalRank === 2 ? 'bg-gray-300 text-gray-800' :
                                globalRank === 3 ? 'bg-amber-600 text-white' :
                                'bg-white/90 backdrop-blur-sm text-gray-600'
                              }`}>
                                #{globalRank}
                              </span>
                            </div>

                            {/* Bookmark Button */}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleBookmark(mp); }}
                              className="absolute top-3 right-3 z-10 p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors"
                            >
                              <svg
                                className={`w-5 h-5 transition-colors ${
                                  bookmarkedMPs.has(String(mp._id || mp.id))
                                    ? 'text-yellow-500 fill-current'
                                    : 'text-gray-400 hover:text-yellow-500'
                                }`}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                            </button>

                            {/* MP Image */}
                            <div className="relative h-48 flex items-center justify-center bg-[#f1f5f9] rounded-t-xl overflow-hidden">
                              <img
                                src={getImageSource(mp.profilePicture, 'mp')}
                                alt={mp.full_name_with_titles || mp.name || 'MP Photo'}
                                className="max-w-full max-h-full w-auto h-auto object-contain"
                                style={{ minWidth: 0, minHeight: 0 }}
                                onError={(e) => handleImageError(e, 'mp')}
                                loading="lazy"
                              />
                              {/* Party Badge */}
                              <div className="absolute bottom-3 left-3">
                                <span className="bg-white/90 backdrop-blur-sm text-xs font-semibold px-2 py-1 rounded-full text-gray-700">
                                  {(!mp.party || /^historical[_ ]?party$/i.test(String(mp.party).trim())) ? t('unknown') : (mp.party_full_name || mp.party)}
                                </span>
                              </div>
                            </div>

                            {/* Content */}
                            <div className="p-4">
                              <h3 className="text-sm font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors leading-snug line-clamp-2">
                                {mp.full_name_with_titles || mp.name || t('unknownMP')}
                              </h3>
                              <p className="text-gray-500 text-xs mb-3">
                                {getConstituencyDisplay(mp) || t('constituencyNotSpecified')}
                              </p>

                              {/* Performance Score bar */}
                              {mp.performanceScore != null && (
                                <div className="mb-3">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-gray-500">{t('performanceScore') || 'Score'}</span>
                                    <span className="text-xs font-semibold text-indigo-600">{mp.performanceScore}</span>
                                  </div>
                                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-indigo-500"
                                      style={{ width: `${Math.min(100, Math.max(0, mp.performanceScore))}%` }}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Mini metrics row */}
                              <div className="grid grid-cols-3 gap-1 text-center mb-3">
                                <div className="bg-gray-50 rounded p-1">
                                  <div className="text-xs font-semibold text-gray-800">
                                    {mp.performance?.attendanceRate != null ? `${mp.performance.attendanceRate}%` : '—'}
                                  </div>
                                  <div className="text-[10px] text-gray-400 leading-tight">Attend.</div>
                                </div>
                                <div className="bg-gray-50 rounded p-1">
                                  <div className="text-xs font-semibold text-gray-800">
                                    {mp.performance?.responseRate != null ? `${mp.performance.responseRate}%` : '—'}
                                  </div>
                                  <div className="text-[10px] text-gray-400 leading-tight">Reply</div>
                                </div>
                                <div className="bg-gray-50 rounded p-1">
                                  <div className="text-xs font-semibold text-gray-800">
                                    {mp.performance?.sentimentScore != null ? mp.performance.sentimentScore : '—'}
                                  </div>
                                  <div className="text-[10px] text-gray-400 leading-tight">Senti.</div>
                                </div>
                              </div>

                              {/* Footer */}
                              <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                                <span className="flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                  </svg>
                                  {getDisplayState(mp) || t('stateNotSpecified')}
                                </span>
                                <span className="flex items-center gap-1 text-green-600">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {t('active')}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination */}
                    {featuredTotalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-6">
                        <button
                          onClick={() => setFeaturedPage(p => Math.max(1, p - 1))}
                          disabled={featuredPage === 1}
                          className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          aria-label="Previous page"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        {Array.from({ length: featuredTotalPages }, (_, i) => i + 1).map(pg => (
                          <button
                            key={pg}
                            onClick={() => setFeaturedPage(pg)}
                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                              pg === featuredPage
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {pg}
                          </button>
                        ))}
                        <button
                          onClick={() => setFeaturedPage(p => Math.min(featuredTotalPages, p + 1))}
                          disabled={featuredPage === featuredTotalPages}
                          className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          aria-label="Next page"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <span className="text-xs text-gray-400 ml-1">
                          {featured.length} {t('mpsTotal') || 'MPs total'}
                        </span>
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>
        ) : list.meta.page === 1 && hasActiveFilters() ? (
          <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100 mb-8 text-center">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-full">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
        </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">{t('featuredMPsHidden')}</h3>
            <p className="text-gray-600 mb-4">
              {t('featuredMPsHiddenDescription')}
            </p>
            <button 
              onClick={clearAllFilters}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {t('clearFiltersToSeeFeatured')}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100 mb-8 text-center">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-full">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
        </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">{t('featuredMPsOnFirstPage')}</h3>
            <p className="text-gray-600 mb-4">
              {t('featuredMPsOnFirstPageDescription')}
            </p>
            <button 
              onClick={goToFirstPage}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {t('goToFirstPage')}
            </button>
        </div>
      )}

        {/* All MPs Section */}
        <div className="mb-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{t('allMPsSection')}</h2>
              <p className="text-gray-600">{t('allMPsDescription')}</p>
            </div>
            {isAuthenticated && (
              <PinButton
                tabId="mp-all"
                tabName={t('allMPsSection')}
                module="MP Dashboard"
              />
            )}
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-indigo-500 bg-white transition ease-in-out duration-150">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('loadingMPs')}
              </div>
            </div>
          ) : list.data.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {list.data.map((mp, index) => {
                const bookmarkKey = String(mp._id || mp.id || `mp-${index}`);
                const isThisCardLoading = loadingDetailId && [
                  mp._id, mp.id, mp.mp_id, mp.name
                ].some((v) => v != null && String(v) === loadingDetailId);
                return (
                <div
                key={mp._id || mp.mp_id || `mp-${index}-${mp.name || 'unknown'}`}
                  className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer group relative"
                onClick={() => handleMpClick(mp)}
                >
                  {isThisCardLoading && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 rounded-xl">
                      <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                  )}
                  {/* Bookmark Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBookmark(mp);
                    }}
                    className="absolute top-3 right-3 z-10 p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors"
                  >
                    <svg 
                      className={`w-5 h-5 transition-colors ${
                        bookmarkedMPs.has(bookmarkKey) 
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

                  {/* MP Image Section - object-fit: contain = full face visible; onError = placeholder when image fails */}
                  <div className="relative h-48 flex items-center justify-center bg-[#f1f5f9] rounded-t-xl overflow-hidden">
                    <img
                      src={getImageSource(mp.profilePicture, 'mp')}
                      alt={mp.full_name_with_titles || mp.name || 'MP Photo'}
                      className="max-w-full max-h-full w-auto h-auto object-contain"
                      style={{ minWidth: 0, minHeight: 0 }}
                      onError={(e) => handleImageError(e, 'mp')}
                      loading="lazy"
                    />
                    {/* Party Badge */}
                    <div className="absolute top-3 left-3">
                      <span className="bg-white/90 backdrop-blur-sm text-xs font-semibold px-2 py-1 rounded-full text-gray-700">
                        {(!mp.party || /^historical[_ ]?party$/i.test(String(mp.party).trim())) ? t('unknown') : (mp.party_full_name || mp.party)}
                      </span>
                    </div>
                  </div>

                  {/* Content Section */}
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {mp.full_name_with_titles || mp.name || t('unknownMP')}
                    </h3>
                    <p className="text-gray-600 text-sm mb-4">
                      {getConstituencyDisplay(mp) || t('constituencyNotSpecified')}
                    </p>
                    
                    {/* Footer */}
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        {getDisplayState(mp) || t('stateNotSpecified')}
                      </span>
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {mp.status === 'current' ? t('active') : t('inactive')}
                      </span>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 max-w-md mx-auto">
                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-full">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">{t('noMPsFound')}</h3>
                <p className="text-gray-600 mb-4">{t('noMPsFoundDescription')}</p>
                <button
                  onClick={clearAllFilters}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  {t('clearFilters')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {list.meta.total > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                {t('showing')} {((list.meta.page - 1) * list.meta.limit) + 1} {t('to')} {Math.min(list.meta.page * list.meta.limit, list.meta.total)} {t('of')} {list.meta.total} {t('MPs')}
              </div>
              
              <div className="flex items-center gap-2">
            <button
              disabled={list.meta.page <= 1 || loading}
              onClick={() => changePage(-1)}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('previous')}
            </button>
            <form onSubmit={(e) => { e.preventDefault(); const n = parseInt(pageInputValue, 10); const totalPages = Math.ceil(list.meta.total / list.meta.limit); if (!isNaN(n) && n >= 1 && n <= totalPages) { goToPage(n); setPageInputValue(''); } }}>
              <input
                type="number"
                min={1}
                max={Math.ceil(list.meta.total / list.meta.limit)}
                value={pageInputValue}
                onChange={handlePageInputChange}
                onKeyPress={handlePageInputKeyPress}
                onBlur={handlePageInputBlur}
                disabled={loading}
                className="w-12 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center disabled:bg-gray-100 disabled:cursor-not-allowed focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder={list.meta.page}
                aria-label="Page number"
              />
            </form>
            <button
              disabled={list.meta.page * list.meta.limit >= list.meta.total || loading}
              onClick={() => changePage(1)}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('next')}
            </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {drawer.open &&
        createPortal(
          <MpDetailWindow
            mp={drawer.mp}
            onClose={() => {
              setDrawer({ open: false, mp: null });
              setReturnToUrl(null);
            }}
            returnToUrl={returnToUrl}
            onFollowToggle={(mpId, nowFollowed) => {
              setBookmarkedMPs(prev => {
                const next = new Set(prev);
                if (nowFollowed) next.add(String(mpId));
                else next.delete(String(mpId));
                return next;
              });
            }}
          />,
          document.body
        )}
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
