import React, { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';

const ChevronDown = () => (
  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

/**
 * Custom select dropdown rendered via a Portal so it always opens downward
 * and is never clipped by overflow-hidden or backdrop-filter ancestors.
 */
const CustomSelect = ({
  name,
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  disabled = false,
  error = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const id = useId().replace(/:/g, '');

  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      const insideTrigger = triggerRef.current?.contains(e.target);
      const insideDropdown = dropdownRef.current?.contains(e.target);
      if (!insideTrigger && !insideDropdown) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const openDropdown = () => {
    if (disabled || open) return;
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Cap height to the available space below so the list never overflows the viewport.
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(240, Math.max(80, spaceBelow)),
        zIndex: 9999,
      });
    }
    setOpen(true);
  };

  const handleSelect = (optValue) => {
    onChange({ target: { name, value: optValue } });
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        onClick={openDropdown}
        disabled={disabled}
        className={`w-full px-4 py-3 border rounded-lg text-left flex items-center justify-between gap-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#C3C3E5] focus:border-transparent transition-colors ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-gray-400'} ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`truncate text-sm ${value ? 'text-gray-900' : 'text-gray-400'}`}>
          {value ? selectedLabel : placeholder}
        </span>
        <ChevronDown />
      </button>

      {open && !disabled && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="bg-white border border-gray-200 rounded-lg shadow-xl overflow-y-auto"
          role="listbox"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(opt.value)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                opt.value === value
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};

CustomSelect.propTypes = {
  name: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({ value: PropTypes.string, label: PropTypes.string })
  ),
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  error: PropTypes.bool,
  className: PropTypes.string,
};

export default CustomSelect;
