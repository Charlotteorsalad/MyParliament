import React from 'react';
import PropTypes from 'prop-types';

const TabNavigation = ({ 
  tabs, 
  activeTab, 
  onTabChange, 
  className = '',
  orientation = 'horizontal' // 'horizontal' or 'vertical'
}) => {
  const isVertical = orientation === 'vertical';
  
  return (
    <div className={`${isVertical ? '' : 'border-b border-gray-200'} ${className}`}>
      <nav className={`${isVertical ? 'space-y-2' : 'flex space-x-8'}`} aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              ${isVertical 
                ? 'w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors' 
                : 'py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200'
              }
              ${activeTab === tab.id
                ? isVertical
                  ? 'bg-gradient-to-r from-[#C3C3E5] to-[#A8A8D8] text-white'
                  : 'border-indigo-500 text-indigo-600'
                : isVertical
                  ? 'text-gray-700 hover:bg-gray-100'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <div className="flex items-center gap-2">
              {tab.icon && (
                <span className="text-lg">{tab.icon}</span>
              )}
              {tab.label}
            </div>
          </button>
        ))}
      </nav>
    </div>
  );
};

const TabContent = ({ 
  children, 
  activeTab, 
  tabId, 
  className = '' 
}) => {
  if (activeTab !== tabId) return null;
  
  return (
    <div className={className}>
      {children}
    </div>
  );
};

TabNavigation.Content = TabContent;

TabNavigation.propTypes = {
  tabs: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    icon: PropTypes.string
  })).isRequired,
  activeTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
  className: PropTypes.string,
  orientation: PropTypes.oneOf(['horizontal', 'vertical'])
};

TabContent.propTypes = {
  children: PropTypes.node.isRequired,
  activeTab: PropTypes.string.isRequired,
  tabId: PropTypes.string.isRequired,
  className: PropTypes.string
};

export default TabNavigation;
