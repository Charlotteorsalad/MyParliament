import React from 'react';
import { BarChart, LineChart } from './SimpleChart';

// CI/CD Pipeline Status Chart
export const PipelineStatusChart = ({ pipelines, title = "CI/CD Pipeline Status" }) => {
  if (!pipelines || pipelines.length === 0) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
        <div className="text-center">
          <div className="text-gray-500 text-lg font-medium">No Pipeline Data</div>
          <div className="text-gray-400 text-sm mt-2">Pipeline status will appear here</div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return '#10B981';
      case 'failed': return '#EF4444';
      case 'running': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return '✓';
      case 'failed': return '✗';
      case 'running': return '⟳';
      default: return '?';
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold">{title}</h4>
      
      {/* Pipeline Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pipelines.map((pipeline, index) => (
          <div key={pipeline.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: getStatusColor(pipeline.status) }}
                >
                  {getStatusIcon(pipeline.status)}
                </div>
                <div>
                  <h5 className="font-medium text-gray-900">{pipeline.name}</h5>
                  <p className="text-xs text-gray-500">{pipeline.environment}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{pipeline.success_rate}%</p>
                <p className="text-xs text-gray-500">success rate</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Last Run:</span>
                <p className="font-medium">{new Date(pipeline.lastRun).toLocaleTimeString()}</p>
              </div>
              <div>
                <span className="text-gray-600">Duration:</span>
                <p className="font-medium">{pipeline.duration > 0 ? `${Math.floor(pipeline.duration / 60)}m ${pipeline.duration % 60}s` : 'Running...'}</p>
              </div>
            </div>
            
            {/* Success Rate Bar */}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Success Rate</span>
                <span>{pipeline.successful_runs}/{pipeline.total_runs}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${pipeline.success_rate}%`,
                    backgroundColor: getStatusColor(pipeline.success_rate > 95 ? 'success' : pipeline.success_rate > 85 ? 'running' : 'failed')
                  }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Deployment Trends Chart
export const DeploymentTrendsChart = ({ trendsData, title = "Deployment Trends" }) => {
  if (!trendsData || trendsData.length === 0) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
        <div className="text-center">
          <div className="text-gray-500 text-lg font-medium">No Trend Data</div>
        </div>
      </div>
    );
  }

  const successData = trendsData.map(item => ({
    label: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: item.successful
  }));

  const failedData = trendsData.map(item => ({
    label: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: item.failed
  }));

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold">{title}</h4>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChart
          data={successData}
          title="Successful Deployments"
          color="#10B981"
        />
        <BarChart
          data={failedData}
          title="Failed Deployments"
          color="#EF4444"
        />
      </div>
    </div>
  );
};

// Cron Job Status Table
export const CronJobTable = ({ jobs, title = "Scheduled Jobs Status" }) => {
  if (!jobs || jobs.length === 0) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
        <div className="text-center">
          <div className="text-gray-500 text-lg font-medium">No Cron Jobs</div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'running': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (seconds) => {
    if (seconds === 0) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const formatNextRun = (nextRun) => {
    const now = new Date();
    const next = new Date(nextRun);
    const diffMs = next - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 24) return `${Math.floor(diffHours / 24)}d ${diffHours % 24}h`;
    if (diffHours > 0) return `${diffHours}h ${diffMinutes}m`;
    return `${diffMinutes}m`;
  };

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold">{title}</h4>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Job Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Schedule</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Last Run</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Next Run</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Duration</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Success Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {jobs.map((job, index) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-gray-900">{job.name}</div>
                      <div className="text-xs text-gray-500 truncate max-w-xs" title={job.description}>
                        {job.description}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{job.schedule}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(job.lastRun).toLocaleString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    in {formatNextRun(job.nextRun)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDuration(job.duration)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">{job.success_rate}%</span>
                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                        <div 
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{ 
                            width: `${job.success_rate}%`,
                            backgroundColor: job.success_rate > 95 ? '#10B981' : job.success_rate > 85 ? '#F59E0B' : '#EF4444'
                          }}
                        ></div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Continuous Learning Progress Chart
export const LearningProgressChart = ({ learningJobs, performanceGains, title = "Continuous Learning Progress" }) => {
  if (!learningJobs || learningJobs.length === 0) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
        <div className="text-center">
          <div className="text-gray-500 text-lg font-medium">No Learning Jobs</div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'running': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'queued': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDuration = (seconds) => {
    if (seconds === 0) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      <h4 className="text-lg font-semibold">{title}</h4>
      
      {/* Learning Jobs Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {learningJobs.map((job, index) => (
          <div key={job.id} className={`rounded-lg border p-4 ${getStatusColor(job.status)}`}>
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-medium">{job.modelName}</h5>
              <span className="text-xs font-medium uppercase">{job.status}</span>
            </div>
            
            <div className="space-y-2 text-sm">
              {job.status === 'completed' && (
                <div className="flex justify-between">
                  <span>Improvement:</span>
                  <span className="font-medium">+{job.improvement}%</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Data Points:</span>
                <span className="font-medium">{job.dataPoints.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-medium">{formatDuration(job.duration)}</span>
              </div>
              <div className="flex justify-between">
                <span>Trigger:</span>
                <span className="font-medium text-xs">{job.trigger.replace('_', ' ')}</span>
              </div>
            </div>
            
            {job.status === 'completed' && job.improvement > 0 && (
              <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                <div className="flex justify-between text-sm">
                  <span>Before: {job.previousAccuracy}%</span>
                  <span>After: {job.newAccuracy}%</span>
                </div>
                <div className="mt-1 bg-current bg-opacity-20 rounded-full h-2">
                  <div 
                    className="bg-current rounded-full h-2 transition-all duration-500"
                    style={{ width: `${(job.newAccuracy / 100) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Performance Gains Chart */}
      {performanceGains && performanceGains.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h5 className="text-md font-semibold mb-4">Model Performance Improvements</h5>
          <BarChart
            data={performanceGains.map(gain => ({
              label: gain.model.split(' ')[0],
              value: gain.improvement
            }))}
            title="Accuracy Improvement (%)"
            color="#8B5CF6"
          />
        </div>
      )}
    </div>
  );
};

// System Alerts Component
export const SystemAlerts = ({ alerts, title = "System Alerts" }) => {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-green-800">All systems operational</p>
          </div>
        </div>
      </div>
    );
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'bg-red-50 border-red-200 text-red-800';
      case 'medium': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'low': return 'bg-blue-50 border-blue-200 text-blue-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high': return '⚠️';
      case 'medium': return '🟡';
      case 'low': return 'ℹ️';
      default: return '📋';
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold">{title}</h4>
      <div className="space-y-3">
        {alerts.map((alert, index) => (
          <div key={alert.id} className={`rounded-lg border p-4 ${getSeverityColor(alert.severity)}`}>
            <div className="flex items-start space-x-3">
              <span className="text-lg">{getSeverityIcon(alert.severity)}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium">{alert.job}</h5>
                  <span className="text-xs">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="text-sm mt-1">{alert.message}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-medium uppercase">{alert.type}</span>
                  <span className="text-xs">{alert.severity} severity</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
