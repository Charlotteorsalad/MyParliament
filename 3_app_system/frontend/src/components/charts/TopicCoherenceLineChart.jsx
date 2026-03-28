import React, { useState, useEffect, useRef } from 'react';
import { adminApi } from '../../api';

const TopicCoherenceLineChart = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await adminApi.get('/admin/analytics/model-performance');
        setData(response.data.modelPerformance);
      } catch (error) {
        console.error('Error fetching model performance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth * 2;
    const height = canvas.height = 600;

    ctx.clearRect(0, 0, width, height);

    const models = data.models || [];
    if (models.length === 0) return;

    const padding = { top: 60, right: 200, bottom: 80, left: 80 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const metrics = [
      { key: 'inference_npmi', label: 'NPMI', color: '#3b82f6' },
      { key: 'inference_cv', label: 'Coherence C_V', color: '#10b981' },
      { key: 'inference_topic_diversity', label: 'Topic Diversity', color: '#f59e0b' },
      { key: 'inference_silhouette', label: 'Silhouette Score', color: '#8b5cf6' }
    ];

    const normalizeValue = (value, min, max) => {
      if (max === min) return 0.5;
      return (value - min) / (max - min);
    };

    const metricRanges = {};
    metrics.forEach(metric => {
      const values = models.map(m => m.realMetrics?.[metric.key]).filter(v => v != null);
      if (values.length > 0) {
        metricRanges[metric.key] = {
          min: Math.min(...values),
          max: Math.max(...values)
        };
      }
    });

    const modelSpacing = chartWidth / (models.length - 1);

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();

      const value = (1 - i / 5).toFixed(1);
      ctx.fillStyle = '#6b7280';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(value, padding.left - 20, y + 8);
    }

    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.stroke();

    metrics.forEach((metric, metricIndex) => {
      ctx.strokeStyle = metric.color;
      ctx.lineWidth = 4;
      ctx.beginPath();

      let firstPoint = true;
      models.forEach((model, i) => {
        const value = model.realMetrics?.[metric.key];
        if (value == null) return;

        const range = metricRanges[metric.key];
        const normalizedValue = normalizeValue(value, range.min, range.max);
        
        const x = padding.left + i * modelSpacing;
        const y = padding.top + chartHeight - (normalizedValue * chartHeight);

        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      models.forEach((model, i) => {
        const value = model.realMetrics?.[metric.key];
        if (value == null) return;

        const range = metricRanges[metric.key];
        const normalizedValue = normalizeValue(value, range.min, range.max);
        
        const x = padding.left + i * modelSpacing;
        const y = padding.top + chartHeight - (normalizedValue * chartHeight);

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = metric.color;
        ctx.lineWidth = 4;
        ctx.stroke();
      });
    });

    models.forEach((model, i) => {
      const x = padding.left + i * modelSpacing;
      const y = padding.top + chartHeight;
      
      ctx.save();
      ctx.translate(x, y + 20);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = '#374151';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(model.name.replace(/^\d+\.\s*/, ''), 0, 0);
      ctx.restore();
    });

    ctx.fillStyle = '#111827';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Model Performance Comparison (Inference Set)', width / 2, 40);

    const legendX = padding.left + chartWidth + 40;
    let legendY = padding.top + 40;
    
    metrics.forEach(metric => {
      ctx.fillStyle = metric.color;
      ctx.beginPath();
      ctx.arc(legendX, legendY, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#374151';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(metric.label, legendX + 20, legendY + 8);

      legendY += 40;
    });

  }, [data]);

  if (loading) {
    return (
      <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <canvas 
        ref={canvasRef} 
        className="w-full"
        style={{ height: '300px' }}
      />
    </div>
  );
};

export default TopicCoherenceLineChart;
