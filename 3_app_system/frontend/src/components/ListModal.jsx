import { useState, useEffect } from "react";

function ListModal({ isOpen, onClose, title, data }) {
  const [searchTerm, setSearchTerm] = useState("");

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Filter data based on search term
  const filteredData = data.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    if (title === 'Followed MPs') {
      return item.name?.toLowerCase().includes(searchLower) || 
             item.constituency?.toLowerCase().includes(searchLower) ||
             item.party?.toLowerCase().includes(searchLower);
    } else if (title === 'Followed Topics') {
      return item.name?.toLowerCase().includes(searchLower) || 
             item.description?.toLowerCase().includes(searchLower);
    }
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder={`Search ${title.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C3C3E5] focus:border-transparent"
            />
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto">
          {filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                {title === 'Followed MPs' ? '👤' : '🏷️'}
              </div>
              <p className="text-center">
                {searchTerm ? 'No results found' : `No ${title.toLowerCase()} yet`}
              </p>
              {!searchTerm && (
                <p className="text-sm text-gray-400 mt-1">
                  {title === 'Followed MPs' 
                    ? 'Start following MPs to see them here' 
                    : 'Start following topics to see them here'
                  }
                </p>
              )}
            </div>
          ) : (
            <div className="p-2">
              {filteredData.map((item, index) => (
                <div key={item._id || index} className="flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
                  {/* Avatar/Icon */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#C3C3E5] to-[#A8A8D8] flex items-center justify-center mr-3 flex-shrink-0">
                    {title === 'Followed MPs' ? (
                      item.profilePicture ? (
                        <img 
                          src={item.profilePicture} 
                          alt={item.name}
                          className="w-12 h-12 rounded-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null
                    ) : null}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${item.profilePicture ? 'hidden' : 'flex'}`}>
                      {title === 'Followed MPs' ? '👤' : '🏷️'}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {item.name || item.title || 'Unknown'}
                    </h3>
                    {title === 'Followed MPs' ? (
                      <div className="text-sm text-gray-500">
                        {item.constituency && <span>{item.constituency}</span>}
                        {item.constituency && item.party && <span> • </span>}
                        {item.party && <span>{item.party}</span>}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 truncate">
                        {item.description || 'No description available'}
                      </p>
                    )}
                  </div>

                  {/* Action Button */}
                  <button className="ml-2 px-3 py-1 text-sm bg-gradient-to-r from-[#C3C3E5] to-[#A8A8D8] text-white rounded-full hover:from-[#B8B8E0] hover:to-[#9D9DD3] transition-all duration-200">
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <p className="text-sm text-gray-500 text-center">
            {filteredData.length} {filteredData.length === 1 ? 'item' : 'items'}
            {searchTerm && ` found for "${searchTerm}"`}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ListModal;
