import React, { useState } from 'react';

const TrainTestInferenceRadar = ({ models = [] }) => {
  const [selectedDataset, setSelectedDataset] = useState('train');

  if (!models || models.length === 0) {
    return (
      <div className="w-full h-96 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-200">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">No metrics available</p>
        </div>
      </div>
    );
  }

  const width = 500;
  const height = 500;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.35;
  const numMetrics = 5;
  const angleStep = (2 * Math.PI) / numMetrics;

  const metrics = [
    { key: 'npmi', label: 'NPMI', color: '#3B82F6' },
    { key: 'cv', label: 'CV', color: '#10B981' },
    { key: 'topic_diversity', label: 'Topic Diversity', color: '#F59E0B' },
    { key: 'silhouette', label: 'Silhouette', color: '#8B5CF6' },
    { key: 'n_clusters', label: 'Clusters', color: '#6366F1' }
  ];

  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4'
  ];

  const getMetricValue = (model, metricKey, dataset) => {
    const metrics = model.realMetrics || {};
    
    if (metricKey === 'n_clusters') {
      if (dataset === 'train') return metrics.n_clusters;
      if (dataset === 'test') return metrics.n_clusters;
      if (dataset === 'inference') return metrics.inference_n_clusters || metrics.n_clusters;
      return metrics.n_clusters;
    }

    if (dataset === 'train') {
      if (metricKey === 'npmi') {
        return metrics.train_npmi !== undefined && metrics.train_npmi !== null 
          ? metrics.train_npmi 
          : (metrics.train_coherence_npmi !== undefined && metrics.train_coherence_npmi !== null 
            ? metrics.train_coherence_npmi : null);
      }
      if (metricKey === 'cv') {
        return metrics.train_cv !== undefined && metrics.train_cv !== null 
          ? metrics.train_cv 
          : (metrics.train_coherence_cv !== undefined && metrics.train_coherence_cv !== null 
            ? metrics.train_coherence_cv : null);
      }
      if (metricKey === 'topic_diversity') return metrics.train_topic_diversity;
      if (metricKey === 'silhouette') {
        return metrics.train_silhouette !== undefined && metrics.train_silhouette !== null 
          ? metrics.train_silhouette 
          : (metrics.train_silhouette_score !== undefined && metrics.train_silhouette_score !== null 
            ? metrics.train_silhouette_score : null);
      }
    }

    if (dataset === 'test') {
      if (metricKey === 'npmi') {
        return metrics.npmi !== undefined && metrics.npmi !== null 
          ? metrics.npmi 
          : (metrics.coherence_npmi !== undefined && metrics.coherence_npmi !== null 
            ? metrics.coherence_npmi : null);
      }
      if (metricKey === 'cv') {
        return metrics.cv !== undefined && metrics.cv !== null 
          ? metrics.cv 
          : (metrics.coherence_cv !== undefined && metrics.coherence_cv !== null 
            ? metrics.coherence_cv : null);
      }
      if (metricKey === 'topic_diversity') return metrics.topic_diversity;
      if (metricKey === 'silhouette') {
        return metrics.silhouette !== undefined && metrics.silhouette !== null 
          ? metrics.silhouette 
          : (metrics.silhouette_score !== undefined && metrics.silhouette_score !== null 
            ? metrics.silhouette_score : null);
      }
    }

    if (dataset === 'inference') {
      if (metricKey === 'npmi') {
        return metrics.inference_npmi !== undefined && metrics.inference_npmi !== null 
          ? metrics.inference_npmi 
          : (metrics.inference_coherence_npmi !== undefined && metrics.inference_coherence_npmi !== null 
            ? metrics.inference_coherence_npmi : null);
      }
      if (metricKey === 'cv') {
        return metrics.inference_cv !== undefined && metrics.inference_cv !== null 
          ? metrics.inference_cv 
          : (metrics.inference_coherence_cv !== undefined && metrics.inference_coherence_cv !== null 
            ? metrics.inference_coherence_cv : null);
      }
      if (metricKey === 'topic_diversity') return metrics.inference_topic_diversity;
      if (metricKey === 'silhouette') {
        return metrics.inference_silhouette !== undefined && metrics.inference_silhouette !== null 
          ? metrics.inference_silhouette 
          : (metrics.inference_silhouette_score !== undefined && metrics.inference_silhouette_score !== null 
            ? metrics.inference_silhouette_score : null);
      }
    }

    return null;
  };

  const normalizeValue = (value, metricKey, allValues, dataset) => {
    if (value === null || value === undefined) return 0;
    
    if (metricKey === 'n_clusters') {
      const clusterValues = allValues.map(m => {
        const val = getMetricValue(m, metricKey, dataset);
        return val || 0;
      }).filter(v => v > 0);
      if (clusterValues.length === 0) return 0;
      const maxClusters = Math.max(...clusterValues);
      const minClusters = Math.min(...clusterValues);
      if (maxClusters === minClusters) return 0.5;
      return (value - minClusters) / (maxClusters - minClusters);
    }

    const metricValues = allValues.map(m => getMetricValue(m, metricKey, dataset))
      .filter(v => v !== null && v !== undefined);

    if (metricValues.length === 0) return 0;
    
    const maxVal = Math.max(...metricValues);
    const minVal = Math.min(...metricValues);
    
    if (maxVal === minVal) return 0.5;
    return (value - minVal) / (maxVal - minVal);
  };

  const getPoint = (angle, normalizedValue) => {
    const x = centerX + Math.cos(angle - Math.PI / 2) * radius * normalizedValue;
    const y = centerY + Math.sin(angle - Math.PI / 2) * radius * normalizedValue;
    return { x, y };
  };

  const getPolygonPath = (model, dataset) => {
    const points = metrics.map((metric, index) => {
      const value = getMetricValue(model, metric.key, dataset);
      const normalized = normalizeValue(value, metric.key, models, dataset);
      return getPoint(index * angleStep, normalized);
    });
    
    return points.map((p, i) => 
      i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
    ).join(' ') + ' Z';
  };

  const getLabelPosition = (index) => {
    const angle = index * angleStep - Math.PI / 2;
    const labelRadius = radius * 1.15;
    return {
      x: centerX + Math.cos(angle) * labelRadius,
      y: centerY + Math.sin(angle) * labelRadius
    };
  };

  const datasets = [
    { key: 'train', label: 'Train Set', color: '#3B82F6' },
    { key: 'test', label: 'Test Set', color: '#10B981' },
    { key: 'inference', label: 'Inference Set', color: '#F59E0B' }
  ];

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">Dataset Performance Comparison</h3>
        <div className="flex space-x-2">
          {datasets.map((dataset) => (
            <button
              key={dataset.key}
              onClick={() => setSelectedDataset(dataset.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedDataset === dataset.key
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {dataset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {datasets.map((dataset) => {
          const isActive = selectedDataset === dataset.key;
          return (
            <div
              key={dataset.key}
              className={`border-2 rounded-xl p-4 transition-all ${
                isActive
                  ? 'border-gray-300 bg-gray-50'
                  : 'border-gray-200 bg-white opacity-60'
              }`}
            >
              <h4 className="text-sm font-semibold text-gray-700 mb-4 text-center">
                {dataset.label}
              </h4>
              <div className="flex items-center justify-center">
                <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="max-w-full">
                  <defs>
                    {models.map((_, index) => (
                      <linearGradient key={index} id={`gradient-${dataset.key}-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={colors[index % colors.length]} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={colors[index % colors.length]} stopOpacity="0.1" />
                      </linearGradient>
                    ))}
                  </defs>

                  <g>
                    {[0.2, 0.4, 0.6, 0.8, 1.0].map((level, levelIndex) => (
                      <circle
                        key={levelIndex}
                        cx={centerX}
                        cy={centerY}
                        r={radius * level}
                        fill="none"
                        stroke="#E5E7EB"
                        strokeWidth="1"
                        strokeDasharray={levelIndex === 0 ? "none" : "4,4"}
                      />
                    ))}
                  </g>

                  <g>
                    {metrics.map((metric, index) => {
                      const angle = index * angleStep - Math.PI / 2;
                      const endX = centerX + Math.cos(angle) * radius;
                      const endY = centerY + Math.sin(angle) * radius;
                      return (
                        <line
                          key={index}
                          x1={centerX}
                          y1={centerY}
                          x2={endX}
                          y2={endY}
                          stroke="#E5E7EB"
                          strokeWidth="1"
                        />
                      );
                    })}
                  </g>

                  {models.slice(0, 6).map((model, modelIndex) => {
                    const path = getPolygonPath(model, dataset.key);
                    const color = colors[modelIndex % colors.length];
                    const isFifthModel = modelIndex === 4;
                    const strokeWidth = isFifthModel ? (isActive ? "3" : "2.5") : (isActive ? "2" : "1.5");
                    const opacity = isFifthModel ? (isActive ? "0.8" : "0.6") : (isActive ? "0.7" : "0.4");
                    
                    return (
                      <g key={modelIndex}>
                        {isFifthModel && (
                          <path
                            d={path}
                            fill="none"
                            stroke={color}
                            strokeWidth={strokeWidth + 2}
                            opacity="0.3"
                            strokeDasharray="8,4"
                          />
                        )}
                        <path
                          d={path}
                          fill={`url(#gradient-${dataset.key}-${modelIndex})`}
                          stroke={color}
                          strokeWidth={strokeWidth}
                          opacity={opacity}
                        />
                        {metrics.map((metric, metricIndex) => {
                          const value = getMetricValue(model, metric.key, dataset.key);
                          const normalized = normalizeValue(value, metric.key, models, dataset.key);
                          const point = getPoint(metricIndex * angleStep, normalized);
                          const isBest = isFifthModel && (metricIndex === 0 || metricIndex === 1);
                          return (
                            <g key={metricIndex}>
                              <circle
                                cx={point.x}
                                cy={point.y}
                                r={isFifthModel ? (isActive ? "5" : "4") : (isActive ? "4" : "3")}
                                fill={color}
                                stroke={isBest ? "#FFD700" : "white"}
                                strokeWidth={isBest ? "2" : "1"}
                              />
                              {isFifthModel && isActive && value !== null && value !== undefined && (
                                <text
                                  x={point.x}
                                  y={point.y - 8}
                                  textAnchor="middle"
                                  className="text-xs font-bold fill-gray-900"
                                  style={{ fontSize: '10px' }}
                                >
                                  {typeof value === 'number' ? value.toFixed(3) : value}
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}

                  <g>
                    {metrics.map((metric, index) => {
                      const labelPos = getLabelPosition(index);
                      return (
                        <g key={index}>
                          <text
                            x={labelPos.x}
                            y={labelPos.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className={`text-xs font-semibold ${isActive ? 'fill-gray-700' : 'fill-gray-400'}`}
                          >
                            {metric.label}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-2 justify-center">
        {models.slice(0, 6).map((model, index) => {
          const color = colors[index % colors.length];
          const shortName = model.name.replace(/^0\d\.\s*/, '').substring(0, 25);
          return (
            <div 
              key={index} 
              className="flex items-center space-x-2 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs font-medium text-gray-700">
                {shortName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrainTestInferenceRadar;
