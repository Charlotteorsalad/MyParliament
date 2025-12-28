import React from 'react';
import { BarChart, LineChart } from './SimpleChart';

export const ModelComparisonChart = ({ models, metric = 'accuracy', title }) => {
  if (!models || models.length === 0) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
        <div className="text-center">
          <div className="text-gray-500 text-lg font-medium">No Models Available</div>
          <div className="text-gray-400 text-sm mt-2">Model data will appear here</div>
        </div>
      </div>
    );
  }

  const data = models.map(model => ({
    label: model.name.split(' ')[0], // Shortened name for chart
    value: model[metric]
  }));

  const getColor = (index) => {
    const colors = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444'];
    return colors[index % colors.length];
  };

  return (
    <div className="space-y-4">
      <BarChart
        data={data}
        title={title || `${metric.charAt(0).toUpperCase() + metric.slice(1)} Comparison`}
        color="#3B82F6"
      />
      
      {/* Model Details Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Model</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Version</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Accuracy</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">F1 Score</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Predictions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {models.map((model, index) => (
                <tr key={model.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: getColor(index) }}
                      ></div>
                      <div>
                        <div className="font-medium text-gray-900">{model.name}</div>
                        <div className="text-xs text-gray-500">{model.type}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{model.version}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      model.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : model.status === 'testing'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {model.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{model.accuracy}%</td>
                  <td className="px-4 py-3 text-gray-600">{model.f1Score}%</td>
                  <td className="px-4 py-3 text-gray-600">{model.totalPredictions.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const ModelTrendsChart = ({ trendsData, selectedModels = [] }) => {
  if (!trendsData || !trendsData.accuracy || trendsData.accuracy.length === 0) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
        <div className="text-center">
          <div className="text-gray-500 text-lg font-medium">No Trend Data Available</div>
          <div className="text-gray-400 text-sm mt-2">Trend data will appear here</div>
        </div>
      </div>
    );
  }

  const colors = {
    hansard: '#3B82F6',
    sentiment: '#10B981',
    topic: '#8B5CF6',
    entity: '#F59E0B'
  };

  // Prepare data for multi-line chart
  const dates = trendsData.accuracy.map(item => 
    new Date(item.date).toLocaleDateString('en-US', { month: 'short' })
  );

  return (
    <div className="space-y-6">
      {/* Accuracy Trends */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h4 className="text-lg font-semibold mb-4">Model Accuracy Trends</h4>
        <div className="relative">
          <svg width="100%" height="300" viewBox="0 0 600 300" className="border border-gray-200 rounded">
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map(y => (
              <line
                key={y}
                x1="50"
                y1={250 - (y * 2)}
                x2="550"
                y2={250 - (y * 2)}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
            ))}
            
            {/* Y-axis labels */}
            {[0, 25, 50, 75, 100].map(y => (
              <text
                key={y}
                x="40"
                y={255 - (y * 2)}
                textAnchor="end"
                className="text-xs fill-gray-600"
              >
                {y}%
              </text>
            ))}

            {/* Model accuracy lines */}
            {Object.entries(colors).map(([modelKey, color]) => {
              const points = trendsData.accuracy.map((item, index) => {
                const x = 50 + (index * (500 / (trendsData.accuracy.length - 1)));
                const y = 250 - (item[modelKey] * 2);
                return `${x},${y}`;
              }).join(' ');

              return (
                <g key={modelKey}>
                  <polyline
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    points={points}
                  />
                  {trendsData.accuracy.map((item, index) => {
                    const x = 50 + (index * (500 / (trendsData.accuracy.length - 1)));
                    const y = 250 - (item[modelKey] * 2);
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
                </g>
              );
            })}

            {/* X-axis labels */}
            {dates.map((date, index) => (
              <text
                key={index}
                x={50 + (index * (500 / (dates.length - 1)))}
                y="280"
                textAnchor="middle"
                className="text-xs fill-gray-600"
              >
                {date}
              </text>
            ))}
          </svg>

          {/* Legend */}
          <div className="flex justify-center mt-4 space-x-6">
            {Object.entries(colors).map(([modelKey, color]) => (
              <div key={modelKey} className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: color }}
                ></div>
                <span className="text-sm text-gray-600 capitalize">
                  {modelKey === 'hansard' ? 'Hansard Classifier' : 
                   modelKey === 'sentiment' ? 'Sentiment Analyzer' :
                   modelKey === 'topic' ? 'Topic Extractor' : 
                   'Entity Recognizer'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Prediction Volume Trends */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h4 className="text-lg font-semibold mb-4">Prediction Volume Trends</h4>
        <div className="relative">
          <svg width="100%" height="250" viewBox="0 0 600 250" className="border border-gray-200 rounded">
            {/* Stacked bar chart for predictions */}
            {trendsData.predictions.map((monthData, monthIndex) => {
              const barWidth = 60;
              const barX = 80 + (monthIndex * 150);
              let stackY = 200;

              return (
                <g key={monthIndex}>
                  {Object.entries(colors).map(([modelKey, color]) => {
                    const value = monthData[modelKey];
                    const barHeight = (value / 20000) * 150; // Scale to fit
                    stackY -= barHeight;
                    
                    return (
                      <rect
                        key={modelKey}
                        x={barX}
                        y={stackY}
                        width={barWidth}
                        height={barHeight}
                        fill={color}
                        opacity="0.8"
                      />
                    );
                  })}
                  
                  {/* Month label */}
                  <text
                    x={barX + barWidth / 2}
                    y="230"
                    textAnchor="middle"
                    className="text-xs fill-gray-600"
                  >
                    {dates[monthIndex]}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};

export const ModelMetricsRadar = ({ models, selectedModel }) => {
  if (!selectedModel || !models.find(m => m.id === selectedModel)) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
        <div className="text-center">
          <div className="text-gray-500 text-lg font-medium">Select a Model</div>
          <div className="text-gray-400 text-sm mt-2">Model metrics will appear here</div>
        </div>
      </div>
    );
  }

  const model = models.find(m => m.id === selectedModel);
  const metrics = [
    { label: 'Accuracy', value: model.accuracy, max: 100 },
    { label: 'Precision', value: model.precision, max: 100 },
    { label: 'Recall', value: model.recall, max: 100 },
    { label: 'F1 Score', value: model.f1Score, max: 100 }
  ];

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h4 className="text-lg font-semibold mb-4">{model.name} - Performance Metrics</h4>
      
      {/* Radar-style visualization using bars */}
      <div className="space-y-4">
        {metrics.map((metric, index) => {
          const percentage = (metric.value / metric.max) * 100;
          return (
            <div key={index} className="flex items-center space-x-4">
              <div className="w-20 text-sm text-gray-600 font-medium">{metric.label}</div>
              <div className="flex-1 bg-gray-200 rounded-full h-3 relative">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
              <div className="w-12 text-sm font-medium text-gray-900 text-right">
                {metric.value}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Model Info */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Version:</span>
            <span className="ml-2 font-medium text-gray-900">{model.version}</span>
          </div>
          <div>
            <span className="text-gray-600">Type:</span>
            <span className="ml-2 font-medium text-gray-900">{model.type}</span>
          </div>
          <div>
            <span className="text-gray-600">Inference Time:</span>
            <span className="ml-2 font-medium text-gray-900">{model.inferenceTime}ms</span>
          </div>
          <div>
            <span className="text-gray-600">Success Rate:</span>
            <span className="ml-2 font-medium text-gray-900">
              {((model.successfulPredictions / model.totalPredictions) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
