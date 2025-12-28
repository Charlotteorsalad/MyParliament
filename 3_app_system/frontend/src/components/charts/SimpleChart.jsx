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

  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cumulativePercentage = 0;

  return (
    <div className="w-full h-64 flex items-center justify-center">
      <div className="relative">
        <svg width="200" height="200" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="80" fill="none" stroke="#e5e7eb" strokeWidth="2" />
          {data.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const strokeDasharray = `${percentage * 5.024} 502.4`; // 502.4 is circumference of circle with r=80
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
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
        </div>
      </div>
      <div className="ml-6">
        <h4 className="text-lg font-semibold mb-3">{title}</h4>
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center space-x-2">
              <div 
                className="w-4 h-4 rounded-full" 
                style={{ backgroundColor: colors[index % colors.length] }}
              ></div>
              <span className="text-sm text-gray-600">{item.label}</span>
              <span className="text-sm font-medium text-gray-900">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const BarChart = ({ data, title, color = '#3B82F6' }) => {
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

  return (
    <div className="w-full h-64 p-4">
      <h4 className="text-lg font-semibold mb-4">{title}</h4>
      <div className="flex items-end justify-between h-48 space-x-2">
        {data.map((item, index) => {
          const height = (item.value / maxValue) * 100;
          return (
            <div key={index} className="flex flex-col items-center flex-1">
              <div className="text-xs text-gray-600 mb-1">{item.value}</div>
              <div 
                className="w-full rounded-t-md transition-all duration-500 hover:opacity-80"
                style={{ 
                  height: `${height}%`, 
                  backgroundColor: color,
                  minHeight: '4px'
                }}
              ></div>
              <div className="text-xs text-gray-600 mt-2 text-center">{item.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const LineChart = ({ data, title, color = '#10B981' }) => {
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
  const minValue = Math.min(...data.map(item => item.value));
  const range = maxValue - minValue || 1;

  const points = data.map((item, index) => {
    const x = (index / (data.length - 1)) * 300;
    const y = 150 - ((item.value - minValue) / range) * 120;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full h-64 p-4">
      <h4 className="text-lg font-semibold mb-4">{title}</h4>
      <div className="relative">
        <svg width="300" height="150" viewBox="0 0 300 150" className="border border-gray-200 rounded">
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2"
            points={points}
          />
          {data.map((item, index) => {
            const x = (index / (data.length - 1)) * 300;
            const y = 150 - ((item.value - minValue) / range) * 120;
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="4"
                fill={color}
              />
            );
          })}
        </svg>
        <div className="flex justify-between mt-2 text-xs text-gray-600">
          {data.map((item, index) => (
            <div key={index} className="text-center">
              <div>{item.label}</div>
              <div className="font-medium">{item.value}</div>
            </div>
          ))}
        </div>
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
