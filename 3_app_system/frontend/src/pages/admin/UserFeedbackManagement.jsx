import React, { useState, useEffect, useRef, Fragment } from 'react';
import { adminApi } from '../../api';
import { useSSEEvent } from '../../contexts/SSEContext';

const UserFeedbackManagement = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [feedback, setFeedback] = useState([]);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stats, setStats] = useState({});
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFeedback, setTotalFeedback] = useState(0);
  const [feedbackPerPage] = useState(10);
  
  // Filter state
  const [filters, setFilters] = useState({
    category: '',
    priority: '',
    sortBy: 'createdDate',
    sortOrder: 'desc'
  });
  
  // Modal state
  const [showViewModal, setShowViewModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [selectedFeedbackId, setSelectedFeedbackId] = useState(null);

  // Admin users for "Assigned to" dropdown (e.g. on Pending tab)
  const [adminUsers, setAdminUsers] = useState([]);
  const [openAssignDropdownId, setOpenAssignDropdownId] = useState(null);
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const assignDropdownRef = useRef(null);
  const [goToPageInput, setGoToPageInput] = useState('');

  // Fetch feedback data
  const fetchFeedback = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        limit: feedbackPerPage,
        status: activeTab === 'pending' ? 'Pending' :
                activeTab === 'in-progress' ? 'In-Progress' :
                activeTab === 'resolved' ? 'Resolved' :
                activeTab === 'archived' ? 'Archived' : '',
        ...filters
      };
      
      const response = await adminApi.getAllFeedback(params);
      setFeedback(response.data.feedback || []);
      const pagination = response.data.pagination || {};
      setTotalPages(pagination.totalPages ?? pagination.pages ?? 1);
      setTotalFeedback(pagination.total ?? 0);
      setCurrentPage(page);
    } catch (err) {
      setError(`Failed to fetch feedback: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch feedback statistics
  const fetchStats = async () => {
    try {
      const response = await adminApi.getFeedbackStats();
      setStats(response.data);
    } catch (err) {
      console.error('Stats fetch error:', err);
    }
  };

  // Fetch admin users for Assigned to dropdown
  const fetchAdminUsers = async () => {
    try {
      const response = await adminApi.getAllAdminUsers(1, 200);
      setAdminUsers(response.data.users || []);
    } catch (err) {
      console.error('Admin users fetch error:', err);
    }
  };

  const [sseKey, setSseKey] = useState(0);

  // Real-time: when a user submits new feedback, auto-refresh the list and stats
  useSSEEvent('feedback_received', () => { setSseKey((k) => k + 1); fetchStats(); });

  useEffect(() => {
    fetchFeedback(1);
    fetchStats();
  }, [activeTab, filters, sseKey]);

  useEffect(() => {
    fetchAdminUsers();
  }, []);

  // Close assign dropdown when modal opens
  useEffect(() => {
    if (showResponseModal || showViewModal) {
      setOpenAssignDropdownId(null);
    }
  }, [showResponseModal, showViewModal]);

  // Lock body scroll when respond modal is open
  useEffect(() => {
    if (showResponseModal) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [showResponseModal]);

  // Close assign dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (assignDropdownRef.current && !assignDropdownRef.current.contains(e.target)) {
        setOpenAssignDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    fetchFeedback(newPage);
  };

  // Handle filter change
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  // Handle status update
  const handleStatusUpdate = async (feedbackId, newStatus) => {
    try {
      await adminApi.updateFeedbackStatus(feedbackId, newStatus);
      setSuccess('Feedback status updated successfully');
      fetchFeedback(currentPage);
      fetchStats();
    } catch (err) {
      setError('Failed to update feedback status');
      console.error('Status update error:', err);
    }
  };

  // Handle priority update
  const handlePriorityUpdate = async (feedbackId, newPriority) => {
    try {
      await adminApi.updateFeedbackPriority(feedbackId, newPriority);
      setSuccess('Feedback priority updated successfully');
      fetchFeedback(currentPage);
    } catch (err) {
      setError('Failed to update feedback priority');
      console.error('Priority update error:', err);
    }
  };

  // Handle assign feedback (Assigned to)
  const handleAssignFeedback = async (feedbackId, assignedToId) => {
    try {
      await adminApi.assignFeedback(feedbackId, assignedToId || null);
      setSuccess('Assignment updated successfully');
      fetchFeedback(currentPage);
    } catch (err) {
      setError('Failed to update assignment');
      console.error('Assign feedback error:', err);
    }
  };

  // Handle view feedback
  const handleViewFeedback = async (feedbackId) => {
    try {
      const response = await adminApi.getFeedbackById(feedbackId);
      setSelectedFeedback(response.data.feedback);
      setShowViewModal(true);
    } catch (err) {
      setError('Failed to fetch feedback details');
      console.error('View feedback error:', err);
    }
  };

  // Handle respond to feedback
  const handleRespondToFeedback = async () => {
    if (!responseText.trim()) {
      setError('Please enter a response');
      return;
    }

    try {
      await adminApi.respondToFeedback(selectedFeedbackId, responseText);
      setSuccess('Response added successfully');
      setResponseText('');
      setShowResponseModal(false);
      setSelectedFeedbackId(null);
      fetchFeedback(currentPage);
    } catch (err) {
      setError('Failed to add response');
      console.error('Respond error:', err);
    }
  };

  // Handle delete feedback
  const handleDeleteFeedback = async (feedbackId) => {
    if (!window.confirm('Are you sure you want to delete this feedback?')) {
      return;
    }

    try {
      await adminApi.deleteFeedback(feedbackId);
      setSuccess('Feedback deleted successfully');
      fetchFeedback(currentPage);
      fetchStats();
    } catch (err) {
      setError('Failed to delete feedback');
      console.error('Delete error:', err);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'In-Progress': return 'bg-blue-100 text-blue-800';
      case 'Resolved': return 'bg-green-100 text-green-800';
      case 'Archived': return 'bg-gray-100 text-gray-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Low': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'High': return 'bg-orange-100 text-orange-800';
      case 'Critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Fragment>
    <div className="min-h-screen min-w-0 max-w-full overflow-x-hidden bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto min-w-0">
        {/* Header Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Feedback Management</h1>
              <p className="text-gray-600 text-base sm:text-lg">Monitor and manage user feedback efficiently</p>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900">{stats.totalFeedback || 0}</div>
                <div className="text-gray-600 text-sm font-medium">Total Feedback</div>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900">{stats.pendingFeedback || 0}</div>
                <div className="text-gray-600 text-sm font-medium">Pending</div>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900">{stats.inProgressFeedback || 0}</div>
                <div className="text-gray-600 text-sm font-medium">In Progress</div>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900">{stats.resolvedFeedback || 0}</div>
                <div className="text-gray-600 text-sm font-medium">Resolved</div>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900">{stats.archivedFeedback || 0}</div>
                <div className="text-gray-600 text-sm font-medium">Archived</div>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8l6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-visible min-w-0">
          {/* Tabs */}
          <div className="border-b border-gray-200 bg-gray-50 overflow-x-auto">
            <nav className="flex gap-px">
              {[
                { id: 'pending', label: 'Pending Feedback', count: stats.pendingFeedback, color: 'yellow' },
                { id: 'in-progress', label: 'In Progress', count: stats.inProgressFeedback, color: 'indigo' },
                { id: 'resolved', label: 'Resolved', count: stats.resolvedFeedback, color: 'green' },
                { id: 'archived', label: 'Archived', count: stats.archivedFeedback, color: 'gray' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? `bg-white text-${tab.color}-600 border-b-2 border-${tab.color}-500`
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        activeTab === tab.id 
                          ? `bg-${tab.color}-100 text-${tab.color}-700` 
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </nav>
          </div>

          {/* Filters and Search */}
          <div className="p-4 sm:p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-64">
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                >
                  <option value="">All Categories</option>
                  <option value="Bug">Bug</option>
                  <option value="Feature Request">Feature Request</option>
                  <option value="General">General</option>
                  <option value="Complaint">Complaint</option>
                  <option value="Suggestion">Suggestion</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="min-w-48">
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select
                  value={filters.priority}
                  onChange={(e) => handleFilterChange('priority', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                >
                  <option value="">All Priorities</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div className="min-w-48">
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                >
                  <option value="createdDate">Date</option>
                  <option value="title">Title</option>
                  <option value="priority">Priority</option>
                  <option value="status">Status</option>
                </select>
              </div>

              <div className="min-w-32">
                <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
                <select
                  value={filters.sortOrder}
                  onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                >
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 invisible select-none" aria-hidden="true">Action</label>
                <button
                  onClick={() => {
                    setFilters({ category: '', priority: '', sortBy: 'createdDate', sortOrder: 'desc' });
                    setCurrentPage(1);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 whitespace-nowrap"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          {/* Error and Success Messages */}
          {error && (
            <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-600 text-sm font-medium">{error}</p>
            </div>
          )}
          {success && (
            <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-3">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-green-600 text-sm font-medium">{success}</p>
            </div>
          )}

          {/* Feedback List */}
          <div className="p-4 sm:p-6 overflow-visible min-w-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600 font-medium">Loading feedback...</p>
                </div>
              </div>
            ) : feedback.length > 0 ? (
              <>
                <div className="space-y-8" style={{ position: 'relative' }}>
                  {feedback.map((item) => (
                    <div key={item._id} className="group bg-white border border-gray-200 rounded-xl px-4 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-6 hover:shadow-lg hover:border-gray-300 transition-all duration-300 overflow-visible min-w-0">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 relative">
                        <div className="flex-1">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <h4 className="text-xl font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                                  {item.title}
                                </h4>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(item.status)}`}>
                                  {item.status}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(item.priority)}`}>
                                  {item.priority}
                                </span>
                              </div>
                              <p className="text-gray-600 text-sm leading-relaxed line-clamp-2 mb-3">
                                {item.content}
                              </p>
                            </div>
                          </div>

                          {/* Meta Information */}
                          <div className="flex items-center space-x-6 text-sm text-gray-500 mb-4">
                            <div className="flex items-center space-x-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span className="font-medium">{item.userId?.username || 'Unknown User'}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                              <span>{item.category}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{formatDate(item.createdDate)}</span>
                            </div>
                            {(item.assignedTo != null) && (
                              <div className="flex items-center space-x-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                <span>Assigned to <span className="font-medium">{item.assignedTo?.username || '—'}</span></span>
                              </div>
                            )}
                            {Array.isArray(item.attachments) && item.attachments.length > 0 && (
                              <div className="flex items-center space-x-1.5 text-amber-600">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                <span className="font-medium">{item.attachments.length} attachment{item.attachments.length > 1 ? 's' : ''}</span>
                              </div>
                            )}
                          </div>

                          {/* Admin Response / No Reply */}
                          {item.adminResponse?.response ? (
                            <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                              <div className="flex flex-col gap-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="text-sm text-green-800 font-medium">Latest Admin Response</p>
                                      {Array.isArray(item.responses) && item.responses.length > 1 && (
                                        <p className="text-xs text-green-600">{item.responses.length} replies total — view all in details</p>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleViewFeedback(item._id)}
                                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors"
                                  >
                                    <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M4 6a2 2 0 012-2h7a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
                                    </svg>
                                    View full feedback
                                  </button>
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm text-green-700 leading-relaxed">{item.adminResponse.response}</p>
                                  <p className="text-xs text-green-600 mt-2">
                                    By {item.adminResponse.respondedBy?.username} • {formatDate(item.adminResponse.respondedAt)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
                              <div className="flex flex-col gap-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="text-sm text-gray-600 font-medium">No Reply Yet</p>
                                      <p className="text-xs text-gray-500 mt-0.5">Haven't replied to this feedback</p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleViewFeedback(item._id)}
                                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors"
                                  >
                                    <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M4 6a2 2 0 012-2h7a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
                                    </svg>
                                    View full feedback
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col items-start gap-2 lg:ml-6 flex-shrink-0">
                          <div className="flex flex-wrap items-end gap-2 relative z-[99999]" ref={openAssignDropdownId === item._id ? assignDropdownRef : null} style={{ zIndex: 99999 }}>
                            <div className="flex flex-col">
                              <label className="text-xs font-medium text-gray-500 mb-1">Assigned to</label>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenAssignDropdownId(openAssignDropdownId === item._id ? null : item._id);
                                  setAssignSearchQuery('');
                                }}
                                className="w-full px-3 py-2 text-xs text-left border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white min-w-[120px] flex items-center justify-between"
                              >
                                <span className="truncate text-gray-900">
                                  {item.assignedTo?.username ?? (typeof item.assignedTo === 'string' ? adminUsers.find(a => a._id === item.assignedTo)?.username : null) ?? 'Unassigned'}
                                </span>
                                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              {openAssignDropdownId === item._id && (
                                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-hidden z-[100000]">
                                  <div className="p-2 border-b border-gray-200">
                                    <input
                                      type="text"
                                      placeholder="Search admins..."
                                      value={assignSearchQuery}
                                      onChange={(e) => setAssignSearchQuery(e.target.value)}
                                      onKeyDown={(e) => e.stopPropagation()}
                                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                      autoFocus
                                    />
                                  </div>
                                  <div className="overflow-y-auto max-h-48">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleAssignFeedback(item._id, null);
                                        setOpenAssignDropdownId(null);
                                        setAssignSearchQuery('');
                                      }}
                                      className="w-full px-3 py-2 text-xs text-left hover:bg-gray-100 text-gray-900"
                                    >
                                      Unassigned
                                    </button>
                                    {adminUsers
                                      .filter((admin) => {
                                        const q = (assignSearchQuery || '').toLowerCase();
                                        if (!q) return true;
                                        const name = (admin.username || '').toLowerCase();
                                        const email = (admin.email || '').toLowerCase();
                                        return name.includes(q) || email.includes(q);
                                      })
                                      .map((admin) => (
                                        <button
                                          key={admin._id}
                                          type="button"
                                          onClick={() => {
                                            handleAssignFeedback(item._id, admin._id);
                                            setOpenAssignDropdownId(null);
                                            setAssignSearchQuery('');
                                          }}
                                          className={`w-full px-3 py-2 text-xs text-left hover:bg-gray-100 ${item.assignedTo === admin._id || (typeof item.assignedTo === 'string' && item.assignedTo === admin._id) ? 'bg-blue-50 text-blue-600' : 'text-gray-900'}`}
                                        >
                                          {admin.username}
                                        </button>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            </div>
                            <div className="flex flex-col">
                              <label className="text-xs font-medium text-gray-500 mb-1">Status</label>
                              <select
                                value={item.status}
                                onChange={(e) => handleStatusUpdate(item._id, e.target.value)}
                                className="px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white min-w-[100px]"
                              >
                                <option value="Pending">Pending</option>
                                <option value="In-Progress">In-Progress</option>
                                <option value="Resolved">Resolved</option>
                                <option value="Archived">Archived</option>
                              </select>
                            </div>
                            <div className="flex flex-col">
                              <label className="text-xs font-medium text-gray-500 mb-1">Priority</label>
                              <select
                                value={item.priority}
                                onChange={(e) => handlePriorityUpdate(item._id, e.target.value)}
                                className="px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white min-w-[90px]"
                              >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                                <option value="Critical">Critical</option>
                              </select>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedFeedbackId(item._id);
                                setShowResponseModal(true);
                              }}
                              className="px-4 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors duration-200 flex items-center space-x-2 flex-shrink-0"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              <span>Respond</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 pt-6 border-t border-gray-200 min-w-0">
                    <div className="flex flex-row items-center justify-between gap-3 flex-nowrap min-w-0">
                      <div className="text-sm text-gray-700 flex-shrink-0 whitespace-nowrap">
                        Showing <span className="font-semibold">{((currentPage - 1) * feedbackPerPage) + 1}</span> to <span className="font-semibold">{Math.min(currentPage * feedbackPerPage, totalFeedback)}</span> of <span className="font-semibold">{totalFeedback}</span> feedback
                      </div>
                      <div className="flex items-center gap-2 flex-nowrap flex-shrink-0">
                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || loading} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                          <span>Previous</span>
                        </button>
                        <form onSubmit={(e) => { e.preventDefault(); const n = parseInt(goToPageInput, 10); if (!isNaN(n) && n >= 1 && n <= totalPages) { handlePageChange(n); setGoToPageInput(''); } }}>
                          <input type="number" min={1} max={totalPages} value={goToPageInput} onChange={(e) => setGoToPageInput(e.target.value.replace(/\D/g, '').slice(0, 5))} className="w-12 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center" placeholder={currentPage} aria-label="Page number" />
                        </form>
                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || loading} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2">
                          <span>Next</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No feedback found</h3>
                <p className="text-gray-500 mb-6">No feedback matches your current filter criteria</p>
                <button
                  onClick={() => {
                    setFilters({ category: '', priority: '', sortBy: 'createdDate', sortOrder: 'desc' });
                    setCurrentPage(1);
                  }}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View Feedback Modal */}
      {showViewModal && selectedFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100000] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[900px] max-h-[90vh] overflow-hidden min-w-0">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 sm:px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Feedback Details</h3>
                    <p className="text-green-100 text-sm">
                      From {selectedFeedback.userId?.username || 'Unknown User'} • {formatDate(selectedFeedback.createdDate)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-120px)] min-w-0">
              <div className="space-y-6">
                {/* Title and Status */}
                <div className="bg-gray-50 rounded-xl p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <h4 className="text-2xl font-bold text-gray-900 break-words flex-1 min-w-0">{selectedFeedback.title}</h4>
                    <div className="flex items-center space-x-3 flex-shrink-0">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(selectedFeedback.status)}`}>
                        {selectedFeedback.status}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getPriorityColor(selectedFeedback.priority)}`}>
                        {selectedFeedback.priority}
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap break-words w-full">{selectedFeedback.content}</p>
                </div>
                
                {/* Meta Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-blue-50 rounded-xl p-4">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-600">Category</p>
                        <p className="text-lg font-semibold text-blue-900 break-words">{selectedFeedback.category}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-50 rounded-xl p-4">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-purple-600">User</p>
                        <p className="text-lg font-semibold text-purple-900 break-words">{selectedFeedback.userId?.username || 'Unknown User'}</p>
                        <p className="text-sm text-purple-600 break-words">{selectedFeedback.userId?.email}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 rounded-xl p-4">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-green-600">Created</p>
                        <p className="text-lg font-semibold text-green-900">{formatDate(selectedFeedback.createdDate)}</p>
                      </div>
                    </div>
                  </div>

                  {selectedFeedback.assignedTo != null && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Assigned to</p>
                          <p className="text-lg font-semibold text-gray-900 break-words">{selectedFeedback.assignedTo?.username || '—'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Attachments / Evidence */}
                {Array.isArray(selectedFeedback.attachments) && selectedFeedback.attachments.length > 0 && (
                  <div className="border border-amber-200 bg-amber-50 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </div>
                      <h5 className="text-base font-semibold text-amber-800">
                        Attachments / Evidence
                        <span className="ml-2 text-xs font-normal text-amber-600">({selectedFeedback.attachments.length} file{selectedFeedback.attachments.length > 1 ? 's' : ''})</span>
                      </h5>
                    </div>

                    {/* Image previews */}
                    {selectedFeedback.attachments.some(a => a.mimetype?.startsWith('image/')) && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                        {selectedFeedback.attachments
                          .filter(a => a.mimetype?.startsWith('image/'))
                          .map((att, i) => {
                            const url = `http://localhost:5000/uploads/feedback/${att.filename}`;
                            return (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                className="group relative block aspect-video rounded-xl overflow-hidden border-2 border-amber-200 hover:border-amber-400 transition-colors shadow-sm">
                                <img
                                  src={url}
                                  alt={att.originalName}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  onError={e => { e.target.style.display = 'none'; }}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                  <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </div>
                                <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 truncate">{att.originalName}</p>
                              </a>
                            );
                          })}
                      </div>
                    )}

                    {/* Non-image files */}
                    {selectedFeedback.attachments.filter(a => !a.mimetype?.startsWith('image/')).length > 0 && (
                      <ul className="space-y-2">
                        {selectedFeedback.attachments
                          .filter(a => !a.mimetype?.startsWith('image/'))
                          .map((att, i) => {
                            const url = `http://localhost:5000/uploads/feedback/${att.filename}`;
                            const isPdf = att.mimetype === 'application/pdf';
                            const isVideo = att.mimetype?.startsWith('video/');
                            const sizeKB = att.size ? (att.size / 1024).toFixed(0) : '?';
                            return (
                              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 bg-white border border-amber-200 rounded-xl">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isPdf ? 'bg-red-100' : isVideo ? 'bg-purple-100' : 'bg-blue-100'}`}>
                                    {isPdf ? (
                                      <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                      </svg>
                                    ) : isVideo ? (
                                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                    ) : (
                                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{att.originalName}</p>
                                    <p className="text-xs text-gray-400">{sizeKB} KB · {att.mimetype}</p>
                                  </div>
                                </div>
                                <a href={url} target="_blank" rel="noopener noreferrer" download={att.originalName}
                                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-colors">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                  {isVideo ? 'View' : 'Download'}
                                </a>
                              </li>
                            );
                          })}
                      </ul>
                    )}
                  </div>
                )}

                {/* Admin Response Log */}
                {(() => {
                  const log = Array.isArray(selectedFeedback.responses) && selectedFeedback.responses.length > 0
                    ? selectedFeedback.responses
                    : selectedFeedback.adminResponse?.response
                      ? [selectedFeedback.adminResponse]
                      : [];
                  if (log.length === 0) return null;
                  return (
                    <div className="border border-green-200 rounded-xl overflow-hidden">
                      <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h5 className="text-sm font-semibold text-white">Admin Response Log ({log.length})</h5>
                      </div>
                      <div className="divide-y divide-green-100">
                        {log.map((entry, idx) => (
                          <div key={idx} className={`p-5 ${idx === log.length - 1 ? 'bg-gradient-to-r from-green-50 to-emerald-50' : 'bg-white'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                #{idx + 1} {idx === log.length - 1 ? '· Latest' : ''}
                              </span>
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  {entry.respondedBy?.username || 'Admin'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {formatDate(entry.respondedAt)}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">{entry.response}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

      {/* Respond to Feedback Modal - rendered outside main container with high z-index */}
      {showResponseModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 999999 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowResponseModal(false);
            setSelectedFeedbackId(null);
            setResponseText('');
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="respond-modal-title"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-[600px] max-w-[95vw]"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 text-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div>
                    <h3 id="respond-modal-title" className="text-xl font-bold">Respond to Feedback</h3>
                    <p className="text-green-100 text-sm">Send a response to the user</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowResponseModal(false);
                    setSelectedFeedbackId(null);
                    setResponseText('');
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Your Response
                  </label>
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-colors duration-200"
                    placeholder="Type your response to the user here..."
                  />
                  <div className="mt-2 text-sm text-gray-500">
                    {responseText.length}/1000 characters
                  </div>
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-yellow-800">Tips for a good response:</p>
                      <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                        <li>• Be polite and professional</li>
                        <li>• Address the user's specific concerns</li>
                        <li>• Provide clear next steps if applicable</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 rounded-b-2xl">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowResponseModal(false);
                  setSelectedFeedbackId(null);
                  setResponseText('');
                }}
                className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRespondToFeedback();
                }}
                disabled={!responseText.trim()}
                className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span>Send Response</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </Fragment>
  );
};

export default UserFeedbackManagement;
