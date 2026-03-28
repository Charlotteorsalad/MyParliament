import React from 'react';

// Simple chart components without external dependencies
export const PieChart = ({ data, title, colors = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444'] }) => {
  if (!data || !Array.isArray(data)) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
        <div className="text-center">
          <div className="text-gray-500 text-lg font-medium">{title}</div>
          <div className="text-gray-400 text-sm mt-2">No data available</div>
        </div>
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const hasData = total > 0;
  let cumulativePercentage = 0;

  // Heuristic: if title contains '%' we treat values as percentages
  const isPercentageChart = typeof title === 'string' && title.includes('%');

  let displayTotal = '';
  if (isPercentageChart) {
    // Clamp to [0, 100] and round to 1 decimal; strip trailing .0
    const rounded = Math.round(total * 10) / 10;
    const clamped = Math.min(100, Math.max(0, rounded));
    displayTotal = clamped % 1 === 0 ? clamped.toFixed(0) : clamped.toFixed(1);
  } else {
    displayTotal = total.toLocaleString();
  }

  return (
    <div className="w-full min-w-0 overflow-visible flex flex-col items-center gap-4 py-2">
      {/* Donut: always on top so legend has full width below */}
      <div className="relative flex-shrink-0 w-[132px] h-[132px] sm:w-[152px] sm:h-[152px] lg:w-[168px] lg:h-[168px]">
        <svg className="w-full h-full" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet">
          <circle cx="100" cy="100" r="80" fill="none" stroke="#e5e7eb" strokeWidth="2" />
          {hasData
            ? data.map((item, index) => {
                const percentage = (item.value / total) * 100;
                const strokeDasharray = `${percentage * 5.024} 502.4`;
                const strokeDashoffset = -cumulativePercentage * 5.024;
                cumulativePercentage += percentage;
                return (
                  <circle
                    key={index}
                    cx="100"
                    cy="100"
                    r="80"
                    fill="none"
                    stroke={colors[index % colors.length]}
                    strokeWidth="20"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    transform="rotate(-90 100 100)"
                  />
                );
              })
            : (
              <circle
                cx="100"
                cy="100"
                r="80"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="20"
              />
            )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-lg sm:text-xl font-bold text-gray-900">
                {displayTotal}
                {isPercentageChart && '%'}
              </div>
              <div className="text-xs sm:text-sm text-gray-600">
                {isPercentageChart ? 'Total share' : 'Total'}
              </div>
            </div>
        </div>
      </div>
      {/* Legend: always below chart so text is never squeezed or truncated */}
      <div className="w-full min-w-0 overflow-visible flex flex-col items-center">
        <h4 className="text-base sm:text-lg font-semibold mb-2 text-gray-900 break-words w-full text-center">{title}</h4>
        <div className="grid w-full grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
          {data.map((item, index) => {
            const rawValue = Number(item.value) || 0;
            const valueLabel = isPercentageChart
              ? `${(Math.round(rawValue * 10) / 10).toFixed(1).replace(/\.0$/, '')}%`
              : rawValue.toLocaleString();
            return (
              <div key={index} className="flex items-center justify-center sm:justify-start gap-2 min-w-0">
                <div
                  className="w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="text-sm text-gray-600 break-words min-w-0">
                  {item.label}
                </span>
                <span className="text-sm font-medium text-gray-900 flex-shrink-0">{valueLabel}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const BarChart = ({ data, title, color = '#3B82F6', horizontal = false }) => {
  if (!data || !Array.isArray(data)) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
        <div className="text-center">
          <div className="text-gray-500 text-lg font-medium">{title}</div>
          <div className="text-gray-400 text-sm mt-2">No data available</div>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(item => item.value));

  // Horizontal bar chart (better for longer labels)
  if (horizontal) {
    return (
      <div className="w-full min-w-0 p-3 sm:p-4 overflow-visible">
        <h4 className="text-base sm:text-lg font-semibold mb-4 text-gray-900 break-words hyphens-auto">{title}</h4>
        <div className="space-y-3">
          {data.map((item, index) => {
            const width = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
            return (
              <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="text-sm text-gray-700 font-medium w-full sm:w-36 text-left sm:text-right break-words">
                  {item.label}
                </div>
                <div className="flex-1 bg-gray-200 rounded-full h-8 relative overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500 hover:opacity-90 flex items-center justify-end pr-2"
                    style={{ 
                      width: `${width}%`, 
                      backgroundColor: color,
                      minWidth: width > 0 ? '20px' : '0'
                    }}
                  >
                    <span className="text-xs font-semibold text-white">{item.value.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Vertical bar chart (original)
  return (
    <div className="w-full min-w-0 p-4 overflow-visible">
      <h4 className="text-base sm:text-lg font-semibold mb-4 text-gray-900 break-words hyphens-auto">{title}</h4>
      <div className="flex items-end justify-between h-64 space-x-2 sm:space-x-3">
        {data.map((item, index) => {
          const height = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
          return (
            <div key={index} className="flex flex-col items-center flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-700 mb-2">{item.value.toLocaleString()}</div>
              <div className="relative w-full flex-1 flex items-end">
                <div 
                  className="w-full rounded-t-lg transition-all duration-500 hover:opacity-80 shadow-md"
                  style={{ 
                    height: `${Math.max(height, 5)}%`, 
                    backgroundColor: color,
                    minHeight: height > 0 ? '20px' : '0'
                  }}
                ></div>
              </div>
              <div className="text-xs text-gray-600 mt-2 text-center font-medium break-words min-w-0 px-0.5">{item.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const LineChart = ({ data, title, color = '#10B981' }) => {
  const [tooltip, setTooltip] = React.useState(null);

  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="w-full h-56 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
        <div className="text-center">
          <div className="text-gray-500 text-base font-medium">{title}</div>
          <div className="text-gray-400 text-sm mt-1">No data available</div>
        </div>
      </div>
    );
  }

  // Chart dimensions
  const W = 560;
  const H = 220;
  const padL = 52;
  const padR = 24;
  const padT = 20;
  const padB = 44;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const values = data.map(d => d.value);
  const rawMax = Math.max(...values);
  const rawMin = Math.min(...values);
  // Nice round max, min at 0 unless all values > 0
  const niceMax = rawMax === 0 ? 10 : Math.ceil(rawMax * 1.15);
  const niceMin = 0;
  const range = niceMax - niceMin || 1;

  // Y-axis ticks (5 lines)
  const yTicks = 5;
  const yStep = range / yTicks;

  const xOf = (i) => padL + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
  const yOf = (v) => padT + chartH - ((v - niceMin) / range) * chartH;

  // Smooth polyline points
  const linePoints = data.map((d, i) => `${xOf(i)},${yOf(d.value)}`).join(' ');

  // Area path (filled under line, back to baseline)
  const areaPath = [
    `M ${xOf(0)},${yOf(data[0].value)}`,
    ...data.map((d, i) => `L ${xOf(i)},${yOf(d.value)}`),
    `L ${xOf(data.length - 1)},${padT + chartH}`,
    `L ${xOf(0)},${padT + chartH}`,
    'Z'
  ].join(' ');

  // Unique gradient id per color to avoid collisions when multiple charts rendered
  const gradId = `lcg-${color.replace('#', '')}`;

  return (
    <div className="w-full">
      {title && <h4 className="text-base font-semibold text-gray-900 mb-3">{title}</h4>}
      <div className="relative w-full" style={{ paddingBottom: '40%' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 w-full h-full"
          onMouseLeave={() => setTooltip(null)}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Y-axis grid lines + labels */}
          {Array.from({ length: yTicks + 1 }, (_, i) => {
            const v = niceMin + yStep * i;
            const y = yOf(v);
            return (
              <g key={i}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="11" fill="#9ca3af">
                  {Math.round(v)}
                </text>
              </g>
            );
          })}

          {/* X-axis baseline */}
          <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="#d1d5db" strokeWidth="1" />

          {/* Area fill */}
          <path d={areaPath} fill={`url(#${gradId})`} />

          {/* Line */}
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={linePoints}
          />

          {/* X-axis labels + dots + hover targets */}
          {data.map((d, i) => {
            const cx = xOf(i);
            const cy = yOf(d.value);
            const isHovered = tooltip && tooltip.i === i;
            // Show label every N labels if too many
            const showLabel = data.length <= 14 || i % Math.ceil(data.length / 14) === 0 || i === data.length - 1;
            return (
              <g key={i}>
                {/* Hover invisible hit area */}
                <rect
                  x={cx - 16}
                  y={padT}
                  width={32}
                  height={chartH + 10}
                  fill="transparent"
                  onMouseEnter={() => setTooltip({ i, x: cx, y: cy, label: d.label, value: d.value })}
                />
                {/* Dot */}
                <circle
                  cx={cx} cy={cy}
                  r={isHovered ? 6 : 4}
                  fill={isHovered ? '#fff' : color}
                  stroke={color}
                  strokeWidth="2"
                  style={{ transition: 'r 0.1s' }}
                />
                {/* X label */}
                {showLabel && (
                  <text
                    x={cx}
                    y={padT + chartH + 18}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#6b7280"
                  >
                    {String(d.label).length > 7 ? String(d.label).slice(-7) : d.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Tooltip */}
          {tooltip && (() => {
            const bw = 72, bh = 36, br = 6;
            let tx = tooltip.x - bw / 2;
            let ty = tooltip.y - bh - 10;
            if (tx < 4) tx = 4;
            if (tx + bw > W - 4) tx = W - bw - 4;
            if (ty < 4) ty = tooltip.y + 14;
            return (
              <g>
                <rect x={tx} y={ty} width={bw} height={bh} rx={br} fill="#1f2937" opacity="0.9" />
                <text x={tx + bw / 2} y={ty + 13} textAnchor="middle" fontSize="10" fill="#d1d5db">
                  {tooltip.label}
                </text>
                <text x={tx + bw / 2} y={ty + 27} textAnchor="middle" fontSize="13" fontWeight="bold" fill="#fff">
                  {tooltip.value.toLocaleString()}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
};

export const MetricCard = ({ title, value, change, trend }) => {
  const isPositive = trend === 'up';
  const isNegative = trend === 'down';
  
  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        {change && (
          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
            isPositive ? 'bg-green-100 text-green-800' :
            isNegative ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {isPositive && (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            )}
            {isNegative && (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
            <span>{change}</span>
          </div>
        )}
      </div>
    </div>
  );
};
