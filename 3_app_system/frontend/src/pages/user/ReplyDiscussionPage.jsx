import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, useApi } from '../../hooks';
import { forumApi, bookmarkApi, userApi } from '../../api';
import { useLanguage } from '../../contexts/LanguageContext';
import { getReportedTopicIds, getReportedPostIds, addReportedTopic, addReportedPost } from '../../utils/forumReportedStorage';
import { useSSEEvent } from '../../contexts/SSEContext';

export default function ReplyDiscussionPage() {
    const { discussionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isAuthenticated } = useAuth();
    const { t } = useLanguage();
    const { executeApiCall, loading, error } = useApi();
    const { executeApiCall: executeBookmarkCall } = useApi();
    const hasInitialBookmark = typeof location.state?.isBookmarked === 'boolean';
    const initialIsBookmarked = hasInitialBookmark ? location.state.isBookmarked : false;
    const [discussion, setDiscussion] = useState(null);
    const isForumRestricted = isAuthenticated && user?.isRestricted && user?.restrictionEndDate && new Date(user.restrictionEndDate) > new Date();
    const [replies, setReplies] = useState([]);
    const [totalReplies, setTotalReplies] = useState(0); // Total replies count from API
    const [newReply, setNewReply] = useState('');
    const [inlineReplyTargetId, setInlineReplyTargetId] = useState(null);
    const [inlineReplyText, setInlineReplyText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedReplies, setExpandedReplies] = useState(new Set()); // Track expanded replies
    const [isDiscussionExpanded, setIsDiscussionExpanded] = useState(false); // Track expanded discussion content
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportTarget, setReportTarget] = useState(null); // { id, author, contentPreview }
    const [reportReason, setReportReason] = useState('');
    const [reportSubmitting, setReportSubmitting] = useState(false);
    const [reportError, setReportError] = useState('');
    const [reportShake, setReportShake] = useState(false);
    const [thankYouModalOpen, setThankYouModalOpen] = useState(false);
    const [highlightedReplyId, setHighlightedReplyId] = useState(null);
    const [highlightTopicCard, setHighlightTopicCard] = useState(false);

    // Always start at top when navigating to this page
    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, []);

    const returnTo = new URLSearchParams(location.search).get('returnTo');
    const targetCommentId = new URLSearchParams(location.search).get('commentId');
    const flashTarget = new URLSearchParams(location.search).get('flashTarget');
    const flashColor = new URLSearchParams(location.search).get('flash') || 'indigo';

    const flashClasses = flashColor === 'green'
        ? 'bg-green-50 ring-2 ring-green-300'
        : 'bg-indigo-50 ring-2 ring-indigo-300';

    const getDisplayNameFromAuthor = (author, fallbackName) => {
        if (!author && !fallbackName) return 'Unknown User';

        // If it's already a plain string (could be name or email)
        if (typeof author === 'string') {
            const value = author.trim();
            if (value.includes('@')) {
                return value.split('@')[0];
            }
            return value || 'Unknown User';
        }

        // Object: prefer name, then username (User model uses username), then fallback
        const name = author?.name || author?.username || fallbackName;
        if (name && !name.includes('@')) return name;

        const email = author?.email || (name && name.includes('@') ? name : '');
        if (email && email.includes('@')) {
            return email.split('@')[0];
        }

        return name || 'Unknown User';
    };

    const getCurrentUserDisplayName = () => {
        if (!user) return null;
        const fromProfile = user.profile?.firstName || user.profile?.lastName;
        if (fromProfile) {
            return [user.profile.firstName, user.profile.lastName].filter(Boolean).join(' ').trim() || null;
        }
        return user.username || (user.email && user.email.split('@')[0]) || null;
    };

    useEffect(() => {
        const fetchDiscussionAndReplies = async () => {
            if (!discussionId || discussionId === 'undefined') {
                return;
            }
            
            try {
                // Load topic details
                const topicResult = await executeApiCall(() => forumApi.getTopicById(discussionId));
                const topic = topicResult.topic || topicResult;

                // Normalize author - prefer display name, fall back to email username
                const authorName = getDisplayNameFromAuthor(topic.author, topic.authorName);
                const uid = user?.id ?? user?._id;
                const topicIdStr = String(topic.id || topic._id || discussionId);
                const storedTopicReported = getReportedTopicIds(uid).has(topicIdStr);

                setDiscussion({
                    id: topic.id || topic._id || parseInt(discussionId, 10),
                    title: topic.title,
                    content: topic.description || topic.content || '',
                    author: authorName,
                    authorId: topic.author?._id || topic.authorId || null,
                    category: topic.category || 'general',
                    createdAt: topic.createdAt,
                    // If we have a bookmark state from the list page, trust it on first load
                    isBookmarked: hasInitialBookmark ? initialIsBookmarked : (topic.isBookmarked ?? false),
                    tags: topic.tags ?? [],
                    currentUserHasReported: topic.currentUserHasReported ?? storedTopicReported
                });

                // Log view for Personal Activities
                if (isAuthenticated) {
                    userApi.logView('forum', discussionId, topic.title || discussionId);
                }

                // Load posts (replies) for this topic
                const postsResult = await executeApiCall(() => forumApi.getTopicPosts(discussionId));
                const posts = postsResult.posts || postsResult || [];
                // Get total replies count from pagination or use posts length
                const totalRepliesCount = postsResult.pagination?.totalItems ?? posts.length;

                const storedPostReported = getReportedPostIds(uid);
                const normalizedReplies = posts.map((post) => {
                    const authorName = getDisplayNameFromAuthor(post.author, post.authorName);
                    const likesCount = Array.isArray(post.likes) ? post.likes.length : 0;
                    const isLiked = Array.isArray(post.likes) && user?.id
                        ? post.likes.some(like =>
                            (typeof like.user === 'string' && like.user === user.id) ||
                            (like.user?._id === user._id) ||
                            (like.user?.id === user.id)
                          )
                        : false;
                    const postIdStr = String(post.id || post._id);
                    const reported = post.currentUserHasReported ?? storedPostReported.has(postIdStr);
                    const parentId = post.parentPost ? (post.parentPost._id || post.parentPost) : null;
                    const hiddenByAdmin = post.hiddenByAdmin || post.status === 'hidden';

                    return {
                        id: post.id || post._id,
                        content: post.content,
                        author: authorName,
                        authorId: post.author?._id || post.authorId || null,
                        createdAt: post.createdAt,
                        likes: likesCount,
                        isLiked: isLiked,
                        currentUserHasReported: reported,
                        parentPost: parentId ? String(parentId) : null,
                        hiddenByAdmin
                    };
                });

                setReplies(normalizedReplies);
                setTotalReplies(totalRepliesCount);
            } catch (err) {
                console.error('Failed to load discussion or replies:', err);
            }
        };

        if (discussionId) {
            fetchDiscussionAndReplies();
        }
    }, [discussionId, executeApiCall, user?.id, user?._id]);

    // Real-time: when admin moderates a post in this thread, silently refresh
    useSSEEvent('forum_updated', useCallback((data) => {
        // Only refresh if the moderated post belongs to this topic
        if (!data || data.type === 'topic' || data.type === 'post') {
            if (discussionId) fetchDiscussionAndReplies();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [discussionId]));

    useEffect(() => {
        if (!targetCommentId || !replies.length) return;

        const targetElement = document.querySelector(`[data-reply-id="${targetCommentId}"]`);
        if (!targetElement) return;

        const timer = setTimeout(() => {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedReplyId(String(targetCommentId));
        }, 150);

        const clearTimer = setTimeout(() => {
            setHighlightedReplyId(null);
        }, 2800);

        return () => {
            clearTimeout(timer);
            clearTimeout(clearTimer);
        };
    }, [targetCommentId, replies]);

    useEffect(() => {
        if (flashTarget !== 'topic' || !discussion) return;

        const timer = setTimeout(() => {
            const topicCard = document.querySelector('[data-forum-topic-card="true"]');
            topicCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightTopicCard(true);
        }, 150);

        const clearTimer = setTimeout(() => {
            setHighlightTopicCard(false);
        }, 2800);

        return () => {
            clearTimeout(timer);
            clearTimeout(clearTimer);
        };
    }, [flashTarget, discussion]);

    // Ensure bookmark state is synced from backend when opened directly (no state from list)
    useEffect(() => {
        if (!isAuthenticated || !discussionId || hasInitialBookmark) return;
        const loadBookmark = async () => {
            try {
                const data = await executeBookmarkCall(() =>
                    bookmarkApi.getBookmarks({ type: 'forum', page: 1, limit: 1000 })
                );
                const idStr = String(discussionId);
                const exists = (data.bookmarks || []).some((b) => {
                    const res = b.resourceId;
                    if (!res) return false;
                    const rid = typeof res === 'string' ? res : String(res._id || res.id);
                    return rid === idStr;
                });
                setDiscussion((prev) => (prev ? { ...prev, isBookmarked: exists } : prev));
            } catch (err) {
                // fail silently; bookmark button will still work
                console.warn('[ReplyDiscussionPage] Failed to load bookmark state:', err);
            }
        };
        loadBookmark();
    }, [isAuthenticated, discussionId, hasInitialBookmark, executeBookmarkCall]);

    // When user or discussion/replies load, re-merge with stored "reported" so refresh shows Reported
    useEffect(() => {
        const uid = user?.id ?? user?._id;
        if (!uid || !discussion) return;
        const topicIdStr = String(discussion.id || discussion._id || discussionId);
        if (getReportedTopicIds(uid).has(topicIdStr)) {
            setDiscussion((prev) => (prev ? { ...prev, currentUserHasReported: true } : prev));
        }
        setReplies((prev) => {
            const postIds = getReportedPostIds(uid);
            return prev.map((r) => {
                const idStr = String(r.id || r._id);
                return postIds.has(idStr) ? { ...r, currentUserHasReported: true } : r;
            });
        });
    }, [user?.id, user?._id, discussion?.id]);

    const handleSubmitReply = async () => {
        if (!newReply.trim() || isForumRestricted || !isAuthenticated) return;

        setIsSubmitting(true);

        try {
            const payload = { content: newReply };
            const result = await executeApiCall(() => forumApi.createPost(discussionId, payload));
            const createdPost = result.post || result;

            // Normalize author - prefer display name, fall back to email username
            const authorName = getDisplayNameFromAuthor(createdPost.author, createdPost.authorName || getCurrentUserDisplayName() || 'Unknown User');

            // Calculate likes from actual likes array from API
            const likesCount = Array.isArray(createdPost.likes) ? createdPost.likes.length : 0;
            // New posts start with no likes
            const isLiked = false;

            const normalizedReply = {
                id: createdPost.id || createdPost._id,
                content: createdPost.content,
                author: authorName,
                authorId: createdPost.author?._id || createdPost.authorId || user?._id || user?.id || null,
                createdAt: createdPost.createdAt, // Use actual createdAt from API
                likes: likesCount, // Use actual likes count from API
                isLiked: isLiked // New posts have no likes initially
            };

            setReplies(prev => [...prev, normalizedReply]);
            setTotalReplies(prev => prev + 1); // Increment total replies count
            setNewReply('');
        } catch (err) {
            console.error('Failed to submit reply:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmitInlineReply = async (parentReplyId) => {
        if (!inlineReplyText.trim() || isForumRestricted || !isAuthenticated) return;

        setIsSubmitting(true);
        try {
            const payload = { content: inlineReplyText };
            const result = await executeApiCall(() => forumApi.replyToPost(parentReplyId, payload));
            const createdPost = result.reply || result.post || result;

            const authorName = getDisplayNameFromAuthor(createdPost.author, createdPost.authorName || getCurrentUserDisplayName() || 'Unknown User');
            const likesCount = Array.isArray(createdPost.likes) ? createdPost.likes.length : 0;

            const normalizedReply = {
                id: createdPost.id || createdPost._id,
                content: createdPost.content,
                author: authorName,
                authorId: createdPost.author?._id || createdPost.authorId || user?._id || user?.id || null,
                createdAt: createdPost.createdAt,
                likes: likesCount,
                isLiked: false,
                parentPost: String(parentReplyId)
            };

            setReplies(prev => [...prev, normalizedReply]);
            setTotalReplies(prev => prev + 1);
            setInlineReplyText('');
            setInlineReplyTargetId(null);
        } catch (err) {
            console.error('Failed to submit inline reply:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleBookmark = async () => {
        if (!discussion || !discussion.id) return;
        if (!isAuthenticated) {
            navigate('/login', { state: { from: `/forum/reply/${discussionId}` } });
            return;
        }
        const idStr = String(discussion.id);
        const wasBookmarked = discussion.isBookmarked;

        // Optimistic toggle
        setDiscussion((prev) => (prev ? { ...prev, isBookmarked: !wasBookmarked } : prev));

        try {
            const result = await executeBookmarkCall(() =>
                bookmarkApi.toggleBookmark({
                    resourceId: idStr,
                    type: 'forum',
                    title: discussion.title || 'Discussion',
                    description: discussion.content || '',
                })
            );
            const nowBookmarked = result.action === 'added';
            setDiscussion((prev) => (prev ? { ...prev, isBookmarked: nowBookmarked } : prev));
        } catch (err) {
            console.error('Failed to toggle forum bookmark (detail):', err);
            // Revert on error
            setDiscussion((prev) => (prev ? { ...prev, isBookmarked: wasBookmarked } : prev));
        }
    };

    const handleLikeReply = (replyId) => {
        if (!isAuthenticated) {
            navigate('/login', { state: { from: `/forum/reply/${discussionId}` } });
            return;
        }

        setReplies(prev => prev.map(reply =>
            reply.id === replyId
                ? {
                    ...reply,
                    isLiked: !reply.isLiked,
                    likes: reply.isLiked ? Math.max(0, (reply.likes || 0) - 1) : (reply.likes || 0) + 1
                }
                : reply
        ));

        // Fire and forget API call to sync like status (if backend supports it)
        const reply = replies.find(r => r.id === replyId);
        if (reply && reply.id && isAuthenticated) {
            forumApi.togglePostLike(reply.id).catch(err => {
                console.error('Failed to toggle like status:', err);
            });
        }
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
            'Parliamentary Reform': 'bg-blue-100 text-blue-800',
            'Digital Democracy': 'bg-purple-100 text-purple-800',
            'Budget & Finance': 'bg-green-100 text-green-800',
            'Education': 'bg-yellow-100 text-yellow-800',
            'general': 'bg-gray-100 text-gray-800'
        };
        return colors[category] || colors.general;
    };

    const truncateText = (text, maxLength = 200) => {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength);
    };

    // Xiaohongshu-style: at most two horizontal levels — root comments and their direct/nested replies flattened to level 2
    const getReplyTree = (repliesList) => {
        const idToReply = new Map();
        repliesList.forEach((r) => idToReply.set(String(r.id), r));
        const resolveRootId = (reply) => {
            if (!reply.parentPost) return String(reply.id);
            const parent = idToReply.get(String(reply.parentPost));
            return parent ? resolveRootId(parent) : String(reply.id);
        };
        const roots = [];
        const childrenByRootId = new Map();
        repliesList.forEach((r) => {
            const rid = String(r.id);
            if (!r.parentPost) {
                roots.push(r);
            } else {
                const rootId = resolveRootId(r);
                if (!childrenByRootId.has(rootId)) childrenByRootId.set(rootId, []);
                childrenByRootId.get(rootId).push(r);
            }
        });
        roots.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        childrenByRootId.forEach((arr) => arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
        return { roots, childrenByRootId };
    };

    const toggleExpandReply = (replyId) => {
        setExpandedReplies(prev => {
            const newSet = new Set(prev);
            if (newSet.has(replyId)) {
                newSet.delete(replyId);
            } else {
                newSet.add(replyId);
            }
            return newSet;
        });
    };

    const openReportModal = (target) => {
        if (!isAuthenticated) {
            navigate('/login', { state: { from: `/forum/reply/${discussionId}` } });
            return;
        }
        
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
        
        setReportError('');
        setReportReason('');
        setReportTarget({
            id: target.id,
            type: target.type, // 'reply' or 'topic'
            author: target.author,
            title: target.title,
            contentPreview: (target.content || '').slice(0, 120)
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
            setReportError('Please provide at least 10 characters explaining why this reply is offensive.');
            setReportShake(true);
            setTimeout(() => setReportShake(false), 400);
            return;
        }

        setReportSubmitting(true);
        setReportError('');

        try {
            const isTopic = reportTarget.type === 'topic';
            const reportedId = reportTarget.id;
            const reportedIdStr = String(reportedId);
            const uid = user?.id ?? user?._id;
            
            if (isTopic) {
                await executeApiCall(() => forumApi.reportTopic(reportedId, trimmedReason));
            } else {
                await executeApiCall(() => forumApi.reportPost(reportedId, trimmedReason));
            }
            
            // Add to localStorage immediately
            if (uid) {
                if (isTopic) addReportedTopic(uid, reportedId);
                else addReportedPost(uid, reportedId);
            }
            
            // IMMEDIATELY update state with optimistic UI (no async refetch to avoid race condition)
            if (isTopic) {
                setDiscussion((prev) => prev ? { ...prev, currentUserHasReported: true } : prev);
            } else {
                setReplies((prev) =>
                    prev.map((r) =>
                        String(r.id || r._id) === reportedIdStr
                            ? { ...r, currentUserHasReported: true }
                            : r
                    )
                );
            }
            
            closeReportModal();
            setThankYouModalOpen(true);
        } catch (err) {
            console.error('Failed to report post:', err);
            setReportError('Failed to submit report. Please try again later.');
        } finally {
            setReportSubmitting(false);
        }
    };

    if (!discussion) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading discussion...</p>
                    {error && (
                        <p className="mt-2 text-sm text-red-600">
                            Failed to load discussion. Please try again later.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 min-w-0 max-w-full">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full min-w-0">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => {
                            if (returnTo) navigate(returnTo);
                            else navigate('/forum');
                        }}
                        className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-4 transition-colors"
                    >
                        {returnTo ? (
                            <span className="font-medium">&gt; Back</span>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                {t('backToPreviousPage')}
                            </>
                        )}
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Reply to Discussion</h1>
                    <p className="text-lg text-gray-600">Share your thoughts and engage with the community</p>
                </div>

                {/* Original Discussion */}
                <div
                    data-forum-topic-card="true"
                    className={`bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8 transition-all duration-300 ${
                        highlightTopicCard ? `${flashClasses} animate-pulse` : ''
                    }`}
                >
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(discussion.category)}`}>
                                {discussion.category}
                            </span>
                            <span className="text-sm text-gray-500">
                                {formatDate(discussion.createdAt)}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                        {isAuthenticated && (
                            (discussion.currentUserHasReported || getReportedTopicIds(user?.id ?? user?._id).has(String(discussion.id || discussion._id || discussionId))) ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-red-200 text-xs font-medium text-red-400 bg-red-50 cursor-default">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Reported
                                </span>
                            ) : (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        openReportModal({
                                            id: discussion.id,
                                            type: 'topic',
                                            author: discussion.author,
                                            title: discussion.title,
                                            content: discussion.content
                                        });
                                    }}
                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M4.93 19h14.14c1.04 0 1.7-1.12 1.18-2.03L13.18 4.97a1.25 1.25 0 00-2.36 0L3.75 16.97C3.23 17.88 3.89 19 4.93 19z" />
                                    </svg>
                                    Report Post
                                </button>
                            )
                        )}
                        <button
                            onClick={handleToggleBookmark}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            title={
                                isAuthenticated
                                    ? (discussion.isBookmarked ? 'Remove bookmark' : 'Bookmark')
                                    : 'Login to bookmark'
                            }
                        >
                            <svg
                                className={`w-5 h-5 transition-colors ${
                                    discussion.isBookmarked
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
                    </div>
                    
                    <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                        {discussion.title}
                    </h2>
                    
                    <div className="flex items-start gap-4 mb-6">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="font-medium text-gray-900">{discussion.author}</span>
                                <span className="text-sm text-gray-500">•</span>
                                <span className="text-sm text-gray-500">Original Post</span>
                            </div>
                            <div className="text-gray-700 leading-relaxed">
                                {(() => {
                                    const content = discussion.content || '';
                                    const shouldTruncate = content.length > 200;
                                    
                                    if (!shouldTruncate) {
                                        return (
                                            <p className="whitespace-pre-line">{content}</p>
                                        );
                                    }
                                    
                                    return (
                                        <div>
                                            <p className="whitespace-pre-line">
                                                {isDiscussionExpanded ? content : truncateText(content)}
                                                {!isDiscussionExpanded && <span className="text-gray-500">...</span>}
                                            </p>
                                            <button
                                                onClick={() => setIsDiscussionExpanded(prev => !prev)}
                                                className="mt-1 text-indigo-600 hover:text-indigo-700 text-sm font-medium transition-colors"
                                            >
                                                {isDiscussionExpanded ? 'Collapse' : 'Expand'}
                                            </button>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-gray-500 pt-4 border-t border-gray-200">
                        <div className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {totalReplies} {totalReplies === 1 ? 'reply' : 'replies'}
                        </div>
                    </div>
                </div>

                {/* Reply Form */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Post Your Reply</h3>
                    {!isAuthenticated && (
                        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-blue-800 text-sm mb-3">
                                You need to be logged in to reply to this discussion.
                            </p>
                            <button
                                onClick={() => navigate('/login', { state: { from: `/forum/reply/${discussionId}` } })}
                                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                Login to Reply
                            </button>
                        </div>
                    )}
                    {isAuthenticated && isForumRestricted && (
                        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                            You cannot create or reply in the forum until {user?.restrictionEndDate ? new Date(user.restrictionEndDate).toLocaleDateString() : ''}. {user?.restrictionReason && `Reason: ${user.restrictionReason}`}
                        </div>
                    )}
                    {isAuthenticated && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Your Response
                                </label>
                                <textarea
                                    value={newReply}
                                    onChange={(e) => setNewReply(e.target.value)}
                                    rows={6}
                                    disabled={isForumRestricted}
                                    className={`w-full px-4 py-3 border rounded-lg resize-none ${
                                        isForumRestricted ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed' : 'border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                                    }`}
                                    placeholder={isForumRestricted ? 'Forum posting is restricted for your account.' : 'Share your thoughts on this discussion...'}
                                />
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={handleSubmitReply}
                                    disabled={!newReply.trim() || isSubmitting || isForumRestricted}
                                    className={`px-8 py-3 font-semibold rounded-lg transition-colors flex items-center gap-2 ${
                                        isForumRestricted ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed'
                                    }`}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            Posting...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                            </svg>
                                            Post Reply
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Replies Section */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-6">
                        Replies ({totalReplies})
                    </h3>
                    
                    {replies.length === 0 ? (
                        <div className="text-center py-8">
                            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <p className="text-gray-500">No replies yet. Be the first to share your thoughts!</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {(() => {
                                const { roots, childrenByRootId } = getReplyTree(replies);
                                return roots.map((root) => (
                                    <div key={root.id} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                                        {/* Level 1: top-level comment (Xiaohongshu-style, max 2 horizontal levels) */}
                                        {[root, ...(childrenByRootId.get(String(root.id)) || [])].map((reply, idx) => {
                                            const isLevel2 = idx > 0;
                                            return (
                                                <div
                                                    key={reply.id}
                                                    data-reply-id={String(reply.id)}
                                                    className={`${isLevel2 ? 'flex items-start gap-3 pl-10 mt-3 ml-1 border-l-2 border-gray-100' : ''} ${
                                                        highlightedReplyId === String(reply.id)
                                                            ? `rounded-xl ${flashClasses} px-3 py-2 transition-all duration-300 animate-pulse`
                                                            : ''
                                                    }`}
                                                >
                                                    <div className={`flex items-start gap-4 ${isLevel2 ? 'gap-3' : ''}`}>
                                                        <div className={`${isLevel2 ? 'w-8 h-8' : 'w-10 h-10'} bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0`}>
                                                            <svg className={`${isLevel2 ? 'w-5 h-5' : 'w-6 h-6'} text-gray-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                            </svg>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className={`font-medium text-gray-900 ${isLevel2 ? 'text-sm' : ''}`}>{reply.author}</span>
                                                                <span className="text-sm text-gray-500">·</span>
                                                                <span className="text-sm text-gray-500">{formatDate(reply.createdAt)}</span>
                                                            </div>
                                                            <div className={`text-gray-700 leading-relaxed ${isLevel2 ? 'text-sm mb-2' : 'mb-3'}`}>
                                                                {reply.hiddenByAdmin ? (
                                                                    <p className="text-gray-500 italic">{t('commentHiddenByAdmin')}</p>
                                                                ) : (
                                                                    (() => {
                                                                        const content = reply.content || '';
                                                                        const isExpanded = expandedReplies.has(reply.id);
                                                                        const shouldTruncate = content.length > 200;
                                                                        if (!shouldTruncate) return <p className="whitespace-pre-line">{content}</p>;
                                                                        return (
                                                                            <div>
                                                                                <p className="whitespace-pre-line">
                                                                                    {isExpanded ? content : truncateText(content)}
                                                                                    {!isExpanded && <span className="text-gray-500">...</span>}
                                                                                </p>
                                                                                <button onClick={() => toggleExpandReply(reply.id)} className="mt-1 text-indigo-600 hover:text-indigo-700 text-sm font-medium">{isExpanded ? 'Collapse' : 'Expand'}</button>
                                                                            </div>
                                                                        );
                                                                    })()
                                                                )}
                                                            </div>
                                                            {!reply.hiddenByAdmin && (
                                                            <div className="flex items-center gap-4 flex-wrap">
                                                                <button
                                                                    onClick={() => { if (!isAuthenticated) { navigate('/login', { state: { from: `/forum/reply/${discussionId}` } }); return; } handleLikeReply(reply.id); }}
                                                                    disabled={!isAuthenticated}
                                                                    className={`flex items-center gap-1 text-sm transition-colors ${!isAuthenticated ? 'text-gray-400 cursor-not-allowed' : reply.isLiked ? 'text-red-600' : 'text-gray-500 hover:text-red-600'}`}
                                                                    title={!isAuthenticated ? 'Login to like replies' : ''}
                                                                >
                                                                    <svg className={`w-4 h-4 ${reply.isLiked ? 'fill-current' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                                                    </svg>
                                                                    {reply.likes} {reply.likes === 1 ? 'like' : 'likes'}
                                                                </button>
                                                                {isAuthenticated && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => { if (!isAuthenticated) { navigate('/login', { state: { from: `/forum/reply/${discussionId}` } }); return; } setInlineReplyTargetId(reply.id); setInlineReplyText(`@${reply.author} `); }}
                                                                            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                                                                        >
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                                            </svg>
                                                                            Reply
                                                                        </button>
                                                                        {(reply.currentUserHasReported || getReportedPostIds(user?.id ?? user?._id).has(String(reply.id || reply._id))) ? (
                                                                            <span className="flex items-center gap-1 text-sm text-red-400 cursor-default">
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                                                Reported
                                                                            </span>
                                                                        ) : (
                                                                            <button
                                                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); openReportModal({ id: reply.id, type: 'reply', author: reply.author, title: null, content: reply.content }); }}
                                                                                className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 transition-colors"
                                                                            >
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.22 19h13.56c1.04 0 1.7-1.12 1.18-2.03L13.18 4.97a1.25 1.25 0 00-2.36 0L4.04 16.97C3.52 17.88 4.18 19 5.22 19z" /></svg>
                                                                                Report
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                            )}
                                                            {inlineReplyTargetId === reply.id && isAuthenticated && !isForumRestricted && (
                                                                <div className="mt-4 ml-0 pl-4 border-l border-gray-200">
                                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Replying to {reply.author}</label>
                                                                    <textarea
                                                                        value={inlineReplyText}
                                                                        onChange={(e) => setInlineReplyText(e.target.value)}
                                                                        rows={3}
                                                                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                                        placeholder="Write your reply..."
                                                                    />
                                                                    <div className="flex justify-end gap-2 mt-2">
                                                                        <button type="button" onClick={() => { setInlineReplyTargetId(null); setInlineReplyText(''); }} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
                                                                        <button type="button" onClick={() => handleSubmitInlineReply(reply.id)} disabled={!inlineReplyText.trim() || isSubmitting} className="px-4 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-1">
                                                                            {isSubmitting && inlineReplyTargetId === reply.id ? (<><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />Posting...</>) : 'Post reply'}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ));
                            })()}
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Report Modal */}
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
                            <h3 className="text-lg font-semibold text-gray-900">
                                {reportTarget.type === 'topic' ? 'Report Post' : 'Report Reply'}
                            </h3>
                            <p className="mt-1 text-sm text-gray-600">
                                Tell us briefly why you find this reply offensive. Your report will be reviewed by moderators.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                if (reportSubmitting) return;
                                closeReportModal();
                            }}
                            className="ml-4 text-gray-400 hover:text-gray-600"
                            aria-label="Close report dialog"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
                            <div className="font-medium text-gray-900 mb-1">
                                {reportTarget.title || reportTarget.author}
                            </div>
                            <div className="text-gray-700 whitespace-pre-line">
                                {reportTarget.contentPreview}
                                {reportTarget.contentPreview.length >= 120 && <span className="text-gray-400">...</span>}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Reason for reporting <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={reportReason}
                                onChange={(e) => {
                                    setReportReason(e.target.value);
                                    if (reportError) {
                                        setReportError('');
                                    }
                                }}
                                rows={4}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm ${
                                    reportError ? 'border-red-500 form-shake' : 'border-gray-300'
                                }`}
                                placeholder="Example: Contains hate speech, harassment, or inappropriate language that violates community guidelines."
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
                            Cancel
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
                            Submit Report
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
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Thank you</h3>
                        <p className="text-gray-600">Your report has been sent to the moderators.</p>
                    </div>
                    <button
                        onClick={() => setThankYouModalOpen(false)}
                        className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        OK
                    </button>
                </div>
            </div>
        )}
        </>
    );
}

