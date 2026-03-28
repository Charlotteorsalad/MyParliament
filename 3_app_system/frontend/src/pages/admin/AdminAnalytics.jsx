import React, { useState, useEffect } from 'react';
import { adminApi, topicApi } from '../../api';
import { PieChart, BarChart, LineChart, MetricCard } from '../../components/charts/SimpleChart';
import { ModelMetricsRadar } from '../../components/charts/ModelComparisonChart';
import { PipelineStatusChart, DeploymentTrendsChart, CronJobTable, LearningProgressChart, SystemAlerts } from '../../components/charts/DevOpsCharts';
import TimeSeriesChart from '../../components/charts/TimeSeriesChart';
import { UserEngagementChart, UserSegmentationChart, UserByRegionChart, UserActivityHeatmap } from '../../components/charts/UserAnalyticsCharts';
import TrainMetricsRadar from '../../components/charts/TrainMetricsRadar';
import TrainTestInferenceRadar from '../../components/charts/TrainTestInferenceRadar';
import ArimaForecastChart from '../../components/charts/ArimaForecastChart';
import { exportToPDF, exportToCSV, exportToExcel } from '../../utils/exportUtils';
import AdminUserReports from './AdminUserReports';

// Alert icon for system health (ok / warning / critical)
const AlertIcon = ({ level, className = 'w-5 h-5' }) => {
  if (level === 'warning') {
    return (
      <svg className={`${className} text-amber-500 flex-shrink-0`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    );
  }
  if (level === 'critical') {
    return (
      <svg className={`${className} text-red-500 flex-shrink-0`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg className={`${className} text-green-500 flex-shrink-0`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
};

// Helpers to format backend labels into human-readable X-axis labels
const MONTH_ABBR = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatWeekLabel = (raw) => {
  const m = String(raw).match(/^(\d{4})-W(\d+)$/);
  if (m) return `W${m[2]} '${m[1].slice(2)}`;
  return raw;
};
const formatMonthLabel = (raw) => {
  const m = String(raw).match(/^(\d{4})-(\d{2})$/);
  if (m) return `${MONTH_ABBR[parseInt(m[2], 10)] || m[2]} '${m[1].slice(2)}`;
  return raw;
};
const formatYearLabel = (raw) => String(raw);

// ISO week number helper
const getISOWeek = (d) => {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
};

// Generate scaffold of N periods ending now, merged with real backend data
const buildWeekScaffold = (realData, n = 10) => {
  const map = {};
  realData.forEach(({ label, value }) => { map[label] = Number(value) || 0; });
  const now = new Date();
  const result = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const year = d.getFullYear();
    const week = getISOWeek(d);
    const key = `${year}-W${week}`;
    result.push({ key, display: formatWeekLabel(key), value: map[key] ?? 0 });
  }
  return result;
};

const buildMonthScaffold = (realData, n = 10) => {
  const map = {};
  realData.forEach(({ label, value }) => { map[label] = Number(value) || 0; });
  const now = new Date();
  const result = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const key = `${year}-${month}`;
    result.push({ key, display: formatMonthLabel(key), value: map[key] ?? 0 });
  }
  return result;
};

const buildYearScaffold = (realData) => {
  const map = {};
  realData.forEach(({ label, value }) => { map[String(label)] = Number(value) || 0; });
  const years = ['2024', '2025', '2026'];
  return years.map((y) => ({ key: y, display: y, value: map[y] ?? 0 }));
};

// Normalize backend growth trend (date/newUsers) to { label, value } with same keys as scaffolds
const normalizeSignUpWeekly = (arr) => (arr || []).map((item) => {
  const id = item.date || item._id || item;
  const label = id.year != null && id.week != null ? `${id.year}-W${id.week}` : '';
  return { label, value: item.newUsers ?? 0 };
}).filter((d) => d.label);
const normalizeSignUpMonthly = (arr) => (arr || []).map((item) => {
  const id = item.date || item._id || item;
  const month = id.month != null ? String(id.month).padStart(2, '0') : '';
  const label = id.year != null && month ? `${id.year}-${month}` : '';
  return { label, value: item.newUsers ?? 0 };
}).filter((d) => d.label);
const normalizeSignUpYearly = (arr) => (arr || []).map((item) => {
  const id = item.date || item._id || item;
  const year = id == null ? '' : (id.year != null ? String(id.year) : (typeof id === 'number' || typeof id === 'string' ? String(id) : ''));
  return { label: year, value: item.newUsers ?? 0 };
}).filter((d) => d.label);

// User Activity card with Active Users + Sign Up Users tabs; both filterable by week / month / year
const UserActivityCard = ({
  dailyActiveUsers = 0,
  weeklyActiveUsers = 0,
  monthlyActiveUsers = 0,
  newRegistrations = 0,
  signUpTrendDaily = [],
  signUpTrendWeekly = [],
  signUpTrendMonthly = [],
  signUpTrendYearly = [],
  activeUsersByWeek = [],
  activeUsersByMonth = [],
  activeUsersByYear = [],
  compact = false
}) => {
  const [tab, setTab] = useState('active');
  const [periodFilter, setPeriodFilter] = useState('week');

  const byWeek  = Array.isArray(activeUsersByWeek)  ? activeUsersByWeek  : [];
  const byMonth = Array.isArray(activeUsersByMonth) ? activeUsersByMonth : [];
  const byYear  = Array.isArray(activeUsersByYear)  ? activeUsersByYear  : [];

  const signUpByWeek  = normalizeSignUpWeekly(signUpTrendWeekly);
  const signUpByMonth = normalizeSignUpMonthly(signUpTrendMonthly);
  const signUpByYear  = normalizeSignUpYearly(signUpTrendYearly);

  const weekScaffold   = buildWeekScaffold(byWeek, 10);
  const monthScaffold  = buildMonthScaffold(byMonth, 10);
  const yearScaffold   = buildYearScaffold(byYear);
  const signUpWeekS   = buildWeekScaffold(signUpByWeek, 10);
  const signUpMonthS  = buildMonthScaffold(signUpByMonth, 10);
  const signUpYearS   = buildYearScaffold(signUpByYear);

  const activeScaffold = periodFilter === 'week' ? weekScaffold : periodFilter === 'month' ? monthScaffold : yearScaffold;
  const signUpScaffold = periodFilter === 'week' ? signUpWeekS : periodFilter === 'month' ? signUpMonthS : signUpYearS;

  const lineChartData   = activeScaffold.map(({ display, value }) => ({ label: display, value }));
  const signUpChartData = signUpScaffold.map(({ display, value }) => ({ label: display, value }));

  const periodLabel = periodFilter === 'week' ? 'Week' : periodFilter === 'month' ? 'Month' : 'Year';
  const activeChartTitle = `Active Users — by ${periodLabel}`;
  const signUpChartTitle = `Sign ups — by ${periodLabel}`;

  const wrapperClass = compact ? 'bg-gray-50 p-6 rounded-lg' : 'bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0';
  const TitleTag = compact ? 'h4' : 'h3';
  const titleClass = compact ? 'text-lg font-semibold mb-4' : 'text-lg font-semibold text-gray-900 mb-4';

  return (
    <div className={wrapperClass}>
      <TitleTag className={titleClass}>User Activity</TitleTag>
      <div className="flex border-b border-gray-200 mb-4">
        <button
          type="button"
          onClick={() => setTab('active')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'active' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Active Users
        </button>
        <button
          type="button"
          onClick={() => setTab('signup')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'signup' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Sign Up Users
        </button>
      </div>
      {tab === 'active' && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-gray-500">Filter by:</span>
            {['week', 'month', 'year'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodFilter(p)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  periodFilter === p
                    ? 'bg-teal-100 text-teal-800 border border-teal-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <LineChart data={lineChartData} title={activeChartTitle} color="#0d9488" />
        </>
      )}
      {tab === 'signup' && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-gray-500">Filter by:</span>
            {['week', 'month', 'year'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodFilter(p)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  periodFilter === p
                    ? 'bg-teal-100 text-teal-800 border border-teal-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <LineChart data={signUpChartData} title={signUpChartTitle} color="#0d9488" />
        </>
      )}
    </div>
  );
};

// Empty State Component
const EmptyState = ({ 
  icon, 
  title, 
  description, 
  actionText, 
  onAction,
  illustration = "" 
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

const CohortRetentionPanel = ({ cohorts = [], title = 'User Cohort Retention Analysis', titleLevel = 'h3' }) => {
  const visibleCohorts = Array.isArray(cohorts) ? cohorts.slice(0, 6) : [];
  const hasRetention = visibleCohorts.some((cohort) => Number(cohort?.retentionRate || 0) > 0);
  const TitleTag = titleLevel;

  if (!visibleCohorts.length) {
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <TitleTag className="text-lg font-semibold text-gray-900 mb-4">{title}</TitleTag>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visibleCohorts.map((cohort, index) => {
          const retentionRate = Number(cohort?.retentionRate || 0);
          const cohortSize = cohort?.cohortSize || 0;
          const activeInPeriod = cohort?.activeInPeriod || 0;

          return (
            <div
              key={`${cohort?.cohort || 'unknown'}-${index}`}
              className="rounded-xl border border-gray-200 bg-gray-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-500">Cohort</p>
                  <p className="text-lg font-semibold text-gray-900">{cohort?.cohort || 'Unknown'}</p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                  retentionRate > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {retentionRate.toFixed(1)}%
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white p-3 border border-gray-100">
                  <p className="text-xs text-gray-500">Cohort Size</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{cohortSize}</p>
                </div>
                <div className="rounded-lg bg-white p-3 border border-gray-100">
                  <p className="text-xs text-gray-500">Active Users</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{activeInPeriod}</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                  <span>Retention Progress</span>
                  <span>{retentionRate.toFixed(1)}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${retentionRate > 0 ? 'bg-green-500' : 'bg-gray-300'}`}
                    style={{ width: `${Math.min(100, retentionRate)}%` }}
                  />
                </div>
                {!hasRetention && (
                  <p className="text-xs text-gray-500 mt-2">No retained users in the selected period yet.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Data validation helpers
const hasValidData = (data, minLength = 1) => {
  if (!data) return false;
  if (Array.isArray(data)) return data.length >= minLength;
  if (typeof data === 'object') return Object.keys(data).length >= minLength;
  return data !== null && data !== undefined && data !== '';
};

const hasSystemHealthData = (data) => {
  return data && (
    data.monitoringReport ||
    data.serverUptime ||
    data.responseTime ||
    (data.activeUsers != null && data.activeUsers > 0) ||
    data.cpuUsage
  );
};

// Parse percentage string (e.g. "95.0%" or 95) to number
const parsePercent = (v) => {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const m = String(v).match(/^([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
};

// Parse ms value from number or string like "20ms"
const parseMs = (v) => {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const m = String(v).match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
};

// Parse process uptime "0m", "5h 20m" to approximate minutes
const processUptimeMinutes = (formatted) => {
  if (!formatted) return null;
  const s = String(formatted).toLowerCase();
  const hMatch = s.match(/(\d+)\s*h/);
  const mMatch = s.match(/(\d+)\s*m/);
  const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
  const mins = mMatch ? parseInt(mMatch[1], 10) : 0;
  return hours * 60 + mins;
};

// Alert levels: 'ok' | 'warning' | 'critical'
const getSystemHealthAlerts = (data) => {
  const metrics = {};
  if (!data) return { overall: 'ok', metrics };

  const serverUptimePct = parsePercent(data.serverUptime);
  if (serverUptimePct != null) {
    if (serverUptimePct < 80) metrics.serverUptime = 'critical';
    else if (serverUptimePct < 90) metrics.serverUptime = 'warning';
    else metrics.serverUptime = 'ok';
  }

  const processMins = processUptimeMinutes(data.processUptimeFormatted);
  if (processMins != null) {
    if (processMins === 0) metrics.processUptime = 'warning'; // recent restart
    else metrics.processUptime = 'ok';
  }

  const responseMs = parseMs(data.responseTime) ?? parseMs(data.databaseResponseTime);
  if (responseMs != null) {
    if (responseMs > 2000) metrics.responseTime = 'critical';
    else if (responseMs > 500) metrics.responseTime = 'warning';
    else metrics.responseTime = 'ok';
  }

  const errorRatePct = parsePercent(data.errorRate);
  if (errorRatePct != null) {
    if (errorRatePct >= 5) metrics.errorRate = 'critical';
    else if (errorRatePct > 1) metrics.errorRate = 'warning';
    else metrics.errorRate = 'ok';
  }

  const dbStatus = data.databaseStatus ? String(data.databaseStatus).toLowerCase() : '';
  if (data.databaseStatus != null) {
    if (dbStatus !== 'healthy' && dbStatus !== 'ok') metrics.databaseStatus = dbStatus.includes('error') || dbStatus === 'down' ? 'critical' : 'warning';
    else metrics.databaseStatus = 'ok';
  }

  const memoryPct = parsePercent(data.memoryUsage);
  if (memoryPct != null) {
    if (memoryPct >= 90) metrics.memoryUsage = 'critical';
    else if (memoryPct > 80) metrics.memoryUsage = 'warning';
    else metrics.memoryUsage = 'ok';
  }

  const requestsPerMin = data.requestsPerMinute != null ? Number(data.requestsPerMinute) : null;
  if (requestsPerMin != null && data.environment === 'production' && requestsPerMin === 0) {
    metrics.requestsPerMinute = 'warning'; // prod with no traffic
  } else if (requestsPerMin != null) {
    metrics.requestsPerMinute = 'ok';
  }

  const levels = Object.values(metrics);
  let overall = 'ok';
  if (levels.some((l) => l === 'critical')) overall = 'critical';
  else if (levels.some((l) => l === 'warning')) overall = 'warning';

  return { overall, metrics };
};

const hasModelPerformanceData = (data) => {
  return data && data.models && Array.isArray(data.models) && data.models.length > 0;
};

const hasContentEngagementData = (data) => {
  return data && (
    (data.totalViews && data.totalViews > 0) ||
    (data.quizzesAnswered != null && data.quizzesAnswered > 0) ||
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

// Success Modal Component
const SuccessModal = ({ isOpen, onClose, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[600px] mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">Success</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-700 flex-1">{message}</p>
          </div>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Pipeline Selector Component
const PipelineSelector = ({ pipelines, onConfirm }) => {
  const [selectedPipeline, setSelectedPipeline] = useState('');
  const [currentDefault, setCurrentDefault] = useState('');
  const [includeLowQuality, setIncludeLowQuality] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const fetchDefault = async () => {
      try {
        const response = await topicApi.getDefaultPipeline();
        const data = response?.data || response;
        if (data?.success && data.pipeline_id) {
          setCurrentDefault(data.pipeline_id);
          setSelectedPipeline(data.pipeline_id);
          setIncludeLowQuality(data.include_low_quality === true);
        }
      } catch (err) {
        console.error('Failed to fetch default pipeline:', err);
      }
    };
    fetchDefault();
  }, []);

  const handleConfirm = async () => {
    if (!selectedPipeline) {
      setSuccessMessage('Please select a pipeline');
      setShowSuccessModal(true);
      return;
    }
    setLoading(true);
    try {
      await onConfirm(selectedPipeline, includeLowQuality);
      setCurrentDefault(selectedPipeline);
      const pipelineName = pipelines.find(p => p.pipeline_id === selectedPipeline)?.pipeline_name || selectedPipeline;
      setSuccessMessage(`Default pipeline set to: ${pipelineName}${includeLowQuality ? ' (low-quality topics included)' : ''}`);
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Failed to set default pipeline:', err);
      setSuccessMessage('Failed to set default pipeline. Please try again.');
      setShowSuccessModal(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6 min-w-0">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 min-w-0">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Select Default Pipeline for Issue Portal</h3>
            <p className="text-sm text-gray-600 break-words">
              Choose which pipeline's precomputed data should be displayed to users on the Issue Portal page.
              {currentDefault && (
                <span className="ml-0 sm:ml-2 block sm:inline text-indigo-600 font-medium break-words">
                  Current: {pipelines.find(p => p.pipeline_id === currentDefault)?.pipeline_name || currentDefault}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto xl:max-w-[60%] min-w-0">
            <select
              value={selectedPipeline}
              onChange={(e) => setSelectedPipeline(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white w-full min-w-0 xl:min-w-[360px] max-w-full"
            >
              <option value="">Select a pipeline...</option>
              {pipelines.map((pipeline) => (
                <option key={pipeline.pipeline_id} value={pipeline.pipeline_id}>
                  {pipeline.pipeline_name || pipeline.pipeline_id}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleConfirm(); }}
              disabled={!selectedPipeline || loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium w-full sm:w-auto"
            >
              {loading ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeLowQuality}
              onChange={(e) => { e.stopPropagation(); setIncludeLowQuality(e.target.checked); }}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Include low-quality topics on Issue Portal
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-6">When enabled, topics marked as low quality will be shown to users on the public Issue Portal.</p>
        </div>
      </div>
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        message={successMessage}
      />
    </>
  );
};

// ─── Issue Portal Trending Chart ───────────────────────────────────────────
const ISSUE_CATEGORY_MAP = {
  Economy: { color: '#6366f1', bg: 'bg-indigo-50', text: 'text-indigo-700' },
  Education: { color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  Healthcare: { color: '#ef4444', bg: 'bg-red-50', text: 'text-red-700' },
  Infrastructure: { color: '#f59e0b', bg: 'bg-amber-50', text: 'text-amber-700' },
  Environment: { color: '#14b8a6', bg: 'bg-teal-50', text: 'text-teal-700' },
  Security: { color: '#8b5cf6', bg: 'bg-violet-50', text: 'text-violet-700' },
  Foreign: { color: '#3b82f6', bg: 'bg-blue-50', text: 'text-blue-700' },
  Technology: { color: '#06b6d4', bg: 'bg-cyan-50', text: 'text-cyan-700' },
  Social: { color: '#ec4899', bg: 'bg-pink-50', text: 'text-pink-700' },
  Other: { color: '#64748b', bg: 'bg-slate-50', text: 'text-slate-600' },
};
const getIssueCatStyle = (cat) => ISSUE_CATEGORY_MAP[cat] || ISSUE_CATEGORY_MAP.Other;

const QUALITY_BADGE = {
  high: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'High' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Medium' },
  low: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Low' },
};

// Animated SVG lollipop chart row — bar length uses value from current sort (statements/views/mp_count/trendingScore)
const LollipopRow = ({ topic, maxVal, rank, animated, sortBy, barValue }) => {
  const pct = maxVal > 0 ? Math.max(3, (barValue / maxVal) * 100) : 3;
  const catStyle = getIssueCatStyle(topic.category);
  const qBadge = QUALITY_BADGE[topic.label_quality] || QUALITY_BADGE.medium;
  const rankGradients = [
    'from-yellow-400 to-orange-400',
    'from-slate-300 to-slate-400',
    'from-amber-600 to-amber-700',
  ];
  const rankGrad = rankGradients[rank] || 'from-slate-200 to-slate-300';
  const views = topic.views ?? 0;
  const stmts = topic.statement_count ?? 0;

  return (
    <div className="group flex items-start gap-3 py-2">
      <div className={`flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br ${rankGrad} flex items-center justify-center text-xs font-bold text-white shadow-sm mt-0.5`}>
        {rank + 1}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
          <span
            className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors leading-snug"
            title={topic.title}
          >
            {topic.title && topic.title.length > 72 ? topic.title.slice(0, 72) + '…' : (topic.title || 'Untitled')}
          </span>
        </div>

        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all ease-out"
              style={{
                width: animated ? `${pct}%` : '0%',
                transitionDuration: `${600 + rank * 80}ms`,
                background: `linear-gradient(90deg, ${catStyle.color}99, ${catStyle.color})`,
              }}
            />
          </div>
          <div className="flex-shrink-0 w-3.5 h-3.5 rounded-full border-2 border-white shadow" style={{ background: catStyle.color }} />
          <span className="text-sm font-bold text-gray-700 w-10 text-right">{barValue}</span>
          <span className="text-xs text-gray-400">
            {sortBy === 'views' ? 'views' : sortBy === 'mp_count' ? 'MPs' : sortBy === 'trending' ? 'score' : 'stmts'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {topic.category && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${catStyle.bg} ${catStyle.text}`}>
              {topic.category}
            </span>
          )}
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${qBadge.bg} ${qBadge.text}`}>
            {qBadge.label} quality
          </span>
          {views > 0 && (
            <span className="text-xs text-indigo-600 font-medium">{views} views</span>
          )}
          {topic.mp_count > 0 && (
            <span className="text-xs text-gray-400 flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {topic.mp_count} MPs
            </span>
          )}
          {topic.session_label && (
            <span className="text-xs text-gray-400">{topic.session_label}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export const IssuePortalTrendingChart = ({ topics = [], pipelineId = 'pipeline5' }) => {
  const [animated, setAnimated] = React.useState(false);
  const [sortBy, setSortBy] = React.useState('trending');
  const [displayedTopics, setDisplayedTopics] = React.useState(topics);
  const [loadingSort, setLoadingSort] = React.useState(false);

  React.useEffect(() => {
    setDisplayedTopics(topics);
  }, [topics]);

  React.useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, [displayedTopics]);

  const sortFetchedRef = React.useRef(false);
  // Refetch when user changes sort (not on initial mount — use parent's topics then)
  React.useEffect(() => {
    if (!pipelineId) return;
    if (!sortFetchedRef.current) {
      sortFetchedRef.current = true;
      return;
    }
    const apiSort = sortBy === 'statement_count' ? 'statements' : sortBy === 'mp_count' ? 'mp_count' : sortBy === 'views' ? 'views' : 'trending';
    setLoadingSort(true);
    topicApi.getTopIssues(pipelineId, 12, apiSort)
      .then((res) => {
        if (res?.data?.success && Array.isArray(res.data.topics)) setDisplayedTopics(res.data.topics);
      })
      .catch(() => {})
      .finally(() => setLoadingSort(false));
  }, [sortBy, pipelineId]);

  const sorted = displayedTopics.slice(0, 12);
  const getBarValue = (t) => {
    if (sortBy === 'views') return t.views ?? 0;
    if (sortBy === 'mp_count') return t.mp_count ?? 0;
    if (sortBy === 'trending') return t.trendingScore ?? (t.views ?? 0) + (t.statement_count ?? 0);
    return t.statement_count ?? 0;
  };
  const maxVal = sorted.length > 0 ? Math.max(...sorted.map(getBarValue), 1) : 1;
  const presentCats = [...new Set(sorted.map(t => t.category).filter(Boolean))];

  if (topics.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-red-50 rounded-lg">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Trending Issues</h3>
            <p className="text-xs text-gray-500">Most discussed Issue Portal topics (by statement count)</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-gray-200 rounded-xl">
          <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-gray-500 text-sm font-medium">No Issue Portal data yet</p>
          <p className="text-gray-400 text-xs mt-1">Run the precompute script to generate topic data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-red-50 rounded-lg">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Trending Issues</h3>
            <p className="text-xs text-gray-500">Most discussed Issue Portal topics · ranked by statement count</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setSortBy('trending')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${sortBy === 'trending' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Trending
            </button>
            <button
              onClick={() => setSortBy('views')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${sortBy === 'views' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              By Views
            </button>
            <button
              onClick={() => setSortBy('statement_count')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${sortBy === 'statement_count' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              By Statements
            </button>
            <button
              onClick={() => setSortBy('mp_count')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${sortBy === 'mp_count' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              By MPs
            </button>
          </div>
          {loadingSort && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Updating…
            </span>
          )}
        </div>
      </div>

      {presentCats.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mb-4">
          {presentCats.map(cat => {
            const s = getIssueCatStyle(cat);
            return (
              <span key={cat} className="flex items-center gap-1 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                {cat}
              </span>
            );
          })}
        </div>
      )}

      <div className="divide-y divide-gray-50">
        {sorted.map((topic, i) => (
          <LollipopRow
            key={topic._id || topic.title || i}
            topic={topic}
            maxVal={maxVal}
            rank={i}
            animated={animated}
            sortBy={sortBy}
            barValue={getBarValue(topic)}
          />
        ))}
      </div>
    </div>
  );
};
// ───────────────────────────────────────────────────────────────────────────

const AdminAnalytics = ({ refreshKey = 0 } = {}) => {
  const emptyEmbeddedUserReportsData = {
    totalUsers: 0,
    activeUsers: 0,
    userActivity: {
      bookmarks: 0,
      discussions: 0,
      learningResources: 0,
      feedback: 0,
      quizzesAnswered: 0
    },
    topUsers: [],
    recentActivity: [],
    popularContent: [],
    userStats: {
      avgSessionTime: '0m',
      avgBookmarksPerUser: 0,
      avgDiscussionsPerUser: 0,
      mostActiveDay: 'Monday'
    },
    trendingIssuePortalTopics: [],
    issuePortalPipelineId: null
  };
  const [activeSection, setActiveSection] = useState('content-engagement');
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState({
    systemHealth: {},
    modelPerformance: {
      models: [],
      summary: {},
      performanceTrends: {
        accuracy: [],
        predictions: []
      }
    },
    contentEngagement: {
      totalViews: 0,
      uniqueVisitors: 0,
      topContent: [],
      contentByCategory: {}
    },
    userBehaviour: {
      dailyActiveUsers: 0,
      weeklyActiveUsers: 0,
      monthlyActiveUsers: 0,
      usersByRegion: {}
    },
    cicdAnalytics: {
      pipelines: [],
      summary: {},
      deploymentTrends: []
    },
    continuousLearningAnalytics: {
      learningJobs: [],
      summary: {},
      performanceGains: []
    },
    cronJobAnalytics: {
      jobs: [],
      summary: {},
      alerts: []
    },
    issuePortalPrecompute: {
      pipelines: [],
      summary: {}
    },
    trendingForumTopics: [],
    trendingEduContent: [],
    trendingIssuePortalTopics: [],
    arimaForecast: null,
    arimaAllPipelines: []
  });
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [selectedModel, setSelectedModel] = useState('hansard-classifier');
  const [selectedArimaPipeline, setSelectedArimaPipeline] = useState('pipeline6');
  const [selectedDevOpsTab, setSelectedDevOpsTab] = useState('operations');
  const [exportLoading, setExportLoading] = useState(false);
  const [analyticsLoadError, setAnalyticsLoadError] = useState(null);
  const [contentEngagementLastUpdated, setContentEngagementLastUpdated] = useState(null);

  // Service Management Dashboard states
  const [dashboardStats, setDashboardStats] = useState({
    incidents: { total: 0, stateStats: [], priorityStats: [], escalatedCount: 0 },
    changes: { total: 0, stateStats: [], approvalStats: [] },
    maintenance: { total: 0, statusCounts: {} }
  });
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [printPanel, setPrintPanel] = useState({ open: false, section: '', timeRange: 'month' });
  const [selectedRange, setSelectedRange] = useState('30d');
  const [embeddedUserReportsRange, setEmbeddedUserReportsRange] = useState('7days');
  const [embeddedUserReportsAutoRefresh, setEmbeddedUserReportsAutoRefresh] = useState(false);
  const [embeddedUserReportsLoading, setEmbeddedUserReportsLoading] = useState(true);
  const [embeddedUserReports, setEmbeddedUserReports] = useState({
    userReportsData: emptyEmbeddedUserReportsData,
    feedbackStats: null,
    surveySummary: null,
    latestSurveySnapshot: null
  });

  // Local state for Most Viewed Edu Content tabs / pagination
  const [eduViewsTab, setEduViewsTab] = useState('content'); // 'content' | 'category'
  const [eduViewsPage, setEduViewsPage] = useState(1);

  // Fetch Service Management Dashboard stats (real API: /admin/technical-support/.../stats)
  const fetchDashboardStats = async (range = selectedRange) => {
    try {
      setDashboardLoading(true);
      const [incidentRes, changeRes, maintenanceRes] = await Promise.all([
        adminApi.getIncidentStats(range),
        adminApi.getChangeRequestStats(range),
        adminApi.getMaintenanceTaskStats(range)
      ]);
      const inc = incidentRes?.data ?? {};
      const chg = changeRes?.data ?? {};
      const mnt = maintenanceRes?.data ?? {};
      setDashboardStats({
        incidents: {
          total: inc.totalIncidents ?? 0,
          stateStats: inc.stateStats ?? [],
          priorityStats: inc.priorityStats ?? [],
          escalatedCount: inc.escalatedCount ?? 0
        },
        changes: {
          total: chg.totalChangeRequests ?? 0,
          stateStats: chg.stateStats ?? [],
          approvalStats: chg.approvalStats ?? []
        },
        maintenance: {
          total: mnt.totalMaintenanceTasks ?? 0,
          statusCounts: mnt.statusCounts ?? {}
        }
      });
    } catch (error) {
      setDashboardStats({
        incidents: { total: 0, stateStats: [], priorityStats: [], escalatedCount: 0 },
        changes: { total: 0, stateStats: [], approvalStats: [] },
        maintenance: { total: 0, statusCounts: {} }
      });
    } finally {
      setDashboardLoading(false);
    }
  };

  const fetchEmbeddedUserReportsData = async (timeRange = embeddedUserReportsRange, { setLoadingState = true } = {}) => {
    if (setLoadingState) setEmbeddedUserReportsLoading(true);

    try {
      const [userReportsResult, feedbackStatsResult, surveySummaryResult] = await Promise.allSettled([
        adminApi.getUserReportsData(timeRange),
        adminApi.getFeedbackStats(timeRange),
        adminApi.getSurveyReportSummary(timeRange)
      ]);

      const userReportsData =
        userReportsResult.status === 'fulfilled'
          ? userReportsResult.value?.data || emptyEmbeddedUserReportsData
          : emptyEmbeddedUserReportsData;

      const feedbackStats =
        feedbackStatsResult.status === 'fulfilled'
          ? feedbackStatsResult.value?.data || null
          : null;

      const surveySummary =
        surveySummaryResult.status === 'fulfilled'
          ? surveySummaryResult.value?.data || null
          : null;

      let latestSurveySnapshot = null;
      const latestSnapshotSurveyId = surveySummary?.latestSnapshotSurveyId;
      if (latestSnapshotSurveyId) {
        try {
          const snapshotResponse = await adminApi.getSurveyStats(latestSnapshotSurveyId, timeRange);
          latestSurveySnapshot = {
            surveyId: latestSnapshotSurveyId,
            title: surveySummary?.latestSnapshotSurveyTitle || snapshotResponse.data?.title || '',
            ...snapshotResponse.data
          };
        } catch (snapshotError) {
          console.error('[AdminAnalytics] Failed to fetch latest survey snapshot:', snapshotError);
        }
      }

      setEmbeddedUserReports({
        userReportsData,
        feedbackStats,
        surveySummary,
        latestSurveySnapshot
      });
    } catch (error) {
      console.error('[AdminAnalytics] Error fetching embedded user reports data:', error);
      setEmbeddedUserReports({
        userReportsData: emptyEmbeddedUserReportsData,
        feedbackStats: null,
        surveySummary: null,
        latestSurveySnapshot: null
      });
    } finally {
      if (setLoadingState) setEmbeddedUserReportsLoading(false);
    }
  };

  useEffect(() => {
    if (!embeddedUserReportsAutoRefresh) return undefined;

    const interval = setInterval(() => {
      fetchEmbeddedUserReportsData(embeddedUserReportsRange);
    }, 30000);

    return () => clearInterval(interval);
  }, [embeddedUserReportsAutoRefresh, embeddedUserReportsRange]);

  // Re-fetch when range changes
  useEffect(() => {
    fetchAnalyticsData(selectedRange);
    if (activeSection === 'service-management') fetchDashboardStats(selectedRange);
  }, [selectedRange]);

  // Re-fetch when content is created/updated/deleted from the content management tab
  useEffect(() => {
    if (refreshKey > 0) {
      fetchAnalyticsData(selectedRange);
      fetchEmbeddedUserReportsData(embeddedUserReportsRange);
    }
  }, [refreshKey]);

  // Fetch dashboard stats when service-management section is active
  useEffect(() => {
    if (activeSection === 'service-management') {
      fetchDashboardStats(selectedRange);
    }
  }, [activeSection]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return undefined;

    const interval = setInterval(() => {
      fetchAnalyticsData();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, selectedRange, embeddedUserReportsRange]);

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  const fetchAnalyticsData = async (range = selectedRange) => {
    try {
      setLoading(true);
      setAnalyticsLoadError(null);
      setEmbeddedUserReportsLoading(true);
      const embeddedUserReportsPromise = fetchEmbeddedUserReportsData(embeddedUserReportsRange, { setLoadingState: false });

      // Fetch comprehensive analytics data from API
      const response = await adminApi.getComprehensiveAnalytics(range);

      const apiData = response.data;
      const ce = apiData.contentEngagement;
      const ub = apiData.userBehaviour;
      console.log('Fetched analytics data (Content & Users):', {
        hasContentEngagement: !!ce,
        totalViews: ce?.totalViews,
        uniqueVisitors: ce?.uniqueVisitors,
        bounceRate: ce?.bounceRate,
        hasUserBehaviour: !!ub,
        dailyActiveUsers: ub?.dailyActiveUsers,
        weeklyActiveUsers: ub?.weeklyActiveUsers,
        monthlyActiveUsers: ub?.monthlyActiveUsers,
        lastUpdated: ce?.lastUpdated || ub?.lastUpdated
      });
      if (ce?.lastUpdated) setContentEngagementLastUpdated(ce.lastUpdated);
      if (ub?.lastUpdated && !ce?.lastUpdated) setContentEngagementLastUpdated(ub.lastUpdated);
      
      // Fetch Issue Portal top issues (trending)
      let trendingIssuePortalTopics = [];
      try {
        // Determine default pipeline from precompute data or fall back to pipeline5
        const defaultPipeline = apiData?.issuePortalPrecompute?.pipelines?.[0]?.pipeline_id || 'pipeline5';
        const topIssuesResponse = await topicApi.getTopIssues(defaultPipeline, 12);
        const topIssuesData = topIssuesResponse?.data;
        if (topIssuesData?.success && Array.isArray(topIssuesData.topics)) {
          trendingIssuePortalTopics = topIssuesData.topics;
        }
      } catch (err) {
        console.warn('[AdminAnalytics] Failed to fetch top issues:', err.message);
      }

      // Fetch Issue Portal precompute report
      let issuePortalData = { pipelines: [], summary: {} };
      try {
        const precomputeResponse = await topicApi.getPrecomputeReport();
        console.log('[AdminAnalytics] Precompute report raw response:', precomputeResponse);
        
        // adminApiInstance returns { data: { success, report } }
        // Check both possible response structures
        let responseData = null;
        if (precomputeResponse?.data) {
          // Axios response structure
          responseData = precomputeResponse.data;
        } else if (precomputeResponse?.success !== undefined) {
          // Direct response object
          responseData = precomputeResponse;
        }
        
        console.log('[AdminAnalytics] Precompute report parsed data:', responseData);
        
        if (responseData?.success && responseData.report) {
          issuePortalData = responseData.report;
          console.log('[AdminAnalytics] Issue Portal data loaded successfully:', {
            pipelines: issuePortalData.pipelines?.length || 0,
            summary: issuePortalData.summary,
            firstPipeline: issuePortalData.pipelines?.[0]
          });
        } else {
          console.warn('[AdminAnalytics] Precompute report response format unexpected:', {
            hasSuccess: !!responseData?.success,
            hasReport: !!responseData?.report,
            responseData: responseData
          });
        }
      } catch (err) {
        console.error('[AdminAnalytics] Failed to fetch Issue Portal precompute report:', err);
        console.error('[AdminAnalytics] Error details:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
          url: err.config?.url,
          stack: err.stack
        });
      }
      
      // Fetch ARIMA forecast results (single pipeline for the ARIMA tab)
      let arimaForecast = analyticsData.arimaForecast;
      let arimaAllPipelines = analyticsData.arimaAllPipelines;
      try {
        const [arimaAllRes, arimaP5Res] = await Promise.allSettled([
          adminApi.getArimaForecast('all', 10),
          adminApi.getArimaForecast('pipeline5', 10),
        ]);
        if (arimaAllRes.status === 'fulfilled' && arimaAllRes.value?.data?.allPipelines) {
          arimaAllPipelines = arimaAllRes.value.data.allPipelines;
        }
        if (arimaP5Res.status === 'fulfilled' && arimaP5Res.value?.data) {
          arimaForecast = arimaP5Res.value.data;
        }
      } catch (err) {
        console.warn('[AdminAnalytics] ARIMA forecast not available:', err.message);
      }

      const mergedData = {
        ...analyticsData,
        systemHealth: apiData.systemHealth || {},
        modelPerformance: apiData.modelPerformance || analyticsData.modelPerformance,
        contentEngagement: apiData.contentEngagement != null ? apiData.contentEngagement : analyticsData.contentEngagement,
        userBehaviour: apiData.userBehaviour != null ? apiData.userBehaviour : analyticsData.userBehaviour,
        cicdAnalytics: apiData.cicdAnalytics || analyticsData.cicdAnalytics,
        continuousLearningAnalytics: apiData.continuousLearningAnalytics || analyticsData.continuousLearningAnalytics,
        cronJobAnalytics: apiData.cronJobAnalytics || analyticsData.cronJobAnalytics,
        issuePortalPrecompute: issuePortalData,
        trendingForumTopics: Array.isArray(apiData.trendingForumTopics) ? apiData.trendingForumTopics : analyticsData.trendingForumTopics,
        trendingEduContent: Array.isArray(apiData.trendingEduContent) ? apiData.trendingEduContent : analyticsData.trendingEduContent,
        trendingIssuePortalTopics: trendingIssuePortalTopics.length > 0 ? trendingIssuePortalTopics : analyticsData.trendingIssuePortalTopics,
        arimaForecast,
        arimaAllPipelines
      };

      await embeddedUserReportsPromise;
      setEmbeddedUserReportsLoading(false);
      setAnalyticsData(mergedData);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      console.error('Error details:', error.response?.data || error.message);
      setAnalyticsLoadError(error.response?.data?.message || error.message || 'Failed to load analytics');
      setEmbeddedUserReportsLoading(false);
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
      
      // Refresh analytics data to show the new DevOps data
      await fetchAnalyticsData();
      
      // Show success message (you could add a toast notification here)
      alert('Sample DevOps data created successfully! Check the DevOps tab.');
    } catch (error) {
      alert('Failed to create DevOps data.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (reportType) => {
    setSelectedMetric(reportType);
  };

  const reports = [
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
        { label: 'Bounce Rate', value: analyticsData.contentEngagement?.bounceRate || 'N/A', status: 'good' },
        { label: 'Quizzes Answered', value: (analyticsData.contentEngagement?.quizzesAnswered ?? 0).toLocaleString(), status: 'good' }
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
    },
    {
      id: 'arima-forecast',
      title: 'Trend Forecast (ARIMA)',
      description: 'Parliamentary topic activity trends and session-level forecasts via ARIMA time series',
      icon: (
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      ),
      color: 'violet',
      metrics: [
        {
          label: 'Topics Forecast',
          value: analyticsData.arimaForecast?.status === 'ok'
            ? (analyticsData.arimaForecast?.n_topics_forecasted || 0).toString()
            : 'N/A',
          status: analyticsData.arimaForecast?.status === 'ok' ? 'excellent' : 'warning'
        },
        {
          label: 'Eras Analysed',
          value: analyticsData.arimaForecast?.n_eras?.toString() || 'N/A',
          status: 'good'
        },
        {
          label: 'Forecast Horizon',
          value: analyticsData.arimaForecast?.forecast_steps
            ? `${analyticsData.arimaForecast.forecast_steps} sessions`
            : 'N/A',
          status: 'good'
        },
        {
          label: 'Status',
          value: analyticsData.arimaForecast?.status === 'ok'
            ? 'Ready'
            : analyticsData.arimaForecast?.status === 'not_computed'
            ? 'Not run'
            : 'Pending',
          status: analyticsData.arimaForecast?.status === 'ok' ? 'excellent' : 'warning'
        }
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
      },
      violet: {
        bg: 'from-violet-50 to-violet-100',
        border: 'border-violet-200',
        icon: 'bg-violet-500',
        text: 'text-violet-700'
      }
    };
    return colorMap[color] || colorMap.green;
  };

  if (loading || !analyticsData.modelPerformance || !analyticsData.cicdAnalytics) {
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

  // ─── Print Utilities ────────────────────────────────────────────────────────
  const PRINT_RANGES = [
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' },
    { value: 'all', label: 'All Time' },
  ];

  const generatePrintHTML = (section, timeRange) => {
    const now = new Date();
    const rangeLabel = PRINT_RANGES.find(r => r.value === timeRange)?.label || timeRange;
    const fileDate = now.toISOString().split('T')[0];
    const ad = analyticsData;
    const ds = dashboardStats;
    const eur = embeddedUserReports || {};

    const css = `body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:20px;padding-bottom:84px}
h1{font-size:16px;margin:0 0 2px}h2{font-size:13px;margin:16px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px}
table{width:100%;border-collapse:collapse;margin-bottom:12px}
th{background:#f0f0f0;text-align:left;padding:5px 8px;border:1px solid #ccc;font-size:11px}
td{padding:4px 8px;border:1px solid #ddd;font-size:11px;vertical-align:top}
.header{background:#1a7a4a;color:#fff;padding:10px 14px;margin-bottom:16px;border-radius:4px}
.header h1{color:#fff;font-size:15px}.meta{font-size:10px;color:#fff;opacity:.85}
.print-actions{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid #d1d5db;padding:12px 20px;display:flex;justify-content:flex-end;gap:10px}
.print-btn{border:none;border-radius:8px;padding:10px 16px;font-size:12px;font-weight:600;cursor:pointer}
.print-btn-primary{background:#16a34a;color:#fff}
.print-btn-secondary{background:#f3f4f6;color:#4b5563}
@media print {.no-print{display:none!important}}
@media print{body{margin:0}}`;

    const escapeHtml = (value) => String(value ?? '—')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const row = (cells) => `<tr>${cells.map((c, i) => `<td${i === 0 ? ' style="font-weight:600"' : ''}>${escapeHtml(c)}</td>`).join('')}</tr>`;
    const hrow = (cells) => `<tr>${cells.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`;
    const prettyLabel = (key) => String(key || '')
      .replace(/_/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (m) => m.toUpperCase());
    const isPrimitive = (value) => value == null || ['string', 'number', 'boolean'].includes(typeof value);
    const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

    const formatValue = (key, value, formatter) => {
      if (typeof formatter === 'function') return formatter(value);
      if (value == null || value === '') return '—';
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      if (typeof value === 'number') {
        if (/accuracy/i.test(key) && value <= 1) return `${(value * 100).toFixed(1)}%`;
        if (/(rate|pct|percentage)$/i.test(key)) return `${value.toFixed(1)}%`;
        return Number.isInteger(value)
          ? value.toLocaleString()
          : value.toLocaleString(undefined, { maximumFractionDigits: 4 });
      }
      return String(value);
    };

    const renderTable = (title, headers, rows) => (
      rows.length
        ? `<h2>${escapeHtml(title)}</h2><table>${hrow(headers)}${rows.map((cells) => row(cells)).join('')}</table>`
        : ''
    );

    const renderKeyValueTable = (title, source, { preferredKeys = [], labelMap = {}, formatters = {}, skipKeys = [] } = {}) => {
      if (!source || typeof source !== 'object') return '';
      const seen = new Set([...preferredKeys, ...skipKeys]);
      const preferredRows = preferredKeys
        .filter((key) => Object.prototype.hasOwnProperty.call(source, key) && isPrimitive(source[key]))
        .map((key) => [labelMap[key] || prettyLabel(key), formatValue(key, source[key], formatters[key])]);
      const extraRows = Object.keys(source)
        .filter((key) => !seen.has(key) && isPrimitive(source[key]))
        .map((key) => [labelMap[key] || prettyLabel(key), formatValue(key, source[key], formatters[key])]);
      return renderTable(title, ['Metric', 'Value'], [...preferredRows, ...extraRows]);
    };

    const renderObjectTable = (title, items, { preferredKeys = [], labelMap = {}, formatters = {}, skipKeys = [] } = {}) => {
      if (!Array.isArray(items) || items.length === 0) return '';
      const columnsSet = new Set();
      items.forEach((item) => {
        Object.entries(item || {}).forEach(([key, value]) => {
          if (!skipKeys.includes(key) && isPrimitive(value)) {
            columnsSet.add(key);
          }
        });
      });
      const remaining = [...columnsSet].filter((key) => !preferredKeys.includes(key));
      const columns = [...preferredKeys.filter((key) => columnsSet.has(key)), ...remaining];
      if (columns.length === 0) return '';
      const rows = items.map((item) =>
        columns.map((key) => formatValue(key, item?.[key], formatters[key]))
      );
      return renderTable(title, columns.map((key) => labelMap[key] || prettyLabel(key)), rows);
    };

    const renderReportSummary = (title, reportId) => {
      const report = reports.find((item) => item.id === reportId);
      if (!report?.metrics?.length) return '';
      return renderTable(
        title,
        ['Metric', 'Value'],
        report.metrics.map((metric) => [metric.label, metric.value])
      );
    };

    const formatMonthYear = (value) => {
      if (!value) return '—';
      const date = new Date(value);
      return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const getMetricValue = (source, candidates = []) => {
      for (const key of candidates) {
        const value = source?.[key];
        if (value !== undefined && value !== null) return value;
      }
      return null;
    };

    const buildModelMetricRows = (models, metricType) => (models || []).map((model) => {
      const realMetrics = model?.realMetrics || {};
      const metricSets = {
        train: {
          npmi: ['train_npmi', 'train_coherence_npmi'],
          cv: ['train_cv', 'train_coherence_cv'],
          topicDiversity: ['train_topic_diversity'],
          silhouette: ['train_silhouette', 'train_silhouette_score'],
          clusters: ['n_clusters']
        },
        test: {
          npmi: ['npmi', 'coherence_npmi'],
          cv: ['cv', 'coherence_cv'],
          topicDiversity: ['topic_diversity'],
          silhouette: ['silhouette', 'silhouette_score'],
          clusters: ['n_clusters']
        },
        inference: {
          npmi: ['inference_npmi', 'inference_coherence_npmi'],
          cv: ['inference_cv', 'inference_coherence_cv'],
          topicDiversity: ['inference_topic_diversity'],
          silhouette: ['inference_silhouette', 'inference_silhouette_score'],
          clusters: ['inference_n_clusters', 'n_clusters']
        }
      };
      const config = metricSets[metricType];
      return {
        pipeline: firstDefined(model?.name, model?.modelName, model?.id, 'Unnamed'),
        npmi: getMetricValue(realMetrics, config.npmi),
        cv: getMetricValue(realMetrics, config.cv),
        topicDiversity: getMetricValue(realMetrics, config.topicDiversity),
        silhouette: getMetricValue(realMetrics, config.silhouette),
        clusters: getMetricValue(realMetrics, config.clusters)
      };
    });

    let body = '';

    if (section === 'content-engagement') {
      const ub = ad.userBehaviour || {};
      const ce = ad.contentEngagement || {};
      const userReportsData = eur.userReportsData || {};
      const feedbackStats = eur.feedbackStats || {};
      const surveySummary = eur.surveySummary || {};
      const latestSurveySnapshot = eur.latestSurveySnapshot || {};
      const totalFeedback = feedbackStats?.totalFeedback ?? 0;
      const feedbackCategoryCounts = Object.fromEntries(
        (feedbackStats?.categoryStats || []).map((item) => [item._id, item.count])
      );
      body += renderReportSummary('Content Engagement Summary', 'content-engagement');
      body += renderReportSummary('User Behaviour Summary', 'user-behaviour');
      body += renderObjectTable('Top Content', ce.topContent || [], {
        preferredKeys: ['title', 'views', 'engagement', 'category', 'type'],
        labelMap: { title: 'Title', views: 'Views', engagement: 'Engagement', category: 'Category', type: 'Type' }
      });
      body += renderObjectTable('Most Viewed Edu Content', ce.topEduContentByViews || [], {
        preferredKeys: ['title', 'views', 'category', 'type'],
        labelMap: { title: 'Title', views: 'Views', category: 'Category', type: 'Type' }
      });
      body += renderObjectTable(
        'Users by Region',
        Object.entries(ub.usersByRegion || {}).map(([region, users]) => ({ region, users })),
        {
          preferredKeys: ['region', 'users'],
          labelMap: { region: 'Region', users: 'Users' }
        }
      );
      body += renderObjectTable(
        'Users by State',
        Object.entries(ub.usersByState || {}).map(([state, users]) => ({ state, users })),
        {
          preferredKeys: ['state', 'users'],
          labelMap: { state: 'State', users: 'Users' }
        }
      );
      body += renderObjectTable(
        'Users by Constituency',
        Object.entries(ub.usersByConstituency || {}).map(([constituency, users]) => ({ constituency, users })),
        {
          preferredKeys: ['constituency', 'users'],
          labelMap: { constituency: 'Constituency', users: 'Users' }
        }
      );
      body += renderKeyValueTable('User Journey Summary', ce.userJourneys || {}, {
        preferredKeys: ['totalJourneys', 'averageJourneyLength', 'averageActionsPerSession'],
        labelMap: {
          totalJourneys: 'Total User Journeys',
          averageJourneyLength: 'Avg Journey Length',
          averageActionsPerSession: 'Actions Per Session'
        },
        skipKeys: ['topUserJourneys']
      });
      body += renderObjectTable(
        'Top User Journeys',
        (ce.userJourneys?.topUserJourneys || []).slice(0, 8).map((journey, index) => ({
          rank: index + 1,
          journeyLength: journey?.journeyLength ?? 0,
          avgActionsPerSession: journey?.avgActionsPerSession ?? 0,
          sessionCount: journey?.sessionCount ?? 0
        })),
        {
          preferredKeys: ['rank', 'journeyLength', 'avgActionsPerSession', 'sessionCount'],
          labelMap: {
            rank: '#',
            journeyLength: 'Total Actions',
            avgActionsPerSession: 'Actions / Session',
            sessionCount: 'Sessions'
          }
        }
      );
      body += renderKeyValueTable('User Reports Summary', userReportsData?.userActivity || {}, {
        preferredKeys: ['bookmarks', 'discussions', 'learningResources', 'quizzesAnswered', 'feedback'],
        labelMap: {
          bookmarks: 'Total User Bookmarks',
          discussions: 'Active Discussions',
          learningResources: 'Learning Resources',
          quizzesAnswered: 'Quizzes Answered',
          feedback: 'User Feedback'
        }
      });
      body += renderKeyValueTable('Feedback Summary', feedbackStats, {
        preferredKeys: ['totalFeedback', 'openFeedback', 'responseCoveragePct', 'oldestOpenAgeDays', 'pendingFeedback', 'inProgressFeedback', 'resolvedFeedback'],
        labelMap: {
          totalFeedback: 'Total Feedback',
          openFeedback: 'Open Feedback',
          responseCoveragePct: 'Response Coverage',
          oldestOpenAgeDays: 'Oldest Open Age (Days)',
          pendingFeedback: 'Pending',
          inProgressFeedback: 'In Progress',
          resolvedFeedback: 'Resolved'
        },
        skipKeys: ['categoryStats', 'priorityStats', 'oldestOpenItem', 'range', 'archivedFeedback', 'respondedFeedback', 'unrespondedFeedback']
      });
      body += renderObjectTable(
        'Feedback Categories',
        ['Bug', 'Feature Request', 'General', 'Complaint', 'Suggestion', 'Other'].map((category) => ({
          category,
          count: feedbackCategoryCounts[category] || 0,
          share: totalFeedback > 0 ? `${(((feedbackCategoryCounts[category] || 0) / totalFeedback) * 100).toFixed(1)}%` : '0.0%'
        })),
        {
          preferredKeys: ['category', 'count', 'share'],
          labelMap: {
            category: 'Category',
            count: 'Count',
            share: 'Share'
          }
        }
      );
      body += renderKeyValueTable('Survey Summary', {
        ...(surveySummary || {}),
        latestSnapshotResponses: latestSurveySnapshot?.totalResponses ?? 0
      }, {
        preferredKeys: ['totalSurveys', 'activeSurveys', 'totalResponses', 'surveysWithResponses', 'latestSnapshotResponses'],
        labelMap: {
          totalSurveys: 'Total Surveys',
          activeSurveys: 'Active Surveys',
          totalResponses: 'Total Responses',
          surveysWithResponses: 'Surveys With Responses',
          latestSnapshotResponses: 'Latest Snapshot Responses'
        },
        skipKeys: ['topSurveys', 'latestSnapshotSurveyId', 'latestSnapshotSurveyTitle', 'range']
      });
      body += renderObjectTable('Top Surveys by Responses', (surveySummary?.topSurveys || []).slice(0, 5).map((survey) => ({
        survey: survey?.title || 'Untitled',
        responses: survey?.responseCount ?? 0,
        questions: survey?.questionsCount ?? 0
      })), {
        preferredKeys: ['survey', 'responses', 'questions'],
        labelMap: { survey: 'Survey', responses: 'Responses', questions: 'Questions' }
      });
    }

    if (section === 'model-performance') {
      const mp = ad.modelPerformance || {};
      const precompute = ad.issuePortalPrecompute || {};
      const arima = ad.arimaForecast || {};
      const arimaAll = Array.isArray(ad.arimaAllPipelines) ? ad.arimaAllPipelines : [];
      body += renderReportSummary('Model Performance Summary', 'model-performance');
      body += renderObjectTable('Models Overview', mp.models || [], {
        preferredKeys: ['name', 'modelName', 'status', 'totalPredictions', 'averageInferenceTime'],
        labelMap: {
          name: 'Model',
          modelName: 'Model',
          status: 'Status',
          totalPredictions: 'Predictions',
          averageInferenceTime: 'Avg Inference Time'
        },
        formatters: {
          averageInferenceTime: (value) => value == null ? '—' : `${value} ms`
        },
        skipKeys: ['accuracy', 'precision', 'recall', 'f1Score', 'fileSize', 'file_size']
      });
      body += renderObjectTable('Train Set Metrics', buildModelMetricRows(mp.models || [], 'train'), {
        preferredKeys: ['pipeline', 'npmi', 'cv', 'topicDiversity', 'silhouette', 'clusters'],
        labelMap: {
          pipeline: 'Pipeline',
          npmi: 'NPMI',
          cv: 'CV',
          topicDiversity: 'Topic Diversity',
          silhouette: 'Silhouette',
          clusters: 'Clusters'
        }
      });
      body += renderObjectTable('Test Set Metrics', buildModelMetricRows(mp.models || [], 'test'), {
        preferredKeys: ['pipeline', 'npmi', 'cv', 'topicDiversity', 'silhouette', 'clusters'],
        labelMap: {
          pipeline: 'Pipeline',
          npmi: 'NPMI',
          cv: 'CV',
          topicDiversity: 'Topic Diversity',
          silhouette: 'Silhouette',
          clusters: 'Clusters'
        }
      });
      body += renderObjectTable('Inference Set Metrics', buildModelMetricRows(mp.models || [], 'inference'), {
        preferredKeys: ['pipeline', 'npmi', 'cv', 'topicDiversity', 'silhouette', 'clusters'],
        labelMap: {
          pipeline: 'Pipeline',
          npmi: 'NPMI',
          cv: 'CV',
          topicDiversity: 'Topic Diversity',
          silhouette: 'Silhouette',
          clusters: 'Clusters'
        }
      });
      body += renderKeyValueTable('Issue Portal Precompute Summary', precompute.summary || {}, {
        preferredKeys: ['total_pipelines', 'total_issues', 'total_turns', 'pipelines_with_data'],
        labelMap: {
          total_pipelines: 'Total Pipelines',
          total_issues: 'Total Issues',
          total_turns: 'Total Statements',
          pipelines_with_data: 'Pipelines with Data'
        }
      });
      body += renderObjectTable(
        'Issue Portal Pipelines',
        (precompute.pipelines || []).map((pipeline) => ({
          pipeline: pipeline?.pipeline_name || pipeline?.pipeline_id,
          issues: pipeline?.issue_count ?? 0,
          avgTurns: pipeline?.avg_turns ?? 0,
          totalTurns: pipeline?.total_turns ?? 0,
          avgMPs: pipeline?.avg_mp_count ?? 0,
          dateRange: pipeline?.date_range?.earliest && pipeline?.date_range?.latest
            ? `${formatMonthYear(pipeline.date_range.earliest)} to ${formatMonthYear(pipeline.date_range.latest)}`
            : '—',
          lastComputed: formatMonthYear(pipeline?.last_computed || pipeline?.computed_at)
        })),
        {
          preferredKeys: ['pipeline', 'issues', 'avgTurns', 'totalTurns', 'avgMPs', 'dateRange', 'lastComputed'],
          labelMap: {
            pipeline: 'Pipeline',
            issues: 'Issues',
            avgTurns: 'Avg Turns',
            totalTurns: 'Total Turns',
            avgMPs: 'Avg MPs',
            dateRange: 'Date Range',
            lastComputed: 'Last Computed'
          }
        }
      );
      body += renderObjectTable(
        'Issue Portal Quality Breakdown',
        (precompute.pipelines || []).map((pipeline) => {
          const high = pipeline?.quality_distribution?.find((q) => q.quality === 'high')?.count || 0;
          const medium = pipeline?.quality_distribution?.find((q) => q.quality === 'medium')?.count || 0;
          const low = pipeline?.quality_distribution?.find((q) => q.quality === 'low')?.count || 0;
          return {
            pipeline: pipeline?.pipeline_name || pipeline?.pipeline_id,
            high,
            medium,
            low
          };
        }),
        {
          preferredKeys: ['pipeline', 'high', 'medium', 'low'],
          labelMap: { pipeline: 'Pipeline', high: 'High', medium: 'Medium', low: 'Low' }
        }
      );
      body += renderKeyValueTable('ARIMA Forecast Summary', arima, {
        preferredKeys: ['status', 'pipeline_id', 'n_topics_forecasted', 'n_eras', 'forecast_steps', 'generated_at'],
        labelMap: {
          status: 'Status',
          pipeline_id: 'Pipeline',
          n_topics_forecasted: 'Topics Forecast',
          n_eras: 'Sessions Analysed',
          forecast_steps: 'Forecast Horizon',
          generated_at: 'Generated At'
        },
        formatters: {
          generated_at: formatMonthYear
        },
        skipKeys: ['series', 'forecasts', 'trends', 'top_topics', 'time_points', 'time_labels', 'topic_totals', 'arima_order', 'message']
      });
      if (arimaAll.length > 0) {
        body += renderObjectTable(
          'ARIMA Pipelines Overview',
          arimaAll,
          {
            preferredKeys: ['pipeline_id', 'status', 'n_topics_forecasted', 'n_eras', 'forecast_steps', 'generated_at'],
            labelMap: {
              pipeline_id: 'Pipeline',
              status: 'Status',
              n_topics_forecasted: 'Topics Forecast',
              n_eras: 'Sessions Analysed',
              forecast_steps: 'Forecast Horizon',
              generated_at: 'Generated At'
            },
            formatters: {
              generated_at: formatMonthYear
            },
            skipKeys: ['series', 'forecasts', 'trends', 'top_topics', 'time_points', 'time_labels', 'topic_totals', 'arima_order', 'message']
          }
        );
      }
      body += renderObjectTable(
        'ARIMA Topic Trend Summary',
        (arima.top_topics || []).map((topic) => ({
          topic,
          trend: arima?.trends?.[topic] || 'unknown',
          total: arima?.topic_totals?.[topic] || 0
        })),
        {
          preferredKeys: ['topic', 'trend', 'total'],
          labelMap: { topic: 'Topic', trend: 'Trend', total: 'Total' }
        }
      );
    }

    if (section === 'devops') {
      const sh = ad.systemHealth || {};
      const mr = sh.monitoringReport || {};
      const cicd = ad.cicdAnalytics || {};
      const learning = ad.continuousLearningAnalytics || {};
      const cron = ad.cronJobAnalytics || {};

      body += renderKeyValueTable('System Health', sh, {
        preferredKeys: [
          'networkStatus',
          'serverUptime',
          'processUptimeFormatted',
          'databaseResponseTime',
          'databaseStatus',
          'memoryUsage',
          'requestsPerMinute',
          'errorRate',
          'activeUsers',
          'hostname',
          'environment',
          'nodeVersion'
        ],
        labelMap: {
          networkStatus: 'Overall Status',
          processUptimeFormatted: 'Process Uptime',
          requestsPerMinute: 'Requests / Min',
          activeUsers: 'Active Users (24h)',
          nodeVersion: 'Node Version'
        },
        skipKeys: ['monitoringReport', 'databaseStorage']
      });
      body += renderObjectTable(
        `Monitoring Metrics (${rangeLabel})`,
        Object.entries(mr.metrics || {}).map(([metric, values]) => ({
          metric: prettyLabel(metric),
          current: values?.current != null ? `${values.current}${values.unit || ''}` : '—',
          average: values?.average != null ? `${values.average}${values.unit || ''}` : '—',
          peak: values?.peak != null ? `${values.peak}${values.unit || ''}` : '—',
          threshold: values?.threshold != null ? `${values.threshold}${values.unit || ''}` : '—',
          status: values?.status || '—'
        })),
        {
          preferredKeys: ['metric', 'current', 'average', 'peak', 'threshold', 'status'],
          labelMap: { metric: 'Metric', current: 'Current', average: 'Average', peak: 'Peak', threshold: 'Threshold', status: 'Status' }
        }
      );
      body += renderKeyValueTable('Database Storage', sh.databaseStorage || {}, {
        preferredKeys: ['dataSizeMB', 'storageSizeMB', 'indexSizeMB', 'collections', 'objects'],
        labelMap: {
          dataSizeMB: 'Data Size (MB)',
          storageSizeMB: 'Storage Size (MB)',
          indexSizeMB: 'Index Size (MB)',
          collections: 'Collections',
          objects: 'Documents'
        }
      });
      body += renderKeyValueTable('CI/CD Summary', cicd.summary || {}, {
        preferredKeys: ['totalPipelines', 'activePipelines', 'successfulDeployments', 'failedDeployments', 'averageDeploymentTime'],
        labelMap: {
          totalPipelines: 'Total Pipelines',
          activePipelines: 'Active Pipelines',
          successfulDeployments: 'Successful Deployments',
          failedDeployments: 'Failed Deployments',
          averageDeploymentTime: 'Avg Deployment Time'
        }
      });
      body += renderObjectTable('CI/CD Pipelines', cicd.pipelines || [], {
        preferredKeys: ['name', 'pipelineName', 'status', 'successRate', 'lastDeployment', 'averageDeploymentTime'],
        labelMap: {
          name: 'Pipeline',
          pipelineName: 'Pipeline',
          successRate: 'Success Rate',
          lastDeployment: 'Last Deployment',
          averageDeploymentTime: 'Avg Deployment Time'
        }
      });
      body += renderKeyValueTable('Continuous Learning Summary', learning.summary || {}, {
        preferredKeys: ['totalRetrainingJobs', 'successfulRetraining', 'modelsImproved', 'averageImprovementRate'],
        labelMap: {
          totalRetrainingJobs: 'Retraining Jobs',
          successfulRetraining: 'Successful Retraining',
          modelsImproved: 'Models Improved',
          averageImprovementRate: 'Avg Improvement Rate'
        }
      });
      body += renderObjectTable('Learning Jobs', learning.learningJobs || [], {
        preferredKeys: ['modelName', 'jobName', 'status', 'startedAt', 'completedAt', 'improvementRate'],
        labelMap: {
          modelName: 'Model',
          jobName: 'Job',
          startedAt: 'Started At',
          completedAt: 'Completed At',
          improvementRate: 'Improvement Rate'
        }
      });
      body += renderKeyValueTable('Scheduled Jobs Summary', cron.summary || {}, {
        preferredKeys: ['totalJobs', 'activeJobs', 'successfulExecutions', 'failedExecutions', 'averageExecutionTime'],
        labelMap: {
          totalJobs: 'Total Jobs',
          activeJobs: 'Active Jobs',
          successfulExecutions: 'Successful Executions',
          failedExecutions: 'Failed Executions',
          averageExecutionTime: 'Avg Execution Time'
        }
      });
      body += renderObjectTable('Scheduled Jobs', cron.jobs || [], {
        preferredKeys: ['name', 'status', 'schedule', 'lastRun', 'nextRun', 'successRate'],
        labelMap: {
          name: 'Job',
          lastRun: 'Last Run',
          nextRun: 'Next Run',
          successRate: 'Success Rate'
        }
      });
      body += renderObjectTable('System Alerts', cron.alerts || [], {
        preferredKeys: ['level', 'title', 'message', 'time'],
        labelMap: { level: 'Level', title: 'Title', message: 'Message', time: 'Time' }
      });
      body += renderTable(
        'Top Concerns',
        ['Concern'],
        Array.isArray(mr.topConcerns) ? mr.topConcerns.map((concern) => [concern]) : []
      );
      body += renderObjectTable('Deployment Trends', cicd.deploymentTrends || [], {
        preferredKeys: ['date', 'deployments', 'successRate'],
        labelMap: { date: 'Date', deployments: 'Deployments', successRate: 'Success Rate' }
      });
      body += renderObjectTable('Learning Performance Gains', learning.performanceGains || [], {
        preferredKeys: ['modelName', 'period', 'improvementRate'],
        labelMap: { modelName: 'Model', period: 'Period', improvementRate: 'Improvement Rate' }
      });
    }

    if (section === 'service-management') {
      body += renderTable('Incidents Summary', ['Metric', 'Value'], [
        ['Total Incidents', ds.incidents.total],
        ['Escalated', ds.incidents.escalatedCount]
      ]);
      body += renderObjectTable('Incidents by State', ds.incidents.stateStats || [], {
        preferredKeys: ['_id', 'count'],
        labelMap: { _id: 'State', count: 'Count' }
      });
      body += renderObjectTable('Incidents by Priority', ds.incidents.priorityStats || [], {
        preferredKeys: ['_id', 'count'],
        labelMap: { _id: 'Priority', count: 'Count' }
      });
      body += renderTable('Change Requests Summary', ['Metric', 'Value'], [
        ['Total Change Requests', ds.changes.total]
      ]);
      body += renderObjectTable('Change Requests by State', ds.changes.stateStats || [], {
        preferredKeys: ['_id', 'count'],
        labelMap: { _id: 'State', count: 'Count' }
      });
      body += renderObjectTable('Change Requests by Approval', ds.changes.approvalStats || [], {
        preferredKeys: ['_id', 'count'],
        labelMap: { _id: 'Approval Status', count: 'Count' }
      });
      body += renderTable('Maintenance Summary', ['Metric', 'Value'], [
        ['Total Maintenance Tasks', ds.maintenance.total]
      ]);
      body += renderObjectTable(
        'Maintenance by Status',
        Object.entries(ds.maintenance.statusCounts || {}).map(([status, count]) => ({ status, count })),
        {
          preferredKeys: ['status', 'count'],
          labelMap: { status: 'Status', count: 'Count' }
        }
      );
    }

    const sectionNames = {
      'content-engagement': 'Content & User Analytics',
      'model-performance': 'ML Model Performance',
      devops: 'DevOps & Operations',
      'service-management': 'Service Management'
    };
    const sectionFileNames = {
      'content-engagement': 'content_engagement_analytics',
      'model-performance': 'model_performance_analytics',
      devops: 'devops_analytics',
      'service-management': 'service_management_analytics'
    };
    const documentTitle = `admin_${sectionFileNames[section] || 'analytics_report'}_${fileDate}`;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(documentTitle)}</title><style>${css}</style></head><body>
<div class="header">
  <h1>MY Parliament · Analytics Report</h1>
  <div class="meta">Section: ${escapeHtml(sectionNames[section] || section)} &nbsp;|&nbsp; Period: ${escapeHtml(rangeLabel)} &nbsp;|&nbsp; Generated: ${escapeHtml(now.toLocaleString())}</div>
</div>
${body}
<p style="font-size:10px;color:#666;border-top:1px solid #eee;margin-top:20px;padding-top:6px">This report was generated from the MY Parliament Admin Analytics dashboard using live dashboard data.</p>
<div class="print-actions no-print">
  <button class="print-btn print-btn-secondary" onclick="window.close()">Close</button>
  <button class="print-btn print-btn-primary" onclick="window.print()">Proceed to Print</button>
</div>
</body></html>`;
  };

  const handlePrint = (section, timeRange) => {
    const html = generatePrintHTML(section, timeRange);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', 'width=980,height=760');
    if (!win) return;
    win.focus();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  // Gray print button + inline time-range picker shown in each section header
  const PrintButton = ({ section }) => {
    const isOpen = printPanel.open && printPanel.section === section;
    return (
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setPrintPanel(p => p.open && p.section === section ? { ...p, open: false } : { open: true, section, timeRange: p.timeRange })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg transition-colors"
          title="Print report"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print
        </button>
        {isOpen && (
          <div className="absolute right-0 top-9 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-56">
            <p className="text-xs font-semibold text-gray-700 mb-2">Select period</p>
            <div className="space-y-1 mb-3">
              {PRINT_RANGES.map(r => (
                <label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer hover:text-gray-900">
                  <input
                    type="radio"
                    name={`print-range-${section}`}
                    value={r.value}
                    checked={printPanel.timeRange === r.value}
                    onChange={() => setPrintPanel(p => ({ ...p, timeRange: r.value }))}
                    className="accent-green-600"
                  />
                  {r.label}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { handlePrint(section, printPanel.timeRange); setPrintPanel(p => ({ ...p, open: false })); }}
                className="flex-1 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Print
              </button>
              <button
                onClick={() => setPrintPanel(p => ({ ...p, open: false }))}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };
  // ────────────────────────────────────────────────────────────────────────────

  const navigationItems = [
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
      id: 'model-performance',
      name: 'ML Models',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
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
    },
    {
      id: 'service-management',
      name: 'Service Management',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    }
  ];

  return (
    <div className="flex flex-col lg:flex-row min-h-screen lg:h-screen bg-gray-50">
      {/* Sidebar Navigation - horizontal scroll on small, vertical on lg */}
      <div className="w-full lg:w-64 flex-shrink-0 bg-white shadow-lg border-b lg:border-b-0 lg:border-r border-gray-200">
        <div className="p-4 lg:p-6 border-b border-gray-200">
          <h2 className="text-lg lg:text-xl font-bold text-gray-900">Analytics</h2>
          <p className="text-xs lg:text-sm text-gray-600 mt-1 hidden sm:block">System Performance Dashboard</p>
        </div>

        <nav className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible lg:mt-6 px-2 lg:px-3 py-2 lg:py-0 gap-1 lg:gap-0">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex-shrink-0 lg:w-full flex items-center justify-center lg:justify-start space-x-2 lg:space-x-3 px-3 py-2.5 lg:py-3 rounded-lg text-left transition-all duration-200 lg:mb-1 ${
                activeSection === item.id
                  ? 'bg-green-50 text-green-700 lg:border-r-2 border-green-500'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <div className={`flex-shrink-0 ${activeSection === item.id ? 'text-green-500' : 'text-gray-400'}`}>
                {item.icon}
              </div>
              <span className="font-medium text-sm whitespace-nowrap">{item.name}</span>
            </button>
          ))}
        </nav>

        {/* (Date range selector removed at user's request) */}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
        <div className="p-4 sm:p-6 lg:p-8 min-w-0">
          {/* ML Models Section */}
          {activeSection === 'model-performance' && (
            <div className="space-y-6 sm:space-y-8 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">ML Model Performance</h1>
                  <p className="text-gray-600 mt-2 text-sm sm:text-base">Monitor and compare machine learning model performance</p>
                </div>
                <PrintButton section="model-performance" />
              </div>

              {/* Model Performance Content - Combined with Training Output */}
              {!hasModelPerformanceData(analyticsData.modelPerformance) ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <EmptyState
                    illustration=""
                    title="No ML Models Found"
                    description="No machine learning models are currently deployed or being monitored. Deploy some models to see their performance metrics here."
                    actionText="Refresh Data"
                    onAction={() => fetchAnalyticsData()}
                  />
                </div>
              ) : (
                <>

              <TrainTestInferenceRadar models={analyticsData.modelPerformance?.models || []} />

              {/* Train Set Metrics Table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6 min-w-0">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Train Set Metrics</h3>
                
                <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pipeline</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-blue-600 uppercase tracking-wider bg-blue-50">NPMI</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-green-600 uppercase tracking-wider bg-green-50">CV</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-orange-600 uppercase tracking-wider bg-orange-50">Topic Diversity</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-purple-600 uppercase tracking-wider bg-purple-50">Silhouette</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-indigo-600 uppercase tracking-wider bg-indigo-50">Clusters</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(analyticsData.modelPerformance?.models || []).slice(0, 6).map((model, idx) => {
                        const realMetrics = model.realMetrics || {};
                        
                        // Debug first model
                        if (idx === 0) {
                          console.log('Frontend - First model realMetrics:', realMetrics);
                        }
                        
                        // Extract train metrics
                        const trainNpmi = realMetrics.train_npmi !== undefined && realMetrics.train_npmi !== null ? realMetrics.train_npmi : 
                                        (realMetrics.train_coherence_npmi !== undefined && realMetrics.train_coherence_npmi !== null ? realMetrics.train_coherence_npmi : null);
                        const trainCv = realMetrics.train_cv !== undefined && realMetrics.train_cv !== null ? realMetrics.train_cv : 
                                       (realMetrics.train_coherence_cv !== undefined && realMetrics.train_coherence_cv !== null ? realMetrics.train_coherence_cv : null);
                        const trainTopicDiversity = realMetrics.train_topic_diversity !== undefined && realMetrics.train_topic_diversity !== null ? realMetrics.train_topic_diversity : null;
                        const trainSilhouette = realMetrics.train_silhouette !== undefined && realMetrics.train_silhouette !== null ? realMetrics.train_silhouette : 
                                               (realMetrics.train_silhouette_score !== undefined && realMetrics.train_silhouette_score !== null ? realMetrics.train_silhouette_score : null);
                        const clusters = realMetrics.n_clusters !== undefined && realMetrics.n_clusters !== null ? realMetrics.n_clusters : null;
                        
                        // Debug first model extracted values
                        if (idx === 0) {
                          console.log('Frontend - First model extracted train metrics:', {
                            trainNpmi, trainCv, trainTopicDiversity, trainSilhouette, clusters
                          });
                        }
                        
                        return (
                          <tr key={`train-${model.id}`} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-gray-900 break-words min-w-[220px]">{model.name}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold">
                              {trainNpmi !== null && trainNpmi !== undefined
                                ? <span className="text-blue-700">{trainNpmi.toFixed(4)}</span>
                                : <span className="text-gray-400">N/A</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold">
                              {trainCv !== null && trainCv !== undefined
                                ? <span className="text-green-700">{trainCv.toFixed(4)}</span>
                                : <span className="text-gray-400">N/A</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold">
                              {trainTopicDiversity !== null && trainTopicDiversity !== undefined
                                ? <span className="text-orange-700">{trainTopicDiversity.toFixed(4)}</span>
                                : <span className="text-gray-400">N/A</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold">
                              {trainSilhouette !== null && trainSilhouette !== undefined
                                ? <span className="text-purple-700">{trainSilhouette.toFixed(4)}</span>
                                : <span className="text-gray-400">N/A</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold">
                              {clusters !== null && clusters !== undefined
                                ? <span className="text-indigo-700">{clusters}</span>
                                : <span className="text-gray-400">N/A</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Test Set Metrics Table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Test Set Metrics</h3>
                
                <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pipeline</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-blue-600 uppercase tracking-wider bg-blue-50">NPMI</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-green-600 uppercase tracking-wider bg-green-50">CV</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-orange-600 uppercase tracking-wider bg-orange-50">Topic Diversity</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-purple-600 uppercase tracking-wider bg-purple-50">Silhouette</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-indigo-600 uppercase tracking-wider bg-indigo-50">Clusters</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(analyticsData.modelPerformance?.models || []).slice(0, 6).map((model, idx) => {
                        const realMetrics = model.realMetrics || {};
                        
                        // Debug first model
                        if (idx === 0) {
                          console.log('Frontend - First model realMetrics (test):', realMetrics);
                        }
                        
                        // Extract test metrics
                        const testNpmi = realMetrics.npmi !== undefined && realMetrics.npmi !== null ? realMetrics.npmi : 
                                       (realMetrics.coherence_npmi !== undefined && realMetrics.coherence_npmi !== null ? realMetrics.coherence_npmi : null);
                        const testCv = realMetrics.cv !== undefined && realMetrics.cv !== null ? realMetrics.cv : 
                                      (realMetrics.coherence_cv !== undefined && realMetrics.coherence_cv !== null ? realMetrics.coherence_cv : null);
                        const testTopicDiversity = realMetrics.topic_diversity !== undefined && realMetrics.topic_diversity !== null ? realMetrics.topic_diversity : null;
                        const testSilhouette = realMetrics.silhouette !== undefined && realMetrics.silhouette !== null ? realMetrics.silhouette : 
                                             (realMetrics.silhouette_score !== undefined && realMetrics.silhouette_score !== null ? realMetrics.silhouette_score : null);
                        const clusters = realMetrics.n_clusters !== undefined && realMetrics.n_clusters !== null ? realMetrics.n_clusters : null;
                        
                        // Debug first model extracted values
                        if (idx === 0) {
                          console.log('Frontend - First model extracted test metrics:', {
                            testNpmi, testCv, testTopicDiversity, testSilhouette, clusters
                          });
                        }
                        
                        return (
                          <tr key={`test-${model.id}`} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-gray-900 break-words min-w-[220px]">{model.name}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold">
                              {testNpmi !== null && testNpmi !== undefined
                                ? <span className="text-blue-700">{testNpmi.toFixed(4)}</span>
                                : <span className="text-gray-400">N/A</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold">
                              {testCv !== null && testCv !== undefined
                                ? <span className="text-green-700">{testCv.toFixed(4)}</span>
                                : <span className="text-gray-400">N/A</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold">
                              {testTopicDiversity !== null && testTopicDiversity !== undefined
                                ? <span className="text-orange-700">{testTopicDiversity.toFixed(4)}</span>
                                : <span className="text-gray-400">N/A</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold">
                              {testSilhouette !== null && testSilhouette !== undefined
                                ? <span className="text-purple-700">{testSilhouette.toFixed(4)}</span>
                                : <span className="text-gray-400">N/A</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold">
                              {clusters !== null && clusters !== undefined
                                ? <span className="text-indigo-700">{clusters}</span>
                                : <span className="text-gray-400">N/A</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {(!analyticsData.modelPerformance?.models || analyticsData.modelPerformance.models.length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    <p>No model metrics available</p>
                  </div>
                )}
              </div>

              {/* Inference Set Metrics Table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Inference Set Metrics</h3>
                
                <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pipeline</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-blue-600 uppercase tracking-wider bg-blue-50">NPMI</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-green-600 uppercase tracking-wider bg-green-50">CV</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-orange-600 uppercase tracking-wider bg-orange-50">Topic Diversity</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-purple-600 uppercase tracking-wider bg-purple-50">Silhouette</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-indigo-600 uppercase tracking-wider bg-indigo-50">Clusters</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(analyticsData.modelPerformance?.models || []).slice(0, 6).map((model, idx) => {
                        const realMetrics = model.realMetrics || {};
                        
                        // Extract inference metrics
                        const inferenceNpmi = realMetrics.inference_npmi !== undefined && realMetrics.inference_npmi !== null ? realMetrics.inference_npmi : 
                                           (realMetrics.inference_coherence_npmi !== undefined && realMetrics.inference_coherence_npmi !== null ? realMetrics.inference_coherence_npmi : null);
                        const inferenceCv = realMetrics.inference_cv !== undefined && realMetrics.inference_cv !== null ? realMetrics.inference_cv : 
                                          (realMetrics.inference_coherence_cv !== undefined && realMetrics.inference_coherence_cv !== null ? realMetrics.inference_coherence_cv : null);
                        const inferenceTopicDiversity = realMetrics.inference_topic_diversity !== undefined && realMetrics.inference_topic_diversity !== null ? realMetrics.inference_topic_diversity : null;
                        const inferenceSilhouette = realMetrics.inference_silhouette !== undefined && realMetrics.inference_silhouette !== null ? realMetrics.inference_silhouette : 
                                                   (realMetrics.inference_silhouette_score !== undefined && realMetrics.inference_silhouette_score !== null ? realMetrics.inference_silhouette_score : null);
                        const inferenceClusters = realMetrics.inference_n_clusters !== undefined && realMetrics.inference_n_clusters !== null ? realMetrics.inference_n_clusters : null;
                        
                        return (
                          <tr key={`inference-${model.id}`} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-gray-900 break-words min-w-[220px]">{model.name}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold">
                              {inferenceNpmi !== null && inferenceNpmi !== undefined
                                ? <span className="text-blue-700">{inferenceNpmi.toFixed(4)}</span>
                                : <span className="text-gray-400">N/A</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold">
                              {inferenceCv !== null && inferenceCv !== undefined
                                ? <span className="text-green-700">{inferenceCv.toFixed(4)}</span>
                                : <span className="text-gray-400">N/A</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold">
                              {inferenceTopicDiversity !== null && inferenceTopicDiversity !== undefined
                                ? <span className="text-orange-700">{inferenceTopicDiversity.toFixed(4)}</span>
                                : <span className="text-gray-400">N/A</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold">
                              {inferenceSilhouette !== null && inferenceSilhouette !== undefined
                                ? <span className="text-purple-700">{inferenceSilhouette.toFixed(4)}</span>
                                : <span className="text-gray-400">N/A</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold">
                              {inferenceClusters !== null && inferenceClusters !== undefined
                                ? <span className="text-indigo-700">{inferenceClusters}</span>
                                : <span className="text-gray-400">N/A</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {(!analyticsData.modelPerformance?.models || analyticsData.modelPerformance.models.length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    <p>No inference metrics available</p>
                  </div>
                )}
              </div>

              {/* Issue Portal Precompute Report - Added at bottom of ML Models section */}
              <div className="mt-12 pt-8 border-t-2 border-gray-200">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Issue Portal Precompute Report</h2>
                  <p className="text-gray-600 mt-1">Statistics and quality metrics for precomputed Issue Portal topics</p>
                </div>

                {!analyticsData.issuePortalPrecompute?.pipelines || analyticsData.issuePortalPrecompute.pipelines.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                    <EmptyState
                      illustration=""
                      title="No Precompute Data Available"
                      description="No Issue Portal precomputation has been run yet. Run the precompute script for pipelines (e.g., pipeline5) to generate topic data."
                      actionText="Refresh Data"
                      onAction={() => fetchAnalyticsData()}
                    />
                  </div>
                ) : (
                  <>
                    {/* Pipeline Selection Dropdown */}
                    <PipelineSelector 
                      pipelines={analyticsData.issuePortalPrecompute.pipelines}
                      onConfirm={async (pipelineId, includeLowQuality) => {
                        await topicApi.setDefaultPipeline(pipelineId, includeLowQuality);
                      }}
                    />

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-8">
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-600">Total Pipelines</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">
                              {analyticsData.issuePortalPrecompute.summary.total_pipelines || 0}
                            </p>
                          </div>
                          <div className="p-3 bg-blue-100 rounded-lg">
                            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-600">Total Issues</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2 break-words">
                              {(analyticsData.issuePortalPrecompute.summary.total_issues || 0).toLocaleString()}
                            </p>
                          </div>
                          <div className="p-3 bg-green-100 rounded-lg">
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-600">Total Statements</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2 break-words">
                              {(analyticsData.issuePortalPrecompute.summary.total_turns || 0).toLocaleString()}
                            </p>
                          </div>
                          <div className="p-3 bg-purple-100 rounded-lg">
                            <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-600">Pipelines with Data</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">
                              {analyticsData.issuePortalPrecompute.summary.pipelines_with_data || 0}
                            </p>
                          </div>
                          <div className="p-3 bg-indigo-100 rounded-lg">
                            <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Comparison Charts */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                      {/* Pipeline Comparison - Issues Count */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0">
                        <BarChart
                          title="Issues Count by Pipeline"
                          data={analyticsData.issuePortalPrecompute.pipelines.map(p => ({
                            label: p.pipeline_name || p.pipeline_id,
                            value: p.issue_count
                          }))}
                          color="#3B82F6"
                          horizontal={true}
                        />
                      </div>

                      {/* Pipeline Comparison - Total Turns */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0">
                        <BarChart
                          title="Total Statements by Pipeline"
                          data={analyticsData.issuePortalPrecompute.pipelines.map(p => ({
                            label: p.pipeline_name || p.pipeline_id,
                            value: p.total_turns
                          }))}
                          color="#10B981"
                          horizontal={true}
                        />
                      </div>
                    </div>

                    {/* Quality Comparison Across Pipelines */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6 min-w-0">
                      <h3 className="text-xl font-bold text-gray-900 mb-6">Quality Comparison Across Pipelines</h3>
                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        {['high', 'medium', 'low'].map((quality) => {
                          const qualityData = analyticsData.issuePortalPrecompute.pipelines.map(p => {
                            const qDist = p.quality_distribution.find(q => q.quality === quality);
                            return {
                              label: p.pipeline_name || p.pipeline_id,
                              value: qDist?.count || 0
                            };
                          });
                          const colorMap = {
                            high: '#10B981',
                            medium: '#F59E0B',
                            low: '#6B7280'
                          };
                          return (
                            <div key={quality}>
                              <BarChart
                                title={`${quality.charAt(0).toUpperCase() + quality.slice(1)} Quality`}
                                data={qualityData}
                                color={colorMap[quality]}
                                horizontal={true}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Pipeline Details Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6 min-w-0">
                      <h3 className="text-xl font-bold text-gray-900 mb-6">Pipeline Statistics</h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-[860px] w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pipeline</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Issues</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Turns</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total Turns</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Avg MPs</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Date Range</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Last Computed</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {analyticsData.issuePortalPrecompute.pipelines.map((pipeline) => (
                              <tr key={pipeline.pipeline_id} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div className="text-sm font-medium text-gray-900 break-words min-w-[220px]">{pipeline.pipeline_name || pipeline.pipeline_id}</div>
                          </td>
                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                  <span className="text-sm font-semibold text-gray-900">{pipeline.issue_count}</span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                  <span className="text-sm text-gray-700">{pipeline.avg_turns.toFixed(1)}</span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                  <span className="text-sm text-gray-700">{pipeline.total_turns.toLocaleString()}</span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                  <span className="text-sm text-gray-700">{pipeline.avg_mp_count.toFixed(1)}</span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                                  {pipeline.date_range.earliest && pipeline.date_range.latest ? (
                                    <div>
                                      <div>{new Date(pipeline.date_range.earliest).toLocaleDateString('en-MY', { year: 'numeric', month: 'short' })}</div>
                                      <div className="text-xs text-gray-400">to</div>
                                      <div>{new Date(pipeline.date_range.latest).toLocaleDateString('en-MY', { year: 'numeric', month: 'short' })}</div>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">N/A</span>
                                  )}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                                  {pipeline.last_computed ? (
                                    new Date(pipeline.last_computed).toLocaleDateString('en-MY', { 
                                      year: 'numeric', 
                                      month: 'short', 
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  ) : (
                                    <span className="text-gray-400">Never</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Quality & Category Distribution */}
                    {analyticsData.issuePortalPrecompute.pipelines.map((pipeline) => {
                      // Prepare data for charts
                      const qualityChartData = pipeline.quality_distribution.map(q => ({
                        label: q.quality.charAt(0).toUpperCase() + q.quality.slice(1),
                        value: q.count
                      }));

                      const categoryChartData = pipeline.category_distribution
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 8)
                        .map(cat => ({
                          label: cat.category,
                          value: cat.count
                        }));

                      return (
                        <div key={`details-${pipeline.pipeline_id}`} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                          <h3 className="text-lg font-bold text-gray-900 mb-4">{pipeline.pipeline_name || pipeline.pipeline_id}</h3>
                          
                          {/* Charts Row */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            {/* Quality Distribution Pie Chart */}
                            <div className="bg-gray-50 rounded-lg p-4">
                              {qualityChartData.length > 0 ? (
                                <PieChart
                                  title="Quality Distribution"
                                  data={qualityChartData}
                                  colors={['#10B981', '#F59E0B', '#6B7280']}
                                />
                              ) : (
                                <div className="text-center py-8 text-gray-400">No quality data</div>
                              )}
                            </div>

                            {/* Category Distribution Pie Chart */}
                            <div className="bg-gray-50 rounded-lg p-4">
                              {categoryChartData.length > 0 ? (
                                <PieChart
                                  title="Top Categories"
                                  data={categoryChartData}
                                  colors={['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#6366F1', '#14B8A6']}
                                />
                              ) : (
                                <div className="text-center py-8 text-gray-400">No category data</div>
                              )}
                            </div>
                          </div>

                          {/* Detailed Distribution Tables */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Quality Distribution */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">Quality Distribution</h4>
                              <div className="space-y-2">
                                {pipeline.quality_distribution.length > 0 ? (
                                  pipeline.quality_distribution.map((q) => {
                                    const percentage = ((q.count / pipeline.issue_count) * 100).toFixed(1);
                                    const colorClass = q.quality === 'high' ? 'bg-green-500' : q.quality === 'medium' ? 'bg-yellow-500' : 'bg-gray-500';
                                    return (
                                      <div key={q.quality} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <div className={`w-3 h-3 rounded-full ${colorClass}`}></div>
                                          <span className="text-sm text-gray-700 capitalize">{q.quality}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <div className="w-32 bg-gray-200 rounded-full h-2">
                                            <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${percentage}%` }}></div>
                                          </div>
                                          <span className="text-sm font-medium text-gray-900 w-12 text-right">{q.count}</span>
                                          <span className="text-xs text-gray-500 w-10 text-right">{percentage}%</span>
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <p className="text-sm text-gray-400">No quality data available</p>
                                )}
                              </div>
                            </div>

                            {/* Category Distribution */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">Category Distribution</h4>
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {pipeline.category_distribution.length > 0 ? (
                                  pipeline.category_distribution
                                    .sort((a, b) => b.count - a.count)
                                    .slice(0, 10)
                                    .map((cat) => {
                                      const percentage = ((cat.count / pipeline.issue_count) * 100).toFixed(1);
                                      return (
                                        <div key={cat.category} className="flex items-center justify-between">
                                          <span className="text-sm text-gray-700 truncate flex-1">{cat.category}</span>
                                          <div className="flex items-center gap-3">
                                            <div className="w-24 bg-gray-200 rounded-full h-2">
                                              <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                                            </div>
                                            <span className="text-sm font-medium text-gray-900 w-8 text-right">{cat.count}</span>
                                            <span className="text-xs text-gray-500 w-10 text-right">{percentage}%</span>
                                          </div>
                                        </div>
                                      );
                                    })
                                ) : (
                                  <p className="text-sm text-gray-400">No category data available</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* ARIMA Trend Forecast */}
              <div className="mt-12 pt-8 border-t-2 border-gray-200">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">ARIMA Trend Forecast</h2>
                  <p className="text-gray-600 mt-1 text-sm">
                    Time series trend analysis and session-level forecasts per pipeline using zero-shot ARIMA(1,1,0).
                    Run <code className="bg-gray-100 px-1 rounded text-xs font-mono">python 2_ml_modeling/08_arima_trend_forecast.py --all-pipelines</code> to precompute.
                  </p>
                </div>

                {/* Pipeline Status Table */}
                {analyticsData.arimaAllPipelines.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center mb-6">
                    <svg className="w-10 h-10 text-amber-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-amber-800 font-semibold mb-1">No ARIMA results precomputed yet</p>
                    <p className="text-amber-700 text-sm">Run the precompute script to generate forecasts for all pipelines.</p>
                    <code className="block mt-3 bg-amber-100 text-amber-900 text-xs rounded px-4 py-2 font-mono text-left max-w-sm mx-auto">
                      cd 2_ml_modeling<br />
                      python 08_arima_trend_forecast.py --all-pipelines
                    </code>
                  </div>
                ) : (
                  <>
                    {/* Summary stat cards */}
                    {(() => {
                      const okCount = analyticsData.arimaAllPipelines.filter(p => p.status === 'ok').length;
                      const insufficientCount = analyticsData.arimaAllPipelines.filter(p => p.status === 'insufficient_eras').length;
                      const notComputedCount = 6 - analyticsData.arimaAllPipelines.length;
                      const totalTopics = analyticsData.arimaAllPipelines.reduce((s, p) => s + (p.n_topics_forecasted || 0), 0);
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 text-center">
                            <p className="text-sm font-medium text-gray-600">Pipelines Ready</p>
                            <p className="text-3xl font-bold text-green-600 mt-1">{okCount}</p>
                          </div>
                          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 text-center">
                            <p className="text-sm font-medium text-gray-600">Insufficient Eras</p>
                            <p className="text-3xl font-bold text-amber-500 mt-1">{insufficientCount}</p>
                          </div>
                          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 text-center">
                            <p className="text-sm font-medium text-gray-600">Not Computed</p>
                            <p className="text-3xl font-bold text-gray-400 mt-1">{notComputedCount}</p>
                          </div>
                          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 text-center">
                            <p className="text-sm font-medium text-gray-600">Total Topics Forecast</p>
                            <p className="text-3xl font-bold text-violet-600 mt-1">{totalTopics}</p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Per-pipeline status table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6 min-w-0">
                      <h3 className="text-xl font-bold text-gray-900 mb-4">Pipeline ARIMA Status</h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-[760px] w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pipeline</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-indigo-600 uppercase tracking-wider bg-indigo-50">Sessions (Eras)</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-violet-600 uppercase tracking-wider bg-violet-50">Topics Forecast</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-blue-600 uppercase tracking-wider bg-blue-50">Forecast Horizon</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">ARIMA Order</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Last Computed</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {(() => {
                              const PIPELINE_LABELS = {
                                pipeline1: 'Pipeline 1: TF-IDF + KMeans',
                                pipeline2: 'Pipeline 2: TF-IDF + LDA',
                                pipeline3: 'Pipeline 3: MEHTC Entity-Only',
                                pipeline4: 'Pipeline 4: MEHTC + XLM Zero-Shot',
                                pipeline5: 'Pipeline 5: MEHTC + LoRA (Production)',
                                pipeline6: 'Pipeline 6: E5-Large SOTA',
                              };
                              const computedIds = new Set(analyticsData.arimaAllPipelines.map(p => p.pipeline_id));
                              const allRows = [
                                ...analyticsData.arimaAllPipelines,
                                ...['pipeline1','pipeline2','pipeline3','pipeline4','pipeline5','pipeline6']
                                  .filter(id => !computedIds.has(id))
                                  .map(id => ({ pipeline_id: id, status: 'not_computed' }))
                              ].sort((a, b) => (a.pipeline_id || '').localeCompare(b.pipeline_id || ''));

                              return allRows.map(p => {
                                const statusConfig = {
                                  ok: { label: 'Ready', cls: 'bg-green-100 text-green-700' },
                                  insufficient_eras: { label: 'Insufficient Eras', cls: 'bg-amber-100 text-amber-700' },
                                  not_computed: { label: 'Not Computed', cls: 'bg-gray-100 text-gray-500' },
                                }[p.status] || { label: p.status, cls: 'bg-gray-100 text-gray-500' };

                                return (
                                  <tr
                                    key={p.pipeline_id}
                                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedArimaPipeline === p.pipeline_id ? 'bg-violet-50 ring-1 ring-inset ring-violet-200' : ''}`}
                                    onClick={() => p.status === 'ok' && setSelectedArimaPipeline(p.pipeline_id)}
                                    title={p.status === 'ok' ? 'Click to view forecast chart' : undefined}
                                  >
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-900 break-words min-w-[220px]">
                                          {PIPELINE_LABELS[p.pipeline_id] || p.pipeline_id}
                                        </span>
                                        {p.status === 'ok' && (
                                          <span className="text-xs text-violet-500 font-medium">view chart</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.cls}`}>
                                        {statusConfig.label}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm font-semibold text-indigo-700">
                                      {p.n_eras != null ? p.n_eras : <span className="text-gray-400">—</span>}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm font-semibold text-violet-700">
                                      {p.status === 'ok' ? p.n_topics_forecasted : <span className="text-gray-400">—</span>}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-blue-700">
                                      {p.forecast_steps ? `${p.forecast_steps} sessions` : <span className="text-gray-400">—</span>}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-gray-600 font-mono">
                                      {p.arima_order ? `(${p.arima_order.join(',')})` : <span className="text-gray-400">—</span>}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                                      {p.generated_at
                                        ? new Date(p.generated_at).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' })
                                        : <span className="text-gray-400">Never</span>}
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                      {analyticsData.arimaAllPipelines.some(p => p.status === 'insufficient_eras') && (
                        <p className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                          <strong>Insufficient Eras:</strong> These pipelines' documents lack <code className="font-mono">parlimen/penggal/mesyuarat</code> session metadata, so no time series can be built. This is expected for Pipeline 1 &amp; 2 (raw segmented docs without session backfill).
                        </p>
                      )}
                    </div>

                    {/* Forecast Line Chart for selected pipeline */}
                    {(() => {
                      const selData = analyticsData.arimaAllPipelines.find(p => p.pipeline_id === selectedArimaPipeline);
                      const PIPELINE_LABELS = {
                        pipeline1: 'Pipeline 1: TF-IDF + KMeans',
                        pipeline2: 'Pipeline 2: TF-IDF + LDA',
                        pipeline3: 'Pipeline 3: MEHTC Entity-Only',
                        pipeline4: 'Pipeline 4: MEHTC + XLM Zero-Shot',
                        pipeline5: 'Pipeline 5: MEHTC + LoRA (Production)',
                        pipeline6: 'Pipeline 6: E5-Large SOTA',
                      };
                      const okPipelines = analyticsData.arimaAllPipelines.filter(p => p.status === 'ok');

                      if (okPipelines.length === 0) {
                        return (
                          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-gray-500 text-sm">
                            No pipeline with sufficient era data to render a forecast chart yet.
                          </div>
                        );
                      }

                      return (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0">
                          {/* Pipeline tab selector */}
                          <div className="flex flex-wrap items-center gap-2 mb-5">
                            <span className="text-sm font-medium text-gray-600 mr-1">View forecast for:</span>
                            {okPipelines.map(p => (
                              <button
                                key={p.pipeline_id}
                                onClick={() => setSelectedArimaPipeline(p.pipeline_id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                                  selectedArimaPipeline === p.pipeline_id
                                    ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-700'
                                }`}
                              >
                                {p.pipeline_id.replace('pipeline', 'P')}
                              </button>
                            ))}
                          </div>

                          {selData && selData.status === 'ok' ? (
                            <>
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <h3 className="text-base font-bold text-gray-900">
                                    {PIPELINE_LABELS[selData.pipeline_id] || selData.pipeline_id}
                                  </h3>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {selData.n_eras} sessions | {selData.n_topics_forecasted} topics | ARIMA({(selData.arima_order || [1,1,0]).join(',')}) | {selData.forecast_steps} session horizon
                                    {selData.generated_at && ` | computed ${new Date(selData.generated_at).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' })}`}
                                  </p>
                                </div>
                              </div>
                              <ArimaForecastChart
                                timePoints={selData.time_points || []}
                                timeLabels={selData.time_labels || []}
                                series={selData.series || {}}
                                forecasts={selData.forecasts || {}}
                                trends={selData.trends || {}}
                                topTopics={selData.top_topics || []}
                                forecastSteps={selData.forecast_steps || 3}
                                title=""
                              />
                            </>
                          ) : (
                            <div className="text-center py-10 text-gray-500 text-sm">
                              Select a pipeline with status <span className="font-semibold text-green-600">Ready</span> to view the forecast chart.
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
              {/* END ARIMA */}

                </>
              )}
            </div>
          )}

          {/* Content & Users Section */}
          {activeSection === 'content-engagement' && (
            <div className="space-y-6 sm:space-y-8 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">Content & User Analytics</h1>
                  <p className="text-gray-600 mt-2 text-sm sm:text-base">Monitor user engagement, content performance, and behavior patterns</p>
                </div>
                <PrintButton section="content-engagement" />
              </div>

              {/* Content & Users: Analytics Overview + User Activity Reports combined */}
              {(
                <>
                  {!hasContentEngagementData(analyticsData.contentEngagement) && 
                   !hasUserBehaviourData(analyticsData.userBehaviour) ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                      <EmptyState
                        illustration=""
                        title="No User Activity Data"
                        description="No user engagement or content analytics data is available. This could mean users haven't been active recently or tracking isn't properly configured."
                        actionText="Refresh Data"
                        onAction={() => fetchAnalyticsData()}
                      />
                    </div>
                  ) : null}
                  {hasContentEngagementData(analyticsData.contentEngagement) || hasUserBehaviourData(analyticsData.userBehaviour) ? (
                    <>
              {analyticsLoadError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between flex-wrap gap-2">
                  <span className="text-red-700 text-sm">Analytics failed to load: {analyticsLoadError}</span>
                  <button type="button" onClick={() => fetchAnalyticsData()} className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700">Retry</button>
                </div>
              )}
              {contentEngagementLastUpdated && !analyticsLoadError && (
                <p className="text-sm text-gray-500 mb-2">
                  Data updated at {new Date(contentEngagementLastUpdated).toLocaleString()}
                </p>
              )}
              {(analyticsData.contentEngagement?.totalViews === 0 && (analyticsData.userBehaviour?.dailyActiveUsers ?? 0) === 0) && !analyticsLoadError && contentEngagementLastUpdated && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                  Live data connected; no content views or active users in the current period yet.
                </p>
              )}
              {/* Row 1: content & user overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 min-w-0">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-600">Total Views</p>
                      <p className="text-2xl font-bold text-gray-900">{(analyticsData.contentEngagement?.totalViews ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-600">Active Users</p>
                      <p className="text-2xl font-bold text-gray-900">{(analyticsData.userBehaviour?.dailyActiveUsers || 0).toLocaleString()}</p>
                    </div>
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
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
              </div>

              {/* Row 2: quiz engagement */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 min-w-0">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-600">Quizzes Answered</p>
                      <p className="text-2xl font-bold text-emerald-700">{(analyticsData.contentEngagement?.quizzesAnswered ?? 0).toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{(analyticsData.contentEngagement?.uniqueUsersWhoAnsweredQuiz ?? 0)} unique users</p>
                    </div>
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <svg className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-600">Quiz Answer Rate</p>
                      <p className="text-2xl font-bold text-teal-700">{analyticsData.contentEngagement?.quizAnswerRate || '0.0%'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Users who answered ≥ 1 quiz</p>
                    </div>
                    <div className="p-2 bg-teal-100 rounded-lg">
                      <svg className="h-6 w-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-600">Avg. Quiz Score</p>
                      <p className="text-2xl font-bold text-sky-700">{analyticsData.contentEngagement?.quizAverageScore || '0.0%'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Average score across submissions</p>
                    </div>
                    <div className="p-2 bg-sky-100 rounded-lg">
                      <svg className="h-6 w-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Most Viewed Edu Content + User Type Distribution side by side */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8 min-w-0">
                {/* Most Viewed Edu Content (left) */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-50 rounded-lg">
                        <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Most Viewed Edu Content</h3>
                        <p className="text-xs text-gray-500">Top content and categories by views</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                      <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                        <button
                          type="button"
                          onClick={() => { setEduViewsTab('content'); setEduViewsPage(1); }}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${eduViewsTab === 'content' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          By Content
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEduViewsTab('category'); setEduViewsPage(1); }}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${eduViewsTab === 'category' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          By Category
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* By Content: paginated list */}
                  {eduViewsTab === 'content' && (
                    (() => {
                      const items = analyticsData.contentEngagement?.topEduContentByViews || [];
                      if (!items.length) {
                        return <p className="text-gray-500 text-sm py-4">No edu content views in the selected period yet.</p>;
                      }
                      const pageSize = 5;
                      const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
                      const safePage = Math.min(eduViewsPage, totalPages);
                      const start = (safePage - 1) * pageSize;
                      const currentItems = items.slice(start, start + pageSize);

                      return (
                        <div className="space-y-3">
                  <ul className="space-y-2">
                            {currentItems.map((item, idx) => {
                              const globalIndex = start + idx;
                      const title = item.title && item.title.trim() ? item.title : 'Untitled';
                      const views = item.views ?? 0;
                              const rankGradients = [
                                'from-yellow-400 to-orange-400',
                                'from-slate-300 to-slate-400',
                                'from-amber-600 to-amber-700',
                              ];
                              const rankGrad = rankGradients[globalIndex] || 'from-slate-200 to-slate-300';
                      return (
                                <li key={item.resourceId || globalIndex} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                                  <span className={`flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br ${rankGrad} text-white text-sm font-semibold flex items-center justify-center`}>
                                    {globalIndex + 1}
                          </span>
                          <span className="flex-1 min-w-0 text-gray-800 truncate" title={title}>
                            {title}
                          </span>
                          <span className="flex-shrink-0 text-sm font-medium text-emerald-600 tabular-nums">
                            {views.toLocaleString()} views
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                              <p className="text-xs text-gray-500">
                                Page <span className="font-medium">{safePage}</span> of <span className="font-medium">{totalPages}</span> · Showing {currentItems.length} of {items.length} items
                              </p>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEduViewsPage(p => Math.max(1, p - 1))}
                                  disabled={safePage === 1}
                                  className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Previous
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEduViewsPage(p => Math.min(totalPages, p + 1))}
                                  disabled={safePage === totalPages}
                                  className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                )}
              </div>
                      );
                    })()
                  )}

                  {/* By Category: top 5 categories pie chart */}
                  {eduViewsTab === 'category' && (
                    (() => {
                      const categoryMap = analyticsData.contentEngagement?.contentByCategory || {};
                      const entries = Object.entries(categoryMap);
                      if (!entries.length) {
                        return <p className="text-gray-500 text-sm py-4">No category data available for this period.</p>;
                      }
                      const top5 = entries
                        .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                        .slice(0, 5)
                        .map(([label, value]) => ({ label, value }));

                      return (
                        <div className="mt-2">
                  <PieChart
                            data={top5}
                            title="Top 5 Categories by Views"
                            colors={['#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6']}
                          />
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* User Type Distribution (right of Most Viewed Edu) */}
                <UserSegmentationChart 
                  segments={analyticsData?.userBehaviour?.userSegmentation?.segments || {}}
                  title="User Type Distribution"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 sm:gap-8 min-w-0">
                <UserActivityCard
                  dailyActiveUsers={analyticsData.userBehaviour?.dailyActiveUsers ?? 0}
                  weeklyActiveUsers={analyticsData.userBehaviour?.weeklyActiveUsers ?? 0}
                  monthlyActiveUsers={analyticsData.userBehaviour?.monthlyActiveUsers ?? 0}
                  newRegistrations={analyticsData.userBehaviour?.newRegistrations ?? 0}
                  signUpTrendDaily={analyticsData.userBehaviour?.userGrowthTrends?.daily ?? []}
                  signUpTrendWeekly={analyticsData.userBehaviour?.userGrowthTrends?.weekly ?? []}
                  signUpTrendMonthly={analyticsData.userBehaviour?.userGrowthTrends?.monthly ?? []}
                  signUpTrendYearly={analyticsData.userBehaviour?.userGrowthTrends?.yearly ?? []}
                  activeUsersByWeek={analyticsData.userBehaviour?.activeUsersByWeek ?? []}
                  activeUsersByMonth={analyticsData.userBehaviour?.activeUsersByMonth ?? []}
                  activeUsersByYear={analyticsData.userBehaviour?.activeUsersByYear ?? []}
                />
              </div>

              <AdminUserReports
                embedded
                externalData={embeddedUserReports}
                externalLoading={embeddedUserReportsLoading}
                selectedTimeRange={embeddedUserReportsRange}
                autoRefresh={embeddedUserReportsAutoRefresh}
                onSelectedTimeRangeChange={(nextRange) => {
                  setEmbeddedUserReportsRange(nextRange);
                  fetchEmbeddedUserReportsData(nextRange);
                }}
                onAutoRefreshChange={setEmbeddedUserReportsAutoRefresh}
                onRefreshData={() => fetchEmbeddedUserReportsData(embeddedUserReportsRange)}
              />

              {/* Enhanced User Analytics Section */}
                <div className="space-y-6 sm:space-y-8 min-w-0">
                {/* User Demographics (region only) */}
                <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 min-w-0">
                  <UserByRegionChart 
                    stateData={analyticsData?.userBehaviour?.usersByState || {}}
                    constituencyData={analyticsData?.userBehaviour?.usersByConstituency || {}}
                    title="User by Region Distribution"
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
                {(analyticsData?.contentEngagement?.userJourneys?.totalJourneys > 0) && (
                  <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">User Content Journey Analytics</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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

                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 sm:p-6">
                      <BarChart
                        title="Top User Journeys by Total Actions"
                        data={(analyticsData?.contentEngagement?.userJourneys?.topUserJourneys || [])
                          .slice(0, 8)
                          .map((journey, index) => ({
                            label: `Journey ${index + 1} · ${Number(journey.avgActionsPerSession || 0).toFixed(1)} actions/session`,
                            value: journey.journeyLength || 0
                          }))}
                        color="#3B82F6"
                        horizontal={true}
                      />
                    </div>
                  </div>
                )}
              </div>

                    </>
                  ) : null}
                </>
              )}
            </div>
          )}

          {/* DevOps Section with subtabs */}
          {activeSection === 'devops' && (
            <div className="space-y-6 sm:space-y-8 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">DevOps & Operations</h1>
                  <p className="text-gray-600 mt-2 text-sm sm:text-base">Monitor CI/CD pipelines, continuous learning, scheduled jobs, and webapp health</p>
                </div>
                <PrintButton section="devops" />
              </div>

              {/* DevOps subtabs */}
              <div className="border-b border-gray-200 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                <nav className="flex space-x-6 sm:space-x-8 min-w-max sm:min-w-0" aria-label="DevOps sections">
                  <button
                    onClick={() => setSelectedDevOpsTab('operations')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      selectedDevOpsTab === 'operations'
                        ? 'border-green-500 text-green-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Operations
                  </button>
                  <button
                    onClick={() => setSelectedDevOpsTab('system-health')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      selectedDevOpsTab === 'system-health'
                        ? 'border-green-500 text-green-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    System Health (Webapp)
                  </button>
                </nav>
              </div>

              {/* Date range selector specifically for DevOps section */}
              <div className="flex items-center flex-wrap gap-2 text-xs text-gray-600 mt-2">
                <span className="font-medium">Date range:</span>
                <div className="flex flex-wrap gap-1">
                  {[{ value: '7d', label: 'Last 7 Days' }, { value: '30d', label: 'Last 30 Days' }, { value: '1y', label: 'Last Year' }, { value: 'all', label: 'All Time' }].map(r => (
                    <button
                      key={r.value}
                      onClick={() => setSelectedRange(r.value)}
                      className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
                        selectedRange === r.value
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                  {loading && (
                    <span className="ml-1 text-[11px] text-gray-400">
                      Updating…
                    </span>
                  )}
                </div>
              </div>

              {selectedDevOpsTab === 'operations' && (
                <div className="space-y-6">
                  {/* Summary cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <p className="text-rose-600 font-semibold">Total Jobs</p>
                      <p className="text-3xl font-bold text-rose-900">{analyticsData.cronJobAnalytics?.summary?.totalJobs ?? 0}</p>
                    </div>
                    <div className="text-center p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <p className="text-green-600 font-semibold">Successful Executions</p>
                      <p className="text-3xl font-bold text-green-900">{analyticsData.cronJobAnalytics?.summary?.successfulExecutions ?? 0}</p>
                    </div>
                    <div className="text-center p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <p className="text-amber-600 font-semibold">Avg Execution Time</p>
                      <p className="text-3xl font-bold text-amber-900">{Math.floor((analyticsData.cronJobAnalytics?.summary?.averageExecutionTime ?? 0) / 60)}m</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
                    <CronJobTable
                      jobs={analyticsData.cronJobAnalytics?.jobs ?? []}
                      title="Scheduled Job Status"
                    />
                  </div>

                  <SystemAlerts
                    alerts={analyticsData.cronJobAnalytics?.alerts ?? []}
                    title="Job Execution Alerts"
                  />
                </div>
              )}

              {selectedDevOpsTab === 'system-health' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-gray-900">System Health (Online Webapp)</h3>
                  {/* Monitoring report: deploy server data (overall, top concerns, metrics with trends) */}
                  {analyticsData.systemHealth?.monitoringReport && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">
                        System Health Monitoring {analyticsData.systemHealth.monitoringReport.period && (
                          <span className="text-gray-500 font-normal">({analyticsData.systemHealth.monitoringReport.period})</span>
                        )}
                      </h4>
                      <div className="flex flex-wrap items-center gap-4 mb-4">
                        <span className="text-sm font-medium text-gray-700">Overall System Health:</span>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                          analyticsData.systemHealth.monitoringReport.overallStatus === 'Critical' ? 'bg-red-100 text-red-800' :
                          analyticsData.systemHealth.monitoringReport.overallStatus === 'Caution' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                        }`}>
                          <AlertIcon level={analyticsData.systemHealth.monitoringReport.overallStatus === 'Critical' ? 'critical' : analyticsData.systemHealth.monitoringReport.overallStatus === 'Caution' ? 'warning' : 'ok'} className="w-4 h-4" />
                          {analyticsData.systemHealth.monitoringReport.overallStatus}
                        </span>
                      </div>
                      {Array.isArray(analyticsData.systemHealth.monitoringReport.topConcerns) && analyticsData.systemHealth.monitoringReport.topConcerns.length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-700 mb-2">Top Concerns</p>
                          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                            {analyticsData.systemHealth.monitoringReport.topConcerns.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {analyticsData.systemHealth.monitoringReport.metrics && (() => {
                        // Helper: build SVG polyline path from trend points
                        const buildPath = (points, W, H, maxV) => {
                          if (!points || points.length < 2) return '';
                          const xs = points.map((_, i) => (i / (points.length - 1)) * W);
                          const ys = points.map(p => H - Math.max(2, (Number(p.v) / maxV) * (H - 4)));
                          return xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
                        };
                        const buildFill = (points, W, H, maxV) => {
                          if (!points || points.length < 2) return '';
                          const path = buildPath(points, W, H, maxV);
                          return `${path} L${W},${H} L0,${H} Z`;
                        };
                        const METRIC_CONF = {
                          cpu: { label: 'CPU Usage', color: '#6366f1', fill: '#e0e7ff' },
                          memory: { label: 'Memory Usage', color: '#f59e0b', fill: '#fef3c7' },
                          networkLatency: { label: 'Network Latency', color: '#10b981', fill: '#d1fae5' },
                        };
                        const W = 600, H = 80;
                        return (
                          <div className="space-y-4">
                            {['cpu', 'memory', 'networkLatency'].map(key => {
                              const m = analyticsData.systemHealth.monitoringReport.metrics[key];
                              const conf = METRIC_CONF[key];
                              if (!m) return null;
                              const statusLevel = m.status === 'critical' ? 'critical' : m.status === 'warning' ? 'warning' : 'ok';
                              const trend = Array.isArray(m.trend) && m.trend.length > 0 ? m.trend : [];
                              const maxV = Math.max(m.peak || 0, m.threshold || 100, 1);
                              const thresholdY = H - (m.threshold / maxV) * (H - 4);
                              const path = buildPath(trend, W, H, maxV);
                              const fillPath = buildFill(trend, W, H, maxV);
                              return (
                                <div key={key} className="border border-gray-200 rounded-lg p-4">
                                  {/* Header row */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                    <span className="font-semibold text-gray-900">{conf.label}</span>
                                    <AlertIcon level={statusLevel} className="w-5 h-5" />
                                  </div>
                                  {/* Stats row */}
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
                                    <div className="bg-gray-50 rounded-lg p-2">
                                      <span className="text-gray-500 text-xs block">Current</span>
                                      <p className="font-bold text-gray-900">{m.current}{m.unit}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg p-2">
                                      <span className="text-gray-500 text-xs block">Average</span>
                                      <p className="font-bold text-gray-900">{m.average}{m.unit}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg p-2">
                                      <span className="text-gray-500 text-xs block">Peak</span>
                                      <p className="font-bold text-gray-900">{m.peak}{m.unit}</p>
                                    </div>
                                    <div className={`rounded-lg p-2 ${statusLevel === 'critical' ? 'bg-red-50' : statusLevel === 'warning' ? 'bg-amber-50' : 'bg-gray-50'}`}>
                                      <span className="text-gray-500 text-xs block">Threshold</span>
                                      <p className={`font-bold ${statusLevel === 'critical' ? 'text-red-700' : statusLevel === 'warning' ? 'text-amber-700' : 'text-gray-900'}`}>{m.threshold}{m.unit}</p>
                                    </div>
                                  </div>
                                  {/* Progress bar: current vs threshold */}
                                  <div className="mb-3">
                                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                                      <span>0{m.unit}</span><span>{m.threshold}{m.unit} threshold</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all ${statusLevel === 'critical' ? 'bg-red-500' : statusLevel === 'warning' ? 'bg-amber-500' : 'bg-green-500'}`}
                                        style={{ width: `${Math.min(100, (m.current / Math.max(m.threshold, m.peak, 1)) * 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                  {/* SVG Line chart */}
                                  {trend.length > 1 ? (
                                    <div>
                                      <p className="text-xs text-gray-400 mb-1">24h trend</p>
                                      <svg
                                        viewBox={`0 0 ${W} ${H}`}
                                        className="w-full"
                                        style={{ height: 80 }}
                                        preserveAspectRatio="none"
                                      >
                                        {/* Fill area */}
                                        <path d={fillPath} fill={conf.fill} opacity="0.6" />
                                        {/* Threshold line */}
                                        <line x1="0" y1={thresholdY} x2={W} y2={thresholdY} stroke="#ef4444" strokeWidth="1" strokeDasharray="6 3" opacity="0.6" />
                                        {/* Metric line */}
                                        <path d={path} fill="none" stroke={conf.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                                        {/* Latest dot */}
                                        {(() => {
                                          const last = trend[trend.length - 1];
                                          const x = W;
                                          const y = H - Math.max(2, (Number(last.v) / maxV) * (H - 4));
                                          return <circle cx={x} cy={y} r="3.5" fill={conf.color} />;
                                        })()}
                                      </svg>
                                      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                                        <span>24h ago</span><span>now</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-gray-400 mt-2">Trend data will appear after the server collects a few performance snapshots (every 5 min).</p>
                                  )}
                                </div>
                              );
                            })}
                            {analyticsData.systemHealth.monitoringReport.metrics.disk && (() => {
                              const m = analyticsData.systemHealth.monitoringReport.metrics.disk;
                              const statusLevel = m.status === 'critical' ? 'critical' : m.status === 'warning' ? 'warning' : 'ok';
                              return (
                                <div className="border border-gray-200 rounded-lg p-4">
                                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                    <span className="font-semibold text-gray-900">Disk Space</span>
                                    <AlertIcon level={statusLevel} className="w-5 h-5" />
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
                                    <div className="bg-gray-50 rounded-lg p-2"><span className="text-gray-500 text-xs block">Current</span><p className="font-bold text-gray-900">{m.current}{m.unit}</p></div>
                                    <div className="bg-gray-50 rounded-lg p-2"><span className="text-gray-500 text-xs block">Threshold</span><p className="font-bold text-gray-900">{m.threshold}{m.unit}</p></div>
                                  </div>
                                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${statusLevel === 'critical' ? 'bg-red-500' : statusLevel === 'warning' ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, m.current)}%` }} />
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  {hasSystemHealthData(analyticsData.systemHealth) ? (
                    (() => {
                      const alerts = getSystemHealthAlerts(analyticsData.systemHealth);
                      const borderClass = (level) => {
                        if (level === 'critical') return 'border-l-4 border-l-red-500';
                        if (level === 'warning') return 'border-l-4 border-l-amber-500';
                        return 'border-l-4 border-l-green-500';
                      };
                      const MetricCard = ({ metricKey, label, value, children, showBar, barPercent }) => (
                        <div className={`bg-white rounded-lg border border-gray-200 p-4 ${borderClass(alerts.metrics[metricKey] || 'ok')}`}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-gray-500">{label}</p>
                            <AlertIcon level={alerts.metrics[metricKey] || 'ok'} />
                          </div>
                          <p className="text-xl font-semibold text-gray-900 mt-1">{value}</p>
                          {showBar && barPercent != null && (
                            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  (alerts.metrics[metricKey] === 'critical') ? 'bg-red-500' :
                                  (alerts.metrics[metricKey] === 'warning') ? 'bg-amber-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(100, barPercent)}%` }}
                              />
                            </div>
                          )}
                          {children}
                        </div>
                      );
                      return (
                    <>
                      <div className="flex flex-wrap items-center gap-4 mb-4">
                        <span className="text-sm font-medium text-gray-700">Overall:</span>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                          alerts.overall === 'critical'
                            ? 'bg-red-100 text-red-800'
                            : alerts.overall === 'warning'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-green-100 text-green-800'
                        }`}>
                          <AlertIcon level={alerts.overall} className="w-4 h-4" />
                          {alerts.overall === 'critical' ? 'Critical' : alerts.overall === 'warning' ? 'Warning' : (analyticsData.systemHealth.networkStatus || 'Healthy')}
                        </span>
                        {analyticsData.systemHealth.lastUpdated && (
                          <span className="text-sm text-gray-500">
                            Last updated: {new Date(analyticsData.systemHealth.lastUpdated).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {analyticsData.systemHealth.serverUptime != null && (
                          <MetricCard
                            metricKey="serverUptime"
                            label="Server uptime"
                            value={String(analyticsData.systemHealth.serverUptime)}
                            showBar
                            barPercent={parsePercent(analyticsData.systemHealth.serverUptime)}
                          />
                        )}
                        {analyticsData.systemHealth.processUptimeFormatted != null && (
                          <MetricCard
                            metricKey="processUptime"
                            label="Process uptime"
                            value={String(analyticsData.systemHealth.processUptimeFormatted)}
                          />
                        )}
                        {(analyticsData.systemHealth.responseTime != null || analyticsData.systemHealth.databaseResponseTime != null) && (
                          <MetricCard
                            metricKey="responseTime"
                            label="Response time"
                            value={
                              analyticsData.systemHealth.databaseResponseTime != null
                                ? String(analyticsData.systemHealth.databaseResponseTime)
                                : typeof analyticsData.systemHealth.responseTime === 'number'
                                  ? `${analyticsData.systemHealth.responseTime}ms`
                                  : String(analyticsData.systemHealth.responseTime)
                            }
                          />
                        )}
                        {analyticsData.systemHealth.errorRate != null && (
                          <MetricCard
                            metricKey="errorRate"
                            label="Error rate"
                            value={String(analyticsData.systemHealth.errorRate)}
                          />
                        )}
                        {analyticsData.systemHealth.databaseStatus != null && (
                          <MetricCard
                            metricKey="databaseStatus"
                            label="Database"
                            value={String(analyticsData.systemHealth.databaseStatus)}
                          />
                        )}
                        {analyticsData.systemHealth.memoryUsage != null && (
                          <MetricCard
                            metricKey="memoryUsage"
                            label="Memory usage"
                            value={String(analyticsData.systemHealth.memoryUsage)}
                            showBar
                            barPercent={parsePercent(analyticsData.systemHealth.memoryUsage)}
                          />
                        )}
                        {analyticsData.systemHealth.requestsPerMinute != null && (
                          <MetricCard
                            metricKey="requestsPerMinute"
                            label="Requests / min"
                            value={Number(analyticsData.systemHealth.requestsPerMinute)}
                          />
                        )}
                        {analyticsData.systemHealth.activeUsers != null && (
                          <MetricCard
                            metricKey="activeUsers"
                            label="Active users (24h)"
                            value={Number(analyticsData.systemHealth.activeUsers)}
                          />
                        )}
                        {analyticsData.systemHealth.totalUsers != null && (
                          <div className={`bg-white rounded-lg border border-gray-200 p-4 ${borderClass('ok')}`}>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-gray-500">Total users</p>
                              <AlertIcon level="ok" />
                            </div>
                            <p className="text-xl font-semibold text-gray-900 mt-1">{Number(analyticsData.systemHealth.totalUsers)}</p>
                          </div>
                        )}
                      </div>
                      {analyticsData.systemHealth.databaseStorage && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-gray-700">Database storage</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className={`bg-white rounded-lg border border-gray-200 p-4 ${borderClass('ok')}`}>
                              <p className="text-sm font-medium text-gray-500">Data size</p>
                              <p className="text-xl font-semibold text-gray-900 mt-1">{Number(analyticsData.systemHealth.databaseStorage.dataSizeMB)} MB</p>
                            </div>
                            <div className={`bg-white rounded-lg border border-gray-200 p-4 ${borderClass('ok')}`}>
                              <p className="text-sm font-medium text-gray-500">Storage size</p>
                              <p className="text-xl font-semibold text-gray-900 mt-1">{Number(analyticsData.systemHealth.databaseStorage.storageSizeMB)} MB</p>
                            </div>
                            <div className={`bg-white rounded-lg border border-gray-200 p-4 ${borderClass('ok')}`}>
                              <p className="text-sm font-medium text-gray-500">Index size</p>
                              <p className="text-xl font-semibold text-gray-900 mt-1">{Number(analyticsData.systemHealth.databaseStorage.indexSizeMB)} MB</p>
                            </div>
                            <div className={`bg-white rounded-lg border border-gray-200 p-4 ${borderClass('ok')}`}>
                              <p className="text-sm font-medium text-gray-500">Collections</p>
                              <p className="text-xl font-semibold text-gray-900 mt-1">{Number(analyticsData.systemHealth.databaseStorage.collections)}</p>
                            </div>
                            <div className={`bg-white rounded-lg border border-gray-200 p-4 ${borderClass('ok')}`}>
                              <p className="text-sm font-medium text-gray-500">Documents</p>
                              <p className="text-xl font-semibold text-gray-900 mt-1">{Number(analyticsData.systemHealth.databaseStorage.objects).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      {(analyticsData.systemHealth.hostname || analyticsData.systemHealth.environment) && (
                        <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-600">
                          {analyticsData.systemHealth.hostname && <span>Host: {String(analyticsData.systemHealth.hostname)}</span>}
                          {analyticsData.systemHealth.environment && (
                            <span className={analyticsData.systemHealth.hostname ? 'ml-4' : ''}>Env: {String(analyticsData.systemHealth.environment)}</span>
                          )}
                        </div>
                      )}
                    </>
                      );
                    })()
                  ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                      <p className="text-gray-600">No system health data available. Load the dashboard to fetch metrics from the server.</p>
                      <button
                        type="button"
                        onClick={() => fetchAnalyticsData()}
                        className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Refresh analytics
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Service Management Section */}
          {activeSection === 'service-management' && (
            <div className="space-y-6 sm:space-y-8 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">Service Management Dashboard</h1>
                  <p className="text-gray-600 mt-2 text-sm sm:text-base">Monitor incidents, change requests, and maintenance tasks</p>
                </div>
                <PrintButton section="service-management" />
              </div>

              {/* Overview Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 min-w-0">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Total Incidents</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {dashboardLoading ? '...' : dashboardStats.incidents.total}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Total Changes</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {dashboardLoading ? '...' : dashboardStats.changes.total}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Total Maintenance</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {dashboardLoading ? '...' : dashboardStats.maintenance.total}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Incidents Statistics */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Incidents Overview</h3>
                  <div className="space-y-3">
                    {dashboardLoading ? (
                      <div className="text-sm text-gray-500">Loading...</div>
                    ) : dashboardStats.incidents.stateStats && dashboardStats.incidents.stateStats.length > 0 ? (
                      <>
                        {dashboardStats.incidents.stateStats.map((stat) => (
                          <div key={stat._id} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">{stat._id}</span>
                            <span className="text-sm font-semibold text-gray-900">{stat.count}</span>
                          </div>
                        ))}
                        {dashboardStats.incidents.escalatedCount > 0 && (
                          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                            <span className="text-sm text-red-600 font-medium">Escalated</span>
                            <span className="text-sm font-semibold text-red-600">{dashboardStats.incidents.escalatedCount}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-gray-500">No incident data available</div>
                    )}
                  </div>
                </div>

                {/* Change Requests Statistics */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Requests Overview</h3>
                  <div className="space-y-3">
                    {dashboardLoading ? (
                      <div className="text-sm text-gray-500">Loading...</div>
                    ) : dashboardStats.changes.stateStats && dashboardStats.changes.stateStats.length > 0 ? (
                      <>
                        {dashboardStats.changes.stateStats.map((stat) => (
                          <div key={stat._id} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">{stat._id}</span>
                            <span className="text-sm font-semibold text-gray-900">{stat.count}</span>
                          </div>
                        ))}
                        {dashboardStats.changes.approvalStats && dashboardStats.changes.approvalStats.length > 0 && (
                          <div className="pt-3 border-t border-gray-200">
                            <p className="text-xs font-medium text-gray-500 mb-2">Approval Status</p>
                            {dashboardStats.changes.approvalStats.map((stat) => (
                              <div key={stat._id} className="flex items-center justify-between mb-1">
                                <span className="text-sm text-gray-600">{stat._id || 'Pending'}</span>
                                <span className="text-sm font-semibold text-gray-900">{stat.count}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-gray-500">No change request data available</div>
                    )}
                  </div>
                </div>

                {/* Maintenance Statistics */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Maintenance Overview</h3>
                  <div className="space-y-3">
                    {dashboardLoading ? (
                      <div className="text-sm text-gray-500">Loading...</div>
                    ) : dashboardStats.maintenance.statusCounts && Object.keys(dashboardStats.maintenance.statusCounts).length > 0 ? (
                      Object.entries(dashboardStats.maintenance.statusCounts).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">{status}</span>
                          <span className="text-sm font-semibold text-gray-900">{count}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500">No maintenance data available</div>
                    )}
                  </div>
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
              {selectedMetric === 'model-performance' && (
                <div className="space-y-6">
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

                </div>
              )}
              
              {selectedMetric === 'content-engagement' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h4 className="text-lg font-semibold mb-4">Engagement Trends</h4>
                      <LineChart
                        data={(analyticsData?.contentEngagement?.engagementTrends?.weekly || []).map((v, i) => ({ label: `Week ${i + 1}`, value: v }))}
                        title="Weekly Views"
                        color="#8B5CF6"
                      />
                    </div>
                  </div>
                  {/* Enhanced User-Content Analytics */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <UserEngagementChart 
                      users={analyticsData?.contentEngagement?.userContentInteractions || []}
                      title="Most Engaged Content Users"
                    />
                    <UserByRegionChart 
                      stateData={analyticsData?.userBehaviour?.usersByState || {}}
                      constituencyData={analyticsData?.userBehaviour?.usersByConstituency || {}}
                      title="User by Region Distribution"
                    />
                  </div>

                  {/* User Journey Analytics */}
                  {(analyticsData?.contentEngagement?.userJourneys?.totalJourneys > 0) && (
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
                  {/* User Segmentation */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <UserSegmentationChart 
                      segments={analyticsData.userBehaviour?.userSegmentation?.segments || {}}
                      title="User Type Segmentation"
                    />
                  </div>

                  {/* Activity Patterns Heatmap */}
                  <UserActivityHeatmap 
                    patterns={analyticsData.userBehaviour?.behaviorPatterns?.timePatterns || []}
                    title="User Activity Patterns (7 Days)"
                  />

                  {/* Traditional Charts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <UserActivityCard
                      dailyActiveUsers={analyticsData?.userBehaviour?.dailyActiveUsers ?? 0}
                      weeklyActiveUsers={analyticsData?.userBehaviour?.weeklyActiveUsers ?? 0}
                      monthlyActiveUsers={analyticsData?.userBehaviour?.monthlyActiveUsers ?? 0}
                      newRegistrations={analyticsData?.userBehaviour?.newRegistrations ?? 0}
                      signUpTrendDaily={analyticsData?.userBehaviour?.userGrowthTrends?.daily ?? []}
                      signUpTrendWeekly={analyticsData?.userBehaviour?.userGrowthTrends?.weekly ?? []}
                      signUpTrendMonthly={analyticsData?.userBehaviour?.userGrowthTrends?.monthly ?? []}
                      signUpTrendYearly={analyticsData?.userBehaviour?.userGrowthTrends?.yearly ?? []}
                      activeUsersByWeek={analyticsData?.userBehaviour?.activeUsersByWeek ?? []}
                      activeUsersByMonth={analyticsData?.userBehaviour?.activeUsersByMonth ?? []}
                      activeUsersByYear={analyticsData?.userBehaviour?.activeUsersByYear ?? []}
                      compact
                    />
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
                    <CohortRetentionPanel
                      cohorts={analyticsData?.userBehaviour?.userCohorts || []}
                      title="User Cohort Retention Analysis"
                      titleLevel="h4"
                    />
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

              {selectedMetric === 'arima-forecast' && (
                <div className="space-y-6">
                  {/* Summary banner */}
                  <div className="bg-violet-50 p-4 rounded-lg border border-violet-200">
                    <h4 className="text-lg font-semibold text-violet-900 mb-1">ARIMA Trend &amp; Forecast Dashboard</h4>
                    <p className="text-violet-700 text-sm">
                      ARIMA(1,1,0) zero-shot time series analysis of parliamentary topic activity across sessions (eras).
                      Historical counts are shown as solid lines; forecasted future sessions are shown as dashed lines.
                    </p>
                    {analyticsData.arimaForecast?.generated_at && (
                      <p className="text-violet-500 text-xs mt-1">
                        Last precomputed: {new Date(analyticsData.arimaForecast.generated_at).toLocaleString()}
                        {' · '}Pipeline: {analyticsData.arimaForecast.pipeline_id || 'pipeline5'}
                        {' · '}ARIMA order: ({(analyticsData.arimaForecast.arima_order || [1,1,0]).join(',')})
                      </p>
                    )}
                  </div>

                  {/* Not computed state */}
                  {(!analyticsData.arimaForecast || analyticsData.arimaForecast.status === 'not_computed') && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
                      <svg className="w-12 h-12 text-amber-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h5 className="text-amber-800 font-semibold mb-2">ARIMA results not yet precomputed</h5>
                      <p className="text-amber-700 text-sm mb-4">
                        Run the following script to generate forecasts and store them in MongoDB:
                      </p>
                      <code className="block bg-amber-100 text-amber-900 text-xs rounded px-4 py-3 text-left font-mono mx-auto max-w-md">
                        cd 2_ml_modeling<br />
                        python 08_arima_trend_forecast.py<br />
                        <span className="text-amber-600"># or: python 08_arima_trend_forecast.py --forecast-steps 5</span>
                      </code>
                    </div>
                  )}

                  {/* Insufficient eras state */}
                  {analyticsData.arimaForecast?.status === 'insufficient_eras' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-blue-700 text-sm">
                        <strong>Insufficient data:</strong> {analyticsData.arimaForecast.message}
                      </p>
                    </div>
                  )}

                  {/* Main chart */}
                  {analyticsData.arimaForecast?.status === 'ok' && (
                    <>
                      {/* Summary stat cards */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-violet-50 rounded-lg border border-violet-200">
                          <p className="text-violet-600 font-semibold text-sm">Topics Forecasted</p>
                          <p className="text-2xl font-bold text-violet-900">{analyticsData.arimaForecast.n_topics_forecasted}</p>
                        </div>
                        <div className="text-center p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                          <p className="text-indigo-600 font-semibold text-sm">Sessions Analysed</p>
                          <p className="text-2xl font-bold text-indigo-900">{analyticsData.arimaForecast.n_eras}</p>
                        </div>
                        <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-blue-600 font-semibold text-sm">Forecast Horizon</p>
                          <p className="text-2xl font-bold text-blue-900">{analyticsData.arimaForecast.forecast_steps} sessions</p>
                        </div>
                        <div className="text-center p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                          <p className="text-emerald-600 font-semibold text-sm">Increasing Topics</p>
                          <p className="text-2xl font-bold text-emerald-900">
                            {Object.values(analyticsData.arimaForecast.trends || {}).filter(t => t === 'increasing').length}
                          </p>
                        </div>
                      </div>

                      {/* Multi-line ARIMA chart */}
                      <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                        <ArimaForecastChart
                          timePoints={analyticsData.arimaForecast.time_points || []}
                          timeLabels={analyticsData.arimaForecast.time_labels || []}
                          series={analyticsData.arimaForecast.series || {}}
                          forecasts={analyticsData.arimaForecast.forecasts || {}}
                          trends={analyticsData.arimaForecast.trends || {}}
                          topTopics={analyticsData.arimaForecast.top_topics || []}
                          forecastSteps={analyticsData.arimaForecast.forecast_steps || 3}
                          title="Topic Activity per Parliamentary Session"
                        />
                      </div>

                      {/* Trend breakdown table */}
                      {analyticsData.arimaForecast.top_topics?.length > 0 && (
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                          <div className="px-5 py-3 border-b border-gray-100">
                            <h5 className="text-sm font-semibold text-gray-800">Topic Trend Summary (top {analyticsData.arimaForecast.top_topics.length})</h5>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-50 text-left">
                                  <th className="px-5 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Topic</th>
                                  <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Total Activity</th>
                                  <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Trend</th>
                                  <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Next Forecast</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {analyticsData.arimaForecast.top_topics.map((topic, i) => {
                                  const trend = analyticsData.arimaForecast.trends?.[topic] || 'unknown';
                                  const total = analyticsData.arimaForecast.topic_totals?.[topic] || 0;
                                  const nextFc = (analyticsData.arimaForecast.forecasts?.[topic] || [])[0];
                                  const trendConfig = {
                                    increasing: { label: 'Increasing', cls: 'bg-green-100 text-green-700' },
                                    decreasing: { label: 'Decreasing', cls: 'bg-red-100 text-red-700' },
                                    stable: { label: 'Stable', cls: 'bg-gray-100 text-gray-600' },
                                    unknown: { label: 'Unknown', cls: 'bg-gray-50 text-gray-400' },
                                  }[trend] || { label: trend, cls: 'bg-gray-50 text-gray-400' };
                                  return (
                                    <tr key={topic} className="hover:bg-gray-50">
                                      <td className="px-5 py-2.5 text-gray-800 font-medium max-w-xs truncate" title={topic}>{i + 1}. {topic}</td>
                                      <td className="px-4 py-2.5 text-gray-600 text-right">{total.toLocaleString()}</td>
                                      <td className="px-4 py-2.5 text-center">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${trendConfig.cls}`}>
                                          {trendConfig.label}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2.5 text-gray-600 text-right">
                                        {nextFc != null ? Math.round(nextFc * 10) / 10 : '—'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}
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
