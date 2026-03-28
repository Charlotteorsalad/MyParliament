import { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks';
import { useApi } from '../../hooks';
import { usePin } from '../../contexts/PinContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { forumApi, bookmarkApi, userApi, topicApi } from '../../api';
import LoginConfirmationModal from '../../components/LoginConfirmationModal';
import { getReportedTopicIds, addReportedTopic } from '../../utils/forumReportedStorage';
import { useSSEEvent } from '../../contexts/SSEContext';

// ─── Searchable dropdown (portal-based so it escapes overflow:hidden containers) ─
function SearchableDropdown({ options = [], value, onChange, placeholder, disabled = false, loading = false, error = false }) {
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const [style, setStyle] = useState({});
    const inputRef = useRef(null);
    const containerRef = useRef(null);
    const portalRef = useRef(null);

    useEffect(() => {
        const close = (e) => {
            const clickedTrigger = containerRef.current?.contains(e.target);
            const clickedPortal = portalRef.current?.contains(e.target);
            if (!clickedTrigger && !clickedPortal) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const handleFocus = () => {
        if (disabled) return;
        if (inputRef.current) {
            const r = inputRef.current.getBoundingClientRect();
            setStyle({ position: 'fixed', top: r.bottom + 4, left: r.left, width: r.width, zIndex: 100000 });
        }
        setSearch('');
        setOpen(true);
    };

    const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

    const handleSelect = (opt) => {
        onChange(opt);
        setSearch('');
        setOpen(false);
    };

    const displayValue = open ? search : (value || '');

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={displayValue}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={handleFocus}
                    disabled={disabled}
                    placeholder={placeholder}
                    className={`w-full px-3 py-2 pr-9 border rounded-lg transition-colors ${
                        error
                            ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                            : 'focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                    } ${
                        disabled
                            ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                            : error ? 'bg-white text-gray-900' : 'border-gray-300 bg-white'
                    }`}
                />
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>
            {open && !disabled && ReactDOM.createPortal(
                <div ref={portalRef} style={style} className="bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                    {loading ? (
                        <div className="px-3 py-3 text-sm text-gray-400 flex items-center gap-2">
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                            Loading…
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="px-3 py-3 text-sm text-gray-400">No results</div>
                    ) : (
                        filtered.map((opt) => (
                            <button
                                key={opt}
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelect(opt);
                                }}
                                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                    opt === value
                                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                                        : 'text-gray-700 hover:bg-gray-50 hover:text-indigo-600'
                                }`}
                            >
                                {opt}
                            </button>
                        ))
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}

export default function DiscussionForumPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, user } = useAuth();
    const { executeApiCall, loading, error } = useApi();
    const { executeApiCall: executeBookmarkCall } = useApi();
    const { PinButton } = usePin();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState('forum');
    const [discussions, setDiscussions] = useState([]);
    const [userCreatedDiscussions, setUserCreatedDiscussions] = useState([]);
    const [userCreatedTotal, setUserCreatedTotal] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [loginAction, setLoginAction] = useState('');
    // tracks whether user has explicitly chosen a category in the standalone create flow
    const [categoryChosen, setCategoryChosen] = useState(false);
    const [createFormShake, setCreateFormShake] = useState(false);
    const [createFormErrors, setCreateFormErrors] = useState({});
    // modal dropdown data
    const [modalCategories, setModalCategories] = useState([]);
    const [modalTopics, setModalTopics] = useState([]);
    const [modalCategoriesLoading, setModalCategoriesLoading] = useState(false);
    const [modalTopicsLoading, setModalTopicsLoading] = useState(false);
    const modalPipelineRef = useRef('pipeline5');
    const [newDiscussion, setNewDiscussion] = useState({
        title: '',
        description: '',
        category: '',
        tags: [],
        linkedTopic: ''
    });
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        itemsPerPage: 10
    });
    const [pageInputValue, setPageInputValue] = useState('1');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [discussionsLoaded, setDiscussionsLoaded] = useState(false);
    const isFetchingRef = useRef(false);
    const isForumRestricted = isAuthenticated && user?.isRestricted && user?.restrictionEndDate && new Date(user.restrictionEndDate) > new Date();
    const discussionsLoadedRef = useRef(false);
    const discussionsCacheRef = useRef([]);
    const lastFetchParamsRef = useRef(null);
    const [expandedDiscussions, setExpandedDiscussions] = useState(new Set()); // Track expanded discussions
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportTarget, setReportTarget] = useState(null); // { id, title, author, contentPreview }
    const [reportReason, setReportReason] = useState('');
    const [reportError, setReportError] = useState('');
    const [reportSubmitting, setReportSubmitting] = useState(false);
    const [reportShake, setReportShake] = useState(false);
    const [thankYouModalOpen, setThankYouModalOpen] = useState(false);
    const [bookmarkedDiscussionIds, setBookmarkedDiscussionIds] = useState(new Set());
    const [sseRefreshKey, setSseRefreshKey] = useState(0);

    // Real-time: when admin moderates a post/topic, invalidate cache and re-fetch
    useSSEEvent('forum_updated', useCallback(() => {
        discussionsLoadedRef.current = false;
        discussionsCacheRef.current = [];
        lastFetchParamsRef.current = null;
        setSseRefreshKey((k) => k + 1);
    }, []));

    // Get topic context from URL parameters
    const urlParams = new URLSearchParams(location.search);
    const topicTitle = urlParams.get('topic');
    const topicCategory = urlParams.get('category');
    const isViewMode = urlParams.get('view') === 'true';
    const isCreateMode = urlParams.get('create') === 'true';

    // Load bookmarked forum discussions from backend
    useEffect(() => {
        if (!isAuthenticated) {
            setBookmarkedDiscussionIds(new Set());
            return;
        }
        const loadBookmarks = async () => {
            try {
                const data = await executeBookmarkCall(() =>
                    bookmarkApi.getBookmarks({ type: 'forum', page: 1, limit: 1000 })
                );
                const ids = new Set(
                    (data.bookmarks || []).map((b) => {
                        const res = b.resourceId;
                        if (!res) return null;
                        if (typeof res === 'string') return res;
                        return String(res._id || res.id);
                    }).filter(Boolean)
                );
                setBookmarkedDiscussionIds(ids);
            } catch (err) {
                console.warn('[DiscussionForumPage] Failed to load forum bookmarks:', err);
            }
        };
        loadBookmarks();
    }, [isAuthenticated, executeBookmarkCall]);

    // Load discussions from API
    useEffect(() => {
        const fetchDiscussions = async () => {
            // Prevent multiple simultaneous fetches
            if (isFetchingRef.current) return;
            
            const params = {
                page: pagination.currentPage,
                limit: pagination.itemsPerPage,
                category: selectedCategory !== 'all' ? selectedCategory : undefined,
                search: searchQuery || undefined
            };

            // Check if we have cached data for the same parameters
            const paramsString = JSON.stringify(params);
            if (discussionsLoadedRef.current && 
                lastFetchParamsRef.current === paramsString && 
                discussionsCacheRef.current.length > 0) {
                // Use cached data
                setDiscussions(discussionsCacheRef.current);
                return;
            }
            
            isFetchingRef.current = true;
            try {
                const result = await executeApiCall(() => forumApi.getAllTopics(params));
                const topics = result.topics || [];
                const reportedIds = getReportedTopicIds(user?.id ?? user?._id);
                const merged = topics.map((t) => ({
                    ...t,
                    currentUserHasReported: t.currentUserHasReported || reportedIds.has(String(t._id || t.id))
                }));

                setDiscussions(merged);
                setPagination(result.pagination || pagination);
                setDiscussionsLoaded(true);
                discussionsLoadedRef.current = true;

                discussionsCacheRef.current = merged;
                lastFetchParamsRef.current = paramsString;
            } catch (err) {
                console.error('Failed to fetch discussions:', err);
                // Only clear discussions if this is the initial load
                if (!discussionsLoadedRef.current) {
                    setDiscussions([]);
                    discussionsCacheRef.current = [];
                }
            } finally {
                isFetchingRef.current = false;
            }
        };

        fetchDiscussions();
    }, [pagination.currentPage, selectedCategory, searchQuery, sseRefreshKey]);

    useEffect(() => {
        setPageInputValue(String(pagination.currentPage));
    }, [pagination.currentPage]);

    const totalPages = Math.max(1, pagination.totalPages || 1);
    const totalItems = pagination.totalItems || 0;
    const limit = pagination.itemsPerPage || 10;

    const changePage = (d) => {
        if (loading) return;
        const next = Math.max(1, Math.min(pagination.currentPage + d, totalPages));
        setPagination((prev) => ({ ...prev, currentPage: next }));
    };
    const goToPage = (page) => {
        if (loading) return;
        const valid = Math.max(1, Math.min(Number(page), totalPages));
        setPagination((prev) => ({ ...prev, currentPage: valid }));
    };
    const goToFirstPage = () => goToPage(1);
    const goToLastPage = () => goToPage(totalPages);
    const handlePageInputChange = (e) => setPageInputValue(e.target.value);
    const handlePageInputKeyPress = (e) => {
        if (e.key === 'Enter') {
            const p = parseInt(pageInputValue, 10);
            if (!isNaN(p) && p > 0) goToPage(p);
            else setPageInputValue(String(pagination.currentPage));
        }
    };
    const handlePageInputBlur = () => {
        const p = parseInt(pageInputValue, 10);
        if (isNaN(p) || p < 1) setPageInputValue(String(pagination.currentPage));
        else goToPage(p);
    };

    // When user loads, re-merge discussions with stored "reported" so refresh always shows Reported
    useEffect(() => {
        const uid = user?.id ?? user?._id;
        if (!uid) return;
        setDiscussions((prev) => {
            const reportedIds = getReportedTopicIds(uid);
            return prev.map((t) => ({
                ...t,
                currentUserHasReported: t.currentUserHasReported || reportedIds.has(String(t._id || t.id))
            }));
        });
    }, [user?.id, user?._id]);

    // Load user's created discussions
    useEffect(() => {
        if (isAuthenticated) {
            const fetchUserDiscussions = async () => {
                try {
                    const result = await executeApiCall(() => forumApi.getUserTopics());
                    setUserCreatedDiscussions(result.topics || []);
                    setUserCreatedTotal(result.pagination?.totalItems ?? (result.topics || []).length);
                } catch (err) {
                    console.error('Failed to fetch user discussions:', err);
                    setUserCreatedDiscussions([]);
                    setUserCreatedTotal(0);
                }
            };

            fetchUserDiscussions();
        }
    }, [isAuthenticated]);

    // Load user notifications from profile (moderation etc.)
    useEffect(() => {
        if (!isAuthenticated) {
            setNotifications([]);
            return;
        }
        const loadNotifications = async () => {
            try {
                const profile = await userApi.getProfile();
                const raw = profile.notifications || [];
                const list = raw.map((n) => {
                    const link = n.link || '';
                    const topicMatch = link.match(/\/forum\/topic\/([^/?#]+)/);
                    const discussionId = topicMatch ? topicMatch[1] : (n.link || '').replace(/^\//, '');
                    return {
                        id: n._id || n.id,
                        message: n.title ? `${n.title}${n.message ? ': ' + n.message : ''}` : (n.message || ''),
                        isRead: !!n.read,
                        timestamp: n.createdAt,
                        discussionId,
                        link: link || (discussionId ? `/forum/reply/${discussionId}` : null)
                    };
                }).filter((n) => n.id)
                  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                setNotifications(list);
            } catch (err) {
                console.warn('[DiscussionForumPage] Failed to load notifications:', err);
                setNotifications([]);
            }
        };
        loadNotifications();
    }, [isAuthenticated]);

    // If coming from a topic in create mode, pre-populate the create modal and show it (unless user is forum-restricted)
    useEffect(() => {
        if (topicTitle && topicCategory && isCreateMode && !isForumRestricted) {
            setNewDiscussion({
                title: '',
                description: '',
                category: topicCategory,
                tags: [],
                linkedTopic: topicTitle
            });
            setCategoryChosen(true);
            setShowCreateModal(true);
        }
    }, [topicTitle, topicCategory, isCreateMode, isForumRestricted]);

    // Lock body scroll when Create Discussion modal is open, restore when closed
    useEffect(() => {
        if (showCreateModal) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = prev || ''; };
        }
    }, [showCreateModal]);

    useEffect(() => {
        if (!showCreateModal) {
            setCreateFormErrors({});
            setCreateFormShake(false);
        }
    }, [showCreateModal]);

    // Fetch parliamentary categories when modal opens
    useEffect(() => {
        if (!showCreateModal) return;
        const load = async () => {
            setModalCategoriesLoading(true);
            try {
                // Resolve default pipeline first, fall back to pipeline5
                let pid = 'pipeline5';
                try {
                    const def = await topicApi.getDefaultPipeline();
                    const d = def?.data || def;
                    if (d?.success && d.pipeline_id) pid = d.pipeline_id;
                } catch { /* ignore */ }
                modalPipelineRef.current = pid;
                const res = await topicApi.getFilters(pid);
                const data = res?.data || res;
                setModalCategories(data?.filters?.categories || []);
            } catch { setModalCategories([]); }
            finally { setModalCategoriesLoading(false); }
        };
        load();
    }, [showCreateModal]);

    // Fetch parliamentary topics when category changes inside the modal
    useEffect(() => {
        const cat = newDiscussion.category;
        if (!showCreateModal || !cat) { setModalTopics([]); return; }
        const load = async () => {
            setModalTopicsLoading(true);
            try {
                const res = await topicApi.getIssuePortalTopics(modalPipelineRef.current, { category: cat });
                const data = res?.data || res;
                const titles = [...new Set((data?.topics || []).map(t => t.title).filter(Boolean))].sort();
                setModalTopics(titles);
            } catch { setModalTopics([]); }
            finally { setModalTopicsLoading(false); }
        };
        load();
    }, [showCreateModal, newDiscussion.category]);

    const handleCreateDiscussion = async () => {
        if (isForumRestricted) return;
        const nextErrors = {};
        if (!newDiscussion.title.trim()) nextErrors.title = t('discussionTitleRequired');
        if (!newDiscussion.category.trim()) nextErrors.category = t('discussionCategoryRequired');
        if (!newDiscussion.linkedTopic.trim()) nextErrors.linkedTopic = t('discussionLinkedTopicRequired');
        if (!newDiscussion.description.trim()) nextErrors.description = t('discussionDescriptionRequired');

        if (Object.keys(nextErrors).length > 0) {
            setCreateFormErrors(nextErrors);
            setCreateFormShake(true);
            window.setTimeout(() => setCreateFormShake(false), 450);
            return;
        }

        try {
            const result = await executeApiCall(() => forumApi.createTopic(newDiscussion));
            
            // Refresh discussions — always go back to page 1 so the new topic appears at the top
            const params = {
                page: 1,
                limit: pagination.itemsPerPage,
                category: selectedCategory !== 'all' ? selectedCategory : undefined,
                search: searchQuery || undefined
            };
            const updatedResult = await executeApiCall(() => forumApi.getAllTopics(params));
            const topics = updatedResult.topics || [];
            setDiscussions(topics);
            setPagination({ ...(updatedResult.pagination || pagination), currentPage: 1 });
            
            // Update cache with new data
            discussionsCacheRef.current = topics;
            lastFetchParamsRef.current = JSON.stringify(params);
            
            // Refresh user discussions
            if (isAuthenticated) {
                const userResult = await executeApiCall(() => forumApi.getUserTopics());
                setUserCreatedDiscussions(userResult.topics || []);
                setUserCreatedTotal(userResult.pagination?.totalItems ?? (userResult.topics || []).length);
            }
            
            setCreateFormErrors({});
            setNewDiscussion({ title: '', description: '', category: '', tags: [], linkedTopic: '' });
            setShowCreateModal(false);
        } catch (err) {
            console.error('Failed to create discussion:', err);
        }
    };

    const handleBookmark = async (discussionId, title, description) => {
        if (!isAuthenticated) {
            setLoginAction(t('loginActionBookmarkDiscussion'));
            setShowLoginModal(true);
            return;
        }
        const idStr = String(discussionId);
        if (!idStr) return;

        const wasBookmarked = bookmarkedDiscussionIds.has(idStr);
        // Optimistic toggle
        setBookmarkedDiscussionIds(prev => {
            const next = new Set(prev);
            if (wasBookmarked) next.delete(idStr);
            else next.add(idStr);
            return next;
        });

        try {
            const result = await executeBookmarkCall(() =>
                bookmarkApi.toggleBookmark({
                    resourceId: idStr,
                    type: 'forum',
                    title: title || 'Forum discussion',
                    description: description || '',
                })
            );
            const nowBookmarked = result.action === 'added';
            setBookmarkedDiscussionIds(prev => {
                const next = new Set(prev);
                if (nowBookmarked) next.add(idStr);
                else next.delete(idStr);
                return next;
            });
        } catch (err) {
            console.error('Failed to toggle forum bookmark:', err);
            // Revert on error
            setBookmarkedDiscussionIds(prev => {
                const next = new Set(prev);
                if (wasBookmarked) next.add(idStr);
                else next.delete(idStr);
                return next;
            });
        }
    };

    const handleDeleteDiscussion = (discussionId) => {
        navigate(`/forum/delete/${discussionId}`);
    };

    const handleEditDiscussion = (discussionId) => {
        navigate(`/forum/edit/${discussionId}`);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-MY', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getCategoryColor = (category) => {
        const colors = {
            'policy': 'bg-blue-100 text-blue-800',
            'debate': 'bg-purple-100 text-purple-800',
            'announcement': 'bg-green-100 text-green-800',
            'general': 'bg-gray-100 text-gray-800'
        };
        return colors[category] || colors.general;
    };

    const getDisplayNameFromAuthor = (author) => {
        if (!author) return t('unknownUser');

        if (typeof author === 'string') {
            const value = author.trim();
            if (value.includes('@')) {
                return value.split('@')[0];
            }
            return value || t('unknownUser');
        }

        const name = author.name;
        if (name && !name.includes('@')) return name;

        const email = author.email || (name && name.includes('@') ? name : '');
        if (email && email.includes('@')) {
            return email.split('@')[0];
        }

        return name || t('unknownUser');
    };

    const truncateText = (text, maxLength = 200) => {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength);
    };

    const toggleExpand = (discussionId) => {
        setExpandedDiscussions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(discussionId)) {
                newSet.delete(discussionId);
            } else {
                newSet.add(discussionId);
            }
            return newSet;
        });
    };

    const openReportModal = (discussion) => {
        if (!isAuthenticated) {
            setLoginAction(t('loginActionReportDiscussion'));
            setShowLoginModal(true);
            return;
        }
        
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
        
        const topicId = discussion._id || discussion.id;
        setReportError('');
        setReportReason('');
        setReportTarget({
            id: topicId,
            title: discussion.title,
            author: getDisplayNameFromAuthor(discussion.author),
            contentPreview: (discussion.description || '').slice(0, 160)
        });
        setReportModalOpen(true);
    };
    
    const closeReportModal = () => {
        // Restore body scroll when modal is closed
        document.body.style.overflow = 'unset';
        setReportModalOpen(false);
        setReportTarget(null);
        setReportReason('');
        setReportError('');
    };

    const handleSubmitReport = async () => {
        if (!reportTarget || !reportTarget.id || reportSubmitting) return;

        const trimmedReason = reportReason.trim();
        if (trimmedReason.length < 10) {
            setReportError(t('reportErrorMinLength'));
            setReportShake(true);
            setTimeout(() => setReportShake(false), 400);
            return;
        }

        setReportSubmitting(true);
        setReportError('');

        try {
            const reportedTopicId = reportTarget.id;
            const reportedIdStr = String(reportedTopicId);
            const uid = user?.id ?? user?._id;
            
            await executeApiCall(() => forumApi.reportTopic(reportedTopicId, trimmedReason));
            
            // Add to localStorage immediately
            if (uid) addReportedTopic(uid, reportedTopicId);
            
            // IMMEDIATELY update state with optimistic UI (no async refetch to avoid race condition)
            setDiscussions((prev) => {
                const updated = prev.map((d) =>
                    String(d._id || d.id) === reportedIdStr
                        ? { ...d, currentUserHasReported: true }
                        : d
                );
                // Also update cache so if useEffect triggers, it uses updated data
                discussionsCacheRef.current = updated;
                return updated;
            });
            
            closeReportModal();
            setThankYouModalOpen(true);
        } catch (err) {
            console.error('Failed to report discussion:', err);
            setReportError(t('reportErrorSubmitFailed'));
        } finally {
            setReportSubmitting(false);
        }
    };

    // When coming from Issue Portal "View topic discussion": discussions matching this topic title
    const topicTitleNorm = (topicTitle || '').trim().toLowerCase();
    const discussionsForThisTopic = topicTitleNorm
        ? discussions.filter((d) => {
            const t = (d.title || '').trim().toLowerCase();
            return t.includes(topicTitleNorm) || t === `discussion: ${topicTitleNorm}`;
          })
        : [];
    const otherDiscussions = topicTitleNorm
        ? discussions.filter((d) => {
            const t = (d.title || '').trim().toLowerCase();
            return !t.includes(topicTitleNorm) && t !== `discussion: ${topicTitleNorm}`;
          })
        : discussions;
    const topicHasNoDiscussion = topicTitleNorm.length > 0 && discussionsLoaded && discussionsForThisTopic.length === 0;
    const listToShow = topicHasNoDiscussion ? otherDiscussions : discussions;

    const renderForumTab = () => (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">{t('discussionForum')}</h2>

            {/* When user came from "View topic discussion" but this topic has no forum discussion yet */}
            {topicHasNoDiscussion && (
                <div className="rounded-xl border border-gray-200 bg-gray-100 pt-8 pb-5 px-5 mb-6">
                    <p className="text-gray-800 font-medium mb-4 text-center pt-2">
                        {t('topicHasNoDiscussion')}
                    </p>
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-200 font-medium"
                        >
                            {t('back')}
                        </button>
                    </div>
                </div>
            )}

            {topicHasNoDiscussion && (
                <h3 className="text-lg font-semibold text-gray-800">{t('otherTopic')}</h3>
            )}

            {listToShow.length === 0 ? (
                <div className="text-center py-12">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noDiscussionsYet')}</h3>
                    <p className="text-gray-500 mb-4">{t('startDiscussionCta')}</p>
                    <button
                        onClick={() => {
                            if (isAuthenticated) {
                                setShowCreateModal(true);
                            } else {
                                setLoginAction(t('loginActionCreateDiscussion'));
                                setShowLoginModal(true);
                            }
                        }}
                        className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                        title={isAuthenticated ? undefined : t('loginToCreateDiscussion')}
                    >
                        {t('createYourFirstDiscussion')}
                    </button>
                </div>
            ) : (
                <>
                <div className="space-y-4">
                    {listToShow.map((discussion) => {
                        const topicId = discussion._id || discussion.id;
                        const isBookmarked = bookmarkedDiscussionIds.has(String(topicId));
                        return (
                    <div key={topicId} className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow min-w-0">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(discussion.category)}`}>
                                        {t(discussion.category) || discussion.category}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                        {formatDate(discussion.createdAt)}
                                    </span>
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                    {discussion.title}
                                </h3>
                                <div className="text-gray-700 mb-4">
                                    {(() => {
                                        const description = discussion.description || '';
                                        const isExpanded = expandedDiscussions.has(topicId);
                                        const shouldTruncate = description.length > 200;
                                        
                                        if (!shouldTruncate) {
                                            return (
                                                <p className="whitespace-pre-line">{description}</p>
                                            );
                                        }
                                        
                                        return (
                                            <div>
                                                <p className="whitespace-pre-line">
                                                    {isExpanded ? description : truncateText(description)}
                                                    {!isExpanded && <span className="text-gray-500">...</span>}
                                                </p>
                                                <button
                                                    onClick={() => toggleExpand(topicId)}
                                                    className="mt-2 text-indigo-600 hover:text-indigo-700 text-sm font-medium transition-colors"
                                                >
                                                    {isExpanded ? t('collapse') : t('expand')}
                                                </button>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                            <button
                                onClick={() =>
                                    handleBookmark(
                                        topicId,
                                        discussion.title,
                                        discussion.description
                                    )
                                }
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                title={
                                    isAuthenticated
                                        ? (isBookmarked ? t('removeBookmark') : t('bookmark'))
                                        : t('loginToBookmark')
                                }
                            >
                                <svg
                                    className={`w-5 h-5 transition-colors ${
                                        isBookmarked
                                            ? 'text-yellow-500 fill-current'
                                            : 'text-gray-400 hover:text-yellow-500'
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                    />
                                </svg>
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-y-2 min-w-0">
                                <div className="flex items-center gap-4 sm:gap-6 text-sm text-gray-500 flex-shrink-0">
                                    <div className="flex items-center gap-1">
                                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        {discussion.viewCount ?? 0} {t('views')}
                                    </div>
                                    <div className="flex items-center gap-1 min-w-0">
                                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        <span className="truncate">{getDisplayNameFromAuthor(discussion.author)}</span>
                                    </div>
                                <div className="flex items-center gap-1">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    {discussion.posts?.length || 0} {t('replies')}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => topicId && navigate(`/forum/reply/${topicId}`, {
                                        state: { isBookmarked }
                                    })}
                                    className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-full border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
                                    title={t('viewFullPostAndReplies')}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    <span>{t('view')}</span>
                                </button>
                                <button
                                    onClick={() => {
                                        if (isForumRestricted) return;
                                        if (!topicId) return;
                                        if (isAuthenticated) {
                                            navigate(`/forum/reply/${topicId}`, {
                                                state: { isBookmarked }
                                            });
                                        } else {
                                            setLoginAction(t('loginActionReplyDiscussion'));
                                            setShowLoginModal(true);
                                        }
                                    }}
                                    disabled={isForumRestricted}
                                    className={`inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-full border transition-colors ${
                                        isForumRestricted
                                            ? 'border-gray-300 text-gray-400 cursor-not-allowed'
                                            : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                                    }`}
                                    title={isForumRestricted ? (user?.restrictionReason || t('forumPostingRestricted')) : (isAuthenticated ? undefined : t('loginToReply'))}
                                >
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                        aria-hidden="true"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M8 10h8M8 14h4m-4 6l-4-4V6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H8z"
                                        />
                                    </svg>
                                    <span>{discussion.posts?.length || 0}</span>
                                </button>
                                {(discussion.currentUserHasReported || getReportedTopicIds(user?.id ?? user?._id).has(String(discussion._id || discussion.id))) ? (
                                    <span className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-full border border-red-200 text-red-400 bg-red-50 cursor-default">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        {t('reportedLabel')}
                                    </span>
                                ) : (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            openReportModal(discussion);
                                        }}
                                        className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.22 19h13.56c1.04 0 1.7-1.12 1.18-2.03L13.18 4.97a1.25 1.25 0 00-2.36 0L4.04 16.97C3.52 17.88 4.18 19 5.22 19z" />
                                        </svg>
                                        {t('reportLabel')}
                                    </button>
                                )}
                            </div>
                        </div>

                        {discussion.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-4">
                                {discussion.tags.map((tag, index) => (
                                    <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                        );
                })}
                </div>

                {/* Pagination */}
                {totalItems > 0 && (
                    <div className="mt-8 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="text-sm text-gray-600">
                                {t('showing')} {((pagination.currentPage - 1) * limit) + 1} {t('to')} {Math.min(pagination.currentPage * limit, totalItems)} {t('of')} {totalItems} {t('discussions')}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    disabled={pagination.currentPage <= 1 || loading}
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
                                        placeholder={pagination.currentPage}
                                        aria-label="Page number"
                                    />
                                </form>
                                <button
                                    disabled={pagination.currentPage * limit >= totalItems || loading}
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
    );

    const renderCreatedTab = () => (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">{t('myCreatedDiscussions')}</h2>
            
            {userCreatedDiscussions.length === 0 ? (
                <div className="text-center py-12">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noDiscussionsYet')}</h3>
                    <p className="text-gray-500 mb-4">{t('startDiscussionCta')}</p>
                    <button
                        onClick={() => !isForumRestricted && setShowCreateModal(true)}
                        disabled={isForumRestricted}
                        className={`px-6 py-3 font-semibold rounded-lg transition-colors ${
                            isForumRestricted ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                    >
                        {t('createYourFirstDiscussion')}
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {userCreatedDiscussions.map((discussion) => {
                        const topicId = discussion._id || discussion.id;
                        const isBookmarked = bookmarkedDiscussionIds.has(String(topicId));
                        return (
                        <div key={topicId} className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 relative">
                            {/* Top-right bookmark star */}
                            <button
                                onClick={() =>
                                    handleBookmark(
                                        topicId,
                                        discussion.title,
                                        discussion.content
                                    )
                                }
                                className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
                                title={
                                    isAuthenticated
                                        ? (isBookmarked ? t('removeBookmark') : t('bookmark'))
                                        : t('loginToBookmark')
                                }
                            >
                                <svg
                                    className={`w-5 h-5 transition-colors ${
                                        isBookmarked
                                            ? 'text-yellow-500 fill-current'
                                            : 'text-gray-400 hover:text-yellow-500'
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                    />
                                </svg>
                            </button>

                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1 pr-8">
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(discussion.category)}`}>
                                            {t(discussion.category) || discussion.category}
                                        </span>
                                        {discussion.status === 'flagged' && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-300">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                                </svg>
                                                Under Review
                                            </span>
                                        )}
                                        <span className="text-sm text-gray-500">
                                            {formatDate(discussion.createdAt)}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                        {discussion.title}
                                    </h3>
                                    <p className="text-gray-700 mb-4">
                                        {discussion.content}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-6 text-sm text-gray-500">
                                    <div className="flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                        {discussion.replies} {t('replies')}
                                    </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                    {/* View button */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            topicId &&
                                            navigate(`/forum/reply/${topicId}`, {
                                                state: { isBookmarked },
                                            })
                                        }
                                        className="px-3 py-2 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-200 hover:bg-indigo-100 transition-colors"
                                        title={t('viewFullPostAndReplies')}
                                    >
                                        {t('view')}
                                    </button>

                                    {/* Reply button */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            topicId &&
                                            navigate(`/forum/reply/${topicId}`, {
                                                state: { isBookmarked },
                                            })
                                        }
                                        className="px-3 py-2 bg-white text-indigo-600 text-xs font-medium rounded-full border border-indigo-200 hover:bg-indigo-50 transition-colors"
                                        title={t('loginToReply')}
                                    >
                                        {t('replies')}
                                    </button>

                                    {/* Edit/Delete */}
                                    <button
                                        onClick={() => topicId && handleEditDiscussion(topicId)}
                                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        {t('edit')}
                                    </button>
                                    <button
                                        onClick={() => topicId && handleDeleteDiscussion(topicId)}
                                        className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                                    >
                                        {t('delete')}
                                    </button>
                                </div>
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    const renderNotificationsTab = () => (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">{t('notifications')}</h2>
            
            {notifications.length === 0 ? (
                <div className="text-center py-12">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.5 19.5L19.5 4.5M19.5 4.5L14.5 4.5M19.5 4.5L19.5 9.5" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noNotifications')}</h3>
                    <p className="text-gray-500">{t('notificationsEmptyDesc')}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {notifications.map((notification) => (
                        <div key={notification.id} className={`bg-white rounded-xl shadow-lg border border-gray-100 p-6 ${!notification.isRead ? 'border-l-4 border-l-indigo-500' : ''}`}>
                            <div className="flex items-start gap-4">
                                <div className={`w-3 h-3 rounded-full mt-2 ${!notification.isRead ? 'bg-indigo-500' : 'bg-gray-300'}`}></div>
                                <div className="flex-1">
                                    <p className="text-gray-900 mb-2">{notification.message}</p>
                                    <p className="text-sm text-gray-500">{formatDate(notification.timestamp)}</p>
                                </div>
                                <button
                                    onClick={async () => {
                                        if (!notification.isRead && notification.id) {
                                            try {
                                                await userApi.markNotificationRead(notification.id);
                                                setNotifications((prev) =>
                                                    prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
                                                );
                                            } catch (e) {
                                                console.warn('Mark read failed:', e);
                                            }
                                        }
                                        const path = notification.link || (notification.discussionId ? `/forum/reply/${notification.discussionId}` : '/forum');
                                        navigate(path.startsWith('/') ? path : `/${path}`);
                                    }}
                                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    {t('view')}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 min-w-0">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full min-w-0">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">{t('discussionForum')}</h1>
                    <p className="text-lg text-gray-600">{t('engageCommunityBlurb')}</p>
                    
                </div>

                {/* Navigation Tabs */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-8">
                    <div className="border-b border-gray-200">
                        <nav className="flex space-x-8 px-6">
                            {[
                                { id: 'forum-discussions', label: t('forum'), count: pagination.totalItems || discussions.length },
                                { id: 'forum-created', label: t('createdForum'), count: userCreatedTotal }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        const tabKey = tab.id === 'forum-discussions' ? 'forum' : tab.id.replace('forum-', '');
                                        if (!isAuthenticated && tabKey === 'created') {
                                            setLoginAction(t('loginToViewCreatedForum'));
                                            setShowLoginModal(true);
                                            return;
                                        }
                                        setActiveTab(tabKey);
                                    }}
                                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                        activeTab === (tab.id === 'forum-discussions' ? 'forum' : tab.id.replace('forum-', ''))
                                            ? 'border-indigo-500 text-indigo-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span>{tab.label}</span>
                                        {tab.count > 0 && (
                                            <span className={`px-2 py-1 text-xs rounded-full ${
                                                activeTab === (tab.id === 'forum-discussions' ? 'forum' : tab.id.replace('forum-', ''))
                                                    ? 'bg-indigo-100 text-indigo-600' 
                                                    : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {tab.count}
                                            </span>
                                        )}
                                        {isAuthenticated && (
                                            <PinButton
                                                tabId={tab.id}
                                                tabName={tab.label}
                                                module="Discussion Forum"
                                                className="ml-1"
                                            />
                                        )}
                                    </div>
                                </button>
                            ))}
                        </nav>
                    </div>

                    <div className="p-6">
                        {/* Back button – shown when navigated from an issue detail page */}
                        {topicTitle && (
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 text-sm font-medium mb-4 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                {t('backToPreviousPage')}
                            </button>
                        )}

                        {/* Create Discussion Button - Available on all tabs (disabled when forum restricted) */}
                        <div className="flex justify-between items-center mb-6">
                            {isForumRestricted && (
                                <p className="text-amber-700 text-sm">
                                    You cannot create or reply in the forum until {user?.restrictionEndDate ? new Date(user.restrictionEndDate).toLocaleDateString() : ''}. {user?.restrictionReason && `Reason: ${user.restrictionReason}`}
                                </p>
                            )}
                            <div></div>
                            <button
                                onClick={() => {
                                    if (isForumRestricted) return;
                                    if (isAuthenticated) {
                                        // Reset form; pre-fill from issue portal URL params when available
                                        setNewDiscussion({
                                            title: '',
                                            description: '',
                                            category: topicCategory || '',
                                            tags: [],
                                            linkedTopic: topicTitle || '',
                                        });
                                        setCategoryChosen(!!topicCategory);
                                        setShowCreateModal(true);
                                    } else {
                                        setLoginAction(t('loginActionCreateDiscussion'));
                                        setShowLoginModal(true);
                                    }
                                }}
                                disabled={isForumRestricted}
                                className={`px-6 py-3 font-semibold rounded-lg transition-colors ${
                                    isForumRestricted
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                                title={isForumRestricted ? (user?.restrictionReason || 'Forum posting restricted') : (isAuthenticated ? undefined : t('loginToCreateDiscussion'))}
                            >
                                {t('createDiscussion')}
                            </button>
                        </div>

                        {activeTab === 'forum' && renderForumTab()}
                        {activeTab === 'created' && renderCreatedTab()}
                    </div>
                </div>
            </div>
        </div>

        {/* Create Discussion Modal - rendered at root level with body scroll lock */}
        {showCreateModal && (
            <div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.target === e.currentTarget) setShowCreateModal(false);
                }}
                role="dialog"
                aria-modal="true"
            >
                <div
                    className="bg-white rounded-xl shadow-xl mx-4 max-h-[90vh] flex flex-col"
                    style={{ width: '900px', maxWidth: '90vw' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex-shrink-0 flex items-center justify-between gap-4 p-6 bg-indigo-600 rounded-t-xl">
                        <h3 className="text-xl font-semibold text-white">
                            {isCreateMode && topicTitle ? `${t('createDiscussionFor')} ${topicTitle}` : t('createNewDiscussion')}
                        </h3>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowCreateModal(false);
                            }}
                            className="flex-shrink-0 p-1 rounded-lg text-white hover:bg-indigo-500 transition-colors"
                            aria-label={t('close')}
                        >
                            <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                    <div className={`flex-1 min-h-0 overflow-y-auto p-6 space-y-4 ${createFormShake ? 'form-shake' : ''}`}>
                        {isCreateMode && topicTitle && (
                            <p className="text-sm text-gray-600 -mt-2 mb-2">
                                {t('startDiscussionAboutTopic')}
                            </p>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('titleLabel')} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={newDiscussion.title}
                                onChange={(e) => {
                                    setNewDiscussion(prev => ({ ...prev, title: e.target.value }));
                                    if (createFormErrors.title) {
                                        setCreateFormErrors(prev => ({ ...prev, title: '' }));
                                    }
                                }}
                                className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                                    createFormErrors.title
                                        ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                                        : 'border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                                }`}
                                placeholder={t('enterDiscussionTitle')}
                            />
                            {createFormErrors.title && (
                                <p className="mt-1 text-sm text-red-600">{createFormErrors.title}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('categoryLabel')} <span className="text-red-500">*</span>
                            </label>
                            <SearchableDropdown
                                options={modalCategories}
                                value={newDiscussion.category}
                                onChange={(val) => {
                                    setNewDiscussion(prev => ({ ...prev, category: val, linkedTopic: '' }));
                                    setCategoryChosen(true);
                                    setCreateFormErrors(prev => ({ ...prev, category: '', linkedTopic: '' }));
                                }}
                                placeholder={t('categoryLabel')}
                                loading={modalCategoriesLoading}
                                error={!!createFormErrors.category}
                            />
                            {createFormErrors.category && (
                                <p className="mt-1 text-sm text-red-600">{createFormErrors.category}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('linkedTopicLabel')} <span className="text-red-500">*</span>
                                {!categoryChosen && (
                                    <span className="ml-1 text-xs text-gray-400 font-normal">({t('selectCategoryFirst')})</span>
                                )}
                            </label>
                            <SearchableDropdown
                                options={modalTopics}
                                value={newDiscussion.linkedTopic}
                                onChange={(val) => {
                                    setNewDiscussion(prev => ({ ...prev, linkedTopic: val }));
                                    if (createFormErrors.linkedTopic) {
                                        setCreateFormErrors(prev => ({ ...prev, linkedTopic: '' }));
                                    }
                                }}
                                placeholder={t('linkedTopicPlaceholder')}
                                disabled={!categoryChosen}
                                loading={modalTopicsLoading}
                                error={!!createFormErrors.linkedTopic}
                            />
                            {createFormErrors.linkedTopic && (
                                <p className="mt-1 text-sm text-red-600">{createFormErrors.linkedTopic}</p>
                            )}
                            {topicTitle && categoryChosen && (
                                <p className="mt-1 text-xs text-indigo-500 flex items-center gap-1">
                                    <svg className="w-3 h-3 inline" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                    {t('autoFilledFromIssuePortal')}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('descriptionLabel')} <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={newDiscussion.description}
                                onChange={(e) => {
                                    setNewDiscussion(prev => ({ ...prev, description: e.target.value }));
                                    if (createFormErrors.description) {
                                        setCreateFormErrors(prev => ({ ...prev, description: '' }));
                                    }
                                }}
                                rows={6}
                                className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                                    createFormErrors.description
                                        ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                                        : 'border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                                }`}
                                placeholder={t('descriptionPlaceholder')}
                            />
                            {createFormErrors.description && (
                                <p className="mt-1 text-sm text-red-600">{createFormErrors.description}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex-shrink-0 p-6 border-t border-gray-200 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowCreateModal(false);
                            }}
                            className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCreateDiscussion();
                            }}
                            className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            {t('createDiscussionBtn')}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Login Confirmation Modal */}
        <LoginConfirmationModal
            isOpen={showLoginModal}
            onClose={() => setShowLoginModal(false)}
            action={loginAction}
        />

        {/* Report Discussion Modal */}
        {reportModalOpen && reportTarget && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !reportSubmitting) {
                            closeReportModal();
                        }
                    }}
                >
                    <div
                        className={`bg-white rounded-xl shadow-2xl mx-4 ${reportShake ? 'form-shake' : ''}`}
                        style={{ 
                            width: '600px',
                            maxWidth: '90vw',
                            maxHeight: '90vh',
                            overflow: 'auto'
                        }}
                    >
                        <div className="p-6 border-b border-gray-200 flex items-start justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">{t('reportDiscussion')}</h3>
                                <p className="mt-1 text-sm text-gray-600">
                                    {t('reportModalBody')}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (reportSubmitting) return;
                                    closeReportModal();
                                }}
                                className="ml-4 text-gray-400 hover:text-gray-600"
                                aria-label={t('closeReportDialog')}
                            >
                                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
                                <div className="font-medium text-gray-900 mb-1">
                                    {reportTarget.title}
                                </div>
                                <div className="text-xs text-gray-500 mb-1">
                                    {reportTarget.author}
                                </div>
                                <div className="text-gray-700 whitespace-pre-line">
                                    {reportTarget.contentPreview}
                                    {reportTarget.contentPreview.length >= 160 && (
                                        <span className="text-gray-400">...</span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('reasonForReporting')} <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={reportReason}
                                    onChange={(e) => {
                                        setReportReason(e.target.value);
                                        if (reportError) setReportError('');
                                    }}
                                    rows={4}
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm ${
                                        reportError ? 'border-red-500 form-shake' : 'border-gray-300'
                                    }`}
                                    placeholder={t('reportPlaceholder')}
                                />
                                {reportError && (
                                    <p className="mt-1 text-sm text-red-600">{reportError}</p>
                                )}
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    if (reportSubmitting) return;
                                    closeReportModal();
                                }}
                                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleSubmitReport}
                                disabled={reportSubmitting}
                                className={`px-4 py-2 text-sm font-medium rounded-lg text-white flex items-center gap-2 ${
                                    reportSubmitting ? 'bg-red-400 cursor-wait' : 'bg-red-600 hover:bg-red-700'
                                }`}
                            >
                                {reportSubmitting && (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                )}
                                {t('submitReport')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Thank you modal (same size as report modal) */}
            {thankYouModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
                    <div
                        className="bg-white rounded-xl shadow-2xl mx-4 flex flex-col items-center justify-center p-8"
                        style={{ width: '600px', maxWidth: '90vw' }}
                    >
                        <div className="text-center mb-6">
                            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('thankYou')}</h3>
                            <p className="text-gray-600">{t('reportSentToModerators')}</p>
                        </div>
                        <button
                            onClick={() => setThankYouModalOpen(false)}
                            className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            {t('ok')}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
