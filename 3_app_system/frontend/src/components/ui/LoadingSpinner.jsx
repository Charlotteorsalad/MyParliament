import React from 'react';
import PropTypes from 'prop-types';

const LoadingSpinner = ({ 
  size = 'md', 
  color = 'indigo', 
  text = '', 
  className = '' 
}) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };
  
  const colors = {
    indigo: 'text-indigo-600',
    white: 'text-white',
    gray: 'text-gray-600',
    red: 'text-red-600',
    green: 'text-green-600'
  };
  
  const spinnerClasses = `animate-spin ${sizes[size]} ${colors[color]}`;
  
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <svg className={spinnerClasses} fill="none" viewBox="0 0 24 24">
        <circle 
          className="opacity-25" 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          strokeWidth="4"
        />
        <path 
          className="opacity-75" 
          fill="currentColor" 
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {text && (
        <p className={`mt-2 text-sm ${colors[color]}`}>
          {text}
        </p>
      )}
    </div>
  );
};

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  color: PropTypes.oneOf(['indigo', 'white', 'gray', 'red', 'green']),
  text: PropTypes.string,
  className: PropTypes.string
};

export default LoadingSpinner;




