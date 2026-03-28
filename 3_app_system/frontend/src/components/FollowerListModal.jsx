import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks';
import { userApi, topicApi, bookmarkApi } from '../api';
import { useLanguage } from '../contexts/LanguageContext';

// Prefetch cache for topic detail – hover in Followed Topics modal populates this
const topicDetailCache = new Map();

const FollowerListModal = ({ isOpen, onClose, type, title, items = [], onItemRemoved }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredItems, setFilteredItems] = useState(items);
  const navigate = useNavigate();
  const { executeApiCall } = useApi();
  const { t } = useLanguage();

  const prefetchTopicDetail = (topicId) => {
    const id = String(topicId);
    if (!id || topicDetailCache.has(id)) return;
    topicApi.getIssueById(id)
      .then((res) => {
        const issue = res?.data?.issue;
        if (issue) topicDetailCache.set(id, issue);
      })
      .catch(() => {});
  };

  // Filter items based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredItems(items);
    } else {
      const filtered = items.filter(item => 
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.party?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.constituency?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredItems(filtered);
    }
  }, [searchTerm, items]);

  // Handle unfollow/unbookmark action
  const handleUnfollow = async (item) => {
    const itemId = item.id || item._id;
    try {
      if (type === 'mps') {
        await executeApiCall(() => userApi.unfollowMP(itemId));
      } else if (type === 'topics') {
        await executeApiCall(() => userApi.unfollowTopic(itemId));
      } else if (type === 'eduContent') {
        await executeApiCall(() => userApi.unbookmarkEduContent(itemId));
      } else if (type === 'discussions') {
        await executeApiCall(() => bookmarkApi.toggleBookmark({
          resourceId: itemId,
          type: 'forum',
          title: item.title || 'Discussion',
          description: item.description || '',
        }));
      }
      setFilteredItems(prev => prev.filter((i) => (i.id || i._id) !== itemId));
      if (onItemRemoved) onItemRemoved(type, item);
    } catch (error) {
      console.error('Failed to unfollow/unbookmark:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-[95%] max-w-[900px] transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Search Bar */}
            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder={`Search ${
                    type === 'mps' ? 'MPs' : 
                    type === 'topics' ? 'topics' :
                    type === 'eduContent' ? 'educational content' :
                    type === 'discussions' ? 'discussions' :
                    type === 'issues' ? 'issues' : 'items'
                  }...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <svg className="h-12 w-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p className="text-sm font-medium">{t('noData')}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredItems.map((item, index) => (
                  <div
                    key={item.id || index}
                    role={type === 'topics' ? 'button' : undefined}
                    tabIndex={type === 'topics' ? 0 : undefined}
                    onMouseEnter={type === 'topics' ? () => prefetchTopicDetail(item.id || item._id) : undefined}
                    onClick={type === 'topics' ? () => {
                      const topicId = item.id || item._id;
                      if (topicId) {
                        onClose();
                        const cached = topicDetailCache.get(String(topicId));
                        navigate(`/topic/${topicId}`, cached ? { state: { prefetchedIssue: cached } } : {});
                      }
                    } : undefined}
                    onKeyDown={type === 'topics' ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        const topicId = item.id || item._id;
                        if (topicId) {
                          onClose();
                          const cached = topicDetailCache.get(String(topicId));
                          navigate(`/topic/${topicId}`, cached ? { state: { prefetchedIssue: cached } } : {});
                        }
                      }
                    } : undefined}
                    className={`flex items-center justify-between p-4 hover:bg-gray-50 transition-colors gap-3 ${type === 'topics' ? 'cursor-pointer' : ''}`}
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      {/* Avatar */}
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                        {type === 'mps' ? (
                          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        ) : type === 'topics' ? (
                          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        ) : type === 'eduContent' ? (
                          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        ) : type === 'issues' ? (
                          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.name || item.title}
                        </p>
                        {type === 'mps' && (
                          <div className="flex items-center space-x-2 mt-1">
                            <p className="text-xs text-gray-500 truncate">{item.party}</p>
                            {item.constituency && (
                              <>
                                <span className="text-xs text-gray-300">•</span>
                                <p className="text-xs text-gray-500 truncate">{item.constituency}</p>
                              </>
                            )}
                          </div>
                        )}
                        {type === 'topics' && item.description && (
                          <p className="text-xs text-gray-500 truncate mt-1">{item.description}</p>
                        )}
                        {type === 'eduContent' && item.category && (
                          <p className="text-xs text-gray-500 truncate mt-1">{item.category}</p>
                        )}
                        {type === 'issues' && item.category && (
                          <p className="text-xs text-gray-500 truncate mt-1">{item.category}</p>
                        )}
                      </div>
                    </div>
                    
                    {/* View (MPs only) + Unfollow/Unbookmark Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {type === 'mps' && (item.mp_id || item._id || item.name) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                            const mpId = item.mp_id || item._id;
                            const name = item.name;
                            if (mpId) {
                              navigate(`/mps?mp=${encodeURIComponent(mpId)}&returnTo=/profile`);
                            } else if (name) {
                              navigate(`/mps?name=${encodeURIComponent(name)}&returnTo=/profile`);
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-full hover:bg-indigo-100 transition-colors"
                        >
                          View
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnfollow(item);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                      >
                        {type === 'mps' || type === 'topics' ? 'Unfollow' : 'Remove'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-3 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              {filteredItems.length} {
                type === 'mps' ? 'MPs' : 
                type === 'topics' ? 'topics' :
                type === 'eduContent' ? 'educational content' :
                type === 'discussions' ? 'discussions' :
                type === 'issues' ? 'issues' : 'items'
              } {type === 'mps' || type === 'topics' ? 'followed' : 'bookmarked'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FollowerListModal;

