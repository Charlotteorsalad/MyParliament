import React, { useState, useEffect, useRef } from 'react';
import adminApiInstance from '../../api/adminConfig';

const TopicNetworkGraph = () => {
  const [networkDataMap, setNetworkDataMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedPipeline, setSelectedPipeline] = useState('pipeline5');
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const simulationRef = useRef(null);
  const nodesRef = useRef(null);
  const linksRef = useRef(null);
  const clusterColorsRef = useRef({});
  const isAnimatingRef = useRef(false);

  const pipelines = [
    { id: 'pipeline1', name: 'TF-IDF + KMeans' },
    { id: 'pipeline2', name: 'TF-IDF + LDA' },
    { id: 'pipeline3', name: 'MEHTC (Entity Only)' },
    { id: 'pipeline4', name: 'MEHTC + XLM-R Zero-shot' },
    { id: 'pipeline5', name: 'MEHTC + LoRA Fine-tuned' },
    { id: 'pipeline6', name: 'Multilingual-E5-Large (SOTA)' }
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
              console.error(`Error fetching network data for ${pipeline.id}:`, error);
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

  const drawGraph = useRef((ctx, width, height, nodes, links, clusterColors) => {
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.3;
    links.forEach(link => {
      if (!link.source || !link.target) return;
      const color = clusterColors[link.cluster] || '#999';
      ctx.strokeStyle = color;
      ctx.lineWidth = link.weight;
      ctx.beginPath();
      ctx.moveTo(link.source.x, link.source.y);
      ctx.lineTo(link.target.x, link.target.y);
      ctx.stroke();
    });
    ctx.restore();

    nodes.forEach(node => {
      const color = clusterColors[node.cluster] || '#999';
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (node.size > 8) {
        ctx.fillStyle = '#333';
        ctx.font = `${Math.max(9, Math.min(12, node.size))}px sans-serif`;
        ctx.fillText(node.name.substring(0, 15), node.x + node.size + 3, node.y + 3);
      }
    });
  });

  useEffect(() => {
    const networkData = networkDataMap[selectedPipeline];
    if (!networkData || !networkData.nodes || networkData.nodes.length === 0 || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!container) return;

    // Stop any existing animation
    isAnimatingRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const width = container.clientWidth || 1200;
    const height = 800;
    
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const nodes = networkData.nodes.map(n => ({
      ...n,
      x: Math.random() * width,
      y: Math.random() * height,
      vx: 0,
      vy: 0
    }));

    const links = networkData.links.map(l => ({
      ...l,
      source: nodes.find(n => n.id === l.source),
      target: nodes.find(n => n.id === l.target)
    })).filter(l => l.source && l.target);

    const clusterColors = {};
    networkData.clusters.forEach(cluster => {
      clusterColors[cluster.id] = cluster.color;
    });

    nodesRef.current = nodes;
    linksRef.current = links;
    clusterColorsRef.current = clusterColors;

    const simulation = createForceSimulation(nodes, links, width, height);
    simulationRef.current = simulation;
    isAnimatingRef.current = true;

    const animate = () => {
      if (!isAnimatingRef.current) {
        return;
      }

      const currentNodes = nodesRef.current;
      const currentLinks = linksRef.current;
      const currentColors = clusterColorsRef.current;
      const currentSimulation = simulationRef.current;

      if (!currentSimulation) {
        isAnimatingRef.current = false;
        return;
      }

      const alpha = currentSimulation.alpha();
      const shouldContinue = alpha > 0.001;
      
      if (shouldContinue) {
        currentSimulation.tick();
        drawGraph.current(ctx, width, height, currentNodes, currentLinks, currentColors);
        if (isAnimatingRef.current) {
          animationFrameRef.current = requestAnimationFrame(animate);
        }
      } else {
        // Draw final frame and stop
        drawGraph.current(ctx, width, height, currentNodes, currentLinks, currentColors);
        isAnimatingRef.current = false;
        animationFrameRef.current = null;
      }
    };

    // Initial draw before animation starts
    drawGraph.current(ctx, width, height, nodes, links, clusterColors);
    
    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      isAnimatingRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      simulationRef.current = null;
    };
  }, [networkDataMap, selectedPipeline]);

  if (loading) {
    return (
      <div className="w-full h-96 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-200">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">Loading topic networks...</p>
        </div>
      </div>
    );
  }

  const currentNetworkData = networkDataMap[selectedPipeline];
  const hasData = currentNetworkData && currentNetworkData.nodes && currentNetworkData.nodes.length > 0;

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4">Topic Network Structure (Inference Set)</h3>
      
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-4 overflow-x-auto">
          {pipelines.map((pipeline) => {
            const isActive = selectedPipeline === pipeline.id;
            const pipelineData = networkDataMap[pipeline.id];
            const hasPipelineData = pipelineData && pipelineData.nodes && pipelineData.nodes.length > 0;
            
            return (
              <button
                key={pipeline.id}
                onClick={() => setSelectedPipeline(pipeline.id)}
                className={`whitespace-nowrap px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {pipeline.name}
                {hasPipelineData && (
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                    isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {pipelineData.clusters?.length || 0} topics
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-4">
        {hasData && currentNetworkData.clusters && currentNetworkData.clusters.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {currentNetworkData.clusters.map(cluster => (
              <span
                key={cluster.id}
                className="px-3 py-1 rounded-lg text-xs font-medium"
                style={{
                  backgroundColor: cluster.color,
                  color: 'white'
                }}
                title={cluster.name}
              >
                {cluster.name}
              </span>
            ))}
          </div>
        )}

        <div 
          ref={containerRef}
          className="w-full border border-gray-200 rounded-lg overflow-hidden bg-gray-50"
          style={{ minHeight: '800px' }}
        >
          {hasData ? (
            <canvas 
              ref={canvasRef}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <p className="text-lg font-medium">No network data available</p>
                <p className="text-sm mt-2">Please ensure inference data has been processed for this pipeline</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function createForceSimulation(nodes, links, width, height) {
  const alpha = 1;
  const alphaDecay = 0.0228;
  const alphaMin = 0.001;
  let currentAlpha = alpha;

  const linkDistance = 40;
  const linkStrength = 0.5;
  const chargeStrength = -200;
  const centerStrength = 0.1;
  const centerX = width / 2;
  const centerY = height / 2;

  function tick() {
    if (currentAlpha < alphaMin) return;

    links.forEach(link => {
      if (!link.source || !link.target) return;
      const dx = link.target.x - link.source.x;
      const dy = link.target.y - link.source.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (distance - linkDistance) * linkStrength / distance;
      const fx = dx * force;
      const fy = dy * force;
      
      link.source.vx += fx;
      link.source.vy += fy;
      link.target.vx -= fx;
      link.target.vy -= fy;
    });

    nodes.forEach((node, i) => {
      nodes.forEach((other, j) => {
        if (i === j) return;
        const dx = node.x - other.x;
        const dy = node.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = chargeStrength / (distance * distance);
        const fx = dx * force / distance;
        const fy = dy * force / distance;
        
        node.vx += fx;
        node.vy += fy;
      });

      const dx = centerX - node.x;
      const dy = centerY - node.y;
      node.vx += dx * centerStrength;
      node.vy += dy * centerStrength;

      node.vx *= 0.6;
      node.vy *= 0.6;
      
      node.x += node.vx;
      node.y += node.vy;

      const padding = 30;
      if (node.x < padding) node.x = padding;
      if (node.x > width - padding) node.x = width - padding;
      if (node.y < padding) node.y = padding;
      if (node.y > height - padding) node.y = height - padding;
    });

    currentAlpha *= (1 - alphaDecay);
  }

  return { tick, alpha: () => currentAlpha };
}

export default TopicNetworkGraph;
