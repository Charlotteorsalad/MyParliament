import React, { useState } from 'react';

// Palette of distinct colours for topic lines
const PALETTE = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#F97316', // orange
  '#EC4899', // pink
  '#84CC16', // lime
  '#6366F1', // indigo
];

const TREND_CONFIG = {
  increasing: { label: 'Increasing', bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  decreasing: { label: 'Decreasing', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  stable: { label: 'Stable', bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  unknown: { label: 'Unknown', bg: 'bg-gray-50', text: 'text-gray-400', dot: 'bg-gray-300' },
};

/**
 * ArimaForecastChart
 *
 * Props:
 *   timePoints   : string[]  — era keys  e.g. ['13_1_1', '13_1_2', ...]
 *   timeLabels   : string[]  — display labels e.g. ['P13 Pg1 M1', ...]
 *   series       : { [topic]: number[] }  — historical counts (length == timePoints)
 *   forecasts    : { [topic]: number[] }  — forecast counts (length == forecastSteps)
 *   trends       : { [topic]: 'increasing'|'decreasing'|'stable'|'unknown' }
 *   topTopics    : string[]  — ordered list of topic names to show
 *   forecastSteps: number
 *   title        : string
 */
const ArimaForecastChart = ({
  timePoints = [],
  timeLabels = [],
  series = {},
  forecasts = {},
  trends = {},
  topTopics = [],
  forecastSteps = 3,
  title = 'Issue Portal Topic Trend & Forecast',
}) => {
  const [displayCount, setDisplayCount] = useState(5);
  const [tooltip, setTooltip] = useState(null);
  const [hoveredTopic, setHoveredTopic] = useState(null);

  const shownTopics = topTopics.slice(0, displayCount);

  // Build combined x-axis: historical eras + forecast labels
  const historicalLen = timePoints.length;
  const forecastLabels = Array.from({ length: forecastSteps }, (_, i) => `F+${i + 1}`);
  const allLabels = [
    ...(timeLabels.length === historicalLen ? timeLabels : timePoints),
    ...forecastLabels,
  ];
  const totalPoints = historicalLen + forecastSteps;

  // Compute global y range
  let globalMax = 1;
  for (const topic of shownTopics) {
    const hist = series[topic] || [];
    const fc = forecasts[topic] || [];
    [...hist, ...fc].forEach(v => { if (v > globalMax) globalMax = v; });
  }
  const niceMax = Math.ceil(globalMax * 1.2) || 10;

  // SVG dimensions
  const W = 700;
  const H = 280;
  const padL = 48;
  const padR = 20;
  const padT = 24;
  const padB = 56;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const xOf = (i) => padL + (totalPoints <= 1 ? chartW / 2 : (i / (totalPoints - 1)) * chartW);
  const yOf = (v) => padT + chartH - (Math.max(0, v) / niceMax) * chartH;

  const yTicks = 5;

  // Shaded forecast region background
  const forecastX0 = xOf(historicalLen - 1);
  const forecastX1 = xOf(totalPoints - 1);

  if (!topTopics.length || !historicalLen) {
    return (
      <div className="w-full h-56 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
        <div className="text-center">
          <div className="text-gray-500 text-base font-medium">{title}</div>
          <div className="text-gray-400 text-sm mt-1">No forecast data available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-base font-semibold text-gray-900">{title}</h4>
        {/* Topic count selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Show top</span>
          {[5, 8, 10].map(n => (
            <button
              key={n}
              onClick={() => setDisplayCount(n)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                displayCount === n
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {n}
            </button>
          ))}
          <span className="text-xs text-gray-500">topics</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {shownTopics.map((topic, idx) => {
          const color = PALETTE[idx % PALETTE.length];
          const trend = trends[topic] || 'unknown';
          const tc = TREND_CONFIG[trend] || TREND_CONFIG.unknown;
          return (
            <button
              key={topic}
              onMouseEnter={() => setHoveredTopic(topic)}
              onMouseLeave={() => setHoveredTopic(null)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all border ${
                hoveredTopic && hoveredTopic !== topic
                  ? 'opacity-30 border-transparent'
                  : 'opacity-100 border-gray-200 bg-white shadow-sm'
              }`}
            >
              <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
              <span className="text-gray-700 truncate max-w-[120px]" title={topic}>{topic}</span>
              <span className={`inline-flex items-center gap-0.5 px-1 rounded ${tc.bg} ${tc.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${tc.dot}`} />
                {tc.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* SVG Chart */}
      <div className="relative w-full" style={{ paddingBottom: '42%' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 w-full h-full"
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Forecast region shading */}
          <rect
            x={forecastX0}
            y={padT}
            width={forecastX1 - forecastX0}
            height={chartH}
            fill="#8B5CF6"
            fillOpacity="0.06"
          />
          {/* Dividing line at historical/forecast boundary */}
          <line
            x1={forecastX0}
            y1={padT}
            x2={forecastX0}
            y2={padT + chartH}
            stroke="#8B5CF6"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            opacity="0.6"
          />
          {/* "Forecast" label */}
          <text
            x={forecastX0 + 6}
            y={padT + 12}
            fontSize="10"
            fill="#8B5CF6"
            fontWeight="600"
            opacity="0.8"
          >
            Forecast
          </text>

          {/* Y-axis grid + labels */}
          {Array.from({ length: yTicks + 1 }, (_, i) => {
            const v = (niceMax / yTicks) * i;
            const y = yOf(v);
            return (
              <g key={i}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                <text x={padL - 5} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
                  {Math.round(v)}
                </text>
              </g>
            );
          })}

          {/* X-axis baseline */}
          <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="#d1d5db" strokeWidth="1" />

          {/* X-axis labels — show every nth to avoid overlap */}
          {allLabels.map((lbl, i) => {
            const step = Math.ceil(allLabels.length / 10);
            if (i % step !== 0 && i !== allLabels.length - 1) return null;
            return (
              <text
                key={i}
                x={xOf(i)}
                y={padT + chartH + 16}
                textAnchor="middle"
                fontSize="9"
                fill={i >= historicalLen ? '#8B5CF6' : '#6b7280'}
                fontWeight={i >= historicalLen ? '600' : '400'}
              >
                {lbl}
              </text>
            );
          })}

          {/* Topic lines */}
          {shownTopics.map((topic, idx) => {
            const color = PALETTE[idx % PALETTE.length];
            const hist = (series[topic] || []).slice(0, historicalLen);
            const fc = forecasts[topic] || [];
            const isHidden = hoveredTopic && hoveredTopic !== topic;
            const opacity = isHidden ? 0.12 : 1;

            // Historical line points
            const histPoints = hist.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ');
            // Forecast line points — starts from last historical value
            const lastHistVal = hist.length > 0 ? hist[hist.length - 1] : 0;
            const fcPoints = [
              `${xOf(historicalLen - 1)},${yOf(lastHistVal)}`,
              ...fc.map((v, i) => `${xOf(historicalLen + i)},${yOf(v)}`),
            ].join(' ');

            return (
              <g key={topic} opacity={opacity}>
                {/* Historical — solid */}
                {hist.length >= 2 && (
                  <polyline
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={histPoints}
                  />
                )}
                {/* Forecast — dashed */}
                {fc.length > 0 && (
                  <polyline
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeDasharray="5 3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={fcPoints}
                  />
                )}
                {/* Hover dots — historical */}
                {hist.map((v, i) => (
                  <circle
                    key={`h-${i}`}
                    cx={xOf(i)}
                    cy={yOf(v)}
                    r="3.5"
                    fill={color}
                    fillOpacity="0"
                    stroke="none"
                    onMouseEnter={(e) =>
                      setTooltip({ topic, label: allLabels[i], value: v, forecast: false, x: xOf(i), y: yOf(v), color })
                    }
                    style={{ cursor: 'pointer' }}
                  />
                ))}
                {/* Hover dots — forecast */}
                {fc.map((v, i) => (
                  <circle
                    key={`f-${i}`}
                    cx={xOf(historicalLen + i)}
                    cy={yOf(v)}
                    r="3.5"
                    fill={color}
                    fillOpacity="0"
                    stroke="none"
                    onMouseEnter={() =>
                      setTooltip({ topic, label: allLabels[historicalLen + i], value: v, forecast: true, x: xOf(historicalLen + i), y: yOf(v), color })
                    }
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </g>
            );
          })}

          {/* Tooltip */}
          {tooltip && (() => {
            const bw = 160;
            const bh = 52;
            const tx = Math.min(tooltip.x - bw / 2, W - padR - bw);
            const ty = Math.max(padT, tooltip.y - bh - 10);
            return (
              <g pointerEvents="none">
                <rect x={tx} y={ty} width={bw} height={bh} rx="5" fill="white" stroke="#e5e7eb" strokeWidth="1" filter="url(#shadow)" />
                <text x={tx + 8} y={ty + 16} fontSize="10" fill="#374151" fontWeight="600">
                  {tooltip.topic.length > 22 ? tooltip.topic.slice(0, 22) + '...' : tooltip.topic}
                </text>
                <text x={tx + 8} y={ty + 30} fontSize="10" fill="#6b7280">
                  {tooltip.label}
                </text>
                <text x={tx + 8} y={ty + 44} fontSize="11" fill={tooltip.color} fontWeight="700">
                  {tooltip.forecast ? 'Forecast: ' : 'Count: '}{Math.round(tooltip.value * 10) / 10}
                </text>
                <defs>
                  <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.12" />
                  </filter>
                </defs>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Legend row: solid = historical, dashed = forecast */}
      <div className="flex items-center gap-4 text-xs text-gray-500 pt-1">
        <span className="flex items-center gap-1.5">
          <svg width="24" height="10">
            <line x1="0" y1="5" x2="24" y2="5" stroke="#6b7280" strokeWidth="2" />
          </svg>
          Historical data
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="24" height="10">
            <line x1="0" y1="5" x2="24" y2="5" stroke="#8B5CF6" strokeWidth="2" strokeDasharray="5 3" />
          </svg>
          Forecast (ARIMA 1,1,0)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-violet-100 border border-violet-300" />
          Forecast region
        </span>
      </div>
    </div>
  );
};

export default ArimaForecastChart;
