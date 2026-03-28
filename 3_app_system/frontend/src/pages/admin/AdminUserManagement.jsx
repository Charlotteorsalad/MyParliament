import React, { useState, useEffect, useMemo } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth.jsx';
import { adminApi } from '../../api';

// Default permissions by role (shown in Details when user has no explicit permissions)
const ALL_PERMISSIONS = [
  { key: 'manage_users',   label: 'Manage Users',              desc: 'User List, User Monitor, User Feedback' },
  { key: 'manage_content', label: 'Manage Content',            desc: 'Educational Content & Quizzes' },
  { key: 'manage_mps',     label: 'Manage MPs',                desc: 'MP Management' },
  { key: 'view_analytics', label: 'View Analytics',            desc: 'Analytics & Reports' },
  { key: 'moderate_forum', label: 'Manage Forum',              desc: 'Forum Moderation (topics, posts, restrictions)' },
  { key: 'manage_support', label: 'Manage Technical Support',  desc: 'Technical Support (incidents, change requests, maintenance)' },
];

const ROLE_DEFAULT_PERMISSIONS = {
  admin: [
    'manage_users',
    'manage_content',
    'manage_mps',
    'view_analytics',
    'moderate_forum',
    'manage_support',
  ],
  superadmin: [
    'manage_users',
    'manage_content',
    'manage_mps',
    'view_analytics',
    'moderate_forum',
    'manage_support',
  ]
};

const DEFAULT_ADMIN_PASSWORD = 'Admin@12345';

/** Strip "IC" and "permissions" from activity log description for display. */
function formatActivityDescription(desc) {
  if (!desc || typeof desc !== 'string') return desc;
  return desc
    .replace(/,?\s*IC\s*,?/gi, '')
    .replace(/,?\s*permissions\s*,?/gi, '')
    .replace(/\s*,\s*,/g, ',')
    .replace(/\(\s*,/g, '(')
    .replace(/,\s*\)/g, ')')
    .replace(/\s*\(\s*\)/g, '')
    .trim();
}

