import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks';
import { useApi } from '../../hooks';
import { usePin } from '../../contexts/PinContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { forumApi } from '../../api';
import LoginConfirmationModal from '../../components/LoginConfirmationModal';

export default function DiscussionForumPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated } = useAuth();
    const { executeApiCall, loading, error } = useApi();
    const { PinButton } = usePin();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState('forum');
    const [discussions, setDiscussions] = useState([]);
    const [userCreatedDiscussions, setUserCreatedDiscussions] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [loginAction, setLoginAction] = useState('');
    const [newDiscussion, setNewDiscussion] = useState({
        title: '',
        description: '',
        category: 'general',
        tags: []
    });
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        itemsPerPage: 10
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [discussionsLoaded, setDiscussionsLoaded] = useState(false);
    const isFetchingRef = useRef(false);
    const discussionsLoadedRef = useRef(false);
    const discussionsCacheRef = useRef([]);
    const lastFetchParamsRef = useRef(null);

    // Get topic context from URL parameters
    const urlParams = new URLSearchParams(location.search);
    const topicTitle = urlParams.get('topic');
    const topicCategory = urlParams.get('category');
    const isViewMode = urlParams.get('view') === 'true';
    const isCreateMode = urlParams.get('create') === 'true';

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
                
                setDiscussions(topics);
                setPagination(result.pagination || pagination);
                setDiscussionsLoaded(true);
                discussionsLoadedRef.current = true;
                
                // Cache the results
                discussionsCacheRef.current = topics;
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
    }, [pagination.currentPage, selectedCategory, searchQuery]);

    // Load user's created discussions
    useEffect(() => {
        if (isAuthenticated) {
            const fetchUserDiscussions = async () => {
                try {
                    const result = await executeApiCall(() => forumApi.getUserTopics());
                    setUserCreatedDiscussions(result.topics || []);
                } catch (err) {
                    console.error('Failed to fetch user discussions:', err);
                    setUserCreatedDiscussions([]);
                }
            };

            fetchUserDiscussions();
        }
    }, [isAuthenticated]);

    // If coming from a topic in create mode, pre-populate the create modal and show it
    useEffect(() => {
        if (topicTitle && topicCategory && isCreateMode) {
            setNewDiscussion({
                title: `Discussion: ${topicTitle}`,
                description: `I'd like to discuss the topic "${topicTitle}" and share my thoughts on this important issue.`,
                category: topicCategory,
                tags: []
            });
            setShowCreateModal(true);
        }
    }, [topicTitle, topicCategory, isCreateMode]);

    const handleCreateDiscussion = async () => {
        if (newDiscussion.title.trim() && newDiscussion.description.trim()) {
            try {
                const result = await executeApiCall(() => forumApi.createTopic(newDiscussion));
                
                // Refresh discussions
                const params = {
                    page: pagination.currentPage,
                    limit: pagination.itemsPerPage,
                    category: selectedCategory !== 'all' ? selectedCategory : undefined,
                    search: searchQuery || undefined
                };
                const updatedResult = await executeApiCall(() => forumApi.getAllTopics(params));
                const topics = updatedResult.topics || [];
                setDiscussions(topics);
                setPagination(updatedResult.pagination || pagination);
                
                // Update cache with new data
                discussionsCacheRef.current = topics;
                lastFetchParamsRef.current = JSON.stringify(params);
                
                // Refresh user discussions
                if (isAuthenticated) {
                    const userResult = await executeApiCall(() => forumApi.getUserTopics());
                    setUserCreatedDiscussions(userResult.topics || []);
                }
                
                setNewDiscussion({ title: '', description: '', category: 'general', tags: [] });
                setShowCreateModal(false);
            } catch (err) {
                console.error('Failed to create discussion:', err);
            }
        }
    };

    const handleBookmark = (discussionId) => {
        setDiscussions(prev => prev.map(discussion => 
            discussion.id === discussionId 
                ? { ...discussion, isBookmarked: !discussion.isBookmarked }
                : discussion
        ));
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

    const renderForumTab = () => (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">{t('discussionForum')}</h2>

            {discussions.length === 0 ? (
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
                                setLoginAction('create a discussion');
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
                <div className="space-y-4">
                    {discussions.map((discussion) => (
                    <div key={discussion.id} className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(discussion.category)}`}>
                                        {discussion.category}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                        {formatDate(discussion.createdAt)}
                                    </span>
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                    {discussion.title}
                                </h3>
                                <p className="text-gray-700 mb-4 line-clamp-3">
                                    {discussion.description}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    if (isAuthenticated) {
                                        handleBookmark(discussion.id);
                                    } else {
                                        setLoginAction('bookmark this discussion');
                                        setShowLoginModal(true);
                                    }
                                }}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                title={isAuthenticated ? (discussion.isBookmarked ? t('removeBookmark') : t('bookmark')) : t('loginToBookmark')}
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
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-6 text-sm text-gray-500">
                                <div className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    {discussion.author?.name || t('unknownUser')}
                                </div>
                                <div className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    {discussion.posts?.length || 0} {t('replies')}
                                </div>
                                <div className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    {discussion.viewCount || 0} {t('views')}
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (isAuthenticated) {
                                        navigate(`/forum/reply/${discussion.id}`);
                                    } else {
                                        setLoginAction('reply to this discussion');
                                        setShowLoginModal(true);
                                    }
                                }}
                                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                                title={isAuthenticated ? undefined : t('loginToReply')}
                            >
                                {t('reply')}
                            </button>
                        </div>

                        {discussion.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-4">
                                {discussion.tags.map((tag, index) => (
                                    <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                </div>
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
                        onClick={() => setShowCreateModal(true)}
                        className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        {t('createYourFirstDiscussion')}
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {userCreatedDiscussions.map((discussion) => (
                        <div key={discussion.id} className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(discussion.category)}`}>
                                            {discussion.category}
                                        </span>
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
                                    <div className="flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        {discussion.views} {t('views')}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEditDiscussion(discussion.id)}
                                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        {t('edit')}
                                    </button>
                                    <button
                                        onClick={() => handleDeleteDiscussion(discussion.id)}
                                        className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                                    >
                                        {t('delete')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
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
                                    onClick={() => navigate(`/forum/reply/${notification.discussionId}`)}
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('discussionForum')}</h1>
                    <p className="text-lg text-gray-600">{t('engageCommunityBlurb')}</p>
                    
                    {/* Topic Context Banner */}
                    {topicTitle && topicCategory && (
                        <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                    {isViewMode ? (
                                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        {isViewMode ? `${t('viewingDiscussionsAbout')}: ${topicTitle}` : 
                                         isCreateMode ? `${t('creatingDiscussionFor')}: ${topicTitle}` : 
                                         `${t('discussing')}: ${topicTitle}`}
                                    </h3>
                                    <p className="text-sm text-gray-600">{t('category')}: {topicCategory}</p>
                                </div>
                                <button
                                    onClick={() => navigate('/forum')}
                                    className="ml-auto px-3 py-1 text-sm text-purple-600 hover:text-purple-700 border border-purple-300 rounded-md hover:bg-purple-50 transition-colors"
                                >
                                    {t('viewAllDiscussions')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation Tabs */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-8">
                    <div className="border-b border-gray-200">
                        <nav className="flex space-x-8 px-6">
                            {[
                                { id: 'forum-discussions', label: t('forumTab'), count: discussions.length },
                                { id: 'forum-created', label: t('createdForumTab'), count: userCreatedDiscussions.length },
                                { id: 'forum-notifications', label: t('notificationsTab'), count: notifications.filter(n => !n.isRead).length }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id === 'forum-discussions' ? 'forum' : tab.id.replace('forum-', ''))}
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
                        {/* Create Discussion Button - Available on all tabs */}
                        <div className="flex justify-between items-center mb-6">
                            <div></div>
                            <button
                                onClick={() => {
                                    if (isAuthenticated) {
                                        setShowCreateModal(true);
                                    } else {
                                        setLoginAction('create a discussion');
                                        setShowLoginModal(true);
                                    }
                                }}
                                className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                                title={isAuthenticated ? undefined : t('loginToCreateDiscussion')}
                            >
                                {t('createDiscussion')}
                            </button>
                        </div>

                        {activeTab === 'forum' && renderForumTab()}
                        {activeTab === 'created' && renderCreatedTab()}
                        {activeTab === 'notifications' && renderNotificationsTab()}
                    </div>
                </div>

                {/* Create Discussion Modal */}
                {showCreateModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl shadow-xl w-[95%] max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-gray-200">
                                <h3 className="text-xl font-semibold text-gray-900">
                                    {isCreateMode && topicTitle ? `Create Discussion for: ${topicTitle}` : 'Create New Discussion'}
                                </h3>
                                {isCreateMode && topicTitle && (
                                    <p className="text-sm text-gray-600 mt-1">
                                        Start a discussion about this parliamentary topic
                                    </p>
                                )}
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                                    <input
                                        type="text"
                                        value={newDiscussion.title}
                                        onChange={(e) => setNewDiscussion(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="Enter discussion title"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                                    <select
                                        value={newDiscussion.category}
                                        onChange={(e) => setNewDiscussion(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="general">General</option>
                                        <option value="policy">Policy</option>
                                        <option value="debate">Debate</option>
                                        <option value="announcement">Announcement</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                                    <textarea
                                        value={newDiscussion.description}
                                        onChange={(e) => setNewDiscussion(prev => ({ ...prev, description: e.target.value }))}
                                        rows={6}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="Share your thoughts and start the discussion..."
                                    />
                                </div>
                            </div>
                            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateDiscussion}
                                    disabled={!newDiscussion.title.trim() || !newDiscussion.description.trim()}
                                    className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                >
                                    Create Discussion
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Login Confirmation Modal */}
            <LoginConfirmationModal
                isOpen={showLoginModal}
                onClose={() => setShowLoginModal(false)}
                action={loginAction}
            />
        </div>
    );
}
