import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api';
import { PieChart, BarChart, LineChart, MetricCard } from '../../components/charts/SimpleChart';
import { ModelComparisonChart, ModelTrendsChart, ModelMetricsRadar } from '../../components/charts/ModelComparisonChart';
import { PipelineStatusChart, DeploymentTrendsChart, CronJobTable, LearningProgressChart, SystemAlerts } from '../../components/charts/DevOpsCharts';
import TimeSeriesChart from '../../components/charts/TimeSeriesChart';
import { UserEngagementChart, UserSegmentationChart, UserJourneyFunnel, ContentDemographicsChart, UserActivityHeatmap } from '../../components/charts/UserAnalyticsCharts';
import AdminUserReports from './AdminUserReports';
import { exportToPDF, exportToCSV, exportToExcel } from '../../utils/exportUtils';

// Empty State Component
const EmptyState = ({ 
  icon, 
  title, 
  description, 
  actionText, 
  onAction,
  illustration = "📊" 
}) => (
  <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
      {icon || (
        <span className="text-4xl">{illustration}</span>
      )}
    </div>
    <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-500 mb-6 max-w-md">{description}</p>
    {actionText && onAction && (
      <button
        onClick={onAction}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
      >
        {actionText}
      </button>
    )}
  </div>
);

// Data validation helpers
const hasValidData = (data, minLength = 1) => {
  if (!data) return false;
  if (Array.isArray(data)) return data.length >= minLength;
  if (typeof data === 'object') return Object.keys(data).length >= minLength;
  return data !== null && data !== undefined && data !== '';
};

const hasSystemHealthData = (data) => {
  return data && (
    data.serverUptime || 
    data.responseTime || 
    data.activeUsers > 0 ||
    data.cpuUsage
  );
};

const hasModelPerformanceData = (data) => {
  return data && data.models && Array.isArray(data.models) && data.models.length > 0;
};

const hasContentEngagementData = (data) => {
  return data && (
    (data.totalViews && data.totalViews > 0) ||
    hasValidData(data.contentByCategory) ||
    hasValidData(data.topPerformingContent)
  );
};

const hasUserBehaviourData = (data) => {
  return data && (
    (data.dailyActiveUsers && data.dailyActiveUsers > 0) ||
    (data.totalUsers && data.totalUsers > 0) ||
    hasValidData(data.usersByRegion)
  );
};

const hasDevOpsData = (cicd, learning, cron) => {
  return (
    hasValidData(cicd?.pipelines) ||
    hasValidData(learning?.learningJobs) ||
    hasValidData(cron?.jobs)
  );
};

