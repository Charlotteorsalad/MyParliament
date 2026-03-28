import React, { useState, useEffect, useRef } from 'react';
import adminApiInstance from '../../api/adminConfig';

const TopicWordCloud = () => {
  const [networkData, setNetworkData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPipeline, setSelectedPipeline] = useState('pipeline5');
  const canvasRef = useRef(null);

  const pipelines = [
    { id: 'pipeline1', name: 'TF-IDF + KMeans' },
    { id: 'pipeline2', name: 'TF-IDF + LDA' },
    { id: 'pipeline3', name: 'MEHTC (Entity Only)' },
    { id: 'pipeline4', name: 'MEHTC + XLM-R Zero-shot' },
    { id: 'pipeline5', name: 'MEHTC + LoRA Fine-tuned' },
    { id: 'pipeline6', name: 'Multilingual-E5-Large (SOTA)' }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await adminApiInstance.get(`/admin/analytics/topic-network?pipelineId=${selectedPipeline}`);
        setNetworkData(response.data);
      } catch (error) {
        console.error('Error fetching network data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedPipeline]);

  useEffect(() => {
    if (!networkData || !networkData.clusters || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth * 2;
    const height = canvas.height = 1600;

    ctx.clearRect(0, 0, width, height);

    const clusters = networkData.clusters.slice(0, 12);
    const cols = 3;
    const rows = Math.ceil(clusters.length / cols);
    const cellWidth = width / cols;
    const cellHeight = height / rows;
    const padding = 40;

    clusters.forEach((cluster, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = col * cellWidth;
      const y = row * cellHeight;

      ctx.save();
      ctx.fillStyle = cluster.color;
      ctx.globalAlpha = 0.1;
      ctx.fillRect(x + padding / 2, y + padding / 2, cellWidth - padding, cellHeight - padding);
      ctx.restore();

      ctx.strokeStyle = cluster.color;
      ctx.lineWidth = 4;
      ctx.strokeRect(x + padding / 2, y + padding / 2, cellWidth - padding, cellHeight - padding);

      ctx.fillStyle = cluster.color;
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      const topicName = cluster.name.length > 30 ? cluster.name.substring(0, 30) + '...' : cluster.name;
      ctx.fillText(topicName, x + cellWidth / 2, y + padding + 30);

      const keywords = cluster.keywords.slice(0, 10);
      const centerX = x + cellWidth / 2;
      const centerY = y + cellHeight / 2;
      
      keywords.forEach((keyword, i) => {
        const angle = (i / keywords.length) * Math.PI * 2 - Math.PI / 2;
        const radiusX = (cellWidth - padding * 2) / 3;
        const radiusY = (cellHeight - padding * 3) / 3;
        const keywordX = centerX + Math.cos(angle) * radiusX;
        const keywordY = centerY + Math.sin(angle) * radiusY;

        const fontSize = Math.max(20, 36 - i * 2);
        ctx.font = `${i === 0 ? 'bold' : 'normal'} ${fontSize}px sans-serif`;
        ctx.fillStyle = i === 0 ? cluster.color : '#374151';
        ctx.textAlign = 'center';
        ctx.fillText(keyword, keywordX, keywordY);

        if (i < 3) {
          ctx.strokeStyle = cluster.color;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(keywordX, keywordY);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      });

      ctx.fillStyle = '#6b7280';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Cluster ${cluster.id}`, x + cellWidth / 2, y + cellHeight - padding / 2);
    });

  }, [networkData]);

  if (loading) {
    return (
      <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Topic Word Cloud Visualization</h3>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4">Topic Word Cloud Visualization</h3>
      
      <div className="mb-4">
        <select
          value={selectedPipeline}
          onChange={(e) => setSelectedPipeline(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {pipelines.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <canvas 
        ref={canvasRef} 
        className="w-full border border-gray-200 rounded-lg bg-white"
        style={{ height: '800px' }}
      />
    </div>
  );
};

export default TopicWordCloud;
