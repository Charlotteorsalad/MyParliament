import React, { useState, useEffect, useMemo } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth.jsx';
import { adminApi } from '../../api';
import { useSSEEvent } from '../../contexts/SSEContext';

const UserManagement = () => {
  const { admin } = useAdminAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('');
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('error'); // 'error', 'success', 'warning'
  const [goToPageInput, setGoToPageInput] = useState('');

  // Helper function to show alerts
  const showAlertMessage = (message, type = 'error') => {
    setAlertMessage(message);
    setAlertType(type);
    setShowAlert(true);
  };

  const hasManageUsers = admin?.role === 'superadmin' || (Array.isArray(admin?.permissions) && admin.permissions.includes('manage_users'));
  const [sseKey, setSseKey] = useState(0);

  // Real-time: when a new user registers, refresh the list automatically
  useSSEEvent('user_registered', () => setSseKey((k) => k + 1));

  // Debounced search effect
  useEffect(() => {
    if (hasManageUsers) {
      const timeoutId = setTimeout(() => {
        fetchUsers();
      }, 300); // 300ms delay for search
      
      return () => clearTimeout(timeoutId);
    }
  }, [hasManageUsers, currentPage, searchTerm, filterStatus, sortBy, sseKey]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setIsApplyingFilter(true);
      
      // Convert sortBy to server format
      // Default to name ascending if no sortBy specified
      let serverSortBy = 'name';
      let serverSortOrder = 'asc';
      
      if (sortBy === 'name-asc') {
        serverSortBy = 'name';
        serverSortOrder = 'asc';
      } else if (sortBy === 'name-desc') {
        serverSortBy = 'name';
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
      
      const response = await adminApi.getAllUsers(currentPage, 10, serverSortBy, serverSortOrder, searchTerm, filterStatus);
      setUsers(response.data.users);
      setTotalPages(response.data.pagination.pages);
      setTotalCount(response.data.pagination.total ?? 0);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
      setIsApplyingFilter(false);
    }
  };




  const handleStatusChange = async (userId, newStatus) => {
    try {
      setLoading(true);
      await adminApi.updateUserStatus(userId, newStatus);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      showAlertMessage('Error updating user status: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };



  const openDetailModal = (user) => {
    setSelectedUser(user);
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

  if (!hasManageUsers) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access user management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
        {/* Search and Filters - First Row */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 mt-0 min-w-0">
          <div className="p-4 sm:p-6">
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="restricted">Restricted</option>
                </select>
              </div>
              <div className="flex items-end">
                <div className="w-full px-4 py-2 text-sm text-gray-500 text-center">
                  Search and filters are applied automatically
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* Users Table - table full width, scroll container when narrow */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 min-w-0">
          <div className="overflow-x-auto min-w-0 w-full">
            <table className="w-full min-w-[720px] divide-y divide-gray-200 transition-all duration-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none w-1/3"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>User</span>
                      {getSortIcon('name')}
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
                  <th className="px-2 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '7rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200" style={{ minHeight: '400px' }}>
                 {loading ? (
                   <tr>
                     <td colSpan="4" className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-gray-600">Loading users...</span>
                      </div>
                    </td>
                  </tr>
                 ) : filteredUsers.length === 0 ? (
                   <tr>
                     <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                       No users found
                     </td>
                   </tr>
                ) : (
                  filteredUsers.map((user, index) => (
                    <tr key={`${user._id}-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap w-1/3">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-sm font-medium text-blue-600">
                                {(user.profile?.firstName || user.profile?.lastName || user.username)?.charAt(0) || 'U'}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4 min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {(user.profile?.firstName || user.profile?.lastName) ? [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(' ') : user.username}
                            </div>
                            <div className="text-sm text-gray-500 truncate">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap w-1/6">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : user.status === 'suspended'
                              ? 'bg-red-100 text-red-800'
                              : user.status === 'restricted'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {user.status === 'active'
                            ? 'Active'
                            : user.status === 'suspended'
                            ? 'Suspended'
                            : user.status === 'restricted'
                            ? 'Restricted'
                            : (user.status || 'Active')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 w-1/4">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-sm font-medium align-top" style={{ minWidth: '7rem' }}>
                        <div className="flex flex-col items-center justify-center gap-0">
                          <button
                            onClick={() => openDetailModal(user)}
                            className="text-xs text-blue-600 hover:text-blue-900 py-0.5 block text-center"
                          >
                            View
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
                <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                {totalPages > 1 && (
                  <form onSubmit={(e) => { e.preventDefault(); const n = parseInt(goToPageInput, 10); if (!isNaN(n) && n >= 1 && n <= totalPages) { setCurrentPage(n); setGoToPageInput(''); } }}>
                    <input type="number" min={1} max={totalPages} value={goToPageInput} onChange={(e) => setGoToPageInput(e.target.value.replace(/\D/g, '').slice(0, 5))} className="w-12 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center" placeholder={currentPage} aria-label="Page number" />
                  </form>
                )}
                <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
              </nav>
            </div>
          </div>
        </div>


             {/* Detail Modal */}
             {showDetailModal && selectedUser && (
               <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
                 <div className="relative p-4 sm:p-6 border w-full max-w-[672px] shadow-lg rounded-md bg-white min-w-0">
                   <div className="mt-3 min-w-0">
                     <h3 className="text-lg font-medium text-gray-900 mb-4">User Overview</h3>
                     <div className="space-y-4">
                       <div className="flex items-center space-x-3">
                         <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                           <span className="text-2xl font-bold text-blue-600">
                             {(selectedUser.profile?.firstName || selectedUser.profile?.lastName || selectedUser.username)?.charAt(0) || 'U'}
                           </span>
                         </div>
                         <div>
                           <h4 className="text-xl font-semibold text-gray-900">
                             {(selectedUser.profile?.firstName || selectedUser.profile?.lastName) ? [selectedUser.profile?.firstName, selectedUser.profile?.lastName].filter(Boolean).join(' ') : selectedUser.username}
                           </h4>
                           <p className="text-gray-600">Email: {selectedUser.email || '—'}</p>
                         </div>
                       </div>

                       <div>
                         <label className="block text-sm font-medium text-gray-700">Status</label>
                         <span className={`mt-1 inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                           selectedUser.status === 'active'
                             ? 'bg-green-100 text-green-800'
                             : selectedUser.status === 'suspended'
                             ? 'bg-red-100 text-red-800'
                             : selectedUser.status === 'restricted'
                             ? 'bg-yellow-100 text-yellow-800'
                             : 'bg-gray-100 text-gray-800'
                         }`}>
                           {selectedUser.status === 'active' ? 'Active' : selectedUser.status === 'suspended' ? 'Suspended' : selectedUser.status === 'restricted' ? 'Restricted' : (selectedUser.status || 'Active')}
                         </span>
                       </div>

                       <div>
                         <label className="block text-sm font-medium text-gray-700">Last Activity</label>
                         <p className="mt-1 text-sm text-gray-900">
                           {selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString() : 'Never'}
                         </p>
                       </div>

                       <div>
                         <label className="block text-sm font-medium text-gray-700">Account Created</label>
                         <p className="mt-1 text-sm text-gray-900">
                           {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : 'Unknown'}
                         </p>
                       </div>
                     </div>

                     <div className="flex justify-end space-x-3 pt-6">
                       <button
                         onClick={() => setShowDetailModal(false)}
                         className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                       >
                         Close
                       </button>
                     </div>
                   </div>
                 </div>
               </div>
             )}

      {/* In-App Alert Modal */}
      {showAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
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

export default UserManagement;
