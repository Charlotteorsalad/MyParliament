import React, { useState, useEffect } from 'react';
import { forumModerationApi } from '../../api';
import { useAdminAuth } from '../../hooks/useAdminAuth';

const ForumModeration = ({ togglePin, isPinned, PinButton }) => {
  const { admin, isAuthenticated } = useAdminAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({});
  const [topics, setTopics] = useState([]);
  const [flaggedContent, setFlaggedContent] = useState({ flaggedTopics: [], flaggedPosts: [] });
  const [restrictions, setRestrictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [showRestrictModal, setShowRestrictModal] = useState(false);
  const [showModerationModal, setShowModerationModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedContent, setSelectedContent] = useState(null);

  useEffect(() => {
    // Fetch stats on initial load for overview tab
    if (activeTab === 'overview') {
      fetchStats();
    } else if (activeTab === 'topics') {
      fetchTopics();
    } else if (activeTab === 'flagged') {
      fetchFlaggedContent();
    } else if (activeTab === 'restrictions') {
      fetchRestrictions();
    }
  }, [activeTab, currentPage]);

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

  const fetchTopics = async () => {
    try {
      setLoading(true);
      const response = await forumModerationApi.getTopics({
        page: currentPage,
        limit: 10
      });
      setTopics(response.data.data.topics);
      setTotalPages(response.data.data.totalPages);
    } catch (error) {
      console.error('Error fetching topics:', error);
      setTopics([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
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
        limit: 10
      });
      setRestrictions(response.data.data.restrictions);
      setTotalPages(response.data.data.totalPages);
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

  const renderOverview = () => (
    <div className="space-y-6">

      {/* Welcome Message */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Welcome to Forum Moderation</h3>
            <p className="text-gray-600">
              Manage forum discussions, moderate content, and handle user restrictions. 
              Use the tabs below to navigate to different moderation tools.
            </p>
          </div>
          <button
            onClick={fetchStats}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Load Statistics
          </button>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Topics</p>
              <p className="text-2xl font-bold text-blue-900">{stats.totalTopics || 0}</p>
            </div>
            <div className="h-12 w-12 bg-blue-500 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-6 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Flagged Content</p>
              <p className="text-2xl font-bold text-red-900">{(stats.flaggedTopics || 0) + (stats.flaggedPosts || 0)}</p>
            </div>
            <div className="h-12 w-12 bg-red-500 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6 border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">Active Restrictions</p>
              <p className="text-2xl font-bold text-orange-900">{stats.activeRestrictions || 0}</p>
            </div>
            <div className="h-12 w-12 bg-orange-500 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Sensitive Content</p>
              <p className="text-2xl font-bold text-purple-900">{stats.sensitiveContent || 0}</p>
            </div>
            <div className="h-12 w-12 bg-purple-500 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setActiveTab('flagged')}
            className="p-4 border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-left"
          >
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Review Flagged Content</h4>
                <p className="text-sm text-gray-600">Review and moderate flagged posts</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('topics')}
            className="p-4 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors text-left"
          >
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Manage Topics</h4>
                <p className="text-sm text-gray-600">View and moderate forum topics</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('restrictions')}
            className="p-4 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors text-left"
          >
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="h-5 w-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">User Restrictions</h4>
                <p className="text-sm text-gray-600">Manage restricted users</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  const renderTopics = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Forum Topics</h3>
        <div className="flex space-x-2">
          <select className="px-3 py-2 border border-gray-300 rounded-md text-sm">
            <option value="">All Categories</option>
            <option value="policy">Policy</option>
            <option value="debate">Debate</option>
            <option value="general">General</option>
            <option value="announcement">Announcement</option>
          </select>
          <select className="px-3 py-2 border border-gray-300 rounded-md text-sm">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="locked">Locked</option>
            <option value="archived">Archived</option>
            <option value="flagged">Flagged</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topic</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Author</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {topics.map((topic) => (
                <tr key={topic._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{topic.title}</div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">{topic.description}</div>
                      </div>
                      {topic.moderationFlags.isFlagged && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Flagged
                        </span>
                      )}
                      {topic.moderationFlags.hasSensitiveContent && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Sensitive
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{topic.author?.username || 'Unknown'}</div>
                    <div className="text-sm text-gray-500">{topic.author?.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      topic.category === 'policy' ? 'bg-blue-100 text-blue-800' :
                      topic.category === 'debate' ? 'bg-purple-100 text-purple-800' :
                      topic.category === 'announcement' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {topic.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      topic.status === 'active' ? 'bg-green-100 text-green-800' :
                      topic.status === 'locked' ? 'bg-red-100 text-red-800' :
                      topic.status === 'archived' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {topic.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(topic.lastActivity).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleModerateContent(topic, 'topic')}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Moderate
                      </button>
                      {topic.author && (
                        <button
                          onClick={() => handleRestrictUser(topic.author)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Restrict User
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-2 text-sm text-gray-700">
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

  const renderFlaggedContent = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Flagged Content</h3>
      
      {/* Flagged Topics */}
      {flaggedContent.flaggedTopics.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h4 className="text-md font-medium text-gray-900">Flagged Topics</h4>
          </div>
          <div className="divide-y divide-gray-200">
            {flaggedContent.flaggedTopics.map((topic) => (
              <div key={topic._id} className="px-6 py-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h5 className="text-sm font-medium text-gray-900">{topic.title}</h5>
                    <p className="text-sm text-gray-600 mt-1">{topic.description}</p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                      <span>By: {topic.author?.username}</span>
                      <span>Category: {topic.category}</span>
                      <span>Flagged: {topic.moderationFlags.flaggedBy.length} times</span>
                    </div>
                    {topic.moderationFlags.flaggedBy.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-600">
                          Last flagged reason: {topic.moderationFlags.flaggedBy[topic.moderationFlags.flaggedBy.length - 1].reason}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleModerateContent(topic, 'topic')}
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700"
                    >
                      Review
                    </button>
                    {topic.author && (
                      <button
                        onClick={() => handleRestrictUser(topic.author)}
                        className="px-3 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700"
                      >
                        Restrict User
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flagged Posts */}
      {flaggedContent.flaggedPosts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h4 className="text-md font-medium text-gray-900">Flagged Posts</h4>
          </div>
          <div className="divide-y divide-gray-200">
            {flaggedContent.flaggedPosts.map((post) => (
              <div key={post._id} className="px-6 py-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{post.content.substring(0, 200)}...</p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                      <span>By: {post.author?.username}</span>
                      <span>Topic: {post.topic?.title}</span>
                      <span>Flagged: {post.moderationFlags.flaggedBy.length} times</span>
                    </div>
                    {post.moderationFlags.flaggedBy.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-600">
                          Last flagged reason: {post.moderationFlags.flaggedBy[post.moderationFlags.flaggedBy.length - 1].reason}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleModerateContent(post, 'post')}
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700"
                    >
                      Review
                    </button>
                    {post.author && (
                      <button
                        onClick={() => handleRestrictUser(post.author)}
                        className="px-3 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700"
                      >
                        Restrict User
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {flaggedContent.flaggedTopics.length === 0 && flaggedContent.flaggedPosts.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No flagged content</h3>
          <p className="mt-1 text-sm text-gray-500">All content has been reviewed or there are no flags.</p>
        </div>
      )}
    </div>
  );

  const renderRestrictions = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">User Restrictions</h3>
        <select className="px-3 py-2 border border-gray-300 rounded-md text-sm">
          <option value="active">Active Restrictions</option>
          <option value="all">All Restrictions</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Restriction Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {restrictions.map((restriction) => (
                <tr key={restriction._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{restriction.user?.username || 'Unknown'}</div>
                    <div className="text-sm text-gray-500">{restriction.user?.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      restriction.restrictionType === 'forum_ban' ? 'bg-red-100 text-red-800' :
                      restriction.restrictionType === 'post_restriction' ? 'bg-orange-100 text-orange-800' :
                      restriction.restrictionType === 'comment_restriction' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {restriction.restrictionType.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate">{restriction.reason}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(restriction.endDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      restriction.isCurrentlyRestricted() ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {restriction.isCurrentlyRestricted() ? 'Active' : 'Expired'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {restriction.isActive && new Date() < new Date(restriction.endDate) && (
                      <button
                        onClick={() => handleLiftRestriction(restriction._id)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Lift Restriction
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-2 text-sm text-gray-700">
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
      fetchRestrictions(); // Refresh the list
    } catch (error) {
      console.error('Error lifting restriction:', error);
    }
  };

  return (
    <div className="p-6">
      {/* Tab Navigation */}
      <div className="mb-6">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'topics', label: 'Topics', icon: '💬' },
            { id: 'flagged', label: 'Flagged Content', icon: '🚩' },
            { id: 'restrictions', label: 'User Restrictions', icon: '🚫' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {PinButton && <PinButton tabId={tab.id} tabName={tab.label} module="Forum Moderation" />}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'topics' && renderTopics()}
          {activeTab === 'flagged' && renderFlaggedContent()}
          {activeTab === 'restrictions' && renderRestrictions()}
        </>
      )}

      {/* Modals */}
      {showRestrictModal && (
        <UserRestrictionModal
          user={selectedUser}
          onClose={() => {
            setShowRestrictModal(false);
            setSelectedUser(null);
          }}
          onRestrict={(data) => {
            // Handle user restriction
            console.log('Restricting user:', data);
            setShowRestrictModal(false);
            setSelectedUser(null);
          }}
        />
      )}

      {showModerationModal && (
        <ModerationModal
          content={selectedContent}
          onClose={() => {
            setShowModerationModal(false);
            setSelectedContent(null);
          }}
          onModerate={(data) => {
            // Handle content moderation
            console.log('Moderating content:', data);
            setShowModerationModal(false);
            setSelectedContent(null);
          }}
        />
      )}
    </div>
  );
};

// User Restriction Modal Component
const UserRestrictionModal = ({ user, onClose, onRestrict }) => {
  const [formData, setFormData] = useState({
    restrictionType: 'forum_ban',
    reason: '',
    durationDays: 7,
    violations: []
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await forumModerationApi.restrictUser(user._id, formData);
      onRestrict(formData);
    } catch (error) {
      console.error('Error restricting user:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Restrict User</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">User: <strong>{user?.username}</strong></p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Restriction Type</label>
            <select
              value={formData.restrictionType}
              onChange={(e) => setFormData({ ...formData, restrictionType: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="forum_ban">Forum Ban</option>
              <option value="post_restriction">Post Restriction</option>
              <option value="comment_restriction">Comment Restriction</option>
              <option value="full_restriction">Full Restriction</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Duration (Days)</label>
            <input
              type="number"
              min="1"
              max="365"
              value={formData.durationDays}
              onChange={(e) => setFormData({ ...formData, durationDays: parseInt(e.target.value) })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Reason</label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              rows={3}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Explain the reason for this restriction..."
              required
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
            >
              Restrict User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Moderation Modal Component
const ModerationModal = ({ content, onClose, onModerate }) => {
  const [action, setAction] = useState('approve');
  const [note, setNote] = useState('');
  const [sensitiveContentType, setSensitiveContentType] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Moderate {content.type}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">
            {content.type === 'topic' ? content.title : 'Post Content'}
          </h4>
          <p className="text-sm text-gray-600">
            {content.type === 'topic' ? content.description : content.content}
          </p>
          <div className="mt-2 text-xs text-gray-500">
            By: {content.author?.username} | 
            {content.moderationFlags.flaggedBy.length > 0 && 
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
              <option value="approve">Approve</option>
              <option value="lock">Lock</option>
              <option value="archive">Archive</option>
              <option value="mark_sensitive">Mark as Sensitive</option>
              <option value="flag">Flag for Review</option>
              {content.type === 'post' && (
                <>
                  <option value="hide">Hide</option>
                  <option value="delete">Delete</option>
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
            <label className="block text-sm font-medium text-gray-700">Moderation Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Add a note about this moderation action..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
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
