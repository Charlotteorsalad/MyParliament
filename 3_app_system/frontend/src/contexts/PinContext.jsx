import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../hooks';

const PinContext = createContext();

export const usePin = () => {
  const context = useContext(PinContext);
  if (!context) {
    throw new Error('usePin must be used within a PinProvider');
  }
  return context;
};

export const PinProvider = ({ children }) => {
  const [pinnedTabs, setPinnedTabs] = useState([]);
  const { isAuthenticated: isUserAuthenticated } = useAuth();

  // Pins are for logged-in users on the public app. Admin may also have a token in the
  // same browser; we still show pins so Quick Actions works (storage key is user-specific).
  const shouldShowPins = isUserAuthenticated;

  // Load pinned tabs from localStorage
  useEffect(() => {
    if (shouldShowPins) {
      loadPinnedTabs();
    } else {
      setPinnedTabs([]);
    }
  }, [shouldShowPins]);

  const loadPinnedTabs = () => {
    try {
      const saved = localStorage.getItem('userPinnedTabs');
      if (saved) {
        setPinnedTabs(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading pinned tabs:', error);
    }
  };

  // Save pinned tabs to localStorage
  const savePinnedTabs = (tabs) => {
    try {
      localStorage.setItem('userPinnedTabs', JSON.stringify(tabs));
    } catch (error) {
      console.error('Error saving pinned tabs:', error);
    }
  };

  // Toggle pin status for a tab
  const togglePin = (tabId, tabName, module = null) => {
    const tabInfo = { id: tabId, name: tabName, module };
    const isPinned = pinnedTabs.some(tab => tab.id === tabId);
    
    let newPinnedTabs;
    if (isPinned) {
      newPinnedTabs = pinnedTabs.filter(tab => tab.id !== tabId);
    } else {
      newPinnedTabs = [...pinnedTabs, tabInfo];
    }
    
    setPinnedTabs(newPinnedTabs);
    savePinnedTabs(newPinnedTabs);
  };

  // Check if a tab is pinned
  const isPinned = (tabId) => {
    return pinnedTabs.some(tab => tab.id === tabId);
  };

  // PinButton component
  const PinButton = ({ tabId, tabName, module = null, className = "" }) => {
    if (!shouldShowPins) {
      return null;
    }

    const pinned = isPinned(tabId);
    
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          togglePin(tabId, tabName, module);
        }}
        className={`p-1.5 rounded-full hover:bg-indigo-100/80 transition-colors cursor-pointer shrink-0 ${className}`}
        title={pinned ? 'Unpin from Quick Actions' : 'Pin to Quick Actions'}
        role="button"
        tabIndex={0}
        aria-pressed={pinned}
        aria-label={pinned ? 'Unpin from Quick Actions' : 'Pin to Quick Actions'}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            togglePin(tabId, tabName, module);
          }
        }}
      >
        <svg 
          className={`w-[18px] h-[18px] transition-colors ${pinned ? 'text-amber-500' : 'text-indigo-600 hover:text-amber-500'}`} 
          fill={pinned ? 'currentColor' : 'none'} 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" 
          />
        </svg>
      </div>
    );
  };

  const value = {
    pinnedTabs,
    togglePin,
    isPinned,
    PinButton,
    loadPinnedTabs
  };

  return (
    <PinContext.Provider value={value}>
      {children}
    </PinContext.Provider>
  );
};
