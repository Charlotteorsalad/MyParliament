import React from 'react';

const TrainMetricsRadar = ({ models = [] }) => {
  if (!models || models.length === 0) {
    return (
      <div className="w-full h-96 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-200">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">No training metrics available</p>
        </div>
      </div>
    );
  }

  const useWeightedScore = true;

  const width = 600;
  const height = 600;
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

  const getCombinedMetricValue = (model, metricKey) => {
    const trainMetrics = model.realMetrics || {};
    const testMetrics = model.realMetrics || {};
    
    let trainValue = null;
    let testValue = null;
    
    if (metricKey === 'npmi') {
      trainValue = trainMetrics.train_npmi !== undefined && trainMetrics.train_npmi !== null 
        ? trainMetrics.train_npmi 
        : (trainMetrics.train_coherence_npmi !== undefined && trainMetrics.train_coherence_npmi !== null 
          ? trainMetrics.train_coherence_npmi : null);
      testValue = testMetrics.npmi !== undefined && testMetrics.npmi !== null 
        ? testMetrics.npmi 
        : (testMetrics.coherence_npmi !== undefined && testMetrics.coherence_npmi !== null 
          ? testMetrics.coherence_npmi : null);
    } else if (metricKey === 'cv') {
      trainValue = trainMetrics.train_cv !== undefined && trainMetrics.train_cv !== null 
        ? trainMetrics.train_cv 
        : (trainMetrics.train_coherence_cv !== undefined && trainMetrics.train_coherence_cv !== null 
          ? trainMetrics.train_coherence_cv : null);
      testValue = testMetrics.cv !== undefined && testMetrics.cv !== null 
        ? testMetrics.cv 
        : (testMetrics.coherence_cv !== undefined && testMetrics.coherence_cv !== null 
          ? testMetrics.coherence_cv : null);
    } else if (metricKey === 'topic_diversity') {
      trainValue = trainMetrics.train_topic_diversity;
      testValue = testMetrics.topic_diversity;
    } else if (metricKey === 'silhouette') {
      trainValue = trainMetrics.train_silhouette !== undefined && trainMetrics.train_silhouette !== null 
        ? trainMetrics.train_silhouette 
        : (trainMetrics.train_silhouette_score !== undefined && trainMetrics.train_silhouette_score !== null 
          ? trainMetrics.train_silhouette_score : null);
      testValue = testMetrics.silhouette !== undefined && testMetrics.silhouette !== null 
        ? testMetrics.silhouette 
        : (testMetrics.silhouette_score !== undefined && testMetrics.silhouette_score !== null 
          ? testMetrics.silhouette_score : null);
    }
    
    if (useWeightedScore) {
      if (trainValue !== null && testValue !== null) {
        return trainValue * 0.3 + testValue * 0.7;
      } else if (testValue !== null) {
        return testValue;
      } else if (trainValue !== null) {
        return trainValue;
      }
    }
    
    return trainValue !== null ? trainValue : testValue;
  };

  const normalizeValue = (value, metricKey, allValues) => {
    if (value === null || value === undefined) return 0;
    
    if (metricKey === 'n_clusters') {
      const clusterValues = allValues.map(m => {
        const metrics = m.realMetrics || {};
        return metrics.n_clusters || 0;
      }).filter(v => v > 0);
      if (clusterValues.length === 0) return 0;
      const maxClusters = Math.max(...clusterValues);
      const minClusters = Math.min(...clusterValues);
      if (maxClusters === minClusters) return 0.5;
      return (value - minClusters) / (maxClusters - minClusters);
    }

    const metricValues = allValues.map(m => getCombinedMetricValue(m, metricKey))
      .filter(v => v !== null && v !== undefined && v !== 0);

    if (metricValues.length === 0) return 0;
    
    const maxVal = Math.max(...metricValues);
    const minVal = Math.min(...metricValues);
    
    if (maxVal === minVal) return 0.5;
    return (value - minVal) / (maxVal - minVal);
  };

  const getMetricValue = (model, metricKey) => {
    if (metricKey === 'n_clusters') {
      const metrics = model.realMetrics || {};
      return metrics.n_clusters;
    }
    return getCombinedMetricValue(model, metricKey);
  };

  const getPoint = (angle, normalizedValue) => {
    const x = centerX + Math.cos(angle - Math.PI / 2) * radius * normalizedValue;
    const y = centerY + Math.sin(angle - Math.PI / 2) * radius * normalizedValue;
    return { x, y };
  };

  const getPolygonPath = (model) => {
    const points = metrics.map((metric, index) => {
      const value = getMetricValue(model, metric.key);
      const normalized = normalizeValue(value, metric.key, models);
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

  const getValueLabelPosition = (index) => {
    const angle = index * angleStep - Math.PI / 2;
    const labelRadius = radius * 1.25;
    return {
      x: centerX + Math.cos(angle) * labelRadius,
      y: centerY + Math.sin(angle) * labelRadius
    };
  };

  const getModelInsights = () => {
    if (models.length === 0) return [];
    
    const allNpmi = models.map(m => getCombinedMetricValue(m, 'npmi')).filter(v => v !== null && v !== undefined);
    const allCv = models.map(m => getCombinedMetricValue(m, 'cv')).filter(v => v !== null && v !== undefined);
    const allSilhouette = models.map(m => getCombinedMetricValue(m, 'silhouette')).filter(v => v !== null && v !== undefined);
    const allTopicDiversity = models.map(m => getCombinedMetricValue(m, 'topic_diversity')).filter(v => v !== null && v !== undefined);
    
    const avgNpmi = allNpmi.length > 0 ? allNpmi.reduce((a, b) => a + b, 0) / allNpmi.length : 0;
    const avgCv = allCv.length > 0 ? allCv.reduce((a, b) => a + b, 0) / allCv.length : 0;
    const avgSilhouette = allSilhouette.length > 0 ? allSilhouette.reduce((a, b) => a + b, 0) / allSilhouette.length : 0;
    const avgTopicDiversity = allTopicDiversity.length > 0 ? allTopicDiversity.reduce((a, b) => a + b, 0) / allTopicDiversity.length : 0;
    
    const insights = [];
    
    models.slice(0, 6).forEach((model, index) => {
      const npmi = getCombinedMetricValue(model, 'npmi');
      const cv = getCombinedMetricValue(model, 'cv');
      const silhouette = getCombinedMetricValue(model, 'silhouette');
      const topicDiversity = getCombinedMetricValue(model, 'topic_diversity');
      
      const strengths = [];
      const performance = [];
      
      if (npmi !== null && npmi !== undefined) {
        if (npmi > avgNpmi * 1.2) {
          strengths.push(`NPMI ${(npmi - avgNpmi).toFixed(3)} above average`);
        }
        if (npmi < 0) {
          performance.push(`Negative NPMI: ${npmi.toFixed(3)}`);
        }
      }
      
      if (cv !== null && cv !== undefined) {
        if (cv > avgCv * 1.1) {
          strengths.push(`CV ${(cv - avgCv).toFixed(3)} above average`);
        }
        if (cv < avgCv * 0.9) {
          performance.push(`CV ${(avgCv - cv).toFixed(3)} below average`);
        }
      }
      
      if (silhouette !== null && silhouette !== undefined) {
        if (silhouette > avgSilhouette * 1.3) {
          strengths.push(`Silhouette ${(silhouette - avgSilhouette).toFixed(3)} above average`);
        }
        if (silhouette < avgSilhouette * 0.7) {
          performance.push(`Silhouette ${(avgSilhouette - silhouette).toFixed(3)} below average`);
        }
      }
      
      if (topicDiversity !== null && topicDiversity !== undefined) {
        if (topicDiversity > avgTopicDiversity * 1.1) {
          strengths.push(`Topic Diversity ${(topicDiversity - avgTopicDiversity).toFixed(3)} above average`);
        }
        if (topicDiversity < avgTopicDiversity * 0.9) {
          performance.push(`Topic Diversity ${(avgTopicDiversity - topicDiversity).toFixed(3)} below average`);
        }
      }
      
      const isFineTuned = model.name.toLowerCase().includes('lora') || model.name.toLowerCase().includes('fine-tuned');
      const hasStrongTestPerformance = silhouette !== null && silhouette > avgSilhouette && cv !== null && cv > avgCv * 0.9;
      
      insights.push({
        model: model.name,
        index: index,
        highlight: isFineTuned || (strengths.length >= 2 && hasStrongTestPerformance),
        strengths: strengths,
        performance: performance,
        npmi: npmi,
        cv: cv,
        silhouette: silhouette,
        topicDiversity: topicDiversity
      });
    });
    
    return insights;
  };

  const modelInsights = getModelInsights();

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-2">Model Performance Comparison</h3>
      <p className="text-sm text-gray-500 mb-6">Weighted score: 30% train + 70% test metrics</p>
      
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 flex items-center justify-center overflow-x-auto">
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="max-w-full">
            <defs>
              {models.map((_, index) => (
                <linearGradient key={index} id={`gradient-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
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
              const path = getPolygonPath(model);
              const color = colors[modelIndex % colors.length];
              return (
                <g key={modelIndex}>
                  <path
                    d={path}
                    fill={`url(#gradient-${modelIndex})`}
                    stroke={color}
                    strokeWidth="2"
                    opacity="0.7"
                  />
                  {metrics.map((metric, metricIndex) => {
                    const value = getMetricValue(model, metric.key);
                    const normalized = normalizeValue(value, metric.key, models);
                    const point = getPoint(metricIndex * angleStep, normalized);
                    return (
                      <circle
                        key={metricIndex}
                        cx={point.x}
                        cy={point.y}
                        r="4"
                        fill={color}
                        stroke="white"
                        strokeWidth="2"
                      />
                    );
                  })}
                </g>
              );
            })}

            <g>
              {metrics.map((metric, index) => {
                const labelPos = getLabelPosition(index);
                const valuePos = getValueLabelPosition(index);
                return (
                  <g key={index}>
                    <text
                      x={labelPos.x}
                      y={labelPos.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-sm font-semibold fill-gray-700"
                    >
                      {metric.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <div className="lg:w-80 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Models</h4>
            <div className="space-y-3">
              {models.slice(0, 6).map((model, index) => {
                const color = colors[index % colors.length];
                const shortName = model.name.replace(/^0\d\.\s*/, '').substring(0, 30);
                return (
                  <div key={index} className="flex items-center space-x-2">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate" title={model.name}>
                        {shortName}
                      </p>
                      <div className="flex space-x-2 mt-1">
                        {metrics.slice(0, 4).map((metric, mIdx) => {
                          const value = getMetricValue(model, metric.key);
                          if (value === null || value === undefined) return null;
                          return (
                            <span key={mIdx} className="text-xs text-gray-500">
                              {metric.label.substring(0, 2)}: {typeof value === 'number' ? value.toFixed(3) : value}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Key Insights</h4>
            <div className="space-y-3">
              {modelInsights.filter(insight => insight.highlight).map((insight, idx) => (
                <div key={idx} className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                      style={{ backgroundColor: colors[insight.index % colors.length] }}
                    />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-900 mb-1">
                        {insight.model.replace(/^0\d\.\s*/, '')}
                      </p>
                      {insight.strengths.length > 0 && (
                        <ul className="text-xs text-gray-700 space-y-1 mb-2">
                          {insight.strengths.map((item, i) => (
                            <li key={i} className="flex items-start">
                              <span className="text-green-600 mr-1">+</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {insight.performance.length > 0 && (
                        <ul className="text-xs text-gray-600 space-y-1">
                          {insight.performance.map((item, i) => (
                            <li key={i} className="flex items-start">
                              <span className="text-gray-400 mr-1">-</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {modelInsights.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-900 mb-2">Performance Summary</p>
                  <p className="text-xs text-blue-800 leading-relaxed">
                    Models with highlighted insights show above-average performance in multiple metrics. 
                    Weighted scoring (30% train + 70% test) emphasizes generalization capability, 
                    making models with strong test performance more suitable for production deployment.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainMetricsRadar;
