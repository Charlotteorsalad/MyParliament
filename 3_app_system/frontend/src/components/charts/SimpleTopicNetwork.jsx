import React, { useState, useEffect, useRef } from 'react';
import adminApiInstance from '../../api/adminConfig';

const SimpleTopicNetwork = () => {
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
    if (!networkData || !networkData.nodes || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth * 2;
    const height = canvas.height = 800;

    const topNodes = networkData.nodes.slice(0, 25);
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.35;

    const clusterColors = {};
    networkData.clusters.forEach(cluster => {
      clusterColors[cluster.id] = cluster.color;
    });

    const nodes = topNodes.map((node, i) => {
      const angle = (i / topNodes.length) * Math.PI * 2 - Math.PI / 2;
      const radius = baseRadius + (Math.random() - 0.5) * baseRadius * 0.2;
      return {
        ...node,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        angle: angle,
        radius: radius
      };
    });

    const links = networkData.links
      .filter(l => {
        const source = nodes.find(n => n.id === l.source);
        const target = nodes.find(n => n.id === l.target);
        return source && target;
      })
      .slice(0, 40)
      .map(l => ({
        ...l,
        source: nodes.find(n => n.id === l.source),
        target: nodes.find(n => n.id === l.target)
      }));

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.2;
    links.forEach(link => {
      const color = clusterColors[link.cluster] || '#9ca3af';
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.min(link.weight * 1.5, 3);
      ctx.beginPath();
      ctx.moveTo(link.source.x, link.source.y);
      ctx.lineTo(link.target.x, link.target.y);
      ctx.stroke();
    });
    ctx.restore();

    nodes.forEach((node, i) => {
      const color = clusterColors[node.cluster] || '#6b7280';
      
      const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.size * 2);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, color + '80');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.size * 2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#1f2937';
      ctx.font = `bold ${Math.max(18, Math.min(24, node.size + 8))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const label = node.name.length > 15 ? node.name.substring(0, 15) + '...' : node.name;
      const textY = node.y - node.size * 2 - 15;
      ctx.fillText(label, node.x, textY);
    });

  }, [networkData]);

  if (loading) {
    return (
      <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Simple Topic Network</h3>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4">Topic Keyword Network (Top 25 Keywords)</h3>
      
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
        className="w-full border border-gray-200 rounded-lg"
        style={{ height: '600px' }}
      />
    </div>
  );
};

export default SimpleTopicNetwork;
