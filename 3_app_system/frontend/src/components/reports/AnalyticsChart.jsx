import React from 'react';
import PropTypes from 'prop-types';
import { Card } from '../ui';

const AnalyticsChart = ({ 
  title, 
  children, 
  onClick 
}) => {
  return (
    <Card 
      className="group cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
          {title}
        </h3>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center text-indigo-600 text-sm font-medium">
            <span>View Details</span>
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
      {children}
    </Card>
  );
};

AnalyticsChart.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func
};

export default AnalyticsChart;