/** Convert snake_case action key to a readable label. */
function formatActionLabel(action) {
  if (!action) return 'Admin Action';
  return action
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const AdminUserManagement = () => {
  const { admin } = useAdminAuth();
  const currentAdminId = admin && (admin.id || admin._id);
  const isCurrentAdmin = (user) => user && currentAdminId && String(user._id) === String(currentAdminId);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('');
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [bulkAction, setBulkAction] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('error'); // 'error', 'success', 'warning'
  const [goToPageInput, setGoToPageInput] = useState('');
  const [logExpanded, setLogExpanded] = useState(false);
  const [adminActivity, setAdminActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Helper function to show alerts
  const showAlertMessage = (message, type = 'error') => {
    setAlertMessage(message);
    setAlertType(type);
    setShowAlert(true);
  };

  // Form states for create/edit
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: DEFAULT_ADMIN_PASSWORD,
    role: '',
    status: '',
    icNumber: '',
    permissions: []
  });
  const [formErrors, setFormErrors] = useState({});
  const [shakeForm, setShakeForm] = useState(false);

  // --- Validation helpers ---
  // Malaysian IC: 12 digits, optional hyphens as YYMMDD-PB-#### (e.g. 900101-01-1234 or 900101011234)
  const isValidMalaysianIC = (value) => {
    if (!value || typeof value !== 'string') return false;
    const stripped = value.replace(/\s/g, '').replace(/-/g, '');
    return /^\d{12}$/.test(stripped);
  };

  // Email must have @ and a proper domain (at least one dot after @, e.g. user@domain.com)
  const isValidEmail = (value) => {
    if (!value || typeof value !== 'string') return false;
    const trimmed = value.trim();
    const atIndex = trimmed.indexOf('@');
    if (atIndex <= 0) return false;
    const domain = trimmed.slice(atIndex + 1);
    if (!domain || !domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return false;
    const tld = domain.split('.').pop();
    return tld.length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  };

  // Username: 3–50 chars, alphanumeric and underscore only
  const isValidUsername = (value) => {
    if (!value || typeof value !== 'string') return false;
    const trimmed = value.trim();
    return trimmed.length >= 3 && trimmed.length <= 50 && /^[a-zA-Z0-9_]+$/.test(trimmed);
  };

  // Password: min 8 chars, at least one letter and one number
  const isValidPassword = (value, required = true) => {
    if (!value || typeof value !== 'string') return !required;
    const p = value;
    return p.length >= 8 && /\d/.test(p) && /[a-zA-Z]/.test(p);
  };

  const validateCreateForm = () => {
    const err = {};
    if (!formData.username?.trim()) err.username = 'Username is required.';
    else if (!isValidUsername(formData.username)) err.username = 'Username must be 3–50 characters and only letters, numbers, and underscores.';
    if (!formData.email?.trim()) err.email = 'Email is required.';
    else if (!isValidEmail(formData.email)) err.email = 'Please enter a valid email with a domain (e.g. name@domain.com).';
    if (!formData.password?.trim()) err.password = 'Password is required.';
    else if (!isValidPassword(formData.password, true)) err.password = 'Password must be at least 8 characters with at least one letter and one number.';
    if (!formData.icNumber?.trim()) err.icNumber = 'IC number is required.';
    else if (!isValidMalaysianIC(formData.icNumber)) err.icNumber = 'Please enter a valid Malaysian IC number (12 digits, e.g. 900101-01-1234).';
    if (!formData.role) err.role = 'Please select a role.';
    setFormErrors(err);
    return { valid: Object.keys(err).length === 0, errors: err };
  };

  const validateEditForm = () => {
    const err = {};
    if (!formData.username?.trim()) err.username = 'Username is required.';
    else if (!isValidUsername(formData.username)) err.username = 'Username must be 3–50 characters and only letters, numbers, and underscores.';
    if (!formData.email?.trim()) err.email = 'Email is required.';
    else if (!isValidEmail(formData.email)) err.email = 'Please enter a valid email with a domain (e.g. name@domain.com).';
    if (!formData.icNumber?.trim()) err.icNumber = 'IC number is required.';
    else if (!isValidMalaysianIC(formData.icNumber)) err.icNumber = 'Please enter a valid Malaysian IC number (12 digits, e.g. 900101-01-1234).';
    if (!formData.role) err.role = 'Please select a role.';
    if (!formData.status) err.status = 'Please select a status.';
    setFormErrors(err);
    return { valid: Object.keys(err).length === 0, errors: err };
  };

  // Check if current admin is superadmin
  const isSuperAdmin = admin?.role === 'superadmin';

  // Debounced search effect
  useEffect(() => {
    if (isSuperAdmin) {
      const timeoutId = setTimeout(() => {
        fetchUsers();
      }, 300); // 300ms delay for search
      
      return () => clearTimeout(timeoutId);
    }
  }, [isSuperAdmin, currentPage, searchTerm, filterRole, filterStatus, sortBy]);

  const getInitialCreateFormData = () => ({
    username: '',
    email: '',
    password: DEFAULT_ADMIN_PASSWORD,
    role: '',
    status: 'active',
    icNumber: '',
    permissions: []
  });

  // Listen for create admin event from parent dashboard
  useEffect(() => {
    const handleCreateAdmin = () => {
      setFormErrors({});
      setFormData(getInitialCreateFormData());
      setShowCreateModal(true);
    };

    window.addEventListener('createAdmin', handleCreateAdmin);
    return () => {
      window.removeEventListener('createAdmin', handleCreateAdmin);
    };
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setIsApplyingFilter(true);
      
      // Convert sortBy to server format
      // Default to name ascending when sortBy is empty (but show inactive icon)
      let serverSortBy = 'name';
      let serverSortOrder = 'asc';
      
      if (sortBy === 'name-asc') {
        serverSortBy = 'name';
        serverSortOrder = 'asc';
      } else if (sortBy === 'name-desc') {
        serverSortBy = 'name';
        serverSortOrder = 'desc';
      } else if (sortBy === 'role-asc') {
        serverSortBy = 'role';
        serverSortOrder = 'asc';
      } else if (sortBy === 'role-desc') {
        serverSortBy = 'role';
        serverSortOrder = 'desc';
      } else if (sortBy === 'status-asc') {
        serverSortBy = 'status';
        serverSortOrder = 'asc';
      } else if (sortBy === 'status-desc') {
        serverSortBy = 'status';
        serverSortOrder = 'desc';
      } else if (sortBy === 'activity-asc') {
        serverSortBy = 'activity';
        serverSortOrder = 'asc';
      } else if (sortBy === 'activity-desc') {
        serverSortBy = 'activity';
        serverSortOrder = 'desc';
      }
      
      const response = await adminApi.getAllAdminUsers(currentPage, 10, serverSortBy, serverSortOrder, searchTerm, filterRole, filterStatus);
      setUsers(response.data.users);
      setTotalPages(response.data.pagination.pages);
      setTotalCount(response.data.pagination.total ?? 0);
    } catch (error) {
      console.error('Error fetching admin users:', error);
    } finally {
      setLoading(false);
      setIsApplyingFilter(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const { valid } = validateCreateForm();
    if (!valid) {
      setShakeForm(true);
      setTimeout(() => setShakeForm(false), 500);
      return;
    }
    try {
      setLoading(true);
      const payload = { ...formData };
      if (!payload.permissions || payload.permissions.length === 0) {
        payload.permissions = ROLE_DEFAULT_PERMISSIONS[payload.role] || [];
      }
      await adminApi.createAdmin(payload);
      closeCreateModal();
      fetchUsers();
    } catch (error) {
      console.error('Error creating admin:', error);
      showAlertMessage('Error creating admin: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    const { valid } = validateEditForm();
    if (!valid) {
      setShakeForm(true);
      setTimeout(() => setShakeForm(false), 500);
      return;
    }
    try {
      setLoading(true);
      await adminApi.updateAdmin(selectedUser._id, formData);
      setShowEditModal(false);
      setSelectedUser(null);
      setFormErrors({});
      fetchUsers();
    } catch (error) {
      console.error('Error updating admin:', error);
      showAlertMessage('Error updating admin: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      setLoading(true);
      await adminApi.deleteAdmin(userToDelete._id);
      setShowDeleteModal(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting admin:', error);
      showAlertMessage('Error deleting admin: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (userId, newStatus) => {
    try {
      setLoading(true);
      await adminApi.updateUserStatus(userId, newStatus);
      fetchUsers();
    } catch (error) {
      console.error('Error updating admin status:', error);
      showAlertMessage('Error updating admin status: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedUsers.length === 0) return;

    let idsToUpdate = selectedUsers;
    if (bulkAction === 'suspend' && currentAdminId) {
      idsToUpdate = selectedUsers.filter((id) => String(id) !== String(currentAdminId));
      if (idsToUpdate.length === 0) {
        showAlertMessage('Cannot suspend your own account. Remove yourself from the selection.', 'error');
        return;
      }
    }

    try {
      setLoading(true);
      await adminApi.bulkUpdateUsers(idsToUpdate, { action: bulkAction });
      setSelectedUsers([]);
      setBulkAction('');
      fetchUsers();
    } catch (error) {
      console.error('Error performing bulk action on admins:', error);
      showAlertMessage('Error performing bulk action on admins: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (userId, isSelected) => {
    if (isSelected) {
      setSelectedUsers([...selectedUsers, userId]);
    } else {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    }
  };

  const handleSelectAll = (isSelected) => {
    if (isSelected) {
      setSelectedUsers(users.map(user => user._id));
    } else {
      setSelectedUsers([]);
    }
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setFormData(getInitialCreateFormData());
    setFormErrors({});
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormErrors({});
    setFormData({
      username: user.username || '',
      email: user.email || '',
      password: '',
      role: user.role || '',
      status: user.status || '',
      icNumber: user.icNumber || '',
      permissions: user.permissions || []
    });
    setShowEditModal(true);
  };

  const openDetailModal = (user) => {
    setSelectedUser(user);
    setLogExpanded(false);
    setAdminActivity([]);
    setShowDetailModal(true);
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

  // Server-side filtering and sorting, so we use users directly
  const filteredUsers = users;

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-green-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-600">You need superadmin privileges to access user management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      {/* Filters and Search - First Row */}
      <div className="bg-white/80 rounded-xl p-4 sm:p-6 shadow-lg border border-green-200 mb-6 mt-0 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by username or email..."
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div className="flex items-end">
              <div className="w-full px-4 py-2 text-sm text-gray-500 text-center">
                Search and filters are applied automatically
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedUsers.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-sm text-green-800">
                {selectedUsers.length} user(s) selected
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={bulkAction}
                  onChange={(e) => setBulkAction(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Select Action</option>
                  <option value="activate">Activate</option>
                  <option value="deactivate">Deactivate</option>
                  <option value="suspend">Suspend</option>
                  <option value="delete">Delete</option>
                </select>
                <button
                  onClick={handleBulkAction}
                  disabled={!bulkAction}
                  className="px-4 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
                >
                  Apply
                </button>
                <button
                  onClick={() => setSelectedUsers([])}
                  className="px-4 py-1 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Users Table - table full width, scroll container when narrow */}
        <div className="bg-white rounded-lg shadow min-w-0">
          <div className="overflow-x-auto min-w-0 w-full">
            <table className="w-full min-w-[900px] divide-y divide-gray-200 transition-all duration-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === users.length && users.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none w-1/4"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Admin User</span>
                      {getSortIcon('name')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none w-1/6"
                    onClick={() => handleSort('role')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Role</span>
                      {getSortIcon('role')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none w-1/6"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Status</span>
                      {getSortIcon('status')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none w-1/4"
                    onClick={() => handleSort('activity')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Last Login</span>
                      {getSortIcon('activity')}
                    </div>
                  </th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '7rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200" style={{ minHeight: '400px' }}>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading users...</p>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user, index) => (
                    <tr key={`${user._id}-${index}`} className={`hover:bg-gray-50 ${user._id === admin?.id ? 'bg-green-50' : ''}`}>
                      <td className="px-6 py-4 w-12">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user._id)}
                          onChange={(e) => handleUserSelect(user._id, e.target.checked)}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap w-1/4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                              <span className="text-sm font-medium text-green-600">
                                {user.username?.charAt(0).toUpperCase() || 'A'}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4 min-w-0 flex-1">
                            <div className="flex items-center space-x-2">
                              <div className="text-sm font-medium text-gray-900 truncate">{user.username}</div>
                              {user._id === admin?.id && (
                                <span className="px-2 py-1 text-xs font-semibold bg-green-600 text-white rounded-full flex-shrink-0">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 truncate">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap w-1/6">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.role === 'superadmin' 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {user.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap w-1/6">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.status === 'active' ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 w-1/4">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-2 sm:px-4 py-2 text-sm font-medium whitespace-nowrap align-top" style={{ minWidth: '7rem' }}>
                        <div className="flex flex-col items-start gap-0">
                          <button
                            onClick={() => openDetailModal(user)}
                            className="text-xs text-blue-600 hover:text-blue-900 py-0.5 block text-left"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => openEditModal(user)}
                            className="text-xs text-indigo-600 hover:text-indigo-900 py-0.5 block text-left"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => !isCurrentAdmin(user) && handleDeleteUser(user)}
                            disabled={isCurrentAdmin(user)}
                            className={`text-xs py-0.5 block text-left ${isCurrentAdmin(user) ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:text-red-900'}`}
                            title={isCurrentAdmin(user) ? 'Cannot delete your own account' : undefined}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 sm:px-6 py-4 border-t border-gray-200 min-w-0">
            <div className="flex flex-row items-center justify-between gap-3 flex-nowrap min-w-0">
              <div className="text-sm text-gray-700 flex items-center gap-2 flex-shrink-0">
                <span>Items:</span>
                <span className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md">{users.length}</span>
                <span>/</span>
                <span className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md">{totalCount}</span>
                <span className="ml-1 whitespace-nowrap">— Page {currentPage} of {totalPages}</span>
              </div>
              <nav className="flex items-center gap-2 flex-nowrap flex-shrink-0">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {totalPages > 1 && (
                  <form onSubmit={(e) => { e.preventDefault(); const n = parseInt(goToPageInput, 10); if (!isNaN(n) && n >= 1 && n <= totalPages) { setCurrentPage(n); setGoToPageInput(''); } }}>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={goToPageInput}
                      onChange={(e) => setGoToPageInput(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      className="w-12 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center"
                      placeholder={currentPage}
                      aria-label="Page number"
                    />
                  </form>
                )}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>

      {/* Create Admin Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative p-0 border w-full max-w-[672px] shadow-xl rounded-lg bg-white max-h-[90vh] flex flex-col overflow-hidden min-w-0">
            {/* Header - Fixed */}
            <div className="bg-green-600 px-6 py-4 rounded-t-lg flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Create New Admin</h3>
                <button
                  onClick={closeCreateModal}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Form - Scrollable */}
            <form onSubmit={handleCreateUser} className={`p-6 space-y-6 overflow-y-auto flex-1 ${shakeForm ? 'form-shake' : ''}`}>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => { setFormData({...formData, username: e.target.value}); setFormErrors((prev) => ({ ...prev, username: '' })); }}
                    placeholder="Enter username (3–50 chars, letters, numbers, underscore)"
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all ${formErrors.username ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {formErrors.username && <p className="mt-1 text-sm text-red-600">{formErrors.username}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={(e) => { setFormData({...formData, email: e.target.value}); setFormErrors((prev) => ({ ...prev, email: '' })); }}
                    placeholder="e.g. admin@example.com"
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all ${formErrors.email ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {formErrors.email && <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    readOnly
                    className="w-full px-4 py-3 border rounded-lg bg-gray-200 border-gray-400 text-gray-500 cursor-not-allowed"
                    aria-label="Default admin password (read-only)"
                  />
                  <p className="mt-1 text-xs text-gray-500">Default for all new admins. They can change it via Forgot password on the login page.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    IC Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.icNumber}
                    onChange={(e) => { setFormData({...formData, icNumber: e.target.value}); setFormErrors((prev) => ({ ...prev, icNumber: '' })); }}
                    placeholder="e.g. 900101-01-1234 or 900101011234 (12 digits)"
                    maxLength={14}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all ${formErrors.icNumber ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {formErrors.icNumber && <p className="mt-1 text-sm text-red-600">{formErrors.icNumber}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => { setFormData({...formData, role: e.target.value}); setFormErrors((prev) => ({ ...prev, role: '' })); }}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all min-w-0 ${formErrors.role ? 'border-red-500' : 'border-gray-300'}`}
                  >
                    <option value="">Select Role</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                  {formErrors.role && <p className="mt-1 text-sm text-red-600">{formErrors.role}</p>}
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center space-x-2"
                >
                  {loading && (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  <span>{loading ? 'Creating...' : 'Create Admin'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative p-4 sm:p-6 border w-full max-w-[672px] shadow-lg rounded-md bg-white min-w-0">
            <div className="mt-3 min-w-0">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Admin</h3>
              <form onSubmit={handleUpdateUser} className={`space-y-4 ${shakeForm ? 'form-shake' : ''}`}>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Username <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.username}
                    readOnly
                    className="mt-1 block w-full px-3 py-2 border rounded-md bg-gray-200 border-gray-400 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.email}
                    readOnly
                    className="mt-1 block w-full px-3 py-2 border rounded-md bg-gray-200 border-gray-400 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">IC Number <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.icNumber}
                    readOnly
                    className="mt-1 block w-full px-3 py-2 border rounded-md bg-gray-200 border-gray-400 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role <span className="text-red-500">*</span></label>
                  <select
                    value={formData.role}
                    onChange={(e) => { setFormData({...formData, role: e.target.value}); setFormErrors((prev) => ({ ...prev, role: '' })); }}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${formErrors.role ? 'border-red-500' : 'border-gray-300'}`}
                  >
                    <option value="admin">Admin</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                  {formErrors.role && <p className="mt-1 text-sm text-red-600">{formErrors.role}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status <span className="text-red-500">*</span></label>
                  <select
                    value={formData.status}
                    onChange={(e) => { setFormData({...formData, status: e.target.value}); setFormErrors((prev) => ({ ...prev, status: '' })); }}
                    disabled={isCurrentAdmin(selectedUser)}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${formErrors.status ? 'border-red-500' : 'border-gray-300'} ${isCurrentAdmin(selectedUser) ? 'bg-gray-200 border-gray-400 text-gray-500 cursor-not-allowed' : ''}`}
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                  {formErrors.status && <p className="mt-1 text-sm text-red-600">{formErrors.status}</p>}
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    {loading ? 'Updating...' : 'Update Admin'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative p-4 sm:p-6 border w-full max-w-[672px] shadow-lg rounded-md bg-white min-w-0">
            <div className="mt-3 min-w-0">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Admin Details</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-2xl font-medium text-green-600">
                      {selectedUser.username?.charAt(0).toUpperCase() || 'A'}
                    </span>
                  </div>
                  <div>
                    <div className="text-lg font-medium text-gray-900">{selectedUser.username}</div>
                    <div className="text-sm text-gray-500">{selectedUser.email}</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <span className={`mt-1 inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedUser.role === 'superadmin' 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {selectedUser.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <span className={`mt-1 inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedUser.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : selectedUser.status === 'suspended'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {selectedUser.status || 'Active'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">IC Number</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedUser.icNumber || 'Not provided'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Permissions</label>
                  <div className="mt-1">
                    {(() => {
                      const hasExplicit = selectedUser.permissions && selectedUser.permissions.length > 0;
                      const rawList = hasExplicit
                        ? selectedUser.permissions
                        : (ROLE_DEFAULT_PERMISSIONS[selectedUser.role] || []);
                      const displayList = rawList.filter((p) =>
                        ALL_PERMISSIONS.some((m) => m.key === p)
                      );
                      if (displayList.length === 0) {
                        return <p className="text-sm text-gray-500">No specific permissions assigned</p>;
                      }
                      return (
                        <>
                          <div className="flex flex-wrap gap-1">
                            {displayList.map((permission, index) => {
                              const meta = ALL_PERMISSIONS.find((p) => p.key === permission);
                              return (
                                <span key={index} title={meta?.desc || ''} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full cursor-default">
                                  {meta?.label || permission.replace(/_/g, ' ')}
                                </span>
                              );
                            })}
                          </div>
                          {selectedUser.role === 'superadmin' && (
                            <p className="mt-1.5 text-xs text-gray-500">
                              Super Admin has full access to all features regardless of permissions.
                            </p>
                          )}
                          {!hasExplicit && selectedUser.role !== 'superadmin' && (
                            <p className="mt-1.5 text-xs text-gray-500">
                              Default permissions for Admin role
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Created At</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Login</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString() : 'Never'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">MFA Status</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedUser.mfaEnabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>

                {/* Log (collapsible, collapsed by default) */}
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <button
                    type="button"
                    onClick={async () => {
                      const next = !logExpanded;
                      setLogExpanded(next);
                      if (next && selectedUser?._id && adminActivity.length === 0) {
                        setActivityLoading(true);
                        try {
                          const res = await adminApi.getAdminActivity(selectedUser._id);
                          setAdminActivity(res.data?.activities ?? []);
                        } catch {
                          setAdminActivity([]);
                        } finally {
                          setActivityLoading(false);
                        }
                      }
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100"
                  >
                    <span>Log</span>
                    <svg className={`w-4 h-4 text-gray-500 transition-transform ${logExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {logExpanded && (
                    <div className="px-3 py-3 bg-white border-t border-gray-200 max-h-64 overflow-y-auto">
                      <p className="text-xs text-gray-500 mb-3">Actions performed by this admin (e.g. add/update/delete admin, restrict user).</p>
                      {activityLoading ? (
                        <p className="text-sm text-gray-500">Loading...</p>
                      ) : adminActivity.length === 0 ? (
                        <p className="text-sm text-gray-500">No activity recorded.</p>
                      ) : (
                        <div className="space-y-2">
                          {adminActivity.map((a, i) => (
                            <div key={i} className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center justify-between gap-4 mb-1">
                                <span className="font-medium text-gray-900 text-sm">{formatActionLabel(a.action)}</span>
                                <span className="text-xs text-gray-500 shrink-0">
                                  {a.timestamp ? new Date(a.timestamp).toLocaleString() : ''}
                                </span>
                              </div>
                              <p className="text-gray-700 text-sm">{formatActivityDescription(a.description)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    openEditModal(selectedUser);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Edit Admin
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative p-4 sm:p-6 border w-full max-w-[448px] shadow-lg rounded-md bg-white min-w-0">
            <div className="mt-3 min-w-0">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">Delete Admin User</h3>
              <p className="text-sm text-gray-500 text-center mb-6 break-words">
                Are you sure you want to delete <strong>{userToDelete.username}</strong>? 
                This action cannot be undone and should only be used for cases like misadding users.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> For normal admin departures, consider changing status to "Suspended" instead of deleting.
                </p>
              </div>
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setUserToDelete(null);
                  }}
                  className="min-w-[140px] px-6 py-2.5 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteUser}
                  disabled={loading}
                  className="min-w-[140px] px-6 py-2.5 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 font-medium"
                >
                  {loading ? 'Deleting...' : 'Delete Admin'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-App Alert Modal */}
      {showAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 min-w-0">
            <div className="p-4 sm:p-6">
              <div className="flex items-center">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  alertType === 'error' ? 'bg-red-100' : 
                  alertType === 'success' ? 'bg-green-100' : 
                  'bg-yellow-100'
                }`}>
                  {alertType === 'error' ? (
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : alertType === 'success' ? (
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <div className="ml-4">
                  <h3 className={`text-lg font-medium ${
                    alertType === 'error' ? 'text-red-900' : 
                    alertType === 'success' ? 'text-green-900' : 
                    'text-yellow-900'
                  }`}>
                    {alertType === 'error' ? 'Error' : 
                     alertType === 'success' ? 'Success' : 
                     'Warning'}
                  </h3>
                  <p className={`mt-1 text-sm ${
                    alertType === 'error' ? 'text-red-700' : 
                    alertType === 'success' ? 'text-green-700' : 
                    'text-yellow-700'
                  }`}>
                    {alertMessage}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowAlert(false)}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    alertType === 'error' ? 'bg-red-600 hover:bg-red-700 text-white' : 
                    alertType === 'success' ? 'bg-green-600 hover:bg-green-700 text-white' : 
                    'bg-yellow-600 hover:bg-yellow-700 text-white'
                  }`}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserManagement;
