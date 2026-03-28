import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { topicApi, userApi } from '../../api';
import { useApi } from '../../hooks';
import { useAuth } from '../../hooks';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSSEEvent } from '../../contexts/SSEContext';

function IssuePortal() {
  const navigate = useNavigate();
  const { executeApiCall, loading, error } = useApi();
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedClusterLabel, setSelectedClusterLabel] = useState('');
  const [selectedParlimen, setSelectedParlimen] = useState('');
  const [selectedPenggal, setSelectedPenggal] = useState('');
  const [selectedMesyuarat, setSelectedMesyuarat] = useState('');
  const [topics, setTopics] = useState([]);
  const [filters, setFilters] = useState({ parlimen: [], penggal: [], mesyuarat: [], categories: [], cluster_labels: [] });
  const [bookmarkedTopics, setBookmarkedTopics] = useState(new Set());
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [stats, setStats] = useState({
    totalTopics:     0,
    sessionCount:    0,
    totalStatements: 0,
  });
  const TOPICS_PER_PAGE = 12;
  const [meta, setMeta] = useState({ page: 1, limit: TOPICS_PER_PAGE });
  const [pageInputValue, setPageInputValue] = useState('1');

  // Load user's followed topic IDs (Issue Portal stars) from profile
  useEffect(() => {
    if (!isAuthenticated) {
      setBookmarkedTopics(new Set());
      return;
    }
    const loadFollowedTopics = async () => {
      try {
        const profile = await userApi.getProfile();
        const list = profile?.followedTopics || [];
        const ids = new Set(list.map((t) => String(t._id ?? t.id)));
        setBookmarkedTopics(ids);
      } catch (err) {
        console.warn('[Issue Portal] Failed to load followed topics:', err);
      }
    };
    loadFollowedTopics();
  }, [isAuthenticated]);

  // Fetch filter options and topics data from default pipeline
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get default pipeline first
        let pipelineId = 'pipeline5'; // fallback
        let includeLowQuality = false;
        try {
          const defaultResponse = await executeApiCall(() => topicApi.getDefaultPipeline());
          const defaultData = defaultResponse?.data || defaultResponse;
          if (defaultData?.success && defaultData.pipeline_id) {
            pipelineId = defaultData.pipeline_id;
            includeLowQuality = defaultData.include_low_quality === true;
          }
        } catch (err) {
          console.warn('[Issue Portal] Failed to fetch default pipeline, using fallback:', err);
        }

        // Fetch filter options
        try {
          const filtersResponse = await executeApiCall(() => topicApi.getFilters(pipelineId));
          const filtersData = filtersResponse?.data || filtersResponse;
          if (filtersData?.success && filtersData.filters) {
            setFilters(filtersData.filters);
          }
        } catch (err) {
          console.warn('[Issue Portal] Failed to fetch filters:', err);
        }

        // Fetch topics from the default pipeline with current filters
        const filterParams = {};
        if (selectedParlimen) filterParams.parlimen = selectedParlimen;
        if (selectedPenggal) filterParams.penggal = selectedPenggal;
        if (selectedMesyuarat) filterParams.mesyuarat = selectedMesyuarat;
        if (selectedCategory !== 'All') filterParams.category = selectedCategory;
        if (selectedClusterLabel) filterParams.cluster_label = selectedClusterLabel;
        if (includeLowQuality) filterParams.includeLowQuality = true; // from admin config

        const response = await executeApiCall(() => topicApi.getIssuePortalTopics(pipelineId, filterParams));
        
        // Handle both axios response structure (response.data) and direct data
        const responseData = response?.data || response;
        console.log('[Issue Portal] API Response:', responseData);
        
        const topicsData = responseData?.topics || [];
        console.log('[Issue Portal] Topics found:', topicsData.length);
        
        if (topicsData.length === 0) {
          console.warn('[Issue Portal] No topics returned from API. Response:', responseData);
        }
        
        setTopics(Array.isArray(topicsData) ? topicsData : []);

        // Calculate aggregate stats from precomputed data
        const totalStatements = topicsData.reduce((sum, t) => sum + (t.statement_count || 0), 0);
        const sessionKeys = new Set();
        topicsData.forEach((t) => {
          const p = t.parlimen, g = t.penggal, m = t.mesyuarat;
          if (p != null && g != null && m != null) {
            sessionKeys.add(`${p}-${g}-${m}`);
          }
        });

        setStats({
          totalTopics:     topicsData.length,
          sessionCount:    sessionKeys.size,
          totalStatements,
        });
      } catch (err) {
        console.error('[Issue Portal] Failed to fetch topics data:', err);
        console.error('[Issue Portal] Error details:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
          url: err.config?.url
        });
        // Set fallback data
        setTopics([]);
        setStats({ totalTopics: 0, sessionCount: 0, totalStatements: 0 });
      }
    };

    fetchData();
  }, [executeApiCall, t, selectedParlimen, selectedPenggal, selectedMesyuarat, selectedCategory, selectedClusterLabel]);

  // Real-time: refetch when topic/issue portal data is updated by admin or ML scripts
  useSSEEvent('topic_updated', useCallback(() => {
    // Reset to page 1 and refetch by nudging a filter dep (no-op value change)
    setMeta((m) => ({ ...m, page: 1 }));
  }, []));

  // Client-side: only search (category & cluster_label are applied by API)
  const categoryOptions = ['All', ...(filters.categories || [])];
  const clusterLabelOptions = ['', ...(filters.cluster_labels || [])];
  // When searching: only show topics where the term appears in title or cluster_label (remove irrelevant hits from description/keywords)
  const filteredTopics = Array.isArray(topics) ? topics.filter(topic => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      topic.title?.toLowerCase().includes(term) ||
      topic.cluster_label?.toLowerCase().includes(term)
    );
  }) : [];

  // Group topics by same title; within each group sort sessions by time (newest first)
  const groupedByTitle = (() => {
    const map = new Map();
    for (const topic of filteredTopics) {
      const key = (topic.title || '').trim() || 'Untitled';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(topic);
    }
    map.forEach((arr) => {
      arr.sort((a, b) => {
        const da = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
        const db = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
        return db - da; // newest first
      });
    });
    return map;
  })();

  // When one title appears multiple times in the same parliamentary session/day,
  // merge them in the card list so the same date is not shown repeatedly.
  const mergeSameSessionEntries = (sessions) => {
    const merged = new Map();
    for (const item of sessions || []) {
      const dateKey = item.lastUpdated
        ? new Date(item.lastUpdated).toISOString().slice(0, 10)
        : '';
      const key = `${item.session_key || item.session_label || 'session'}|${dateKey}`;
      if (!merged.has(key)) {
        merged.set(key, {
          ...item,
          statement_count: item.statement_count || 0,
          mp_count: item.mp_count || 0,
          duplicate_count: 1,
        });
        continue;
      }

      const current = merged.get(key);
      current.statement_count += item.statement_count || 0;
      current.mp_count = Math.max(current.mp_count || 0, item.mp_count || 0);
      current.duplicate_count += 1;

      const currentTs = current.lastUpdated ? new Date(current.lastUpdated).getTime() : 0;
      const nextTs = item.lastUpdated ? new Date(item.lastUpdated).getTime() : 0;
      if (nextTs > currentTs) {
        current.lastUpdated = item.lastUpdated;
        current._id = item._id || current._id;
        current.cluster_id = item.cluster_id || current.cluster_id;
      }
    }
    return [...merged.values()].sort((a, b) => {
      const da = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
      const db = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
      return db - da;
    });
  };

  // A single parliamentary session can span multiple sitting dates.
  // Detail page groups by actual timeline dates, so for card previews we expose
  // both earliest and latest known dates as separate clickable entries.
  const expandSessionDates = (sessions) => {
    const expanded = [];
    for (const item of sessions || []) {
      const seen = new Set();
      const candidates = [item.lastUpdated, item.earliest_date];
      for (const raw of candidates) {
        if (!raw) continue;
        const ymd = new Date(raw).toISOString().slice(0, 10);
        if (seen.has(ymd)) continue;
        seen.add(ymd);
        expanded.push({
          ...item,
          displayDate: raw,
          displayDateKey: ymd,
          displayKey: `${item.session_key || item.session_label || item._id || item.cluster_id || 'session'}|${ymd}`,
        });
      }
      if (seen.size === 0) {
        expanded.push({
          ...item,
          displayDate: null,
          displayDateKey: '',
          displayKey: `${item.session_key || item.session_label || item._id || item.cluster_id || 'session'}|none`,
        });
      }
    }
    return expanded.sort((a, b) => {
      const da = a.displayDate ? new Date(a.displayDate).getTime() : 0;
      const db = b.displayDate ? new Date(b.displayDate).getTime() : 0;
      return db - da;
    });
  };

  const groupEntries = [...groupedByTitle.entries()];
  const totalTopics = groupEntries.length;
  const totalPages = Math.max(1, Math.ceil(totalTopics / meta.limit));
  const displayEntries = groupEntries.slice((meta.page - 1) * meta.limit, meta.page * meta.limit);

  useEffect(() => {
    if (totalTopics > 0 && meta.page > totalPages) {
      setMeta((m) => ({ ...m, page: totalPages }));
    }
  }, [totalTopics, totalPages, meta.page]);

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

  // Follow/unfollow topic (Issue Portal star): optimistic update, write to User.followedTopics
  const handleBookmarkToggle = async (topicId) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    const wasFollowed = bookmarkedTopics.has(topicId);

    setBookmarkedTopics(prev => {
      const next = new Set(prev);
      if (wasFollowed) next.delete(topicId);
      else next.add(topicId);
      return next;
    });

    try {
      if (wasFollowed) {
        await userApi.unfollowTopic(topicId);
      } else {
        await userApi.followTopic(topicId);
      }
    } catch (err) {
      console.error('Failed to follow/unfollow topic:', err);
      setBookmarkedTopics(prev => {
        const next = new Set(prev);
        if (wasFollowed) next.add(topicId);
        else next.delete(topicId);
        return next;
      });
    }
  };

  // Lock body scroll when login modal is open, restore when closed
  const prevOverflow = useRef(null);
  useEffect(() => {
    if (showLoginModal) {
      prevOverflow.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = prevOverflow.current ?? '';
      prevOverflow.current = null;
    }
    return () => {
      document.body.style.overflow = prevOverflow.current ?? '';
    };
  }, [showLoginModal]);

  return (
    <>
    <div className="w-full max-w-full min-w-0 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full max-w-full min-w-0">
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
                <p className="text-sm font-medium text-gray-600">{t('activeIssues')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTopics || 0}</p>
              </div>
            </div>
          </div>

          <div
            className="bg-white rounded-xl shadow-lg p-6 border border-gray-100"
            title="Number of distinct parliamentary sessions (Mesyuarat) covered by these issues"
          >
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{t('sessionsCovered')}</p>
                <p className="text-2xl font-bold text-gray-900">{(stats.sessionCount || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{t('totalStatements')}</p>
                <p className="text-2xl font-bold text-gray-900">{(stats.totalStatements || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
          <div className="flex flex-col gap-4">
            {/* Search Bar */}
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
            {/* Topic filters: tech badge (category) + coalition badge (cluster_label) */}
            <div className="flex gap-2 flex-wrap">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm min-w-0 w-full sm:w-auto sm:min-w-[140px]"
                title="Category"
              >
                <option value="All">{t('allCategories')}</option>
                {categoryOptions.filter(c => c !== 'All').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={selectedClusterLabel}
                onChange={(e) => setSelectedClusterLabel(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm min-w-0 w-full sm:w-auto sm:min-w-[160px] max-w-full sm:max-w-[320px]"
                title={t('topics')}
              >
                <option value="">{t('allTopics')}</option>
                {clusterLabelOptions.filter(Boolean).map(cl => (
                  <option key={cl} value={cl}>{cl}</option>
                ))}
              </select>
              <select
                value={selectedParlimen}
                onChange={(e) => setSelectedParlimen(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              >
                <option value="">{t('allParlimen')}</option>
                {filters.parlimen.map(p => (
                  <option key={p} value={p}>Parlimen {p}</option>
                ))}
              </select>
              <select
                value={selectedPenggal}
                onChange={(e) => setSelectedPenggal(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              >
                <option value="">{t('allPenggal')}</option>
                {filters.penggal.map(p => (
                  <option key={p} value={p}>Penggal {p}</option>
                ))}
              </select>
              <select
                value={selectedMesyuarat}
                onChange={(e) => setSelectedMesyuarat(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              >
                <option value="">{t('allMesyuarat')}</option>
                {filters.mesyuarat.map(m => (
                  <option key={m} value={m}>Mesyuarat {m}</option>
                ))}
              </select>
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
            <div className="flex flex-col justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-gray-600">{t('loading') || 'Loading topics...'}</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="mb-4">
                <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-600 font-semibold mb-2">{t('failedToLoadTopics') || 'Failed to load topics'}</p>
                <p className="text-gray-500 text-sm mb-4">{error}</p>
              </div>
              <button 
                onClick={() => window.location.reload()} 
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {t('retry') || 'Retry'}
              </button>
            </div>
          ) : !Array.isArray(filteredTopics) || filteredTopics.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-4">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500 text-lg font-medium mb-2">
                  {searchTerm || selectedCategory !== 'All' || selectedClusterLabel || selectedParlimen || selectedPenggal || selectedMesyuarat
                    ? (t('noIssuesFound') || 'No issues found matching your criteria')
                    : (t('noIssuesAvailable') || 'No issues available')}
                </p>
                {(searchTerm || selectedCategory !== 'All' || selectedClusterLabel || selectedParlimen || selectedPenggal || selectedMesyuarat) && (
                  <p className="text-gray-400 text-sm mb-4">
                    {t('clearIssueFiltersSuggestion') || 'Try clearing your filters or selecting a different session'}
                  </p>
                )}
                {!searchTerm && selectedCategory === 'All' && (
                  <p className="text-gray-400 text-sm max-w-md mx-auto">
                    Issue Portal topics are loaded from a precomputed cache. If this is the first time, an administrator must run the precompute step for the pipeline (e.g. pipeline5) from the backend or admin panel to populate topics here.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayEntries.map(([title, sessions]) => {
                const topic = sessions[0]; // newest session for card summary
                const mergedSessions = mergeSameSessionEntries(sessions);
                const sessionDateEntries = expandSessionDates(mergedSessions);
                const issueId = topic._id || topic.cluster_id;
                const totalStatements = sessions.reduce((sum, t) => sum + (t.statement_count || 0), 0);
                const totalMps = sessions.reduce((max, t) => Math.max(max, t.mp_count || 0), 0);
                const statementLabel = totalStatements.toLocaleString();
                return (
              <div
                key={title + (topic._id || '')}
                className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
                onClick={() => navigate(`/topic/${issueId}`, {
                  state: {
                    fromIssuePortal: true,
                    isFollowed: bookmarkedTopics.has(issueId),
                  },
                })}
              >
                <div className="relative">
                  <div className="h-48 bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-black/5"></div>
                    <div className="text-center z-10">
                      <div className="w-16 h-16 bg-white/90 rounded-lg flex items-center justify-center mx-auto mb-2 shadow-lg">
                        <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full">
                        <p className="text-xs font-medium text-gray-700">{statementLabel} statement{totalStatements !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-4 left-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedCategory(topic.category); }}
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/90 backdrop-blur-sm text-indigo-800 shadow-sm hover:bg-indigo-50 hover:shadow-md transition-all cursor-pointer"
                    >
                      {topic.category}
                    </button>
                  </div>
                  <div className="absolute top-4 right-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleBookmarkToggle(issueId); }}
                      className={`p-2 rounded-full backdrop-blur-sm transition-all ${
                        bookmarkedTopics.has(issueId) ? 'bg-yellow-100 text-yellow-600' : 'bg-white/90 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50'
                      }`}
                    >
                      <svg className="w-5 h-5" fill={bookmarkedTopics.has(issueId) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  {topic.cluster_label && (
                    <div className="mb-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedClusterLabel(topic.cluster_label); }}
                        className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 transition-colors cursor-pointer"
                      >
                        {topic.cluster_label}
                      </button>
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors line-clamp-2">
                    {title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {topic.description || 'No description available'}
                  </p>
                  {/* Sessions in this topic (newest first) */}
                  <div className="border-t border-gray-100 pt-3 mt-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">Sessions (by date)</p>
                    <ul className="space-y-1.5">
                      {sessionDateEntries.map((t) => (
                        <li key={t.displayKey}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const dateParam = t.displayDate
                                ? `&scrollToDate=${encodeURIComponent(new Date(t.displayDate).toISOString().slice(0, 10))}`
                                : '';
                              navigate(`/topic/${t._id || t.cluster_id}?from=session${dateParam}`, {
                                state: {
                                  fromIssuePortal: true,
                                  isFollowed: bookmarkedTopics.has(issueId),
                                },
                              });
                            }}
                            className="text-left w-full text-sm text-indigo-600 hover:text-indigo-700 hover:underline py-0.5"
                          >
                            {t.session_label || 'Session'}
                            {t.displayDate && (
                              <span className="text-gray-500 font-normal ml-1">
                                · {new Date(t.displayDate).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500 pt-3 mt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      <span>{totalStatements.toLocaleString()} statements</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{totalMps || 0} MPs</span>
                    </div>
                    {topic.label_quality && topic.label_quality !== 'unknown' && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        topic.label_quality === 'high' ? 'bg-green-100 text-green-700' :
                        topic.label_quality === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {topic.label_quality}
                      </span>
                    )}
                  </div>
                </div>
              </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalTopics > 0 && (
              <div className="mt-8 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-gray-600">
                    {t('showing')} {((meta.page - 1) * meta.limit) + 1} {t('to')} {Math.min(meta.page * meta.limit, totalTopics)} {t('of')} {totalTopics} {t('topics')}
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
                      disabled={meta.page * meta.limit >= totalTopics || loading}
                      onClick={() => changePage(1)}
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
      </div>
    </div>

    {/* Login required modal — sibling of main content, high z-index */}
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

export default IssuePortal;
