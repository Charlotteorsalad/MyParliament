import React, { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import CustomCalendar from './CustomCalendar';

const CalendarIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

function formatDate(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function normalizeDate(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

/**
 * Date field with custom calendar dropdown (calendar-only selection, no manual typing).
 * The calendar is rendered via a Portal into document.body so it is never clipped by
 * overflow-hidden or backdrop-filter ancestors. It opens upward above the input field.
 */
const DatePickerField = ({
  label,
  value,
  onChange,
  placeholder = 'DD/MM/YYYY',
  error,
  disabled,
  minDate,
  maxDate,
  required,
  className = '',
  inputClassName = '',
  autoComplete,
}) => {
  const [open, setOpen] = useState(false);
  const [calendarStyle, setCalendarStyle] = useState({});
  const wrapperRef = useRef(null);
  const calendarRef = useRef(null);
  const id = useId().replace(/:/g, '');

  // Close calendar on outside click — must check both the input wrapper and the portal element.
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      const insideWrapper = wrapperRef.current?.contains(e.target);
      const insideCalendar = calendarRef.current?.contains(e.target);
      if (!insideWrapper && !insideCalendar) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const openCalendar = () => {
    if (disabled || open) return;
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      setCalendarStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        minWidth: `${rect.width}px`,
        maxHeight: Math.max(200, spaceBelow),
        overflowY: 'auto',
        zIndex: 9999,
      });
    }
    setOpen(true);
  };

  const handleCalendarSelect = (date) => {
    onChange(normalizeDate(date));
    setOpen(false);
  };

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(null);
  };

  return (
    <div ref={wrapperRef} className={`relative space-y-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div
        className={`kt-input relative w-full flex items-center gap-2 rounded-lg bg-white overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent border ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100' : ''}`}
        data-kt-date-picker="true"
        id={`calendar-${id}`}
      >
        <span className="flex-shrink-0 pl-3 flex items-center pointer-events-none text-gray-400" aria-hidden>
          <CalendarIcon />
        </span>
        <input
          id={id}
          type="text"
          value={formatDate(value)}
          readOnly
          onChange={() => {}}
          onFocus={openCalendar}
          onClick={openCalendar}
          placeholder={placeholder}
          autoComplete={autoComplete || 'off'}
          data-input
          className={`grow min-w-0 py-2.5 pr-10 bg-transparent border-0 outline-none text-gray-900 placeholder-gray-400 select-none ${
            disabled ? 'cursor-not-allowed' : 'cursor-pointer'
          } ${inputClassName}`}
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-300 hover:bg-gray-400 text-white text-sm leading-none flex items-center justify-center flex-shrink-0"
            aria-label="Clear date"
          >
            ×
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}

      {open && !disabled && createPortal(
        <div ref={calendarRef} style={calendarStyle}>
          <CustomCalendar
            value={value}
            onChange={handleCalendarSelect}
            minDate={minDate}
            maxDate={maxDate}
            onClose={() => setOpen(false)}
          />
        </div>,
        document.body
      )}
    </div>
  );
};

DatePickerField.propTypes = {
  label: PropTypes.string,
  value: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  error: PropTypes.string,
  disabled: PropTypes.bool,
  minDate: PropTypes.object,
  maxDate: PropTypes.object,
  required: PropTypes.bool,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  autoComplete: PropTypes.string,
};

export default DatePickerField;