const AdminAnalytics = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState({
    systemHealth: {
      serverUptime: '99.9%',
      responseTime: '120ms',
      errorRate: '0.1%',
      activeUsers: 1247,
      cpuUsage: '45%',
      memoryUsage: '62%',
      diskUsage: '34%',
      networkStatus: 'Healthy'
    },
    modelPerformance: {
      models: [
        {
          id: 'hansard-classifier',
          name: 'Hansard Document Classifier',
          version: 'v2.1.0',
          type: 'Text Classification',
          status: 'active',
          accuracy: 94.2,
          precision: 91.8,
          recall: 89.5,
          f1Score: 90.6,
          inferenceTime: 85,
          totalPredictions: 15672,
          successfulPredictions: 14783,
          deployedDate: new Date('2024-01-15'),
          lastUpdated: new Date()
        },
        {
          id: 'sentiment-analyzer',
          name: 'Parliamentary Sentiment Analyzer',
          version: 'v1.8.2',
          type: 'Sentiment Analysis',
          status: 'active',
          accuracy: 87.5,
          precision: 85.2,
          recall: 88.9,
          f1Score: 87.0,
          inferenceTime: 62,
          totalPredictions: 18450,
          successfulPredictions: 17234,
          deployedDate: new Date('2024-02-10'),
          lastUpdated: new Date()
        },
        {
          id: 'topic-extractor',
          name: 'Topic Extraction Model',
          version: 'v3.0.1',
          type: 'Topic Modeling',
          status: 'active',
          accuracy: 92.1,
          precision: 89.4,
          recall: 91.7,
          f1Score: 90.5,
          inferenceTime: 120,
          totalPredictions: 11550,
          successfulPredictions: 10996,
          deployedDate: new Date('2024-03-05'),
          lastUpdated: new Date()
        },
        {
          id: 'entity-recognizer',
          name: 'Named Entity Recognition',
          version: 'v1.5.0',
          type: 'Entity Recognition',
          status: 'testing',
          accuracy: 89.3,
          precision: 87.1,
          recall: 90.2,
          f1Score: 88.6,
          inferenceTime: 95,
          totalPredictions: 5230,
          successfulPredictions: 4876,
          deployedDate: new Date('2024-03-20'),
          lastUpdated: new Date()
        }
      ],
      summary: {
        totalModels: 4,
        activeModels: 3,
        testingModels: 1,
        averageAccuracy: 90.8,
        totalPredictions: 50902,
        totalSuccessfulPredictions: 47889,
        averageInferenceTime: 90.5
      },
      performanceTrends: {
        accuracy: [
          { date: '2024-01-01', hansard: 92.1, sentiment: 85.8, topic: 90.5, entity: 87.2 },
          { date: '2024-02-01', hansard: 93.4, sentiment: 86.2, topic: 91.8, entity: 88.1 },
          { date: '2024-03-01', hansard: 94.2, sentiment: 87.5, topic: 92.1, entity: 89.3 }
        ],
        predictions: [
          { date: '2024-01-01', hansard: 12450, sentiment: 15200, topic: 8900, entity: 3200 },
          { date: '2024-02-01', hansard: 14100, sentiment: 16800, topic: 10200, entity: 4100 },
          { date: '2024-03-01', hansard: 15672, sentiment: 18450, topic: 11550, entity: 5230 }
        ]
      }
    },
    contentEngagement: {
      totalViews: 125847,
      uniqueVisitors: 8934,
      averageSessionTime: '8m 34s',
      bounceRate: '23.4%',
      topContent: [
        { title: 'Parliamentary Procedures', views: 2341, engagement: '85%' },
        { title: 'Constitutional Law', views: 1987, engagement: '78%' },
        { title: 'Legislative Process', views: 1654, engagement: '82%' }
      ],
      contentByCategory: {
        'Educational': 45,
        'Procedures': 32,
        'Legal': 28,
        'Historical': 19
      }
    },
    userBehaviour: {
      dailyActiveUsers: 3247,
      weeklyActiveUsers: 12456,
      monthlyActiveUsers: 34789,
      userRetention: '67.8%',
      newRegistrations: 234,
      usersByRegion: {
        'Kuala Lumpur': 8934,
        'Selangor': 6721,
        'Johor': 4567,
        'Penang': 3456,
        'Others': 11111
      }
    },
    cicdAnalytics: {
      pipelines: [
        {
          id: 'frontend-deploy',
          name: 'Frontend Deployment',
          status: 'success',
          lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000),
          duration: 180,
          success_rate: 95.2,
          total_runs: 156,
          successful_runs: 148,
          branch: 'main',
          environment: 'production'
        },
        {
          id: 'backend-deploy',
          name: 'Backend Deployment',
          status: 'success',
          lastRun: new Date(Date.now() - 4 * 60 * 60 * 1000),
          duration: 240,
          success_rate: 92.8,
          total_runs: 134,
          successful_runs: 124,
          branch: 'main',
          environment: 'production'
        },
        {
          id: 'ml-model-deploy',
          name: 'ML Model Deployment',
          status: 'running',
          lastRun: new Date(Date.now() - 15 * 60 * 1000),
          duration: 0,
          success_rate: 88.5,
          total_runs: 78,
          successful_runs: 69,
          branch: 'model-updates',
          environment: 'production'
        }
      ],
      summary: {
        totalPipelines: 3,
        activePipelines: 3,
        successfulDeployments: 24,
        failedDeployments: 2,
        averageDeploymentTime: 166,
        deploymentsToday: 8
      },
      deploymentTrends: [
        { date: '2024-03-15', successful: 4, failed: 0, duration: 145 },
        { date: '2024-03-16', successful: 6, failed: 1, duration: 167 },
        { date: '2024-03-17', successful: 5, failed: 0, duration: 156 },
        { date: '2024-03-18', successful: 7, failed: 1, duration: 178 },
        { date: '2024-03-19', successful: 8, failed: 0, duration: 142 }
      ]
    },
    continuousLearningAnalytics: {
      learningJobs: [
        {
          id: 'hansard-retrain',
          modelName: 'Hansard Document Classifier',
          status: 'completed',
          startTime: new Date(Date.now() - 8 * 60 * 60 * 1000),
          endTime: new Date(Date.now() - 6 * 60 * 60 * 1000),
          duration: 7200,
          newAccuracy: 94.8,
          previousAccuracy: 94.2,
          improvement: 0.6,
          dataPoints: 15000,
          trigger: 'scheduled'
        },
        {
          id: 'sentiment-retrain',
          modelName: 'Parliamentary Sentiment Analyzer',
          status: 'running',
          startTime: new Date(Date.now() - 3 * 60 * 60 * 1000),
          endTime: null,
          duration: 0,
          newAccuracy: null,
          previousAccuracy: 87.5,
          improvement: null,
          dataPoints: 12500,
          trigger: 'performance_degradation'
        }
      ],
      summary: {
        totalRetrainingJobs: 45,
        successfulRetraining: 41,
        failedRetraining: 4,
        averageImprovementRate: 2.3,
        modelsImproved: 12
      },
      performanceGains: [
        { model: 'Hansard Classifier', before: 92.1, after: 94.8, improvement: 2.7 },
        { model: 'Sentiment Analyzer', before: 85.2, after: 87.5, improvement: 2.3 },
        { model: 'Topic Extractor', before: 89.8, after: 92.1, improvement: 2.3 }
      ]
    },
    cronJobAnalytics: {
      jobs: [
        {
          id: 'data-backup',
          name: 'Database Backup',
          schedule: '0 2 * * *',
          status: 'success',
          lastRun: new Date(Date.now() - 10 * 60 * 60 * 1000),
          nextRun: new Date(Date.now() + 14 * 60 * 60 * 1000),
          duration: 1800,
          success_rate: 98.5,
          total_runs: 365,
          successful_runs: 359,
          description: 'Daily backup of all database collections'
        },
        {
          id: 'model-validation',
          name: 'Model Performance Validation',
          schedule: '0 */6 * * *',
          status: 'success',
          lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000),
          nextRun: new Date(Date.now() + 4 * 60 * 60 * 1000),
          duration: 900,
          success_rate: 94.2,
          total_runs: 1460,
          successful_runs: 1375,
          description: 'Validate ML model performance and alert on degradation'
        },
        {
          id: 'data-sync',
          name: 'External Data Synchronization',
          schedule: '0 */2 * * *',
          status: 'failed',
          lastRun: new Date(Date.now() - 30 * 60 * 1000),
          nextRun: new Date(Date.now() + 90 * 60 * 1000),
          duration: 0,
          success_rate: 89.3,
          total_runs: 2920,
          successful_runs: 2607,
          description: 'Sync data from external parliamentary sources'
        }
      ],
      summary: {
        totalJobs: 3,
        activeJobs: 3,
        successfulExecutions: 24,
        failedExecutions: 1,
        averageExecutionTime: 900
      },
      alerts: [
        {
          id: 'data-sync-failure',
          job: 'External Data Synchronization',
          type: 'failure',
          message: 'Connection timeout to external API',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
          severity: 'high'
        }
      ]
    }
  });
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [selectedModel, setSelectedModel] = useState('hansard-classifier');
  const [selectedDevOpsTab, setSelectedDevOpsTab] = useState('cicd');
  const [selectedContentTab, setSelectedContentTab] = useState('analytics');
  const [exportLoading, setExportLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchAnalyticsData();
      }, 30000); // Refresh every 30 seconds
      setRefreshInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [autoRefresh]);

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Fetch comprehensive analytics data from API
      const response = await adminApi.getComprehensiveAnalytics();
      
      // Merge API data with mock data structure to ensure compatibility
      const apiData = response.data;
      const mergedData = {
        ...analyticsData,
        systemHealth: apiData.systemHealth || analyticsData.systemHealth,
        modelPerformance: apiData.modelPerformance || analyticsData.modelPerformance,
        contentEngagement: apiData.contentEngagement || analyticsData.contentEngagement,
        userBehaviour: apiData.userBehaviour || analyticsData.userBehaviour,
        // Keep mock DevOps data if not provided by API
        cicdAnalytics: apiData.cicdAnalytics || analyticsData.cicdAnalytics,
        continuousLearningAnalytics: apiData.continuousLearningAnalytics || analyticsData.continuousLearningAnalytics,
        cronJobAnalytics: apiData.cronJobAnalytics || analyticsData.cronJobAnalytics
      };
      
      setAnalyticsData(mergedData);
      
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      // Keep mock data if API fails - data is already initialized
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    setExportLoading(true);
    try {
      const filename = `analytics_report_${new Date().toISOString().split('T')[0]}`;
      
      switch (format) {
        case 'pdf':
          exportToPDF(analyticsData, filename);
          break;
        case 'csv':
          exportToCSV(analyticsData, filename);
          break;
        case 'xlsx':
          exportToExcel(analyticsData, filename);
          break;
        default:
          exportToCSV(analyticsData, filename);
      }
      
      setTimeout(() => {
        setExportLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Export error:', error);
      setExportLoading(false);
    }
  };

  // Function to simulate empty data state for testing
  const simulateEmptyData = () => {
    setAnalyticsData({
      systemHealth: {},
      modelPerformance: { models: [] },
      contentEngagement: {},
      userBehaviour: {},
      cicdAnalytics: { pipelines: [] },
      continuousLearningAnalytics: { learningJobs: [] },
      cronJobAnalytics: { jobs: [] }
    });
  };

  const createSampleDevOpsData = async () => {
    try {
      setLoading(true);
      const response = await adminApi.createSampleDevOpsData();
      console.log('DevOps data created:', response.data);
      
      // Refresh analytics data to show the new DevOps data
      await fetchAnalyticsData();
      
      // Show success message (you could add a toast notification here)
      alert('Sample DevOps data created successfully! Check the DevOps tab.');
    } catch (error) {
      console.error('Error creating DevOps data:', error);
      alert('Failed to create DevOps data. Check the console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (reportType) => {
    setSelectedMetric(reportType);
  };

  const reports = [
    {
      id: 'system-health',
      title: 'System Health',
      description: 'Monitor server performance, uptime, and resource usage',
      icon: (
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'green',
      metrics: [
        { label: 'Server Uptime', value: analyticsData.systemHealth?.serverUptime || 'N/A', status: 'excellent' },
        { label: 'Response Time', value: analyticsData.systemHealth?.responseTime || 'N/A', status: 'good' },
        { label: 'Error Rate', value: analyticsData.systemHealth?.errorRate || 'N/A', status: 'excellent' },
        { label: 'Active Users', value: (analyticsData.systemHealth?.activeUsers || 0).toLocaleString(), status: 'good' }
      ]
    },
    {
      id: 'model-performance',
      title: 'Model Performance',
      description: 'AI model accuracy, predictions, and performance metrics',
      icon: (
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      color: 'blue',
      metrics: [
        { label: 'Total Models', value: (analyticsData.modelPerformance?.summary?.totalModels || 0).toString(), status: 'excellent' },
        { label: 'Active Models', value: (analyticsData.modelPerformance?.summary?.activeModels || 0).toString(), status: 'excellent' },
        { label: 'Average Accuracy', value: `${analyticsData.modelPerformance?.summary?.averageAccuracy || 0}%`, status: 'good' },
        { label: 'Total Predictions', value: (analyticsData.modelPerformance?.summary?.totalPredictions || 0).toLocaleString(), status: 'good' }
      ]
    },
    {
      id: 'content-engagement',
      title: 'Content Engagement',
      description: 'User interaction, views, and content performance',
      icon: (
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      color: 'purple',
      metrics: [
        { label: 'Total Views', value: (analyticsData.contentEngagement?.totalViews || 0).toLocaleString(), status: 'good' },
        { label: 'Unique Visitors', value: (analyticsData.contentEngagement?.uniqueVisitors || 0).toLocaleString(), status: 'good' },
        { label: 'Avg Session Time', value: analyticsData.contentEngagement?.averageSessionTime || 'N/A', status: 'excellent' },
        { label: 'Bounce Rate', value: analyticsData.contentEngagement?.bounceRate || 'N/A', status: 'good' }
      ]
    },
    {
      id: 'user-behaviour',
      title: 'User Behaviour',
      description: 'User activity patterns, retention, and demographics',
      icon: (
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      color: 'amber',
      metrics: [
        { label: 'Daily Active Users', value: (analyticsData.userBehaviour?.dailyActiveUsers || 0).toLocaleString(), status: 'good' },
        { label: 'User Retention', value: analyticsData.userBehaviour?.userRetention || 'N/A', status: 'good' },
        { label: 'New Registrations', value: (analyticsData.userBehaviour?.newRegistrations || 0).toLocaleString(), status: 'excellent' },
        { label: 'Monthly Active Users', value: (analyticsData.userBehaviour?.monthlyActiveUsers || 0).toLocaleString(), status: 'good' }
      ]
    },
    {
      id: 'cicd-operations',
      title: 'CI/CD Operations',
      description: 'Deployment pipelines, build status, and release metrics',
      icon: (
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        </svg>
      ),
      color: 'indigo',
      metrics: [
        { label: 'Total Pipelines', value: analyticsData.cicdAnalytics?.summary?.totalPipelines?.toString() || '0', status: 'good' },
        { label: 'Active Pipelines', value: analyticsData.cicdAnalytics?.summary?.activePipelines?.toString() || '0', status: 'excellent' },
        { label: 'Successful Deployments', value: analyticsData.cicdAnalytics?.summary?.successfulDeployments?.toString() || '0', status: 'excellent' },
        { label: 'Avg Deploy Time', value: `${analyticsData.cicdAnalytics?.summary?.averageDeploymentTime || 0}s`, status: 'good' }
      ]
    },
    {
      id: 'continuous-learning',
      title: 'Continuous Learning',
      description: 'ML model retraining, performance improvements, and learning automation',
      icon: (
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      color: 'teal',
      metrics: [
        { label: 'Retraining Jobs', value: analyticsData.continuousLearningAnalytics?.summary?.totalRetrainingJobs?.toString() || '0', status: 'good' },
        { label: 'Successful Retraining', value: analyticsData.continuousLearningAnalytics?.summary?.successfulRetraining?.toString() || '0', status: 'excellent' },
        { label: 'Models Improved', value: analyticsData.continuousLearningAnalytics?.summary?.modelsImproved?.toString() || '0', status: 'excellent' },
        { label: 'Avg Improvement', value: `${analyticsData.continuousLearningAnalytics?.summary?.averageImprovementRate || 0}%`, status: 'excellent' }
      ]
    },
    {
      id: 'scheduled-jobs',
      title: 'Scheduled Jobs',
      description: 'Cron jobs, automated tasks, and system maintenance operations',
      icon: (
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'rose',
      metrics: [
        { label: 'Total Jobs', value: analyticsData.cronJobAnalytics?.summary?.totalJobs?.toString() || '0', status: 'good' },
        { label: 'Active Jobs', value: analyticsData.cronJobAnalytics?.summary?.activeJobs?.toString() || '0', status: 'excellent' },
        { label: 'Successful Executions', value: analyticsData.cronJobAnalytics?.summary?.successfulExecutions?.toString() || '0', status: 'excellent' },
        { label: 'Avg Execution Time', value: `${Math.floor((analyticsData.cronJobAnalytics?.summary?.averageExecutionTime || 0) / 60)}m`, status: 'good' }
      ]
    }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'excellent': return 'text-green-600 bg-green-50';
      case 'good': return 'text-blue-600 bg-blue-50';
      case 'warning': return 'text-amber-600 bg-amber-50';
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getColorClasses = (color) => {
    const colorMap = {
      green: {
        bg: 'from-green-50 to-green-100',
        border: 'border-green-200',
        icon: 'bg-green-500',
        text: 'text-green-700'
      },
      blue: {
        bg: 'from-blue-50 to-blue-100',
        border: 'border-blue-200',
        icon: 'bg-blue-500',
        text: 'text-blue-700'
      },
      purple: {
        bg: 'from-purple-50 to-purple-100',
        border: 'border-purple-200',
        icon: 'bg-purple-500',
        text: 'text-purple-700'
      },
      amber: {
        bg: 'from-amber-50 to-amber-100',
        border: 'border-amber-200',
        icon: 'bg-amber-500',
        text: 'text-amber-700'
      },
      indigo: {
        bg: 'from-indigo-50 to-indigo-100',
        border: 'border-indigo-200',
        icon: 'bg-indigo-500',
        text: 'text-indigo-700'
      },
      teal: {
        bg: 'from-teal-50 to-teal-100',
        border: 'border-teal-200',
        icon: 'bg-teal-500',
        text: 'text-teal-700'
      },
      rose: {
        bg: 'from-rose-50 to-rose-100',
        border: 'border-rose-200',
        icon: 'bg-rose-500',
        text: 'text-rose-700'
      }
    };
    return colorMap[color] || colorMap.green;
  };

  if (loading || !analyticsData.systemHealth || !analyticsData.modelPerformance || !analyticsData.cicdAnalytics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-slate-200 border-t-green-600 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-green-400 rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <p className="mt-6 text-slate-600 font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const navigationItems = [
    {
      id: 'overview',
      name: 'Dashboard Overview',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
    },
    {
      id: 'system-health',
      name: 'System Health',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 'model-performance',
      name: 'ML Models',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
    {
      id: 'content-engagement',
      name: 'Content & Users',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )
    },
    {
      id: 'devops',
      name: 'DevOps & Operations',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        </svg>
      )
    }
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-white shadow-lg border-r border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Analytics</h2>
          <p className="text-sm text-gray-600 mt-1">System Performance Dashboard</p>
        </div>
        
        <nav className="mt-6 px-3">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-left transition-all duration-200 mb-1 ${
                activeSection === item.id
                  ? 'bg-green-50 text-green-700 border-r-2 border-green-500'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <div className={`${activeSection === item.id ? 'text-green-500' : 'text-gray-400'}`}>
                {item.icon}
              </div>
              <span className="font-medium">{item.name}</span>
            </button>
          ))}
        </nav>

        {/* Export Section */}
        <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200 bg-white">
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Export Reports</p>
            <div className="flex space-x-2">
              <button
                onClick={() => handleExport('pdf')}
                disabled={exportLoading}
                className="flex-1 px-2 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                PDF
              </button>
              <button
                onClick={() => handleExport('xlsx')}
                disabled={exportLoading}
                className="flex-1 px-2 py-1 bg-green-50 text-green-600 rounded text-xs hover:bg-green-100 transition-colors disabled:opacity-50"
              >
                Excel
              </button>
              <button
                onClick={() => handleExport('csv')}
                disabled={exportLoading}
                className="flex-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                CSV
              </button>
            </div>
            
            {/* Real-time Controls */}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Real-time</p>
              <div className="space-y-2">
                <button
                  onClick={toggleAutoRefresh}
                  className={`w-full px-2 py-1 rounded text-xs transition-colors ${
                    autoRefresh
                      ? 'bg-green-50 text-green-600 hover:bg-green-100'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {autoRefresh ? '🔄 Auto-refresh ON' : '⏸️ Auto-refresh OFF'}
                </button>
                <button
                  onClick={() => fetchAnalyticsData()}
                  disabled={loading}
                  className="w-full px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Refreshing...' : '🔄 Refresh Now'}
                </button>
              </div>
            </div>

            {/* Test Empty State Button (for development) */}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Testing</p>
              <button
                onClick={simulateEmptyData}
                className="w-full px-2 py-1 bg-gray-50 text-gray-600 rounded text-xs hover:bg-gray-100 transition-colors mb-2"
              >
                Test Empty State
              </button>
              
              <button
                onClick={createSampleDevOpsData}
                className="w-full px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100 transition-colors"
              >
                Create DevOps Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          {/* Overview Dashboard */}
          {activeSection === 'overview' && (
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Analytics Overview</h1>
                <p className="text-gray-600 mt-2">Key performance indicators and system health at a glance</p>
              </div>

              {/* Check if we have any meaningful data */}
              {!hasSystemHealthData(analyticsData.systemHealth) && 
               !hasModelPerformanceData(analyticsData.modelPerformance) && 
               !hasContentEngagementData(analyticsData.contentEngagement) && 
               !hasUserBehaviourData(analyticsData.userBehaviour) ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <EmptyState
                    illustration="📈"
                    title="No Analytics Data Available"
                    description="We couldn't find any analytics data to display. This might be because the system is still collecting data or there's a connection issue with the analytics service."
                    actionText="Refresh Data"
                    onAction={() => fetchAnalyticsData()}
                  />
                </div>
              ) : (
                <>

              {/* Key Metrics Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">System Uptime</p>
                      <p className="text-2xl font-bold text-gray-900">{analyticsData.systemHealth.serverUptime}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Active ML Models</p>
                      <p className="text-2xl font-bold text-gray-900">{analyticsData.modelPerformance?.summary?.activeModels || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Active Users</p>
                      <p className="text-2xl font-bold text-gray-900">{(analyticsData.userBehaviour?.dailyActiveUsers || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Deployments Today</p>
                      <p className="text-2xl font-bold text-gray-900">{analyticsData.cicdAnalytics?.summary?.deploymentsToday || 0}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Status Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health Overview</h3>
                  <LineChart
                    data={[
                      { label: 'CPU', value: parseInt(analyticsData.systemHealth?.cpuUsage?.replace('%', '') || '0') },
                      { label: 'Memory', value: parseInt(analyticsData.systemHealth?.memoryUsage?.replace('%', '') || '0') },
                      { label: 'Disk', value: parseInt(analyticsData.systemHealth?.diskUsage?.replace('%', '') || '0') },
                      { label: 'Load', value: Math.round((analyticsData.systemHealth?.systemLoad || 0) * 100) }
                    ]}
                    title="Current Resource Usage"
                    color="#10B981"
                  />
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Model Performance</h3>
                  <BarChart
                    data={(analyticsData.modelPerformance?.models || []).map(model => ({
                      label: model.name?.split(' ')[0] || 'Model',
                      value: model.accuracy || 0
                    }))}
                    title="Model Accuracy (%)"
                    color="#3B82F6"
                  />
                </div>
              </div>

              {/* Real-time Performance Trends */}
              {analyticsData.systemHealth?.performanceHistory && (
                <TimeSeriesChart
                  data={analyticsData.systemHealth.performanceHistory}
                  title="Real-time System Performance"
                  metrics={['cpuUsage', 'memoryUsage']}
                  colors={['#3B82F6', '#10B981']}
                  height={300}
                />
              )}
                </>
              )}
            </div>
          )}

          {/* System Health Section */}
          {activeSection === 'system-health' && (
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
                <p className="text-gray-600 mt-2">Monitor server performance, uptime, and resource usage</p>
              </div>

              {!hasSystemHealthData(analyticsData.systemHealth) ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <EmptyState
                    illustration="🖥️"
                    title="No System Health Data"
                    description="System health monitoring data is not available. The monitoring service might be starting up or there could be a configuration issue."
                    actionText="Refresh Data"
                    onAction={() => fetchAnalyticsData()}
                  />
                </div>
              ) : (
                <>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">CPU Usage</p>
                      <p className="text-2xl font-bold text-gray-900">{analyticsData.systemHealth.cpuUsage}</p>
                    </div>
                    <div className="p-2 bg-green-100 rounded-lg">
                      <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Memory Usage</p>
                      <p className="text-2xl font-bold text-gray-900">{analyticsData.systemHealth.memoryUsage}</p>
                    </div>
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Response Time</p>
                      <p className="text-2xl font-bold text-gray-900">{analyticsData.systemHealth.responseTime}</p>
                    </div>
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Server Uptime</p>
                      <p className="text-2xl font-bold text-gray-900">{analyticsData.systemHealth.serverUptime}</p>
                    </div>
                    <div className="p-2 bg-green-100 rounded-lg">
                      <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <TimeSeriesChart
                data={analyticsData.systemHealth?.performanceHistory}
                title="Application Performance Over Time"
                metrics={['cpuUsage', 'memoryUsage', 'systemLoad', 'responseTime']}
                colors={['#3B82F6', '#10B981', '#F59E0B', '#EF4444']}
                height={400}
              />

              {/* Application Health Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Database Status</p>
                      <p className={`text-2xl font-bold ${
                        analyticsData.systemHealth?.databaseStatus === 'healthy' 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {analyticsData.systemHealth?.databaseStatus === 'healthy' ? 'Healthy' : 'Unhealthy'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {analyticsData.systemHealth?.databaseResponseTime || 'N/A'}
                      </p>
                    </div>
                    <div className={`p-2 rounded-lg ${
                      analyticsData.systemHealth?.databaseStatus === 'healthy' 
                        ? 'bg-green-100' 
                        : 'bg-red-100'
                    }`}>
                      <svg className={`h-6 w-6 ${
                        analyticsData.systemHealth?.databaseStatus === 'healthy' 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Connections</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {(analyticsData.systemHealth?.activeConnections || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {analyticsData.systemHealth?.requestsPerMinute || 0}/min
                      </p>
                    </div>
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">App Memory</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {analyticsData.systemHealth?.appMemoryUsage || 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {analyticsData.systemHealth?.appMemoryLimit || 'N/A'} limit
                      </p>
                    </div>
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional System Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">System Information</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Hostname:</span>
                      <span className="font-medium">{analyticsData.systemHealth?.hostname || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Platform:</span>
                      <span className="font-medium">{analyticsData.systemHealth?.platform || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Architecture:</span>
                      <span className="font-medium">{analyticsData.systemHealth?.architecture || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Node.js Version:</span>
                      <span className="font-medium">{analyticsData.systemHealth?.nodeVersion || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Environment:</span>
                      <span className={`font-medium px-2 py-1 rounded text-xs ${
                        analyticsData.systemHealth?.environment === 'production' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {analyticsData.systemHealth?.environment || 'development'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">App Version:</span>
                      <span className="font-medium">{analyticsData.systemHealth?.version || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Memory & Storage</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Memory:</span>
                      <span className="font-medium">{analyticsData.systemHealth?.totalMemory || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Free Memory:</span>
                      <span className="font-medium">{analyticsData.systemHealth?.freeMemory || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Memory Usage:</span>
                      <span className="font-medium">{analyticsData.systemHealth?.memoryUsage || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Disk Usage:</span>
                      <span className="font-medium">{analyticsData.systemHealth?.diskUsage || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">System Load:</span>
                      <span className="font-medium">{analyticsData.systemHealth?.systemLoad?.toFixed(2) || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Uptime Information */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Uptime Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-green-600 font-semibold">System Uptime</p>
                    <p className="text-2xl font-bold text-green-900">{analyticsData.systemHealth?.systemUptimeFormatted || 'N/A'}</p>
                    <p className="text-sm text-green-700 mt-1">Server has been running</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-blue-600 font-semibold">Process Uptime</p>
                    <p className="text-2xl font-bold text-blue-900">{analyticsData.systemHealth?.processUptimeFormatted || 'N/A'}</p>
                    <p className="text-sm text-blue-700 mt-1">Application has been running</p>
                  </div>
                </div>
              </div>
                </>
              )}
            </div>
          )}

          {/* ML Models Section */}
          {activeSection === 'model-performance' && (
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">ML Model Performance</h1>
                <p className="text-gray-600 mt-2">Monitor and compare machine learning model performance</p>
              </div>

              {!hasModelPerformanceData(analyticsData.modelPerformance) ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <EmptyState
                    illustration="🤖"
                    title="No ML Models Found"
                    description="No machine learning models are currently deployed or being monitored. Deploy some models to see their performance metrics here."
                    actionText="Refresh Data"
                    onAction={() => fetchAnalyticsData()}
                  />
                </div>
              ) : (
                <>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div>
                  <h4 className="text-lg font-semibold text-blue-900">Model Performance Dashboard</h4>
                  <p className="text-blue-700 text-sm">Compare and analyze multiple ML models</p>
                </div>
                <div className="flex items-center space-x-4">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {(analyticsData.modelPerformance?.models || []).map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-4 bg-white rounded-xl shadow-sm border border-gray-200">
                  <p className="text-blue-600 font-semibold">Total Models</p>
                  <p className="text-2xl font-bold text-blue-900">{analyticsData.modelPerformance?.summary?.totalModels || 0}</p>
                </div>
                <div className="text-center p-4 bg-white rounded-xl shadow-sm border border-gray-200">
                  <p className="text-green-600 font-semibold">Active Models</p>
                  <p className="text-2xl font-bold text-green-900">{analyticsData.modelPerformance?.summary?.activeModels || 0}</p>
                </div>
                <div className="text-center p-4 bg-white rounded-xl shadow-sm border border-gray-200">
                  <p className="text-purple-600 font-semibold">Avg Accuracy</p>
                  <p className="text-2xl font-bold text-purple-900">{analyticsData.modelPerformance?.summary?.averageAccuracy || 0}%</p>
                </div>
                <div className="text-center p-4 bg-white rounded-xl shadow-sm border border-gray-200">
                  <p className="text-amber-600 font-semibold">Total Predictions</p>
                  <p className="text-2xl font-bold text-amber-900">{(analyticsData.modelPerformance?.summary?.totalPredictions || 0).toLocaleString()}</p>
                </div>
                <div className="text-center p-4 bg-white rounded-xl shadow-sm border border-gray-200">
                  <p className="text-red-600 font-semibold">Success Rate</p>
                  <p className="text-2xl font-bold text-red-900">
                    {analyticsData.modelPerformance?.summary?.totalPredictions 
                      ? ((analyticsData.modelPerformance.summary.totalSuccessfulPredictions / analyticsData.modelPerformance.summary.totalPredictions) * 100).toFixed(1)
                      : 0}%
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <ModelComparisonChart
                    models={analyticsData.modelPerformance?.models || []}
                    metric="accuracy"
                    title="Model Accuracy Comparison"
                  />
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <ModelMetricsRadar
                    models={analyticsData.modelPerformance?.models || []}
                    selectedModel={selectedModel}
                  />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <ModelTrendsChart
                  trendsData={analyticsData.modelPerformance?.performanceTrends || {}}
                  selectedModels={[]}
                />
              </div>
                </>
              )}
            </div>
          )}

          {/* Content & Users Section */}
          {activeSection === 'content-engagement' && (
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Content & User Analytics</h1>
                <p className="text-gray-600 mt-2">Monitor user engagement, content performance, and behavior patterns</p>
              </div>

              {/* Content & Users Tabs */}
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  {[
                    { id: 'analytics', name: 'Analytics Overview', icon: '📊' },
                    { id: 'user-reports', name: 'User Activity Reports', icon: '📋' }
                  ].map((tab) => {
                    const isActive = selectedContentTab === tab.id;
                    
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setSelectedContentTab(tab.id)}
                        className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                          isActive
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <span>{tab.icon}</span>
                        <span>{tab.name}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Analytics Tab Content */}
              {selectedContentTab === 'analytics' && (
                <>
                  {!hasContentEngagementData(analyticsData.contentEngagement) && 
                   !hasUserBehaviourData(analyticsData.userBehaviour) ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                      <EmptyState
                        illustration="👥"
                        title="No User Activity Data"
                        description="No user engagement or content analytics data is available. This could mean users haven't been active recently or tracking isn't properly configured."
                        actionText="Refresh Data"
                        onAction={() => fetchAnalyticsData()}
                      />
                    </div>
                  ) : (
                    <>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Views</p>
                      <p className="text-2xl font-bold text-gray-900">{(analyticsData.contentEngagement?.totalViews || 0).toLocaleString()}</p>
                    </div>
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Users</p>
                      <p className="text-2xl font-bold text-gray-900">{(analyticsData.userBehaviour?.dailyActiveUsers || 0).toLocaleString()}</p>
                    </div>
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Bounce Rate</p>
                      <p className="text-2xl font-bold text-gray-900">{analyticsData.contentEngagement?.bounceRate || '0%'}</p>
                    </div>
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <svg className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Session Time</p>
                      <p className="text-2xl font-bold text-gray-900">{analyticsData.contentEngagement?.averageSessionTime || '0m 0s'}</p>
                    </div>
                    <div className="p-2 bg-green-100 rounded-lg">
                      <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Content Categories</h3>
                  <PieChart
                    data={Object.entries(analyticsData.contentEngagement?.contentByCategory || {}).map(([key, value]) => ({
                      label: key,
                      value: value
                    }))}
                    title="Content Distribution"
                    colors={['#8B5CF6', '#10B981', '#F59E0B', '#EF4444']}
                  />
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">User Activity</h3>
                  <BarChart
                    data={[
                      { label: 'Daily', value: analyticsData.userBehaviour?.dailyActiveUsers || 0 },
                      { label: 'Weekly', value: analyticsData.userBehaviour?.weeklyActiveUsers || 0 },
                      { label: 'Monthly', value: analyticsData.userBehaviour?.monthlyActiveUsers || 0 }
                    ]}
                    title="Active Users by Period"
                    color="#F59E0B"
                  />
                </div>
              </div>

              {/* Enhanced User Analytics Section */}
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">User Engagement Analytics</h2>
                  <p className="text-gray-600">Deep insights into user behavior and content interaction patterns</p>
                </div>

                {/* Quick User Insights */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-xl text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100 text-sm">High Engagement Users</p>
                        <p className="text-2xl font-bold">{analyticsData?.userBehaviour?.userSegmentation?.engagementLevels?.High || 0}</p>
                      </div>
                      <div className="text-blue-200">
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-xl text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100 text-sm">Power Users</p>
                        <p className="text-2xl font-bold">{analyticsData?.userBehaviour?.userSegmentation?.segments?.['Power User'] || 0}</p>
                      </div>
                      <div className="text-green-200">
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-xl text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-100 text-sm">Peak Hour</p>
                        <p className="text-2xl font-bold">{analyticsData?.userBehaviour?.behaviorPatterns?.peakHours?.[0]?.hour || 'N/A'}:00</p>
                      </div>
                      <div className="text-purple-200">
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-xl text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-orange-100 text-sm">Content Searches</p>
                        <p className="text-2xl font-bold">{(analyticsData?.contentEngagement?.totalSearches || 0).toLocaleString()}</p>
                      </div>
                      <div className="text-orange-200">
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* User Engagement and Demographics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <UserEngagementChart 
                    users={analyticsData?.contentEngagement?.userContentInteractions || []}
                    title="Most Engaged Content Users"
                  />
                  <ContentDemographicsChart 
                    data={analyticsData?.contentEngagement?.contentPerformanceByDemographics || []}
                    title="Content Performance by Region"
                  />
                </div>

                {/* User Segmentation and Journey */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <UserSegmentationChart 
                    segments={analyticsData?.userBehaviour?.userSegmentation?.segments || {}}
                    title="User Type Distribution"
                  />
                  <UserJourneyFunnel 
                    funnel={analyticsData?.userBehaviour?.engagementFunnel || {}}
                    title="User Engagement Funnel"
                  />
                </div>

                {/* Activity Patterns */}
                <div className="space-y-6">
                  <UserActivityHeatmap 
                    patterns={analyticsData?.userBehaviour?.behaviorPatterns?.timePatterns || []}
                    title="User Activity Patterns (Last 7 Days)"
                  />
                </div>

                {/* User Journey Analytics */}
                {analyticsData?.contentEngagement?.userJourneys && (
                  <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">User Content Journey Analytics</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {analyticsData?.contentEngagement?.userJourneys?.totalJourneys || 0}
                        </div>
                        <div className="text-sm text-gray-600">Total User Journeys</div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {analyticsData?.contentEngagement?.userJourneys?.averageJourneyLength?.toFixed(1) || '0.0'}
                        </div>
                        <div className="text-sm text-gray-600">Avg Journey Length</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">
                          {analyticsData?.contentEngagement?.userJourneys?.averageActionsPerSession?.toFixed(1) || '0.0'}
                        </div>
                        <div className="text-sm text-gray-600">Actions Per Session</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* User Cohort Analysis */}
                {analyticsData?.userBehaviour?.userCohorts && analyticsData?.userBehaviour?.userCohorts.length > 0 && (
                  <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">User Cohort Retention Analysis</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Cohort</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Cohort Size</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Active Users</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Retention Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {(analyticsData?.userBehaviour?.userCohorts || []).slice(0, 6).map((cohort, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">{cohort?.cohort || 'Unknown'}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{cohort?.cohortSize || 0}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{cohort?.activeInPeriod || 0}</td>
                              <td className="px-4 py-3 text-sm">
                                <div className="flex items-center space-x-2">
                                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-green-500 rounded-full"
                                      style={{ width: `${Math.min(100, cohort?.retentionRate || 0)}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-gray-700">{(cohort?.retentionRate || 0).toFixed(1)}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
                    </>
                  )}
                </>
              )}

              {/* User Reports Tab Content */}
              {selectedContentTab === 'user-reports' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">User Activity Reports</h3>
                    <p className="text-gray-600 text-sm">
                      Detailed view of individual user activities, engagement patterns, and content interactions
                    </p>
                  </div>
                  <AdminUserReports />
                </div>
              )}
            </div>
          )}

          {/* DevOps Section */}
          {activeSection === 'devops' && (
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">DevOps & Operations</h1>
                <p className="text-gray-600 mt-2">Monitor CI/CD pipelines, continuous learning, and scheduled jobs</p>
              </div>

              {/* Simple message for no DevOps data */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
                <div className="text-center">
                  <div className="text-6xl mb-4">⚙️</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">DevOps Operations</h3>
                  <p className="text-gray-600 mb-4">
                    DevOps monitoring features are currently being set up. This section will display:
                  </p>
                  <div className="text-left max-w-md mx-auto space-y-2 mb-6">
                    <div className="flex items-center space-x-2">
                      <span className="text-blue-500">🔄</span>
                      <span className="text-gray-700">CI/CD Pipeline Status & Deployment Trends</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-green-500">🤖</span>
                      <span className="text-gray-700">ML Model Training & Performance Monitoring</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-purple-500">⏰</span>
                      <span className="text-gray-700">Scheduled Jobs & Automated Tasks</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-red-500">🚨</span>
                      <span className="text-gray-700">System Alerts & Health Monitoring</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    Contact your system administrator to configure DevOps monitoring.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detailed View Modal */}
      {selectedMetric && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">
                  {reports.find(r => r.id === selectedMetric)?.title} - Detailed View
                </h2>
                <button
                  onClick={() => setSelectedMetric(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {selectedMetric === 'system-health' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                      <h4 className="font-semibold text-green-800">CPU Usage</h4>
                      <p className="text-2xl font-bold text-green-900">{analyticsData.systemHealth.cpuUsage}</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-blue-800">Memory Usage</h4>
                      <p className="text-2xl font-bold text-blue-900">{analyticsData.systemHealth.memoryUsage}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                      <h4 className="font-semibold text-purple-800">Disk Usage</h4>
                      <p className="text-2xl font-bold text-purple-900">{analyticsData.systemHealth.diskUsage}</p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border border-amber-200">
                      <h4 className="font-semibold text-amber-800">Network Status</h4>
                      <p className="text-2xl font-bold text-amber-900">{analyticsData.systemHealth.networkStatus}</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h4 className="text-lg font-semibold mb-4">System Performance Over Time</h4>
                    <LineChart
                      data={[
                        { label: '6AM', value: 42 },
                        { label: '12PM', value: 65 },
                        { label: '6PM', value: 58 },
                        { label: '12AM', value: 38 }
                      ]}
                      title="CPU Usage Throughout Day"
                      color="#10B981"
                    />
                  </div>
                </div>
              )}
              
              {selectedMetric === 'model-performance' && (
                <div className="space-y-6">
                  {/* Model Selection and Summary */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div>
                      <h4 className="text-lg font-semibold text-blue-900">Model Performance Dashboard</h4>
                      <p className="text-blue-700 text-sm">Compare and analyze multiple ML models</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {analyticsData.modelPerformance.models.map(model => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Summary Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-blue-600 font-semibold">Total Models</p>
                      <p className="text-2xl font-bold text-blue-900">{analyticsData.modelPerformance?.summary?.totalModels || 0}</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-green-600 font-semibold">Active Models</p>
                      <p className="text-2xl font-bold text-green-900">{analyticsData.modelPerformance?.summary?.activeModels || 0}</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="text-purple-600 font-semibold">Avg Accuracy</p>
                      <p className="text-2xl font-bold text-purple-900">{analyticsData.modelPerformance?.summary?.averageAccuracy || 0}%</p>
                    </div>
                    <div className="text-center p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <p className="text-amber-600 font-semibold">Total Predictions</p>
                      <p className="text-2xl font-bold text-amber-900">{(analyticsData.modelPerformance?.summary?.totalPredictions || 0).toLocaleString()}</p>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-red-600 font-semibold">Success Rate</p>
                      <p className="text-2xl font-bold text-red-900">
                        {((analyticsData.modelPerformance.summary.totalSuccessfulPredictions / analyticsData.modelPerformance.summary.totalPredictions) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Model Comparison Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <ModelComparisonChart
                        models={analyticsData.modelPerformance.models}
                        metric="accuracy"
                        title="Model Accuracy Comparison"
                      />
                    </div>
                    <div>
                      <ModelMetricsRadar
                        models={analyticsData.modelPerformance.models}
                        selectedModel={selectedModel}
                      />
                    </div>
                  </div>

                  {/* Performance Trends */}
                  <div>
                    <ModelTrendsChart
                      trendsData={analyticsData.modelPerformance.performanceTrends}
                      selectedModels={[]}
                    />
                  </div>
                </div>
              )}
              
              {selectedMetric === 'content-engagement' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h4 className="text-lg font-semibold mb-4">Content Categories</h4>
                      <PieChart
                        data={Object.entries(analyticsData?.contentEngagement?.contentByCategory || {}).map(([key, value]) => ({
                          label: key,
                          value: value
                        }))}
                        title="Content Distribution"
                        colors={['#8B5CF6', '#10B981', '#F59E0B', '#EF4444']}
                      />
                    </div>
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h4 className="text-lg font-semibold mb-4">Engagement Trends</h4>
                      <LineChart
                        data={[
                          { label: 'Week 1', value: 15000 },
                          { label: 'Week 2', value: 18000 },
                          { label: 'Week 3', value: 22000 },
                          { label: 'Week 4', value: 25000 }
                        ]}
                        title="Weekly Views"
                        color="#8B5CF6"
                      />
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <h4 className="text-lg font-semibold p-4 border-b border-gray-200">Top Performing Content</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Content Title</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Views</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Engagement</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {(analyticsData?.contentEngagement?.topContent || []).map((content, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">{content?.title || 'Unknown'}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{(content?.views || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{content?.engagement || '0%'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Enhanced User-Content Analytics */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <UserEngagementChart 
                      users={analyticsData?.contentEngagement?.userContentInteractions || []}
                      title="Most Engaged Content Users"
                    />
                    <ContentDemographicsChart 
                      data={analyticsData?.contentEngagement?.contentPerformanceByDemographics || []}
                      title="Content Performance by Region"
                    />
                  </div>

                  {/* User Journey Analytics */}
                  {analyticsData?.contentEngagement?.userJourneys && (
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">User Content Journey Analytics</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {analyticsData?.contentEngagement?.userJourneys?.totalJourneys || 0}
                          </div>
                          <div className="text-sm text-gray-600">Total User Journeys</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {analyticsData?.contentEngagement?.userJourneys?.averageJourneyLength?.toFixed(1) || '0.0'}
                          </div>
                          <div className="text-sm text-gray-600">Avg Journey Length</div>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">
                            {analyticsData?.contentEngagement?.userJourneys?.averageActionsPerSession?.toFixed(1) || '0.0'}
                          </div>
                          <div className="text-sm text-gray-600">Actions Per Session</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {selectedMetric === 'user-behaviour' && (
                <div className="space-y-6">
                  {/* User Segmentation and Engagement Funnel */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <UserSegmentationChart 
                      segments={analyticsData.userBehaviour?.userSegmentation?.segments || {}}
                      title="User Type Segmentation"
                    />
                    <UserJourneyFunnel 
                      funnel={analyticsData.userBehaviour?.engagementFunnel || {}}
                      title="User Engagement Funnel"
                    />
                  </div>

                  {/* Activity Patterns Heatmap */}
                  <UserActivityHeatmap 
                    patterns={analyticsData.userBehaviour?.behaviorPatterns?.timePatterns || []}
                    title="User Activity Patterns (7 Days)"
                  />

                  {/* Traditional Charts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h4 className="text-lg font-semibold mb-4">User Activity</h4>
                      <BarChart
                        data={[
                          { label: 'Daily', value: analyticsData?.userBehaviour?.dailyActiveUsers || 0 },
                          { label: 'Weekly', value: analyticsData?.userBehaviour?.weeklyActiveUsers || 0 },
                          { label: 'Monthly', value: analyticsData?.userBehaviour?.monthlyActiveUsers || 0 }
                        ]}
                        title="Active Users by Period"
                        color="#F59E0B"
                      />
                    </div>
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h4 className="text-lg font-semibold mb-4">Users by Region</h4>
                      <PieChart
                        data={Object.entries(analyticsData?.userBehaviour?.usersByRegion || {}).map(([key, value]) => ({
                          label: key,
                          value: value
                        }))}
                        title="Geographic Distribution"
                        colors={['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444']}
                      />
                    </div>
                  </div>

                  {/* Enhanced User Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-6 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-2xl font-bold text-blue-600">
                        {analyticsData.userBehaviour?.userSegmentation?.engagementLevels?.High || 0}
                      </div>
                      <div className="text-sm text-gray-600">High Engagement Users</div>
                    </div>
                    <div className="text-center p-6 bg-green-50 rounded-lg border border-green-200">
                      <div className="text-2xl font-bold text-green-600">
                        {analyticsData.userBehaviour?.behaviorPatterns?.peakHours?.[0]?.hour || 'N/A'}:00
                      </div>
                      <div className="text-sm text-gray-600">Peak Activity Hour</div>
                    </div>
                    <div className="text-center p-6 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="text-2xl font-bold text-yellow-600">
                        {analyticsData.userBehaviour?.userCohorts?.[0]?.retentionRate?.toFixed(1) || '0.0'}%
                      </div>
                      <div className="text-sm text-gray-600">Latest Cohort Retention</div>
                    </div>
                    <div className="text-center p-6 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="text-2xl font-bold text-purple-600">
                        {analyticsData.userBehaviour?.mostActiveUsers?.length || 0}
                      </div>
                      <div className="text-sm text-gray-600">Active Power Users</div>
                    </div>
                  </div>

                  {/* User Cohort Analysis */}
                  {analyticsData?.userBehaviour?.userCohorts && analyticsData?.userBehaviour?.userCohorts.length > 0 && (
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">User Cohort Retention Analysis</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Cohort</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Cohort Size</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Active Users</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Retention Rate</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {(analyticsData?.userBehaviour?.userCohorts || []).slice(0, 6).map((cohort, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-900">{cohort?.cohort || 'Unknown'}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">{cohort?.cohortSize || 0}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">{cohort?.activeInPeriod || 0}</td>
                                <td className="px-4 py-3 text-sm">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-green-500 rounded-full"
                                        style={{ width: `${Math.min(100, cohort?.retentionRate || 0)}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-gray-700">{(cohort?.retentionRate || 0).toFixed(1)}%</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {selectedMetric === 'cicd-operations' && (
                <div className="space-y-6">
                  {/* CI/CD Summary */}
                  <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                    <h4 className="text-lg font-semibold text-indigo-900 mb-2">CI/CD Operations Dashboard</h4>
                    <p className="text-indigo-700 text-sm">Monitor deployment pipelines and release automation</p>
                  </div>

                  {/* Pipeline Status */}
                  <PipelineStatusChart
                    pipelines={analyticsData.cicdAnalytics.pipelines}
                    title="Deployment Pipeline Status"
                  />

                  {/* Deployment Trends */}
                  <DeploymentTrendsChart
                    trendsData={analyticsData.cicdAnalytics.deploymentTrends}
                    title="Deployment Success/Failure Trends"
                  />

                  {/* System Alerts */}
                  <SystemAlerts
                    alerts={[]}
                    title="CI/CD System Status"
                  />
                </div>
              )}
              
              {selectedMetric === 'continuous-learning' && (
                <div className="space-y-6">
                  {/* Learning Summary */}
                  <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
                    <h4 className="text-lg font-semibold text-teal-900 mb-2">Continuous Learning Dashboard</h4>
                    <p className="text-teal-700 text-sm">Track ML model retraining and performance improvements</p>
                  </div>

                  {/* Learning Progress */}
                  <LearningProgressChart
                    learningJobs={analyticsData.continuousLearningAnalytics.learningJobs}
                    performanceGains={analyticsData.continuousLearningAnalytics.performanceGains}
                    title="Model Learning and Improvement Progress"
                  />

                  {/* Retraining Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-teal-50 rounded-lg border border-teal-200">
                      <p className="text-teal-600 font-semibold">Total Jobs</p>
                      <p className="text-2xl font-bold text-teal-900">{analyticsData.continuousLearningAnalytics.summary.totalRetrainingJobs}</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-green-600 font-semibold">Successful</p>
                      <p className="text-2xl font-bold text-green-900">{analyticsData.continuousLearningAnalytics.summary.successfulRetraining}</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="text-purple-600 font-semibold">Models Improved</p>
                      <p className="text-2xl font-bold text-purple-900">{analyticsData.continuousLearningAnalytics.summary.modelsImproved}</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-blue-600 font-semibold">Avg Improvement</p>
                      <p className="text-2xl font-bold text-blue-900">{analyticsData.continuousLearningAnalytics.summary.averageImprovementRate}%</p>
                    </div>
                  </div>
                </div>
              )}
              
              {selectedMetric === 'scheduled-jobs' && (
                <div className="space-y-6">
                  {/* Jobs Summary */}
                  <div className="bg-rose-50 p-4 rounded-lg border border-rose-200">
                    <h4 className="text-lg font-semibold text-rose-900 mb-2">Scheduled Jobs Dashboard</h4>
                    <p className="text-rose-700 text-sm">Monitor cron jobs, automated tasks, and system maintenance</p>
                  </div>

                  {/* Job Status Table */}
                  <CronJobTable
                    jobs={analyticsData.cronJobAnalytics.jobs}
                    title="Detailed Job Status and Scheduling"
                  />

                  {/* System Alerts */}
                  <SystemAlerts
                    alerts={analyticsData.cronJobAnalytics.alerts}
                    title="Job Execution Alerts"
                  />

                  {/* Execution Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-6 bg-rose-50 rounded-lg border border-rose-200">
                      <p className="text-rose-600 font-semibold">Total Jobs</p>
                      <p className="text-3xl font-bold text-rose-900">{analyticsData.cronJobAnalytics.summary.totalJobs}</p>
                    </div>
                    <div className="text-center p-6 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-green-600 font-semibold">Successful Executions</p>
                      <p className="text-3xl font-bold text-green-900">{analyticsData.cronJobAnalytics.summary.successfulExecutions}</p>
                    </div>
                    <div className="text-center p-6 bg-amber-50 rounded-lg border border-amber-200">
                      <p className="text-amber-600 font-semibold">Avg Execution Time</p>
                      <p className="text-3xl font-bold text-amber-900">{Math.floor(analyticsData.cronJobAnalytics.summary.averageExecutionTime / 60)}m</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAnalytics;
