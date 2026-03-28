import React, { useState, useEffect } from 'react';
import adminApiInstance from '../../api/adminConfig';

const TimeSeriesTopicNetwork = () => {
  const [networkDataMap, setNetworkDataMap] = useState({});
  const [loading, setLoading] = useState(true);

  const pipelines = [
    { id: 'pipeline1', name: 'TF-IDF + KMeans', row: 0, col: 0 },
    { id: 'pipeline2', name: 'TF-IDF + LDA', row: 0, col: 1 },
    { id: 'pipeline3', name: 'MEHTC (Entity Only)', row: 0, col: 2 },
    { id: 'pipeline4', name: 'MEHTC + XLM-R Zero-shot', row: 1, col: 0 },
    { id: 'pipeline5', name: 'MEHTC + LoRA Fine-tuned', row: 1, col: 1 },
    { id: 'pipeline6', name: 'Multilingual-E5-Large (SOTA)', row: 1, col: 2 }
  ];

  useEffect(() => {
    const fetchAllNetworkData = async () => {
      try {
        setLoading(true);
        const dataMap = {};
        
        await Promise.all(
          pipelines.map(async (pipeline) => {
            try {
              const response = await adminApiInstance.get(`/admin/analytics/topic-network?pipelineId=${pipeline.id}`);
              dataMap[pipeline.id] = response.data;
            } catch (error) {
              console.error(`Error fetching ${pipeline.id}:`, error);
              dataMap[pipeline.id] = { nodes: [], links: [], clusters: [] };
            }
          })
        );
        
        setNetworkDataMap(dataMap);
      } catch (error) {
        console.error('Error fetching network data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllNetworkData();
  }, []);

  const renderMiniNetwork = (pipeline) => {
    const data = networkDataMap[pipeline.id];
    if (!data || !data.nodes || data.nodes.length === 0) {
      return (
        <div className="w-full h-64 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm border border-gray-200">
          No data available
        </div>
      );
    }

    const topNodes = data.nodes.slice(0, 12);
    const centerX = 150;
    const centerY = 120;
    const radius = 70;

    const clusterColors = {};
    data.clusters.forEach(cluster => {
      clusterColors[cluster.id] = cluster.color;
    });

    return (
      <div className="relative w-full h-64 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 overflow-hidden">
        <svg className="w-full h-full" viewBox="0 0 300 240">
          <defs>
            {data.clusters.slice(0, 5).map(cluster => (
              <radialGradient key={cluster.id} id={`grad-${pipeline.id}-${cluster.id}`}>
                <stop offset="0%" stopColor={cluster.color} stopOpacity="0.3" />
                <stop offset="100%" stopColor={cluster.color} stopOpacity="0.05" />
              </radialGradient>
            ))}
          </defs>
          
          {data.links.filter(link => {
            const sourceNode = topNodes.find(n => n.id === link.source);
            const targetNode = topNodes.find(n => n.id === link.target);
            return sourceNode && targetNode;
          }).slice(0, 15).map((link, i) => {
            const sourceNode = topNodes.find(n => n.id === link.source);
            const targetNode = topNodes.find(n => n.id === link.target);
            const sourceIdx = topNodes.indexOf(sourceNode);
            const targetIdx = topNodes.indexOf(targetNode);
            
            const sourceAngle = (sourceIdx / topNodes.length) * Math.PI * 2 - Math.PI / 2;
            const targetAngle = (targetIdx / topNodes.length) * Math.PI * 2 - Math.PI / 2;
            
            const x1 = centerX + Math.cos(sourceAngle) * radius;
            const y1 = centerY + Math.sin(sourceAngle) * radius;
            const x2 = centerX + Math.cos(targetAngle) * radius;
            const y2 = centerY + Math.sin(targetAngle) * radius;

            const color = clusterColors[link.cluster] || '#d1d5db';

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={color}
                strokeWidth="1.5"
                opacity="0.25"
              />
            );
          })}

          {topNodes.map((node, i) => {
            const angle = (i / topNodes.length) * Math.PI * 2 - Math.PI / 2;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            const cluster = data.clusters.find(c => c.id === node.cluster);
            const color = cluster?.color || '#9ca3af';
            const nodeSize = Math.max(6, Math.min(12, node.size / 2));

            return (
              <g key={node.id}>
                <circle
                  cx={x}
                  cy={y}
                  r={nodeSize + 2}
                  fill={color}
                  opacity="0.2"
                />
                <circle
                  cx={x}
                  cy={y}
                  r={nodeSize}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
                <text
                  x={x}
                  y={y - nodeSize - 8}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#1f2937"
                  fontWeight="600"
                  className="font-sans"
                >
                  {node.name.length > 10 ? node.name.substring(0, 10) + '...' : node.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Topic Networks Comparison</h3>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-6">Topic Networks Comparison (6 Models)</h3>
      
      <div className="grid grid-cols-3 gap-6">
        {pipelines.map(pipeline => (
          <div key={pipeline.id} className="space-y-3">
            <div className="text-center bg-gray-50 rounded-lg py-2 px-3 border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-800">{pipeline.name}</h4>
              <p className="text-xs text-gray-600 mt-1">
                {networkDataMap[pipeline.id]?.clusters?.length || 0} topics · Top 12 keywords
              </p>
            </div>
            {renderMiniNetwork(pipeline)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimeSeriesTopicNetwork;
