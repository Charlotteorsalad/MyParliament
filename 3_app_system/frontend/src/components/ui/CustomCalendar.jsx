import React, { useState, useMemo, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const ChevronLeft = () => (
  <svg className="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);
const ChevronRight = () => (
  <svg className="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);
const ChevronDown = () => (
  <svg className="shrink-0 size-3.5 text-gray-500" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/**
 * Builds a 6×7 grid of calendar days (Monday-based).
 * Each cell is { date: Date, dayNum: number, isCurrentMonth: boolean }.
 */
function buildCalendarGrid(viewYear, viewMonth) {
  const first = new Date(viewYear, viewMonth, 1);
  const last = new Date(viewYear, viewMonth + 1, 0);
  const lastDay = last.getDate();
  // Monday = 0: (getDay() + 6) % 7
  const firstWeekday = (first.getDay() + 6) % 7;
  const startOffset = 1 - firstWeekday;
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dayNum = startOffset + i;
    let date;
    let isCurrentMonth;
    if (dayNum < 1) {
      date = new Date(viewYear, viewMonth, dayNum);
      isCurrentMonth = false;
    } else if (dayNum > lastDay) {
      date = new Date(viewYear, viewMonth, dayNum);
      isCurrentMonth = false;
    } else {
      date = new Date(viewYear, viewMonth, dayNum);
      isCurrentMonth = true;
    }
    cells.push({ date, dayNum: date.getDate(), isCurrentMonth });
  }
  return cells;
}

function sameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const CustomCalendar = ({
  value,
  onChange,
  minDate,
  maxDate,
  onClose,
  className = '',
}) => {
  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(() => {
    if (value && !isNaN(value.getTime())) return value;
    return today;
  });
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const monthPickerRef = useRef(null);
  const yearPickerRef = useRef(null);
  const yearListRef = useRef(null);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const grid = useMemo(() => buildCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const rows = useMemo(() => {
    const r = [];
    for (let i = 0; i < 6; i++) r.push(grid.slice(i * 7, (i + 1) * 7));
    return r;
  }, [grid]);

  const minYear = minDate ? minDate.getFullYear() : viewYear - 20;
  const maxYear = maxDate ? maxDate.getFullYear() : viewYear + 20;
  const years = [];
  for (let y = minYear; y <= maxYear; y++) years.push(y);

  useEffect(() => {
    const close = (e) => {
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target)) setMonthPickerOpen(false);
      if (yearPickerRef.current && !yearPickerRef.current.contains(e.target)) setYearPickerOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (!yearPickerOpen || !yearListRef.current) return;
    const el = yearListRef.current.querySelector(`[data-year="${viewYear}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [yearPickerOpen, viewYear]);

  const goPrev = () => {
    setViewDate((d) => {
      const next = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      return next;
    });
  };
  const goNext = () => {
    setViewDate((d) => {
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      return next;
    });
  };

  const isDayDisabled = (date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const handleDayClick = (cell) => {
    if (!cell.isCurrentMonth) return;
    if (isDayDisabled(cell.date)) return;
    onChange(cell.date);
    onClose?.();
  };

  const handleMonthSelect = (monthIndex) => {
    setViewDate(new Date(viewYear, monthIndex, 1));
    setMonthPickerOpen(false);
  };
  const handleYearSelect = (year) => {
    setViewDate(new Date(year, viewMonth, 1));
    setYearPickerOpen(false);
  };

  const canGoPrev = !minDate || new Date(viewYear, viewMonth - 1, 1) >= new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const canGoNext = !maxDate || new Date(viewYear, viewMonth + 1, 1) <= new Date(maxDate.getFullYear(), maxDate.getMonth(), 31);

  return (
    <div
      className={`w-80 flex flex-col bg-white border border-gray-200 shadow-lg rounded-xl ${className}`}
      role="dialog"
      aria-label="Calendar"
    >
      <div className="p-3 space-y-0.5">
        {/* Months header: Prev | Month / Year | Next */}
        <div className="grid grid-cols-5 items-center gap-x-3 mx-1.5 pb-3">
          <div className="col-span-1">
            <button
              type="button"
              onClick={goPrev}
              disabled={!canGoPrev}
              className="size-8 flex justify-center items-center text-gray-700 hover:bg-gray-100 rounded-full disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:bg-gray-100"
              aria-label="Previous month"
            >
              <ChevronLeft />
            </button>
          </div>

          <div className="col-span-3 flex justify-center items-center gap-x-1">
            {/* Month: button opens month grid */}
            <div className="relative" ref={monthPickerRef}>
              <button
                type="button"
                onClick={() => { setMonthPickerOpen((o) => !o); setYearPickerOpen(false); }}
                className="flex items-center gap-0.5 rounded-md px-2 py-1 text-sm font-medium text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 border border-transparent hover:border-gray-200"
                aria-expanded={monthPickerOpen}
                aria-label="Select month"
              >
                <span>{MONTH_NAMES[viewMonth]}</span>
                <ChevronDown />
              </button>
              {monthPickerOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 w-44 p-2.5 bg-white border border-gray-200 rounded-xl shadow-xl">
                  <div className="grid grid-cols-3 gap-2">
                    {MONTH_NAMES_SHORT.map((name, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleMonthSelect(i)}
                        className={`px-2 py-2 text-sm rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset transition-colors
                          ${viewMonth === i
                            ? 'bg-indigo-600 text-white font-medium shadow-sm'
                            : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'
                          }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <span className="text-gray-600">/</span>
            {/* Year: button opens styled list */}
            <div className="relative" ref={yearPickerRef}>
              <button
                type="button"
                onClick={() => { setYearPickerOpen((o) => !o); setMonthPickerOpen(false); }}
                className="flex items-center gap-0.5 rounded-md px-2 py-1 text-sm font-medium text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 border border-transparent hover:border-gray-200"
                aria-expanded={yearPickerOpen}
                aria-label="Select year"
              >
                <span>{viewYear}</span>
                <ChevronDown />
              </button>
              {yearPickerOpen && (
                <div
                  ref={yearListRef}
                  className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 w-48 max-h-52 overflow-y-auto p-2.5 bg-white border border-gray-200 rounded-xl shadow-xl calendar-dropdown-scroll"
                >
                  <div className="grid grid-cols-3 gap-2">
                    {years.map((y) => (
                      <button
                        key={y}
                        type="button"
                        data-year={y}
                        onClick={() => handleYearSelect(y)}
                        className={`min-w-[3rem] px-2 py-2 text-sm rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset transition-colors
                          ${viewYear === y
                            ? 'bg-indigo-600 text-white font-medium shadow-sm'
                            : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'
                          }`}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="col-span-1 flex justify-end">
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              className="size-8 flex justify-center items-center text-gray-700 hover:bg-gray-100 rounded-full disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:bg-gray-100"
              aria-label="Next month"
            >
              <ChevronRight />
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="flex pb-1.5">
          {WEEKDAYS.map((d) => (
            <span key={d} className="m-px w-10 block text-center text-sm text-gray-500">
              {d}
            </span>
          ))}
        </div>

        {/* Day grid: 6 rows × 7 */}
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className="flex">
            {row.map((cell, colIdx) => {
              const selected = sameDay(value, cell.date);
              const disabled = !cell.isCurrentMonth || isDayDisabled(cell.date);
              const isToday = sameDay(today, cell.date);
              return (
                <div key={colIdx}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleDayClick(cell)}
                    className={`m-px size-10 flex justify-center items-center border-[1.5px] border-transparent text-sm rounded-full
                      ${selected
                        ? 'bg-indigo-600 font-medium text-white hover:bg-indigo-700 focus:outline-none focus:bg-indigo-700'
                        : 'text-gray-900 hover:border-indigo-400 hover:text-indigo-600 focus:outline-none focus:border-indigo-500 focus:text-indigo-600'
                      }
                      ${disabled ? 'opacity-50 pointer-events-none' : ''}
                      ${isToday && !selected ? 'ring-1 ring-indigo-300' : ''}
                    `}
                  >
                    {cell.dayNum}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

CustomCalendar.propTypes = {
  value: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  minDate: PropTypes.object,
  maxDate: PropTypes.object,
  onClose: PropTypes.func,
  className: PropTypes.string,
};

export default CustomCalendar;
