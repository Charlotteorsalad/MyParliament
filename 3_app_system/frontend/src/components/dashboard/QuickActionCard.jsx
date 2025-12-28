import React from 'react';
import PropTypes from 'prop-types';

const QuickActionCard = ({ 
  title, 
  description, 
  icon, 
  onClick 
}) => {
  return (
    <button
      onClick={onClick}
      className="group p-6 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 hover:border-indigo-300 rounded-lg transition-all duration-300 text-left hover:shadow-lg"
    >
      <div className="flex items-center mb-4">
        <div className="h-12 w-12 bg-indigo-500 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
          <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </div>
        <div className="ml-4">
          <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
      <div className="flex items-center text-indigo-600 text-sm font-medium">
        <span>View Details</span>
        <svg className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
};

QuickActionCard.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired
};

export default QuickActionCard;

