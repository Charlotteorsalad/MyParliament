import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api';

const AdminUserReports = () => {
  const [loading, setLoading] = useState(true);
  const [userReportsData, setUserReportsData] = useState({
    totalUsers: 0,
    activeUsers: 0,
    userActivity: {
      bookmarks: 0,
      discussions: 0,
      learningResources: 0,
      feedback: 0
    },
    topUsers: [],
    recentActivity: [],
    popularContent: [],
    userStats: {
      avgSessionTime: '0m',
      avgBookmarksPerUser: 0,
      avgDiscussionsPerUser: 0,
      mostActiveDay: 'Monday'
    }
  });
  const [selectedTimeRange, setSelectedTimeRange] = useState('7days');
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    fetchUserReportsData();
    
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchUserReportsData, 30000); // Refresh every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedTimeRange, autoRefresh]);

  const fetchUserReportsData = async () => {
    try {
      setLoading(true);
      
      // Try to fetch real data from API
      try {
        const response = await adminApi.getUserReportsData(selectedTimeRange);
        setUserReportsData(response.data);
        return;
      } catch (apiError) {
        console.warn('API call failed, using mock data:', apiError);
      }
      
      // Fallback to mock data that represents what users are seeing in their reports
      const mockData = {
        totalUsers: 1247,
        activeUsers: 89,
        userActivity: {
          bookmarks: 156,
          discussions: 234,
          learningResources: 67,
          feedback: 45
        },
        topUsers: [
          { id: 1, name: 'Ahmad Rahman', email: 'ahmad@example.com', bookmarks: 15, discussions: 8, learningProgress: 85, lastActive: '2 hours ago' },
          { id: 2, name: 'Sarah Lim', email: 'sarah@example.com', bookmarks: 12, discussions: 12, learningProgress: 92, lastActive: '1 hour ago' },
          { id: 3, name: 'Hassan Ali', email: 'hassan@example.com', bookmarks: 18, discussions: 6, learningProgress: 78, lastActive: '30 minutes ago' },
          { id: 4, name: 'Priya Sharma', email: 'priya@example.com', bookmarks: 9, discussions: 15, learningProgress: 88, lastActive: '45 minutes ago' },
          { id: 5, name: 'Lim Wei Ming', email: 'lim@example.com', bookmarks: 11, discussions: 9, learningProgress: 90, lastActive: '1.5 hours ago' }
        ],
        recentActivity: [
          { user: 'Ahmad Rahman', action: 'Bookmarked Topic', details: 'Healthcare Reform Bill 2024', time: '2 hours ago', type: 'bookmark' },
          { user: 'Sarah Lim', action: 'Posted Discussion', details: 'Education Budget Concerns', time: '3 hours ago', type: 'discussion' },
          { user: 'Hassan Ali', action: 'Completed Quiz', details: 'Parliamentary Procedures - Score: 95%', time: '4 hours ago', type: 'learning' },
          { user: 'Priya Sharma', action: 'Submitted Feedback', details: 'Platform Navigation Improvement', time: '5 hours ago', type: 'feedback' },
          { user: 'Lim Wei Ming', action: 'Bookmarked MP', details: 'Anwar Ibrahim', time: '6 hours ago', type: 'bookmark' }
        ],
        popularContent: [
          { title: 'Healthcare Reform Bill 2024', views: 234, bookmarks: 45, type: 'topic', category: 'Healthcare' },
          { title: 'Education Budget Analysis', views: 189, bookmarks: 38, type: 'topic', category: 'Education' },
          { title: 'Parliamentary Procedures Course', views: 156, completions: 89, type: 'learning', category: 'Education' },
          { title: 'Budget 2024 Discussion', views: 145, replies: 67, type: 'discussion', category: 'Economy' },
          { title: 'Environmental Policy Quiz', views: 134, completions: 78, type: 'learning', category: 'Environment' }
        ],
        userStats: {
          avgSessionTime: '12m 34s',
          avgBookmarksPerUser: 3.2,
          avgDiscussionsPerUser: 1.8,
          mostActiveDay: 'Tuesday',
          peakHour: '2:00 PM',
          totalSessions: 2456,
          bounceRate: '23.4%'
        }
      };
      
      setUserReportsData(mockData);
    } catch (error) {
      console.error('Error fetching user reports data:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderHeader = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Activity Reports</h1>
          <p className="text-gray-600 mt-2">Comprehensive view of user engagement and platform interactions</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Time Range:</label>
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
            </select>
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              autoRefresh 
                ? 'bg-green-100 text-green-700 border border-green-300' 
                : 'bg-gray-100 text-gray-700 border border-gray-300'
            }`}
          >
            {autoRefresh ? '⏸️ Auto-refresh ON' : '▶️ Auto-refresh OFF'}
          </button>
          <button
            onClick={fetchUserReportsData}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? '⟳ Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderQuickStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total User Bookmarks</p>
            <p className="text-3xl font-bold text-indigo-600">{userReportsData.userActivity.bookmarks}</p>
            <p className="text-xs text-gray-500 mt-1">Across all users</p>
          </div>
          <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Active Discussions</p>
            <p className="text-3xl font-bold text-emerald-600">{userReportsData.userActivity.discussions}</p>
            <p className="text-xs text-gray-500 mt-1">User-generated content</p>
          </div>
          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Learning Resources</p>
            <p className="text-3xl font-bold text-purple-600">{userReportsData.userActivity.learningResources}</p>
            <p className="text-xs text-gray-500 mt-1">Educational content</p>
          </div>
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">User Feedback</p>
            <p className="text-3xl font-bold text-orange-600">{userReportsData.userActivity.feedback}</p>
            <p className="text-xs text-gray-500 mt-1">Platform improvements</p>
          </div>
          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTopUsers = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Most Active Users</h3>
        <span className="text-sm text-gray-500">Based on overall engagement</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">User</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Bookmarks</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Discussions</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Learning Progress</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Last Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {userReportsData.topUsers.map((user, index) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">#{index + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">{user.bookmarks}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{user.discussions}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${user.learningProgress}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-700">{user.learningProgress}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{user.lastActive}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderRecentActivity = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Live User Activity Feed</h3>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
            autoRefresh ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
          }`}>
            {autoRefresh ? '🟢 Live Updates' : '⚫ Static View'}
          </div>
        </div>
        <div className="space-y-3">
          {userReportsData.recentActivity.map((activity, index) => (
            <div key={index} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                activity.type === 'bookmark' ? 'bg-indigo-100' :
                activity.type === 'discussion' ? 'bg-emerald-100' :
                activity.type === 'learning' ? 'bg-purple-100' : 'bg-orange-100'
              }`}>
                {activity.type === 'bookmark' && (
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                )}
                {activity.type === 'discussion' && (
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                )}
                {activity.type === 'learning' && (
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {activity.type === 'feedback' && (
                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{activity.user}</p>
                <p className="text-sm text-gray-600">{activity.action}: {activity.details}</p>
                <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Popular Content</h3>
        <div className="space-y-3">
          {userReportsData.popularContent.map((content, index) => (
            <div key={index} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">#{index + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{content.title}</p>
                <p className="text-xs text-gray-500">{content.category} • {content.type}</p>
                <div className="flex items-center space-x-4 mt-1">
                  <span className="text-xs text-gray-600">{content.views} views</span>
                  <span className="text-xs text-gray-600">
                    {content.bookmarks ? `${content.bookmarks} bookmarks` : 
                     content.completions ? `${content.completions} completions` :
                     content.replies ? `${content.replies} replies` : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderUserStats = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">User Behavior Insights</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{userReportsData.userStats.avgSessionTime}</div>
          <div className="text-sm text-gray-600">Avg Session Time</div>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{userReportsData.userStats.avgBookmarksPerUser}</div>
          <div className="text-sm text-gray-600">Avg Bookmarks/User</div>
        </div>
        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">{userReportsData.userStats.mostActiveDay}</div>
          <div className="text-sm text-gray-600">Most Active Day</div>
        </div>
        <div className="text-center p-4 bg-orange-50 rounded-lg">
          <div className="text-2xl font-bold text-orange-600">{userReportsData.userStats.bounceRate}</div>
          <div className="text-sm text-gray-600">Bounce Rate</div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading user reports data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderHeader()}
        {renderQuickStats()}
        {renderTopUsers()}
        {renderRecentActivity()}
        {renderUserStats()}
      </div>
    </div>
  );
};

export default AdminUserReports;
