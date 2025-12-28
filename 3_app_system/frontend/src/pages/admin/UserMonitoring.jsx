import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminApi';

const UserMonitoring = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userActivities, setUserActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalActivities, setTotalActivities] = useState(0);
  const activitiesPerPage = 10;

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setError(null);
    try {
      console.log('Searching for:', searchTerm);
      const response = await adminApi.searchUsers(searchTerm);
      console.log('Search response:', response.data);
      setSearchResults(response.data);
    } catch (err) {
      setError('Failed to search users. Please try again.');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = async (user) => {
    console.log('Selecting user:', user);
    setSelectedUser(user);
    setCurrentPage(1); // Reset to first page
    await fetchUserActivities(user._id, 1);
  };

  const fetchUserActivities = async (userId, page = 1) => {
    try {
      console.log('Fetching activities for user:', userId, 'page:', page);
      const response = await adminApi.getUserActivities(userId, page, activitiesPerPage);
      console.log('Activities response:', response.data);
      setUserActivities(response.data.activities || []);
      setTotalPages(Number(response.data.pagination?.totalPages) || 1);
      setTotalActivities(Number(response.data.pagination?.totalActivities) || 0);
      console.log('Set totalPages:', Number(response.data.pagination?.totalPages) || 1);
      console.log('Set totalActivities:', Number(response.data.pagination?.totalActivities) || 0);
    } catch (err) {
      console.error('Failed to fetch user activities:', err);
      setUserActivities([]);
      setTotalPages(1);
      setTotalActivities(0);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      if (selectedUser) {
        fetchUserActivities(selectedUser._id, newPage);
      }
    }
  };

  const handleRestrictUser = async (userId) => {
    try {
      await adminApi.restrictUser(userId);
      setSelectedUser(prev => ({ ...prev, isRestricted: true }));
      // Refresh activities to show the restriction action
      await fetchUserActivities(userId, currentPage);
    } catch (err) {
      console.error('Failed to restrict user:', err);
    }
  };

  const handleUnrestrictUser = async (userId) => {
    try {
      await adminApi.unrestrictUser(userId);
      setSelectedUser(prev => ({ ...prev, isRestricted: false }));
      // Refresh activities to show the unrestriction action
      await fetchUserActivities(userId, currentPage);
    } catch (err) {
      console.error('Failed to unrestrict user:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Users</h3>
        <form onSubmit={handleSearch} className="flex gap-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, or ID..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
        
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Search Results</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {searchResults.map((user) => (
              <div key={user._id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="text-lg font-medium text-gray-900">{user.username || user.name}</h4>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <p className="text-sm text-gray-500">ID: {user._id}</p>
                    {user.isRestricted && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Restricted
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleUserSelect(user)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Select User
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected User Details */}
      {selectedUser && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">User Details</h3>
                <p className="text-sm text-gray-600">{selectedUser.username || selectedUser.name} ({selectedUser.email})</p>
              </div>
              <div className="flex gap-2">
                {selectedUser.isRestricted ? (
                  <button
                    onClick={() => handleUnrestrictUser(selectedUser._id)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Unrestrict User
                  </button>
                ) : (
                  <button
                    onClick={() => handleRestrictUser(selectedUser._id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Restrict User
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* User Activities */}
          <div className="p-6">
            <h4 className="text-md font-semibold text-gray-900 mb-4">User Activities</h4>
            
            {userActivities.length > 0 ? (
              <>
                <div className="space-y-4">
                  {userActivities.map((activity, index) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                          <p className="text-sm text-gray-600">{activity.description}</p>
                        </div>
                        <span className="text-xs text-gray-500">{activity.timestamp}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing <span className="font-semibold">{Math.max(1, ((currentPage - 1) * activitiesPerPage) + 1)}</span> to{' '}
                    <span className="font-semibold">{Math.min(currentPage * activitiesPerPage, totalActivities || 0)}</span> of{' '}
                    <span className="font-semibold">{totalActivities || 0}</span> activities
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    
                    <div className="flex space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = i + 1;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-3 py-1 text-sm border rounded-md ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-center py-4">No activities found for this user.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMonitoring;