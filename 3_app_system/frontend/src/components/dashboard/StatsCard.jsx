import React from 'react';
import PropTypes from 'prop-types';

const StatsCard = ({ 
  title, 
  value, 
  icon, 
  color, 
  bgColor, 
  description 
}) => {
  return (
    <div className={`group relative bg-gradient-to-br ${bgColor} rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border ${color.replace('bg-', 'border-').replace('-500', '-200/60')} overflow-hidden`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${bgColor.replace('-50', '-100/80').replace('-100', '-200/60')}`}></div>
      <div className="relative p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`h-12 w-12 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
            </svg>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-900">{(value || 0).toLocaleString()}</p>
            <p className="text-sm text-slate-600">{title}</p>
          </div>
        </div>
        <div className={`flex items-center text-sm ${color.replace('bg-', 'text-')}`}>
          <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <span className="font-medium">{description}</span>
        </div>
      </div>
    </div>
  );
};

StatsCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  icon: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
  bgColor: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired
};

export default StatsCard;

