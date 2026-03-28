import React, { useState, useEffect, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { forumModerationApi } from '../../api';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useSSEEvent } from '../../contexts/SSEContext';

const ForumModeration = ({ togglePin, isPinned, PinButton }) => {
  const { admin, isAuthenticated } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initialSearchParams = new URLSearchParams(location.search);
  const highlightFlashColor = initialSearchParams.get('fmFlash') || 'indigo';
  const [activeTab, setActiveTab] = useState('topics');
  const [stats, setStats] = useState({});
  const [topics, setTopics] = useState([]);
  const [comments, setComments] = useState([]);
  const [flaggedContent, setFlaggedContent] = useState({ flaggedTopics: [], flaggedPosts: [] });
  const [pendingContent, setPendingContent] = useState([]);
  const [restrictions, setRestrictions] = useState([]);
  const [userEscalations, setUserEscalations] = useState([]);
  const [expandedEscalations, setExpandedEscalations] = useState({});
  const [highlightedReturnKey, setHighlightedReturnKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [currentPage, setCurrentPage] = useState(() => Math.max(1, parseInt(initialSearchParams.get('fmPage') || '1', 10) || 1));
  const [totalPages, setTotalPages] = useState(1);
  const [restrictionsFilter, setRestrictionsFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState(() => initialSearchParams.get('fmStatus') || '');
  const [commentsStatusFilter, setCommentsStatusFilter] = useState(() => initialSearchParams.get('fmCommentsStatus') || '');
  const [sortBy, setSortBy] = useState(() => initialSearchParams.get('fmSort') || '');
  const [commentsSortBy, setCommentsSortBy] = useState(() => initialSearchParams.get('fmCommentsSort') || '');
  const [userEscalateSortBy, setUserEscalateSortBy] = useState(() => initialSearchParams.get('fmUserSort') || 'reportedOn');
  const [userEscalateSortDir, setUserEscalateSortDir] = useState(() => initialSearchParams.get('fmUserDir') || 'desc');
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [goToPageInput, setGoToPageInput] = useState('');

  // Modals
  const [showRestrictModal, setShowRestrictModal] = useState(false);
  const [showModerationModal, setShowModerationModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedContent, setSelectedContent] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  // Sync active tab with URL hash when opened from notification (e.g. #userEscalate)
  useEffect(() => {
    const hash = (window.location.hash || '').replace('#', '');
    const validTabs = ['topics', 'comments', 'userEscalate', 'restrictions'];
    if (hash === 'flagged') setActiveTab('topics');
    else if (validTabs.includes(hash)) setActiveTab(hash);
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = (window.location.hash || '').replace('#', '');
      const validTabs = ['topics', 'comments', 'userEscalate', 'restrictions'];
      if (hash === 'flagged') setActiveTab('topics');
      else if (validTabs.includes(hash)) setActiveTab(hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const page = Math.max(1, parseInt(params.get('fmPage') || '1', 10) || 1);
    setCurrentPage(page);
    setStatusFilter(params.get('fmStatus') || '');
    setCommentsStatusFilter(params.get('fmCommentsStatus') || '');
    setSortBy(params.get('fmSort') || '');
    setCommentsSortBy(params.get('fmCommentsSort') || '');
    setUserEscalateSortBy(params.get('fmUserSort') || 'reportedOn');
    setUserEscalateSortDir(params.get('fmUserDir') || 'desc');
  }, [location.search]);

  useEffect(() => {
    const fetchNotificationCount = async () => {
      try {
        const res = await forumModerationApi.getNotifications({ limit: 1, unreadOnly: 'true' });
        setNotificationUnreadCount(res.data.data?.unreadCount ?? 0);
      } catch (_) {
        setNotificationUnreadCount(0);
      }
    };
    fetchNotificationCount();
    const interval = setInterval(fetchNotificationCount, 60000);
    return () => clearInterval(interval);
  }, []);

  const [sseKey, setSseKey] = useState(0);

  // Real-time: when users create new posts/reports, or admin moderates, refresh lists + stats
  useSSEEvent('forum_activity', () => {
    setSseKey((k) => k + 1);
    fetchStats();
  });
  useSSEEvent('forum_updated',  () => {
    setSseKey((k) => k + 1);
    fetchStats();
  });

  useEffect(() => {
    if (activeTab === 'topics') {
      // Only show loading overlay on initial load or page change
      // For filter/sort changes, use isFiltering state
      const isInitialLoad = currentPage === 1 && !statusFilter && !sortBy;
      fetchTopics(isInitialLoad);
    } else if (activeTab === 'comments') {
      // Comments tab: fetch all posts
      const isInitialLoad = currentPage === 1 && !commentsStatusFilter && !commentsSortBy;
      fetchComments(isInitialLoad);
    } else if (activeTab === 'restrictions') {
      fetchRestrictions();
      fetchStats();
    } else if (activeTab === 'userEscalate') {
      fetchUserEscalations();
    }
  }, [activeTab, currentPage, restrictionsFilter, statusFilter, commentsStatusFilter, sortBy, commentsSortBy, sseKey]);

  const fetchStats = async () => {
    try {
      const response = await forumModerationApi.getStats();
      setStats(response.data.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      // Set default stats to prevent UI issues
      setStats({
        totalTopics: 0,
        flaggedTopics: 0,
        totalPosts: 0,
        flaggedPosts: 0,
        activeRestrictions: 0,
        totalRestrictions: 0,
        sensitiveContent: 0
      });
    }
  };

  const fetchTopics = async (showLoadingOverlay = false) => {
    try {
      // Only show loading overlay if explicitly requested (initial load)
      // For filter changes, use isFiltering state instead
      if (showLoadingOverlay) {
        setLoading(true);
      } else {
        setIsFiltering(true);
      }
      
      const params = {
        page: currentPage,
        limit: 10
      };
      // Add status filter if selected
      if (statusFilter) {
        if (statusFilter === 'approved') {
          // Approved: topics that were flagged and then approved
          params.approved = 'true';
        } else if (statusFilter === 'flagged') {
          params.flagged = 'true'; // Show flagged posts (may be active or hidden)
        } else if (statusFilter === 'restricted') {
          // "Hide" topics are stored as archived in ForumTopic.status
          params.status = 'archived';
        } else {
          // For "active", only show non-flagged active topics
          if (statusFilter === 'active') {
            params.status = 'active';
            params.flagged = 'false';
          } else {
            params.status = statusFilter;
          }
        }
      }
      // Add sorting parameters
      if (sortBy) {
        const [sortField, sortOrder] = sortBy.split('-');
        // Map frontend field names to backend field names
        const fieldMap = {
          'title': 'title',
          'author': 'author', // Will sort by author ObjectId
          'category': 'category',
          'status': 'status',
          'createdAt': 'createdAt'
        };
        params.sortBy = fieldMap[sortField] || sortField;
        params.sortOrder = sortOrder;
      }
      const response = await forumModerationApi.getTopics(params);
      // Only update topics after successful fetch (keeps previous data visible during loading)
      setTopics(response.data.data.topics);
      setTotalPages(response.data.data.totalPages);
    } catch (error) {
      console.error('Error fetching topics:', error);
      // Don't clear topics on error, keep previous data
      setTotalPages(1);
    } finally {
      setLoading(false);
      setIsFiltering(false);
    }
  };

  const fetchUserEscalations = async () => {
    try {
      setLoading(true);
      const response = await forumModerationApi.getUserEscalations({
        page: 1,
        limit: 50
      });
      const escalations = response.data.data.escalations || [];
      setUserEscalations(escalations);
      setExpandedEscalations(
        escalations.reduce((acc, item) => {
          const reportCount = Math.max(
            item?.meta?.reportCount || 0,
            Array.isArray(item?.meta?.reports) ? item.meta.reports.length : 0,
            item?.meta?.reason ? 1 : 0
          );
          if (reportCount > 1) {
            acc[item._id] = true;
          }
          return acc;
        }, {})
      );
    } catch (error) {
      console.error('Error fetching user escalations:', error);
      setUserEscalations([]);
      setExpandedEscalations({});
    } finally {
      setLoading(false);
    }
  };

  const getForumModerationReturnTo = (targetType, targetId) => {
    const params = new URLSearchParams(location.search);
    params.set('fmPage', String(currentPage));
    params.set('fmTargetType', targetType);
    params.set('fmTargetId', String(targetId));

    if (activeTab === 'topics') {
      if (statusFilter) params.set('fmStatus', statusFilter);
      else params.delete('fmStatus');
      if (sortBy) params.set('fmSort', sortBy);
      else params.delete('fmSort');
      params.delete('fmCommentsStatus');
      params.delete('fmCommentsSort');
    } else if (activeTab === 'comments') {
      if (commentsStatusFilter) params.set('fmCommentsStatus', commentsStatusFilter);
      else params.delete('fmCommentsStatus');
      if (commentsSortBy) params.set('fmCommentsSort', commentsSortBy);
      else params.delete('fmCommentsSort');
      params.delete('fmStatus');
      params.delete('fmSort');
    } else if (activeTab === 'userEscalate') {
      params.set('fmUserSort', userEscalateSortBy);
      params.set('fmUserDir', userEscalateSortDir);
    }

    return `${location.pathname}?${params.toString()}#${activeTab}`;
  };

  const handleNavigateToTopic = (topicId) => {
    if (!topicId) return;
    navigate(`/forum/reply/${topicId}?returnTo=${encodeURIComponent(getForumModerationReturnTo('topic', topicId))}`);
  };

  const handleNavigateToPost = (post, returnTargetType = 'comment', returnTargetId = null) => {
    const topicId = post?.topic?._id || post?.topic?.id || post?.topic;
    const postId = post?._id || post?.id;
    if (!topicId || !postId) return;
    navigate(
      `/forum/reply/${topicId}?commentId=${encodeURIComponent(postId)}&returnTo=${encodeURIComponent(getForumModerationReturnTo(returnTargetType, returnTargetId || postId))}`
    );
  };

  const handleSort = (column) => {
    if (sortBy === `${column}-asc`) {
      setSortBy(`${column}-desc`);
    } else {
      setSortBy(`${column}-asc`);
    }
    // Reset to page 1 when sorting changes
    setCurrentPage(1);
  };

  const handleCommentsSort = (column) => {
    if (commentsSortBy === `${column}-asc`) {
      setCommentsSortBy(`${column}-desc`);
    } else {
      setCommentsSortBy(`${column}-asc`);
    }
    // Reset to page 1 when sorting changes
    setCurrentPage(1);
  };

  const getCommentsSortIcon = (column) => {
    if (commentsSortBy === `${column}-asc`) {
      return (
        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    } else if (commentsSortBy === `${column}-desc`) {
      return (
        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      );
    } else {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
  };

  const getSortIcon = (column) => {
    if (sortBy === `${column}-asc`) {
      return (
        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    } else if (sortBy === `${column}-desc`) {
      return (
        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      );
    } else {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
  };

  const fetchPendingContent = async () => {
    try {
      setLoading(true);
      const response = await forumModerationApi.getPendingContent({
        page: currentPage,
        limit: 10
      });
      setPendingContent(response.data.data.pendingPosts || []);
      setTotalPages(response.data.data.totalPages || 1);
    } catch (error) {
      console.error('Error fetching pending content:', error);
      setPendingContent([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (showLoadingOverlay = false) => {
    try {
      if (showLoadingOverlay) {
        setLoading(true);
      } else {
        setIsFiltering(true);
      }
      
      const params = {
        page: currentPage,
        limit: 10
      };
      
      // Add status filter if selected
      if (commentsStatusFilter) {
        if (commentsStatusFilter === 'flagged') {
          params.flagged = 'true';
        } else if (commentsStatusFilter === 'active') {
          params.status = 'active';
          params.flagged = 'false';
        } else if (commentsStatusFilter === 'restricted') {
          params.status = 'hidden';
        } else {
          params.status = commentsStatusFilter;
        }
      }
      
      // Add sorting parameters
      if (commentsSortBy) {
        const [sortField, sortOrder] = commentsSortBy.split('-');
        const fieldMap = {
          'content': 'content',
          'author': 'author',
          'topic': 'topic',
          'status': 'status',
          'createdAt': 'createdAt'
        };
        params.sortBy = fieldMap[sortField] || sortField;
        params.sortOrder = sortOrder;
      }
      
      const response = await forumModerationApi.getPosts(params);
      setComments(response.data.data.posts);
      setTotalPages(response.data.data.totalPages);
    } catch (error) {
      console.error('Error fetching comments:', error);
      setTotalPages(1);
    } finally {
      setLoading(false);
      setIsFiltering(false);
    }
  };

  const fetchFlaggedContent = async () => {
    try {
      setLoading(true);
      const response = await forumModerationApi.getFlaggedContent();
      setFlaggedContent(response.data.data);
    } catch (error) {
      console.error('Error fetching flagged content:', error);
      setFlaggedContent({ flaggedTopics: [], flaggedPosts: [] });
    } finally {
      setLoading(false);
    }
  };

  const fetchRestrictions = async () => {
    try {
      setLoading(true);
      const response = await forumModerationApi.getRestrictions({
        page: currentPage,
        limit: 100,
        active: restrictionsFilter === 'active' ? 'true' : 'false'
      });
      setRestrictions(response.data.data.restrictions || []);
      setTotalPages(response.data.data.totalPages ?? 1);
    } catch (error) {
      console.error('Error fetching restrictions:', error);
      setRestrictions([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const handleRestrictUser = (user) => {
    setSelectedUser(user);
    setShowRestrictModal(true);
  };

  const handleModerateContent = (content, type) => {
    setSelectedContent({ ...content, type });
    setShowModerationModal(true);
  };

  const renderStatsGrid = () => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-4 sm:mb-6">
      <div className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">Total Topics</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-900">{stats.totalTopics || 0}</p>
          </div>
          <div className="h-10 w-10 sm:h-12 sm:w-12 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-600">Total Comments</p>
            <p className="text-xl sm:text-2xl font-bold text-green-900">{stats.totalPosts || 0}</p>
          </div>
          <div className="h-10 w-10 sm:h-12 sm:w-12 bg-green-500 rounded-lg flex items-center justify-center shrink-0">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2m-4 0H7l-4 4V6a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-red-600">Total Flagged</p>
            <p className="text-xl sm:text-2xl font-bold text-red-900">{(stats.flaggedTopics || 0) + (stats.flaggedPosts || 0)}</p>
          </div>
          <div className="h-10 w-10 sm:h-12 sm:w-12 bg-red-500 rounded-lg flex items-center justify-center shrink-0">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-orange-600">Total Restrictions</p>
            <p className="text-xl sm:text-2xl font-bold text-orange-900">{stats.totalRestrictions || 0}</p>
          </div>
          <div className="h-10 w-10 sm:h-12 sm:w-12 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTopics = () => (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <h3 className="text-lg font-semibold text-gray-900">Forum Topics</h3>
        <div className="flex flex-wrap gap-2 items-center">
          <select 
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            disabled={isFiltering}
            className={`px-3 py-2 border border-gray-300 rounded-md text-sm ${isFiltering ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="flagged">Flagged</option>
            <option value="restricted">Hide</option>
          </select>
          {isFiltering && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
        {/* Loading overlay for filter changes */}
        {isFiltering && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-sm text-gray-600">Loading...</p>
            </div>
          </div>
        )}

        {/* Mobile: card list (no horizontal scroll) */}
        <div className="md:hidden divide-y divide-gray-200">
          {topics.length === 0 && !loading && !isFiltering ? (
            <div className="px-4 py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {statusFilter === ''
                  ? 'No topics found'
                  : statusFilter === 'active'
                  ? 'No active topics'
                  : statusFilter === 'flagged'
                  ? 'No flagged topics'
                  : statusFilter === 'restricted'
                  ? 'No hidden topics'
                  : 'No topics found'}
              </h3>
              <p className="text-gray-500 text-sm">
                {statusFilter === ''
                  ? 'There are no forum topics yet.'
                  : statusFilter === 'active'
                  ? 'There are no active topics at the moment.'
                  : statusFilter === 'flagged'
                  ? 'There are no flagged topics to review.'
                  : statusFilter === 'restricted'
                  ? 'There are no hidden topics.'
                  : 'Try adjusting your filters to see more results.'}
              </p>
            </div>
          ) : (
            topics.map((topic) => {
              const statusLabel = topic.moderationFlags?.isFlagged
                ? 'Flagged'
                : topic.status === 'active'
                ? 'Active'
                : topic.status === 'hidden'
                ? 'Restricted'
                : topic.status === 'archived'
                ? 'Hide'
                : topic.status;
              const statusClass = topic.status === 'active' && !topic.moderationFlags?.isFlagged ? 'bg-green-100 text-green-800' : topic.moderationFlags?.isFlagged ? 'bg-red-100 text-red-800' : topic.status === 'hidden' ? 'bg-orange-100 text-orange-800' : topic.status === 'archived' ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800';
              const categoryClass = topic.category === 'policy' ? 'bg-blue-100 text-blue-800' : topic.category === 'debate' ? 'bg-purple-100 text-purple-800' : topic.category === 'announcement' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
              return (
                <div
                  key={topic._id}
                  data-fm-target={`topic:${topic._id || topic.id}`}
                  className={`p-4 ${getHighlightClasses(`topic:${topic._id || topic.id}`)}`}
                >
                  <div className="font-medium text-gray-900">{topic.title}</div>
                  {topic.description && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{topic.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500">
                    <span>{topic.author?.username || 'Unknown'}</span>
                    <span className={categoryClass + ' px-2 py-0.5 rounded-full font-medium'}>{topic.category}</span>
                    <span>{topic.createdAt ? new Date(topic.createdAt).toLocaleString() : topic.lastActivity ? new Date(topic.lastActivity).toLocaleString() : ''}</span>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <span className={'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + statusClass}>{statusLabel}</span>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleNavigateToTopic(topic._id || topic.id); }} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">Navigate</button>
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleModerateContent(topic, 'topic'); }} className="text-sm font-medium text-blue-600 hover:text-blue-800">Moderate</button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop: full table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('title')}>
                  <div className="flex items-center space-x-1"><span>Topic</span>{getSortIcon('title')}</div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('author')}>
                  <div className="flex items-center space-x-1"><span>Author</span>{getSortIcon('author')}</div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('category')}>
                  <div className="flex items-center space-x-1"><span>Category</span>{getSortIcon('category')}</div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('status')}>
                  <div className="flex items-center space-x-1"><span>Status</span>{getSortIcon('status')}</div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('createdAt')}>
                  <div className="flex items-center space-x-1"><span>Created On</span>{getSortIcon('createdAt')}</div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-px">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {topics.length === 0 && !loading && !isFiltering ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {statusFilter === ''
                          ? 'No topics found'
                          : statusFilter === 'active'
                          ? 'No active topics'
                          : statusFilter === 'flagged'
                          ? 'No flagged topics'
                          : statusFilter === 'restricted'
                          ? 'No hidden topics'
                          : 'No topics found'}
                      </h3>
                      <p className="text-gray-500">
                        {statusFilter === ''
                          ? 'There are no forum topics yet.'
                          : statusFilter === 'active'
                          ? 'There are no active topics at the moment.'
                          : statusFilter === 'flagged'
                          ? 'There are no flagged topics to review.'
                          : statusFilter === 'restricted'
                          ? 'There are no hidden topics.'
                          : 'Try adjusting your filters to see more results.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                topics.map((topic) => (
                  <tr
                    key={topic._id}
                    data-fm-target={`topic:${topic._id || topic.id}`}
                    className={getHighlightClasses(`topic:${topic._id || topic.id}`, true)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center min-w-0">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900">{topic.title}</div>
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {topic.description?.length > 40 ? `${topic.description.substring(0, 40)}...` : topic.description}
                          </div>
                        </div>
                        {topic.moderationFlags?.isFlagged && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 shrink-0">Flagged</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{topic.author?.username || 'Unknown'}</div>
                      <div className="text-sm text-gray-500 truncate max-w-[140px]">{topic.author?.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        topic.category === 'policy' ? 'bg-blue-100 text-blue-800' : topic.category === 'debate' ? 'bg-purple-100 text-purple-800' : topic.category === 'announcement' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>{topic.category}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        topic.status === 'active' && !topic.moderationFlags?.isFlagged ? 'bg-green-100 text-green-800' : topic.moderationFlags?.isFlagged ? 'bg-red-100 text-red-800' : topic.status === 'hidden' ? 'bg-orange-100 text-orange-800' : topic.status === 'archived' ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {topic.moderationFlags?.isFlagged
                          ? 'Flagged'
                          : topic.status === 'active'
                          ? 'Active'
                          : topic.status === 'hidden'
                          ? 'Restricted'
                          : topic.status === 'archived'
                          ? 'Hide'
                          : topic.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {topic.createdAt ? new Date(topic.createdAt).toLocaleString() : topic.lastActivity ? new Date(topic.lastActivity).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2 align-middle text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleNavigateToTopic(topic._id || topic.id);
                          }}
                          className="inline-block text-sm text-indigo-600 hover:text-indigo-900"
                        >
                          Navigate
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleModerateContent(topic, 'topic');
                          }}
                          className="inline-block text-sm text-blue-600 hover:text-blue-900"
                        >
                          Moderate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <form onSubmit={(e) => { e.preventDefault(); const n = parseInt(goToPageInput, 10); if (!isNaN(n) && n >= 1 && n <= totalPages) { setCurrentPage(n); setGoToPageInput(''); } }}>
            <input type="number" min={1} max={totalPages} value={goToPageInput} onChange={(e) => setGoToPageInput(e.target.value.replace(/\D/g, '').slice(0, 5))} className="w-12 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center" placeholder={currentPage} aria-label="Page number" />
          </form>
          <span className="px-2 sm:px-3 py-2 text-sm text-gray-700 whitespace-nowrap">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );

  const renderPendingContent = () => (
    <div className="space-y-4 sm:space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Pending Posts</h3>
      
      {pendingContent.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="divide-y divide-gray-200">
            {pendingContent.map((post) => (
              <div key={post._id} className="px-4 sm:px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      {post.content?.length > 30 ? `${post.content.substring(0, 30)}...` : post.content}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                      <span>By: {post.author?.username}</span>
                      <span className="truncate max-w-[180px] sm:max-w-none">Topic: {post.topic?.title}</span>
                      <span>Created: {new Date(post.createdAt).toLocaleString()}</span>
                    </div>
                    {post.moderationFlags?.isFlagged && (
                      <div className="mt-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Flagged
                        </span>
                        {post.moderationFlags.flaggedBy.length > 0 && (
                          <p className="text-xs text-gray-600 mt-1">
                            Reason: {post.moderationFlags.flaggedBy[post.moderationFlags.flaggedBy.length - 1].reason}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2 sm:ml-4 shrink-0">
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleModerateContent(post, 'post'); }}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700"
                    >
                      Review
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No pending posts</h3>
          <p className="mt-1 text-sm text-gray-500">All posts have been reviewed.</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <form onSubmit={(e) => { e.preventDefault(); const n = parseInt(goToPageInput, 10); if (!isNaN(n) && n >= 1 && n <= totalPages) { setCurrentPage(n); setGoToPageInput(''); } }}>
            <input type="number" min={1} max={totalPages} value={goToPageInput} onChange={(e) => setGoToPageInput(e.target.value.replace(/\D/g, '').slice(0, 5))} className="w-12 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center" placeholder={currentPage} aria-label="Page number" />
          </form>
          <span className="px-2 sm:px-3 py-2 text-sm text-gray-700 whitespace-nowrap">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );

  const renderComments = () => (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <h3 className="text-lg font-semibold text-gray-900">Comments</h3>
        <div className="flex flex-wrap gap-2 items-center">
          <select 
            value={commentsStatusFilter}
            onChange={(e) => {
              setCommentsStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            disabled={isFiltering}
            className={`px-3 py-2 border border-gray-300 rounded-md text-sm ${isFiltering ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="flagged">Flagged</option>
            <option value="restricted">Hide</option>
          </select>
          {isFiltering && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
        {isFiltering && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-sm text-gray-600">Loading...</p>
            </div>
          </div>
        )}

        {/* Mobile: card list */}
        <div className="md:hidden divide-y divide-gray-200">
          {comments.length === 0 && !loading && !isFiltering ? (
            <div className="px-4 py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2m-4 0H7l-4 4V6a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {commentsStatusFilter === '' ? 'No comments found' : commentsStatusFilter === 'active' ? 'No active comments' : commentsStatusFilter === 'flagged' ? 'No flagged comments' : commentsStatusFilter === 'restricted' ? 'No restricted comments' : 'No comments found'}
              </h3>
              <p className="text-gray-500 text-sm">
                {commentsStatusFilter === '' ? 'There are no comments yet.' : commentsStatusFilter === 'active' ? 'There are no active comments at the moment.' : commentsStatusFilter === 'flagged' ? 'There are no flagged comments to review.' : commentsStatusFilter === 'restricted' ? 'There are no restricted comments.' : 'Try adjusting your filters to see more results.'}
              </p>
            </div>
          ) : (
            comments.map((post) => {
              const statusLabel = post.moderationFlags?.isFlagged ? 'Flagged' : post.status === 'active' ? 'Active' : post.status === 'hidden' ? 'Restricted' : post.status;
              const statusClass = post.moderationFlags?.isFlagged ? 'bg-red-100 text-red-800' : post.status === 'active' ? 'bg-green-100 text-green-800' : post.status === 'hidden' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800';
              return (
                <div
                  key={post._id}
                  data-fm-target={`comment:${post._id || post.id}`}
                  className={`p-4 ${getHighlightClasses(`comment:${post._id || post.id}`)}`}
                >
                  <p className="text-sm text-gray-900 line-clamp-3">{post.content}</p>
                  {post.moderationFlags?.flaggedBy?.length > 0 && (
                    <p className="text-xs text-red-600 mt-1">Flagged: {post.moderationFlags.flaggedBy[post.moderationFlags.flaggedBy.length - 1].reason}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500">
                    <span>{post.author?.username || 'Unknown'}</span>
                    <span>·</span>
                    <span className="truncate max-w-[160px]">{post.topic?.title || 'N/A'}</span>
                    <span>·</span>
                    <span>{post.createdAt ? new Date(post.createdAt).toLocaleString() : 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <span className={'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + statusClass}>{statusLabel}</span>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleNavigateToPost(post, 'comment', post._id || post.id); }} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">Navigate</button>
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleModerateContent(post, 'post'); }} className="text-sm font-medium text-blue-600 hover:text-blue-800">Moderate</button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop: full table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleCommentsSort('content')}>
                  <div className="flex items-center space-x-1"><span>Content</span>{getCommentsSortIcon('content')}</div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleCommentsSort('author')}>
                  <div className="flex items-center space-x-1"><span>Author</span>{getCommentsSortIcon('author')}</div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleCommentsSort('topic')}>
                  <div className="flex items-center space-x-1"><span>Topic</span>{getCommentsSortIcon('topic')}</div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleCommentsSort('status')}>
                  <div className="flex items-center space-x-1"><span>Status</span>{getCommentsSortIcon('status')}</div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleCommentsSort('createdAt')}>
                  <div className="flex items-center space-x-1"><span>Created On</span>{getCommentsSortIcon('createdAt')}</div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-px">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {comments.length === 0 && !loading && !isFiltering ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2m-4 0H7l-4 4V6a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {commentsStatusFilter === '' ? 'No comments found' : commentsStatusFilter === 'active' ? 'No active comments' : commentsStatusFilter === 'flagged' ? 'No flagged comments' : commentsStatusFilter === 'restricted' ? 'No restricted comments' : 'No comments found'}
                      </h3>
                      <p className="text-gray-500">
                        {commentsStatusFilter === '' ? 'There are no comments yet.' : commentsStatusFilter === 'active' ? 'There are no active comments at the moment.' : commentsStatusFilter === 'flagged' ? 'There are no flagged comments to review.' : commentsStatusFilter === 'restricted' ? 'There are no restricted comments.' : 'Try adjusting your filters to see more results.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                comments.map((post) => (
                  <tr
                    key={post._id}
                    data-fm-target={`comment:${post._id || post.id}`}
                    className={getHighlightClasses(`comment:${post._id || post.id}`, true)}
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-md">
                        {post.content?.length > 60 ? `${post.content.substring(0, 60)}...` : post.content}
                      </div>
                      {post.moderationFlags?.flaggedBy?.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">Flagged: {post.moderationFlags.flaggedBy[post.moderationFlags.flaggedBy.length - 1].reason}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{post.author?.username || 'Unknown'}</div>
                      <div className="text-sm text-gray-500 truncate max-w-[140px]">{post.author?.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 truncate max-w-[160px]">{post.topic?.title || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        post.moderationFlags?.isFlagged ? 'bg-red-100 text-red-800' : post.status === 'active' ? 'bg-green-100 text-green-800' : post.status === 'hidden' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {post.moderationFlags?.isFlagged ? 'Flagged' : post.status === 'active' ? 'Active' : post.status === 'hidden' ? 'Restricted' : post.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {post.createdAt ? new Date(post.createdAt).toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-4 py-2 align-middle text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleNavigateToPost(post, 'comment', post._id || post.id);
                          }}
                          className="inline-block text-sm text-indigo-600 hover:text-indigo-900"
                        >
                          Navigate
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleModerateContent(post, 'post');
                          }}
                          className="inline-block text-sm text-blue-600 hover:text-blue-900"
                        >
                          Moderate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const handleUserEscalateSort = (column) => {
    if (userEscalateSortBy === column) {
      setUserEscalateSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setUserEscalateSortBy(column);
      setUserEscalateSortDir(column === 'reportedOn' ? 'desc' : 'asc');
    }
  };

  const getEscalationReports = (item) => {
    if (Array.isArray(item?.meta?.reports) && item.meta.reports.length) {
      return item.meta.reports;
    }
    if (item?.meta?.reason) {
      return [{
        reporterId: item.meta.reporterId,
        reason: item.meta.reason,
        createdAt: item.createdAt
      }];
    }
    return [];
  };

  const getEscalationReportCount = (item) => {
    const reports = getEscalationReports(item);
    return Math.max(item?.meta?.reportCount || 0, reports.length, item?.meta?.reason ? 1 : 0);
  };

  const getEscalationReportedAt = (item) => {
    const reports = getEscalationReports(item);
    if (!reports.length) return item.createdAt;

    return reports.reduce((latest, report) => {
      const latestTime = new Date(latest || item.createdAt).getTime();
      const reportTime = new Date(report?.createdAt || item.createdAt).getTime();
      return reportTime > latestTime ? (report?.createdAt || item.createdAt) : latest;
    }, item.createdAt);
  };

  const getHighlightClasses = (targetKey, isTableRow = false) => {
    if (highlightedReturnKey !== targetKey) {
      return isTableRow ? 'hover:bg-gray-50' : '';
    }

    if (highlightFlashColor === 'green') {
      return isTableRow ? 'bg-green-50 animate-pulse' : 'bg-green-50 ring-2 ring-green-300 animate-pulse';
    }

    return isTableRow ? 'bg-indigo-50 animate-pulse' : 'bg-indigo-50 ring-2 ring-indigo-300 animate-pulse';
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetType = params.get('fmTargetType');
    const targetId = params.get('fmTargetId');
    if (!targetType || !targetId || loading || isFiltering) return;

    const targetKey = `${targetType}:${targetId}`;
    const targetElement = document.querySelector(`[data-fm-target="${targetKey}"]`);
    if (!targetElement) return;

    const timer = setTimeout(() => {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedReturnKey(targetKey);
    }, 150);

    const clearTimer = setTimeout(() => {
      setHighlightedReturnKey((prev) => (prev === targetKey ? null : prev));
      const nextParams = new URLSearchParams(location.search);
      nextParams.delete('fmTargetType');
      nextParams.delete('fmTargetId');
      nextParams.delete('fmFlash');
      const nextSearch = nextParams.toString();
      const nextUrl = `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
      window.history.replaceState(window.history.state, '', nextUrl);
    }, 2600);

    return () => {
      clearTimeout(timer);
      clearTimeout(clearTimer);
    };
  }, [location.search, activeTab, topics, comments, userEscalations, loading, isFiltering]);

  const toggleEscalationReports = (notificationId) => {
    setExpandedEscalations((prev) => ({
      ...prev,
      [notificationId]: !prev[notificationId]
    }));
  };

  const getSortedUserEscalations = () => {
    if (!userEscalations.length) return [];
    const sorted = [...userEscalations];
    const dir = userEscalateSortDir === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
      const isTopicA = a.type === 'forum_user_report_topic' || (!a.meta?.postId && a.meta?.topicId);
      const isTopicB = b.type === 'forum_user_report_topic' || (!b.meta?.postId && b.meta?.topicId);
      const topicA = a.meta?.topicId;
      const postA = a.meta?.postId;
      const topicB = b.meta?.topicId;
      const postB = b.meta?.postId;
      const authorA = (isTopicA ? topicA?.author : postA?.author) || a.meta?.authorId;
      const authorB = (isTopicB ? topicB?.author : postB?.author) || b.meta?.authorId;
      const authorNameA = (authorA?.username || authorA?.email || '').toLowerCase();
      const authorNameB = (authorB?.username || authorB?.email || '').toLowerCase();
      const contentA = isTopicA ? (topicA?.title || topicA?.description || '') : (postA?.content || '');
      const contentB = isTopicB ? (topicB?.title || topicB?.description || '') : (postB?.content || '');

      switch (userEscalateSortBy) {
        case 'type':
          return dir * ((isTopicA ? 'topic' : 'reply').localeCompare(isTopicB ? 'topic' : 'reply'));
        case 'content':
          return dir * (contentA.localeCompare(contentB, undefined, { sensitivity: 'base' }));
        case 'author':
          return dir * (authorNameA.localeCompare(authorNameB, undefined, { sensitivity: 'base' }));
        case 'reportedOn':
        default:
          return dir * (new Date(getEscalationReportedAt(a)) - new Date(getEscalationReportedAt(b)));
      }
    });
    return sorted;
  };

  const SortHeader = ({ column, label, currentSort, currentDir }) => (
    <th
      scope="col"
      className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100"
      onClick={() => handleUserEscalateSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {currentSort === column && (
          currentDir === 'asc' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          )
        )}
      </span>
    </th>
  );

  const renderUserEscalations = () => {
    const sortedEscalations = getSortedUserEscalations();
    return (
    <div className="space-y-4 sm:space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">User Escalate (Reported Content)</h3>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Mobile: card list */}
        <div className="md:hidden divide-y divide-gray-200">
          {loading && sortedEscalations.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
            </div>
          ) : sortedEscalations.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No user escalations</h3>
              <p className="text-gray-500 text-sm">When users report posts or replies, they will appear here for review.</p>
            </div>
          ) : (
            sortedEscalations.map((item) => {
              const isTopic = item.type === 'forum_user_report_topic' || (!item.meta?.postId && item.meta?.topicId);
              const topic = item.meta?.topicId;
              const post = item.meta?.postId;
              const contentText = isTopic ? (topic?.description || topic?.title || '') : (post?.content || '');
              const author = (isTopic ? topic?.author : post?.author) || item.meta?.authorId;
              const title = isTopic ? (topic?.title || 'Untitled topic') : (topic?.title || 'Related topic');
              const reports = getEscalationReports(item);
              const reportCount = getEscalationReportCount(item);
              const reportedAt = getEscalationReportedAt(item);
              const isExpanded = expandedEscalations[item._id] ?? reportCount > 1;
              return (
                <div
                  key={item._id}
                  data-fm-target={`escalation:${item._id}`}
                  className={`p-4 ${getHighlightClasses(`escalation:${item._id}`)}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-500 uppercase">{isTopic ? 'Post (Topic)' : 'Reply'}</span>
                    <span className="text-xs text-gray-500">{new Date(reportedAt).toLocaleString()}</span>
                  </div>
                  <div className="font-medium text-gray-900 mt-1">{title}</div>
                  <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{contentText || 'No content preview'}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <span className="font-medium text-red-600">{reportCount} report{reportCount === 1 ? '' : 's'}</span>
                    {reportCount > 1 && (
                      <button
                        type="button"
                        onClick={() => toggleEscalationReports(item._id)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {isExpanded ? 'Collapse' : 'Expand to see all'}
                      </button>
                    )}
                  </div>
                  {reportCount === 1 && (
                    <p className="text-xs text-red-600 mt-1">Latest report: {reports[0]?.reason || 'No reason provided'}</p>
                  )}
                  {reportCount > 1 && isExpanded && (
                    <div className="mt-2 space-y-2 rounded-md bg-red-50 p-3">
                      {reports.map((report, index) => (
                        <div key={`${item._id}-report-${index}`} className="text-xs text-red-700">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium">
                              {report?.reporterId?.username || report?.reporterId?.email || `Reporter ${index + 1}`}
                            </div>
                            <div className="text-red-500 whitespace-nowrap">{new Date(report?.createdAt || item.createdAt).toLocaleString()}</div>
                          </div>
                          <div>{report?.reason || 'No reason provided'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-3 mt-3 pt-3 border-t border-gray-100">
                    {isTopic && topic ? (
                      <>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/forum/reply/${topic._id || topic.id}?returnTo=${encodeURIComponent(getForumModerationReturnTo('escalation', item._id))}`); }} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">Navigate</button>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleModerateContent(topic, 'topic'); }} className="text-sm font-medium text-blue-600 hover:text-blue-800">Moderate Topic</button>
                      </>
                    ) : post ? (
                      <>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleNavigateToPost(post, 'escalation', item._id); }} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">Navigate</button>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleModerateContent(post, 'post'); }} className="text-sm font-medium text-blue-600 hover:text-blue-800">Moderate Reply</button>
                      </>
                    ) : (
                      <span className="text-gray-400 text-xs">No content linked</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop: full table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <colgroup>
              <col className="w-28" />
              <col className="w-52" />
              <col className="w-40" />
              <col className="w-36" />
              <col className="w-px" />
            </colgroup>
            <thead className="bg-gray-50">
              <tr>
                <SortHeader column="type" label="Type" currentSort={userEscalateSortBy} currentDir={userEscalateSortDir} />
                <SortHeader column="content" label="Content" currentSort={userEscalateSortBy} currentDir={userEscalateSortDir} />
                <SortHeader column="author" label="Author" currentSort={userEscalateSortBy} currentDir={userEscalateSortDir} />
                <SortHeader column="reportedOn" label="Reported On" currentSort={userEscalateSortBy} currentDir={userEscalateSortDir} />
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-px">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && sortedEscalations.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                  </td>
                </tr>
              ) : sortedEscalations.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No user escalations</h3>
                      <p className="text-gray-500">When users report posts or replies, they will appear here for review.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedEscalations.map((item) => {
                  const isTopic = item.type === 'forum_user_report_topic' || (!item.meta?.postId && item.meta?.topicId);
                  const topic = item.meta?.topicId;
                  const post = item.meta?.postId;
                  const contentText = isTopic ? (topic?.description || topic?.title || '') : (post?.content || '');
                  const author = (isTopic ? topic?.author : post?.author) || item.meta?.authorId;
                  const reports = getEscalationReports(item);
                  const reportCount = getEscalationReportCount(item);
                  const reportedAt = getEscalationReportedAt(item);
                  const isExpanded = expandedEscalations[item._id] ?? reportCount > 1;
                  return (
                    <tr
                      key={item._id}
                      data-fm-target={`escalation:${item._id}`}
                      className={getHighlightClasses(`escalation:${item._id}`, true)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{isTopic ? 'Post (Topic)' : 'Reply'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 overflow-hidden">
                        <div className="font-medium text-gray-900 truncate" title={isTopic ? (topic?.title || 'Untitled topic') : (topic?.title || 'Related topic')}>{isTopic ? (topic?.title || 'Untitled topic') : (topic?.title || 'Related topic')}</div>
                        <div className="text-gray-600 text-xs mt-1 truncate" title={contentText || 'No content preview'}>{contentText && contentText.length > 55 ? `${contentText.substring(0, 55)}...` : contentText || 'No content preview'}</div>
                        <div className="mt-2 flex items-center gap-3 text-xs">
                          <span className="font-medium text-red-600">{reportCount} report{reportCount === 1 ? '' : 's'}</span>
                          {reportCount > 1 && (
                            <button
                              type="button"
                              onClick={() => toggleEscalationReports(item._id)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              {isExpanded ? 'Collapse' : 'Expand to see all'}
                            </button>
                          )}
                        </div>
                        {reportCount === 1 && (
                          <div className="text-xs text-red-600 mt-1">Latest report: {reports[0]?.reason || 'No reason provided'}</div>
                        )}
                        {reportCount > 1 && isExpanded && (
                          <div className="mt-2 space-y-2 rounded-md bg-red-50 p-3">
                            {reports.map((report, index) => (
                              <div key={`${item._id}-report-${index}`} className="text-xs text-red-700">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="font-medium">
                                    {report?.reporterId?.username || report?.reporterId?.email || `Reporter ${index + 1}`}
                                  </div>
                                  <div className="text-red-500 whitespace-nowrap">{new Date(report?.createdAt || item.createdAt).toLocaleString()}</div>
                                </div>
                                <div>{report?.reason || 'No reason provided'}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>{author?.username || author?.email || 'Unknown'}</div>
                        {author?.email && author?.username && <div className="text-gray-500 text-xs truncate max-w-[140px]">{author.email}</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(reportedAt).toLocaleString()}</td>
                      <td className="px-4 py-2 align-middle text-center">
                        {isTopic && topic ? (
                          <div className="inline-flex flex-col items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                navigate(`/forum/reply/${topic._id || topic.id}?returnTo=${encodeURIComponent(getForumModerationReturnTo('escalation', item._id))}`);
                              }}
                              className="inline-block text-sm text-indigo-600 hover:text-indigo-900"
                            >
                              Navigate
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleModerateContent(topic, 'topic');
                              }}
                              className="inline-block text-sm text-blue-600 hover:text-blue-900"
                            >
                              Moderate Topic
                            </button>
                          </div>
                        ) : post ? (
                          <div className="inline-flex flex-col items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleNavigateToPost(post, 'escalation', item._id);
                              }}
                              className="inline-block text-sm text-indigo-600 hover:text-indigo-900"
                            >
                              Navigate
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleModerateContent(post, 'post');
                              }}
                              className="inline-block text-sm text-blue-600 hover:text-blue-900"
                            >
                              Moderate Reply
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">No content linked</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    );
  };

  const renderRestrictions = () => (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <h3 className="text-lg font-semibold text-gray-900">User Restrictions</h3>
        <select
          value={restrictionsFilter}
          onChange={(e) => { setRestrictionsFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm w-full sm:w-auto"
        >
          <option value="active">Active Restrictions</option>
          <option value="all">All Restrictions</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Mobile: card list */}
        <div className="md:hidden divide-y divide-gray-200">
          {loading && restrictions.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
            </div>
          ) : restrictions.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No user restrictions</h3>
              <p className="text-gray-500 text-sm max-w-sm mx-auto">
                No users are currently restricted. To restrict a user, go to <strong>Topics</strong> or <strong>Comments</strong>, click <strong>Moderate</strong>, then apply a restriction.
              </p>
            </div>
          ) : (
            restrictions.map((restriction) => {
              const isActive = restriction.isActive !== false && restriction.endDate && new Date(restriction.endDate) > new Date();
              return (
                <div key={restriction._id} className="p-4">
                  <div className="font-medium text-gray-900">{restriction.user?.username || 'Unknown'}</div>
                  <div className="text-sm text-gray-500 truncate">{restriction.user?.email}</div>
                  <p className="text-sm text-gray-700 mt-2">{restriction.reason}</p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {restriction.restrictionType === 'forum' ? 'Forum' : (restriction.restrictionType || 'Forum').replace(/_/g, ' ')}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {isActive ? 'Active' : 'Expired'}
                      </span>
                      {restriction.endDate && <span className="text-xs text-gray-500">{new Date(restriction.endDate).toLocaleDateString()}</span>}
                    </div>
                    {isActive && (
                      <button onClick={() => handleLiftRestriction(restriction._id)} className="text-sm font-medium text-green-600 hover:text-green-800">Lift</button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop: full table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Restriction Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-px">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && restrictions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                  </td>
                </tr>
              ) : restrictions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No user restrictions</h3>
                      <p className="text-gray-500 max-w-sm">
                        No users are currently restricted. To restrict a user, go to <strong>Topics</strong> or <strong>Comments</strong>, click <strong>Moderate</strong> on a post or topic, then apply a restriction.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                restrictions.map((restriction) => (
                  <tr key={restriction._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{restriction.user?.username || 'Unknown'}</div>
                      <div className="text-sm text-gray-500 truncate max-w-[180px]">{restriction.user?.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {restriction.restrictionType === 'forum' ? 'Forum' : (restriction.restrictionType || 'Forum').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs">{restriction.reason}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {restriction.endDate ? new Date(restriction.endDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        (restriction.isActive !== false && restriction.endDate && new Date(restriction.endDate) > new Date()) ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {(restriction.isActive !== false && restriction.endDate && new Date(restriction.endDate) > new Date()) ? 'Active' : 'Expired'}
                      </span>
                    </td>
                    <td className="px-4 py-2 align-top">
                      {restriction.endDate && new Date(restriction.endDate) > new Date() && (
                        <button onClick={() => handleLiftRestriction(restriction._id)} className="text-sm text-green-600 hover:text-green-900">Lift Restriction</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <form onSubmit={(e) => { e.preventDefault(); const n = parseInt(goToPageInput, 10); if (!isNaN(n) && n >= 1 && n <= totalPages) { setCurrentPage(n); setGoToPageInput(''); } }}>
            <input type="number" min={1} max={totalPages} value={goToPageInput} onChange={(e) => setGoToPageInput(e.target.value.replace(/\D/g, '').slice(0, 5))} className="w-12 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center" placeholder={currentPage} aria-label="Page number" />
          </form>
          <span className="px-2 sm:px-3 py-2 text-sm text-gray-700 whitespace-nowrap">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );

  const handleLiftRestriction = async (restrictionId) => {
    try {
      await forumModerationApi.liftRestriction(restrictionId, {
        reason: 'Restriction lifted by administrator'
      });
      fetchRestrictions();
      fetchStats();
    } catch (error) {
      console.error('Error lifting restriction:', error);
    }
  };

  return (
    <Fragment>
      <div className="p-4 sm:p-6 max-w-full overflow-x-hidden" style={{ scrollbarGutter: 'stable' }}>
        {/* Statistics Grid - above tabs */}
        {renderStatsGrid()}

        {/* Tab Navigation */}
        <div className="mb-4 sm:mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
          <nav className="flex space-x-4 sm:space-x-8 overflow-x-auto pb-2 -mb-2" aria-label="Forum moderation tabs">
            {[
              { id: 'topics', label: 'Topics' },
              { id: 'comments', label: 'Comments' },
              { id: 'userEscalate', label: 'User Escalate' },
              { id: 'restrictions', label: 'User Restrictions' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap shrink-0 ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
                {PinButton && <PinButton tabId={tab.id} tabName={tab.label} module="Forum Moderation" />}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="min-h-[24rem]">
          {activeTab === 'topics' && renderTopics()}
          {activeTab === 'comments' && renderComments()}
          {activeTab === 'userEscalate' && renderUserEscalations()}
          {activeTab === 'restrictions' && renderRestrictions()}
        </div>
      </div>

      {/* Modals – portaled to document.body so they stay viewport-centered when list is scrolled */}
      {showRestrictModal &&
        createPortal(
          <UserRestrictionModal
            user={selectedUser}
            onClose={() => {
              setShowRestrictModal(false);
              setSelectedUser(null);
            }}
            onRestrict={(data) => {
              setShowRestrictModal(false);
              setSelectedUser(null);
              fetchStats();
              if (activeTab === 'topics') fetchTopics();
            }}
          />,
          document.body
        )}

      {showModerationModal &&
        createPortal(
          <ModerationModal
            content={selectedContent}
            onClose={() => {
              setShowModerationModal(false);
              setSelectedContent(null);
            }}
            onModerate={(data) => {
              setShowModerationModal(false);
              setSelectedContent(null);
              fetchStats();
              if (activeTab === 'comments') fetchComments();
              if (activeTab === 'topics') fetchTopics();
            }}
          />,
          document.body
        )}
    </Fragment>
  );
};

// Restrict Post – confirm modal (600px, reason only). Renders outside main container; locks body scroll when open.
const UserRestrictionModal = ({ user, onClose, onRestrict }) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleClose = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await forumModerationApi.restrictUser(user._id, { reason: reason.trim(), durationDays: 7 });
      onRestrict({ reason });
    } catch (error) {
      console.error('Error restricting user:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4" role="dialog" aria-modal="true" aria-labelledby="restrict-modal-title">
      <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-[600px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 id="restrict-modal-title" className="text-lg font-medium text-gray-900">Restrict post?</h3>
          <button type="button" onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-3">User: <strong>{user?.username}</strong></p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required)"
            className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!reason.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// Moderation Modal Component
const ModerationModal = ({ content, onClose, onModerate }) => {
  // Default action:
  // - flagged content: approve (review OK)
  // - active/unflagged content: flag for review
  const [action, setAction] = useState(() => {
    // Flagged content: default to "Flag for Review"
    if (content?.moderationFlags?.isFlagged) {
      return 'flag';
    }
    // Hidden topics (archived) / hidden posts: default to "restrict" (keep hidden)
    if (content?.type === 'topic' && content?.status === 'archived') {
      return 'restrict';
    }
    if (content?.type === 'post' && content?.status === 'hidden') {
      return 'restrict';
    }
    // Active content: default to "Active" (approve)
    return 'approve';
  });
  const [note, setNote] = useState('');
  const [sensitiveContentType, setSensitiveContentType] = useState('');
  const [showShake, setShowShake] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [contentExpanded, setContentExpanded] = useState(false);

  const handleNoteChange = (e) => {
    setNote(e.target.value);
    // Clear error when user starts typing
    if (noteError) {
      setNoteError('');
    }
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleClose = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Validate moderation note
    if (!note.trim()) {
      setNoteError('Moderation note is required');
      setShowShake(true);
      setTimeout(() => setShowShake(false), 600);
      return;
    }

    try {
      const data = { action, note, sensitiveContentType };
      if (content.type === 'topic') {
        await forumModerationApi.moderateTopic(content._id, data);
      } else {
        await forumModerationApi.moderatePost(content._id, data);
      }
      onModerate(data);
    } catch (error) {
      console.error('Error moderating content:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4" role="dialog" aria-modal="true" aria-labelledby="moderation-modal-title">
      <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-[600px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 id="moderation-modal-title" className="text-lg font-medium text-gray-900">Moderate {content.type}</h3>
          <button type="button" onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">
            {content.type === 'topic' ? content.title : 'Post Content'}
          </h4>
          <p className={`text-sm text-gray-600 whitespace-pre-wrap ${contentExpanded ? '' : 'line-clamp-4 overflow-hidden'}`}>
            {content.type === 'topic' ? content.description : content.content}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContentExpanded((v) => !v);
            }}
            className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            {contentExpanded ? 'Collapse' : 'Expand'}
          </button>
          <div className="mt-2 text-xs text-gray-500">
            By: {content.author?.username} |
            {content.moderationFlags?.flaggedBy?.length > 0 &&
              ` Flagged ${content.moderationFlags.flaggedBy.length} times`}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Action</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              >
                {/* Flagged (topic or post): Wait for review, Restrict, Approved */}
                {content.moderationFlags?.isFlagged ? (
                  <>
                    <option value="flag">Wait for review</option>
                    <option value="restrict">Restrict</option>
                    <option value="approve">Approved</option>
                  </>
                ) : content.type === 'topic' && content.status === 'archived' ? (
                  <>
                    {/* Hidden topics: Restrict / Approved */}
                    <option value="restrict">Restrict</option>
                    <option value="approve">Approved</option>
                  </>
                ) : content.type === 'post' && content.status === 'hidden' ? (
                  <>
                    {/* Hidden posts: Restrict / Approved */}
                    <option value="restrict">Restrict</option>
                    <option value="approve">Approved</option>
                  </>
                ) : (
                  <>
                    {/* Active (topic or post): Approved / Restrict */}
                    <option value="approve">Approved</option>
                    <option value="restrict">Restrict</option>
                  </>
                )}
              </select>
          </div>

          {action === 'mark_sensitive' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Sensitive Content Type</label>
              <select
                value={sensitiveContentType}
                onChange={(e) => setSensitiveContentType(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
              >
                <option value="">Select type...</option>
                <option value="profanity">Profanity</option>
                <option value="hate_speech">Hate Speech</option>
                <option value="inappropriate">Inappropriate</option>
                <option value="spam">Spam</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Moderation Note <span className="text-red-500">*</span>
            </label>
            <textarea
              value={note}
              onChange={handleNoteChange}
              rows={3}
              className={`mt-1 block w-full border rounded-md px-3 py-2 ${noteError ? 'form-shake border-red-500' : 'border-gray-300'}`}
              placeholder={
                action === 'approve' 
                  ? "This note is for admin record only and will not be sent to the user."
                  : action === 'restrict' || action === 'hide' || action === 'delete' || action === 'archive'
                  ? "This note is for admin record and will be sent to the user to notify them of the reason for this moderation action."
                  : "This note is for admin record and will notify the user the reason for this moderation action..."
              }
            />
            {noteError && (
              <p className="mt-1 text-sm text-red-600">{noteError}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {action === 'approve' 
                ? "Note will be stored for admin records only."
                : action === 'restrict' || action === 'hide' || action === 'delete' || action === 'archive'
                ? "Note will be sent to the user as notification."
                : "Note will be recorded for moderation history."}
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={(e) => e.stopPropagation()}
              className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
            >
              Apply Action
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForumModeration;
