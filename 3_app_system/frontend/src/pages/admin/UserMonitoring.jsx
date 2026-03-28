import React, { useState, useEffect, useMemo } from 'react';
import { adminApi } from '../../api/adminApi';
import { DatePickerField } from '../../components/ui';

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
  const [goToPageInput, setGoToPageInput] = useState('');
  const activitiesPerPage = 10;

  // Restrict user modal
  const [showRestrictModal, setShowRestrictModal] = useState(false);
  const [restrictUntil, setRestrictUntil] = useState('');
  const [restrictReason, setRestrictReason] = useState('');
  const [restrictSubmitting, setRestrictSubmitting] = useState(false);
  const [restrictError, setRestrictError] = useState(null);
  const [suspendSubmitting, setSuspendSubmitting] = useState(false);
  const [suspendError, setSuspendError] = useState(null);
  const [showSuspendModal, setShowSuspendModal] = useState(false);

  const runSearch = async (term) => {
    if (!term || term.trim().length < 2) {
      setSearchResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.searchUsers(term.trim());
      setSearchResults(response.data);
    } catch (err) {
      setError('Failed to search users. Please try again.');
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Real-time search with debounce (same as User list — 300ms)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      runSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleUserSelect = async (user) => {
    setSelectedUser(user);
    setCurrentPage(1); // Reset to first page
    await fetchUserActivities(user._id, 1);
  };

  const fetchUserActivities = async (userId, page = 1) => {
    try {
      const response = await adminApi.getUserActivities(userId, page, activitiesPerPage);
      const data = response.data;
      setUserActivities(data.activities || []);
      const pagination = data.pagination || {};
      setTotalPages(Number(pagination.totalPages) || 1);
      setTotalActivities(Number(pagination.total) ?? 0);
      // Merge real user data from API into selected user so User Details shows current state
      if (data.user) {
        setSelectedUser(prev => prev && String(prev._id) === String(data.user._id) ? { ...prev, ...data.user } : prev);
      }
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

  const toDateTimeLocal = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}:${min}`;
  };

  const formatDateTimeAMPM = (dateTimeStr) => {
    if (!dateTimeStr) return '';
    const d = new Date(dateTimeStr);
    const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${date} at ${time}`;
  };

  const restrictMinDate = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const openRestrictModal = () => {
    const defaultUntil = new Date();
    defaultUntil.setDate(defaultUntil.getDate() + 30);
    defaultUntil.setHours(23, 59, 0, 0);
    setRestrictUntil(toDateTimeLocal(defaultUntil));
    setRestrictReason('');
    setRestrictError(null);
    setShowRestrictModal(true);
  };

  const closeRestrictModal = () => {
    setShowRestrictModal(false);
    setRestrictUntil('');
    setRestrictReason('');
    setRestrictSubmitting(false);
    setRestrictError(null);
  };

  const handleRestrictConfirm = async () => {
    if (!selectedUser) return;
    const chosen = restrictUntil ? new Date(restrictUntil) : null;
    if (!restrictUntil || !chosen.getTime() || chosen <= new Date()) {
      setRestrictError('Please choose a future date and time for Restrict until.');
      return;
    }
    setRestrictError(null);
    setRestrictSubmitting(true);
    try {
      const response = await adminApi.restrictUser(selectedUser._id, {
        endDate: new Date(restrictUntil).toISOString(),
        reason: restrictReason.trim() || undefined
      });
      const updated = response.data?.user;
      if (updated) {
        setSelectedUser(prev => ({ ...prev, ...updated }));
      } else {
        setSelectedUser(prev => ({ ...prev, isRestricted: true }));
      }
      closeRestrictModal();
      await fetchUserActivities(selectedUser._id, currentPage);
    } catch (err) {
      console.error('Failed to restrict user:', err);
      setRestrictError(err.response?.data?.message || 'Failed to restrict user. Please try again.');
    } finally {
      setRestrictSubmitting(false);
    }
  };

  const handleSuspendUser = async (userId) => {
    setSuspendError(null);
    setSuspendSubmitting(true);
    try {
      await adminApi.suspendUser(userId);
      setShowSuspendModal(false);
      setSelectedUser(prev => prev && String(prev._id) === String(userId) ? { ...prev, status: 'suspended' } : prev);
      await fetchUserActivities(userId, currentPage);
    } catch (err) {
      console.error('Failed to suspend user:', err);
      setSuspendError(err.response?.data?.message || 'Failed to suspend user.');
    } finally {
      setSuspendSubmitting(false);
    }
  };

  const handleUnsuspendUser = async (userId) => {
    setSuspendError(null);
    setSuspendSubmitting(true);
    try {
      await adminApi.unsuspendUser(userId);
      setSelectedUser(prev => prev && String(prev._id) === String(userId) ? { ...prev, status: 'active' } : prev);
      await fetchUserActivities(userId, currentPage);
    } catch (err) {
      console.error('Failed to unsuspend user:', err);
      setSuspendError(err.response?.data?.message || 'Failed to unsuspend user.');
    } finally {
      setSuspendSubmitting(false);
    }
  };

  const handleActivateUser = async (userId) => {
    setError(null);
    setSuspendError(null);
    setSuspendSubmitting(true);
    try {
      const user = selectedUser;
      if (user?.isRestricted) await adminApi.unrestrictUser(userId);
      if (user?.status === 'suspended') await adminApi.unsuspendUser(userId);
      setSelectedUser(prev => prev && String(prev._id) === String(userId) ? { ...prev, status: 'active', isRestricted: false, restrictionEndDate: null, restrictionReason: null } : prev);
      await fetchUserActivities(userId, currentPage);
    } catch (err) {
      console.error('Failed to activate user:', err);
      setSuspendError(err.response?.data?.message || 'Failed to activate user.');
    } finally {
      setSuspendSubmitting(false);
    }
  };

  const handleUnrestrictUser = async (userId) => {
    setError(null);
    try {
      const response = await adminApi.unrestrictUser(userId);
      const updated = response.data?.user;
      if (updated) {
        setSelectedUser(prev => ({ ...prev, ...updated }));
      } else {
        setSelectedUser(prev => ({ ...prev, isRestricted: false }));
      }
      await fetchUserActivities(userId, currentPage);
    } catch (err) {
      console.error('Failed to unrestrict user:', err);
      setError(err.response?.data?.message || 'Failed to unrestrict user. Please try again.');
    }
  };

  return (
    <div className="space-y-6 min-w-0 max-w-full overflow-x-hidden">
      {/* Search Section */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 min-w-0">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Users</h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or email (min 2 characters)..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-label="Search users"
          />
          {loading && (
            <span className="flex items-center text-sm text-gray-500">Searching...</span>
          )}
        </div>
        
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-white rounded-lg shadow min-w-0">
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Search Results</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {searchResults.map((user) => (
              <div key={user._id} className="p-4 sm:p-6 hover:bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-lg font-medium text-gray-900">{user.username || user.name}</h4>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <p className="text-sm text-gray-500">ID: {user._id}</p>
                    {user.status === 'suspended' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-white">
                        Suspended
                      </span>
                    )}
                    {user.isRestricted && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Restricted
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleUserSelect(user)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex-shrink-0"
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
        <div className="bg-white rounded-lg shadow min-w-0">
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-gray-900">User Details</h3>
                <p className="text-sm text-gray-600 mt-1">{selectedUser.username || selectedUser.name} ({selectedUser.email})</p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-500">
                  <span><strong className="text-gray-700">Status:</strong> {selectedUser.status || (selectedUser.isRestricted ? 'restricted' : 'active')}</span>
                  <span><strong className="text-gray-700">Last login:</strong> {selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString() : 'Never'}</span>
                  <span><strong className="text-gray-700">Joined:</strong> {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : '—'}</span>
                  {selectedUser.isRestricted && selectedUser.restrictionEndDate && (
                    <span><strong className="text-gray-700">Restriction until:</strong> {new Date(selectedUser.restrictionEndDate).toLocaleDateString()}</span>
                  )}
                  {selectedUser.isRestricted && selectedUser.restrictionReason && (
                    <span className="w-full"><strong className="text-gray-700">Reason:</strong> {selectedUser.restrictionReason}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 flex-shrink-0">
                {suspendError && (
                  <div className="w-full text-sm text-red-600">{suspendError}</div>
                )}
                {(selectedUser.status === 'suspended' || selectedUser.isRestricted) ? (
                  <button
                    onClick={() => handleActivateUser(selectedUser._id)}
                    disabled={suspendSubmitting}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {suspendSubmitting ? 'Activating…' : 'Change to activate'}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={openRestrictModal}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                    >
                      Restrict User
                    </button>
                    <button
                      onClick={() => setShowSuspendModal(true)}
                      disabled={suspendSubmitting}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      title="Permanent ban: user cannot log in until unsuspended"
                    >
                      Suspend User
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* User Activities */}
          <div className="p-4 sm:p-6 min-w-0">
            <h4 className="text-md font-semibold text-gray-900 mb-4">User Activities</h4>
            
            {userActivities.length > 0 ? (
              <>
                <div className="space-y-4 min-w-0 overflow-x-auto">
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
                <div className="mt-6 flex flex-row items-center justify-between gap-3 flex-nowrap min-w-0">
                  <div className="text-sm text-gray-700 flex-shrink-0 whitespace-nowrap">
                    Showing <span className="font-semibold">{Math.max(1, ((currentPage - 1) * activitiesPerPage) + 1)}</span> to <span className="font-semibold">{Math.min(currentPage * activitiesPerPage, totalActivities || 0)}</span> of <span className="font-semibold">{totalActivities || 0}</span> activities
                  </div>
                  <div className="flex items-center gap-2 flex-nowrap flex-shrink-0">
                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                    {totalPages > 1 && (
                      <form onSubmit={(e) => { e.preventDefault(); const n = parseInt(goToPageInput, 10); if (!isNaN(n) && n >= 1 && n <= totalPages) { handlePageChange(n); setGoToPageInput(''); } }}>
                        <input type="number" min={1} max={totalPages} value={goToPageInput} onChange={(e) => setGoToPageInput(e.target.value.replace(/\D/g, '').slice(0, 5))} className="w-12 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center" placeholder={currentPage} aria-label="Page number" />
                      </form>
                    )}
                    <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-center py-4">No activities found for this user.</p>
            )}
          </div>
        </div>
      )}

      {/* Suspend User confirmation modal */}
      {showSuspendModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-[480px] min-w-0" role="dialog" aria-labelledby="suspend-modal-title" aria-modal="true">
            <div className="px-4 sm:px-6 py-5 border-b border-gray-200">
              <h3 id="suspend-modal-title" className="text-xl font-semibold text-gray-900">Suspend User</h3>
              <p className="text-sm text-gray-600 mt-1">
                Suspend <strong>{selectedUser.username || selectedUser.name}</strong> permanently? They will not be able to log in again until you unsuspend them.
              </p>
            </div>
            <div className="px-4 sm:px-6 py-5 flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowSuspendModal(false)}
                disabled={suspendSubmitting}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSuspendUser(selectedUser._id)}
                disabled={suspendSubmitting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {suspendSubmitting ? 'Suspending…' : 'Confirm suspend'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restrict User confirmation modal - 600px width */}
      {showRestrictModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-[600px] min-w-0" role="dialog" aria-labelledby="restrict-modal-title" aria-modal="true">
            <div className="px-4 sm:px-6 py-5 border-b border-gray-200">
              <h3 id="restrict-modal-title" className="text-xl font-semibold text-gray-900">Restrict User</h3>
              <p className="text-sm text-gray-600 mt-1">Confirm restriction for <strong>{selectedUser.username || selectedUser.name}</strong>. This will be recorded and the user will be notified with your note.</p>
            </div>
            <div className="px-4 sm:px-6 py-5 space-y-5 min-w-0">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Restrict until (date &amp; time)</label>
                <div className="flex gap-2 items-end">
                  <div className="flex-1 min-w-0">
                    <DatePickerField
                      value={restrictUntil ? new Date(restrictUntil.slice(0, 10) + 'T12:00:00') : null}
                      onChange={(d) => {
                        const dateStr = d ? d.toISOString().slice(0, 10) : '';
                        const timeStr = restrictUntil ? restrictUntil.slice(11, 16) : '00:00';
                        setRestrictUntil(dateStr ? dateStr + 'T' + timeStr : '');
                      }}
                      minDate={restrictMinDate}
                      placeholder="DD/MM/YYYY"
                    />
                  </div>
                  <input
                    id="restrict-until-time"
                    type="time"
                    value={restrictUntil ? restrictUntil.slice(11, 16) : ''}
                    onChange={(e) => {
                      const t = e.target.value;
                      const d = restrictUntil ? restrictUntil.slice(0, 10) : new Date().toISOString().slice(0, 10);
                      setRestrictUntil(d + 'T' + t);
                    }}
                    min={restrictUntil && restrictUntil.slice(0, 10) === new Date().toISOString().slice(0, 10)
                      ? (() => {
                          const n = new Date(Date.now() + 60000);
                          return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
                        })()
                      : undefined
                    }
                    step="60"
                    className="flex-shrink-0 w-28 px-4 py-3 border border-gray-300 rounded-lg text-base text-gray-900 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors shadow-sm"
                  />
                </div>
                {restrictUntil && (
                  <p className="text-sm text-gray-500">
                    Selected: <span className="font-medium text-gray-700">{formatDateTimeAMPM(restrictUntil)}</span>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="restrict-reason" className="block text-sm font-medium text-gray-700">Reason (note to user &amp; admin record)</label>
                <textarea
                  id="restrict-reason"
                  value={restrictReason}
                  onChange={(e) => setRestrictReason(e.target.value)}
                  placeholder="e.g. Violation of community guidelines..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base text-gray-900 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none transition-colors shadow-sm"
                />
              </div>
              {restrictError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{restrictError}</div>
              )}
            </div>
            <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex flex-wrap gap-3 justify-end bg-gray-50/50 rounded-b-xl">
              <button
                type="button"
                onClick={closeRestrictModal}
                disabled={restrictSubmitting}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 shadow-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestrictConfirm}
                disabled={restrictSubmitting}
                className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 shadow-sm"
              >
                {restrictSubmitting ? 'Restricting…' : 'Confirm restrict'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMonitoring;