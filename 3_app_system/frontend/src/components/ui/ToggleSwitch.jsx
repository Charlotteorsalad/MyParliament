import React from 'react';
import PropTypes from 'prop-types';

const ToggleSwitch = ({ 
  checked, 
  onChange, 
  disabled = false, 
  size = 'md', 
  color = 'indigo',
  label,
  description,
  className = ''
}) => {
  const sizes = {
    sm: {
      switch: 'w-8 h-4',
      thumb: 'w-3 h-3',
      translate: 'translate-x-4'
    },
    md: {
      switch: 'w-11 h-6',
      thumb: 'w-5 h-5',
      translate: 'translate-x-5'
    },
    lg: {
      switch: 'w-14 h-7',
      thumb: 'w-6 h-6',
      translate: 'translate-x-7'
    }
  };

  const colors = {
    indigo: 'peer-checked:bg-indigo-600 peer-focus:ring-indigo-500',
    green: 'peer-checked:bg-green-600 peer-focus:ring-green-500',
    red: 'peer-checked:bg-red-600 peer-focus:ring-red-500',
    purple: 'peer-checked:bg-purple-600 peer-focus:ring-purple-500'
  };

  const currentSize = sizes[size];

  return (
    <div className={`flex items-center ${className}`}>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only peer"
        />
        <div className={`
          ${currentSize.switch} 
          bg-gray-200 
          peer-focus:outline-none 
          peer-focus:ring-4 
          peer-focus:ring-opacity-20 
          rounded-full 
          peer 
          peer-checked:after:translate-x-full 
          peer-checked:after:border-white 
          after:content-[''] 
          after:absolute 
          after:top-[2px] 
          after:left-[2px] 
          after:bg-white 
          after:border-gray-300 
          after:border 
          after:rounded-full 
          after:h-5 
          after:w-5 
          after:transition-all 
          peer-checked:bg-gradient-to-r 
          peer-checked:from-indigo-500 
          peer-checked:to-purple-600
          ${colors[color]}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `} />
      </label>
      {(label || description) && (
        <div className="ml-3">
          {label && (
            <div className="text-sm font-medium text-gray-900">{label}</div>
          )}
          {description && (
            <div className="text-sm text-gray-500">{description}</div>
          )}
        </div>
      )}
    </div>
  );
};

ToggleSwitch.propTypes = {
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  color: PropTypes.oneOf(['indigo', 'green', 'red', 'purple']),
  label: PropTypes.string,
  description: PropTypes.string,
  className: PropTypes.string
};

export default ToggleSwitch;




