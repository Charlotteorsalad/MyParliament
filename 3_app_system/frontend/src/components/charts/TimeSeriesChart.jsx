import React, { useState } from 'react';

const TimeSeriesChart = ({ 
  data, 
  title, 
  metrics = ['cpuUsage', 'memoryUsage'], 
  colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'],
  height = 300 
}) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [selectedMetrics, setSelectedMetrics] = useState(metrics);

  // Check for various no-data conditions
  const timeSeriesData = data && data[`last${selectedTimeRange}`] ? data[`last${selectedTimeRange}`] : [];
  const hasNoData = !data || timeSeriesData.length === 0;
  const hasNoMetrics = selectedMetrics.length === 0;
  const hasInsufficientData = timeSeriesData.length < 2 && !hasNoData; // Need at least 2 points for a meaningful chart

  if (hasNoData || hasNoMetrics || hasInsufficientData) {
    return (
      <div className="bg-white rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 sm:mb-0">{title}</h3>
          <div className="flex flex-wrap gap-2">
            {/* Time Range Selector */}
            <div className="flex flex-wrap bg-gray-100 rounded-lg p-1 gap-1">
              {[
                { key: '1h', label: '1H' }, { key: '6h', label: '6H' }, { key: '24h', label: '1D' },
                { key: '7d', label: '7D' }, { key: '30d', label: '30D' }, { key: '6m', label: '6M' },
                { key: '1y', label: '1Y' }, { key: '3y', label: '3Y' }
              ].map((range) => (
                <button
                  key={range.key}
                  onClick={() => setSelectedTimeRange(range.key)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    selectedTimeRange === range.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Metric Toggles */}
        <div className="flex flex-wrap gap-2 mb-6">
          {metrics.map((metric, index) => (
            <button
              key={metric}
              onClick={() => {
                if (selectedMetrics.includes(metric)) {
                  setSelectedMetrics(selectedMetrics.filter(m => m !== metric));
                } else {
                  setSelectedMetrics([...selectedMetrics, metric]);
                }
              }}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedMetrics.includes(metric)
                  ? 'text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={selectedMetrics.includes(metric) ? { backgroundColor: colors[index % colors.length] } : {}}
            >
              {['cpuUsage', 'memoryUsage', 'systemLoad', 'responseTime'].includes(metric) ? 
                ['CPU Usage (%)', 'Memory Usage (%)', 'System Load', 'Response Time (ms)'][
                  ['cpuUsage', 'memoryUsage', 'systemLoad', 'responseTime'].indexOf(metric)
                ] : metric}
            </button>
          ))}
        </div>
        
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-4">
              {hasNoMetrics ? '🎯' : hasInsufficientData ? '⏳' : '📊'}
            </div>
            {hasNoMetrics ? (
              <div>
                <p className="text-lg font-medium text-gray-700 mb-2">No Metrics Selected</p>
                <p className="text-sm text-gray-500">Please select one or more metrics to display the chart</p>
              </div>
            ) : hasInsufficientData ? (
              <div>
                <p className="text-lg font-medium text-gray-700 mb-2">Not Enough Data</p>
                <p className="text-sm text-gray-500">Insufficient data points for the selected time period</p>
                <p className="text-xs text-gray-400 mt-1">Try selecting a longer time range or wait for more data to be collected</p>
              </div>
            ) : (
              <div>
                <p className="text-lg font-medium text-gray-700 mb-2">No Data Available</p>
                <p className="text-sm text-gray-500">No historical data available yet</p>
                <p className="text-xs text-gray-400 mt-1">Data will appear as the system collects performance metrics over time</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const maxValues = selectedMetrics.reduce((acc, metric) => {
    const values = timeSeriesData
      .filter(point => point && typeof point[metric] === 'number')
      .map(point => point[metric]);
    acc[metric] = values.length > 0 ? Math.max(...values) : 100;
    return acc;
  }, {});

  const svgWidth = 800;
  const svgHeight = height;
  const padding = { top: 20, right: 60, bottom: 60, left: 60 };
  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  const getPath = (metric) => {
    if (timeSeriesData.length < 2) return '';
    
    const maxValue = Math.max(maxValues[metric], 100); // Ensure minimum scale
    const points = timeSeriesData
      .filter(point => point && typeof point[metric] === 'number') // Filter out invalid points
      .map((point, index, validPoints) => {
        const originalIndex = timeSeriesData.indexOf(point);
        const x = padding.left + (originalIndex / (timeSeriesData.length - 1)) * chartWidth;
        const y = padding.top + chartHeight - ((point[metric] || 0) / maxValue) * chartHeight;
        return `${x},${y}`;
      });
    
    if (points.length < 2) return '';
    return `M ${points.join(' L ')}`;
  };

  const getYAxisTicks = (metric) => {
    const maxValue = Math.max(maxValues[metric], 100);
    const ticks = [];
    for (let i = 0; i <= 5; i++) {
      const value = (maxValue * i) / 5;
      const y = padding.top + chartHeight - (i / 5) * chartHeight;
      ticks.push({ value: Math.round(value), y });
    }
    return ticks;
  };

  const getXAxisTicks = () => {
    const ticks = [];
    const tickCount = Math.min(6, timeSeriesData.length);
    
    if (timeSeriesData.length === 0) {
      return ticks;
    }
    
    for (let i = 0; i < tickCount; i++) {
      const index = tickCount === 1 ? 0 : Math.floor((i / (tickCount - 1)) * (timeSeriesData.length - 1));
      const point = timeSeriesData[index];
      
      if (!point) continue; // Skip if point is undefined
      
      const x = padding.left + (index / (timeSeriesData.length - 1)) * chartWidth;
      
      // Create fallback labels if formatted ones don't exist
      const timestamp = point.timestamp || Date.now();
      const date = new Date(timestamp);
      
      ticks.push({ 
        x, 
        label: point.formattedTime || date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        fullLabel: point.formattedDate || date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      });
    }
    return ticks;
  };

  const metricLabels = {
    cpuUsage: 'CPU Usage (%)',
    memoryUsage: 'Memory Usage (%)',
    systemLoad: 'System Load',
    responseTime: 'Response Time (ms)',
    activeConnections: 'Active Connections'
  };

  const toggleMetric = (metric) => {
    if (selectedMetrics.includes(metric)) {
      setSelectedMetrics(selectedMetrics.filter(m => m !== metric));
    } else {
      setSelectedMetrics([...selectedMetrics, metric]);
    }
  };

  return (
    <div className="bg-white rounded-lg p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 sm:mb-0">{title}</h3>
        
        <div className="flex flex-wrap gap-2">
          {/* Time Range Selector */}
          <div className="flex flex-wrap bg-gray-100 rounded-lg p-1 gap-1">
            {[
              { key: '1h', label: '1H' },
              { key: '6h', label: '6H' },
              { key: '24h', label: '1D' },
              { key: '7d', label: '7D' },
              { key: '30d', label: '30D' },
              { key: '6m', label: '6M' },
              { key: '1y', label: '1Y' },
              { key: '3y', label: '3Y' }
            ].map((range) => (
              <button
                key={range.key}
                onClick={() => setSelectedTimeRange(range.key)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  selectedTimeRange === range.key
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metric Toggles */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.keys(metricLabels).map((metric, index) => (
          <button
            key={metric}
            onClick={() => toggleMetric(metric)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedMetrics.includes(metric)
                ? 'text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={{
              backgroundColor: selectedMetrics.includes(metric) ? colors[index % colors.length] : undefined
            }}
          >
            {metricLabels[metric]}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="overflow-x-auto">
        <svg width={svgWidth} height={svgHeight} className="w-full">
          {/* Grid Lines */}
          {getYAxisTicks(selectedMetrics[0]).map((tick, index) => (
            <g key={index}>
              <line
                x1={padding.left}
                y1={tick.y}
                x2={padding.left + chartWidth}
                y2={tick.y}
                stroke="#f3f4f6"
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={tick.y + 4}
                textAnchor="end"
                className="text-xs fill-gray-500"
              >
                {tick.value}
              </text>
            </g>
          ))}

          {/* X-Axis Ticks */}
          {getXAxisTicks().map((tick, index) => (
            <g key={index}>
              <line
                x1={tick.x}
                y1={padding.top}
                x2={tick.x}
                y2={padding.top + chartHeight}
                stroke="#f3f4f6"
                strokeWidth="1"
              />
              <text
                x={tick.x}
                y={padding.top + chartHeight + 20}
                textAnchor="middle"
                className="text-xs fill-gray-500"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Data Lines */}
          {selectedMetrics.map((metric, index) => (
            <path
              key={metric}
              d={getPath(metric)}
              fill="none"
              stroke={colors[index % colors.length]}
              strokeWidth="2"
              className="drop-shadow-sm"
            />
          ))}

          {/* Data Points */}
          {selectedMetrics.map((metric, metricIndex) => 
            timeSeriesData
              .filter((point, pointIndex) => point && typeof point[metric] === 'number') // Only render valid points
              .map((point, pointIndex) => {
                const originalIndex = timeSeriesData.indexOf(point);
                const maxValue = Math.max(maxValues[metric], 100);
                const x = padding.left + (originalIndex / (timeSeriesData.length - 1)) * chartWidth;
                const y = padding.top + chartHeight - ((point[metric] || 0) / maxValue) * chartHeight;
                
                // Create fallback for tooltip
                const timestamp = point.timestamp || Date.now();
                const date = new Date(timestamp);
                const tooltipDate = point.formattedDate || date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                
                return (
                  <circle
                    key={`${metric}-${originalIndex}`}
                    cx={x}
                    cy={y}
                    r="3"
                    fill={colors[metricIndex % colors.length]}
                    className="drop-shadow-sm"
                  >
                    <title>{`${metricLabels[metric]}: ${point[metric] || 0}${metric.includes('Usage') ? '%' : ''} at ${tooltipDate}`}</title>
                  </circle>
                );
              })
          )}

          {/* Axes */}
          <line
            x1={padding.left}
            y1={padding.top + chartHeight}
            x2={padding.left + chartWidth}
            y2={padding.top + chartHeight}
            stroke="#6b7280"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + chartHeight}
            stroke="#6b7280"
            strokeWidth="1"
          />
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-200">
        {selectedMetrics.map((metric, index) => (
          <div key={metric} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: colors[index % colors.length] }}
            ></div>
            <span className="text-sm text-gray-600">{metricLabels[metric]}</span>
            {timeSeriesData.length > 0 && (
              <span className="text-sm font-medium text-gray-900">
                {(() => {
                  const lastPoint = timeSeriesData[timeSeriesData.length - 1];
                  const value = lastPoint && typeof lastPoint[metric] === 'number' ? lastPoint[metric] : 0;
                  const safeValue = isNaN(value) ? 0 : value;
                  return safeValue.toFixed(1);
                })()}
                {metric.includes('Usage') ? '%' : metric === 'responseTime' ? 'ms' : ''}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Data Info & Summary Stats */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-start mb-3">
          <h4 className="text-sm font-semibold text-gray-700">Performance Summary ({selectedTimeRange})</h4>
          <div className="text-xs text-gray-500">
            {['7d', '30d'].includes(selectedTimeRange) && '📊 Daily Averages'}
            {['6m', '1y'].includes(selectedTimeRange) && '📊 Monthly Averages'}
            {['3y'].includes(selectedTimeRange) && '📊 Yearly Averages'}
            {['1h', '6h', '24h'].includes(selectedTimeRange) && '📊 Real-time Data'}
            {timeSeriesData.length > 0 && ` • ${timeSeriesData.length} data points`}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {selectedMetrics.map((metric) => {
            const values = timeSeriesData
              .filter(point => point && typeof point[metric] === 'number')
              .map(point => point[metric]);
            
            if (values.length === 0) {
              return (
                <div key={metric} className="text-center">
                  <p className="text-gray-600">{metricLabels[metric]}</p>
                  <p className="font-medium">No Data</p>
                  <p className="text-xs text-gray-500">-</p>
                </div>
              );
            }
            
            const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
            const max = Math.max(...values);
            const min = Math.min(...values);
            
            // Ensure no NaN values
            const safeAvg = isNaN(avg) ? 0 : avg;
            const safeMax = isNaN(max) ? 0 : max;
            const safeMin = isNaN(min) ? 0 : min;
            
            return (
              <div key={metric} className="text-center">
                <p className="text-gray-600">{metricLabels[metric]}</p>
                <p className="font-medium">Avg: {safeAvg.toFixed(1)}{metric.includes('Usage') ? '%' : ''}</p>
                <p className="text-xs text-gray-500">
                  Min: {safeMin.toFixed(1)} | Max: {safeMax.toFixed(1)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TimeSeriesChart;
