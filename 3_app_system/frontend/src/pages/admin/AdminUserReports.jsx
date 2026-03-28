import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api';
import { PieChart } from '../../components/charts/SimpleChart';

const TIME_RANGE_LABELS = {
  '24h': 'last 24 hours',
  '7days': 'last 7 days',
  '30days': 'last 30 days',
  '90days': 'last 90 days'
};

const FEEDBACK_CATEGORIES = ['Bug Report', 'UI / Theme', 'Feature Request', 'Performance', 'Security', 'General', 'Complaint', 'Suggestion', 'Other'];
const PRINT_RANGES = [
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7days', label: 'Last 7 Days' },
  { value: '30days', label: 'Last 30 Days' },
  { value: '90days', label: 'Last 90 Days' }
];

const EMPTY_USER_REPORTS_DATA = {
  totalUsers: 0,
  activeUsers: 0,
  userActivity: {
    bookmarks: 0,
    discussions: 0,
    learningResources: 0,
    feedback: 0,
    quizzesAnswered: 0
  },
  contentStats: {
    totalForumTopics: 0,
    totalForumPosts: 0,
    totalEduContent: 0,
    newForumTopics: 0,
    newForumPosts: 0
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

const AdminUserReports = ({
  embedded = false,
  externalData = null,
  externalLoading = false,
  selectedTimeRange: controlledSelectedTimeRange,
  autoRefresh: controlledAutoRefresh = false,
  onSelectedTimeRangeChange,
  onAutoRefreshChange,
  onRefreshData
}) => {
  const [loading, setLoading] = useState(true);
  const [feedbackStats, setFeedbackStats] = useState(null);
  const [surveySummary, setSurveySummary] = useState(null);
  const [latestSurveySnapshot, setLatestSurveySnapshot] = useState(null);
  const [userReportsData, setUserReportsData] = useState(EMPTY_USER_REPORTS_DATA);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7days');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [printPanel, setPrintPanel] = useState({ open: false, timeRange: '7days' });
  const useExternalData = embedded && externalData !== null;
  const selectedTimeRangeValue = useExternalData ? (controlledSelectedTimeRange || '7days') : selectedTimeRange;
  const autoRefreshValue = useExternalData ? controlledAutoRefresh : autoRefresh;
  const loadingState = useExternalData ? externalLoading : loading;
  const reportData = useExternalData ? (externalData?.userReportsData || EMPTY_USER_REPORTS_DATA) : userReportsData;
  const feedbackStatsData = useExternalData ? (externalData?.feedbackStats || null) : feedbackStats;
  const surveySummaryData = useExternalData ? (externalData?.surveySummary || null) : surveySummary;
  const latestSurveySnapshotData = useExternalData ? (externalData?.latestSurveySnapshot || null) : latestSurveySnapshot;
  const timeRangeLabel = TIME_RANGE_LABELS[selectedTimeRangeValue] || 'selected period';

  useEffect(() => {
    if (useExternalData) return undefined;

    fetchUserReportsData();

    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchUserReportsData, 30000); // Refresh every 30 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedTimeRange, autoRefresh, useExternalData]);

  useEffect(() => {
    setPrintPanel((prev) => ({ ...prev, timeRange: selectedTimeRangeValue }));
  }, [selectedTimeRangeValue]);

  const fetchUserReportsData = async () => {
    try {
      setLoading(true);

      const [userReportsResult, feedbackStatsResult, surveySummaryResult] = await Promise.allSettled([
        adminApi.getUserReportsData(selectedTimeRangeValue),
        adminApi.getFeedbackStats(selectedTimeRangeValue),
        adminApi.getSurveyReportSummary(selectedTimeRangeValue)
      ]);

      if (feedbackStatsResult.status === 'fulfilled') {
        setFeedbackStats(feedbackStatsResult.value?.data || null);
      } else {
        setFeedbackStats(null);
      }

      if (surveySummaryResult.status === 'fulfilled') {
        const summary = surveySummaryResult.value?.data || null;
        setSurveySummary(summary);

        const latestSnapshotSurveyId = summary?.latestSnapshotSurveyId;
        if (latestSnapshotSurveyId) {
          try {
            const snapshotResponse = await adminApi.getSurveyStats(latestSnapshotSurveyId, selectedTimeRangeValue);
            setLatestSurveySnapshot({
              surveyId: latestSnapshotSurveyId,
              title: summary?.latestSnapshotSurveyTitle || snapshotResponse.data?.title || '',
              ...snapshotResponse.data
            });
          } catch (snapshotError) {
            console.error('Failed to fetch latest survey snapshot:', snapshotError);
            setLatestSurveySnapshot(null);
          }
        } else {
          setLatestSurveySnapshot(null);
        }
      } else {
        setSurveySummary(null);
        setLatestSurveySnapshot(null);
      }

      if (userReportsResult.status === 'fulfilled') {
        setUserReportsData(userReportsResult.value.data);
        return;
      }

      console.error('Failed to fetch user reports from API:', userReportsResult.reason);
      
      // Fallback: show empty analytics instead of mock data
      const emptyData = {
        ...EMPTY_USER_REPORTS_DATA,
        userStats: {
          ...EMPTY_USER_REPORTS_DATA.userStats,
          avgSessionTime: 'No data',
          mostActiveDay: 'No data',
          peakHour: 'No data',
          totalSessions: 0,
          bounceRate: 'No data'
        }
      };

      setUserReportsData(emptyData);
    } catch (error) {
      console.error('Error fetching user reports data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePrintHTML = (timeRange) => {
    const rangeLabel = PRINT_RANGES.find((item) => item.value === timeRange)?.label || timeRange;
    const now = new Date();
    const generatedAt = now.toLocaleString();
    const fileDate = now.toISOString().split('T')[0];
    const documentTitle = `admin_content_engagement_user_reports_${fileDate}`;
    const totalFeedback = feedbackStatsData?.totalFeedback ?? 0;
    const feedbackCategoryCounts = Object.fromEntries(
      (feedbackStatsData?.categoryStats || []).map((item) => [item._id, item.count])
    );
    const surveyRows = (surveySummaryData?.topSurveys || []).slice(0, 5);

    const escapeHtml = (value) => String(value ?? '—')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const row = (cells) => `<tr>${cells.map((cell, index) => `<td${index === 0 ? ' style="font-weight:600"' : ''}>${escapeHtml(cell)}</td>`).join('')}</tr>`;
    const hrow = (cells) => `<tr>${cells.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr>`;
    const renderTable = (title, headers, rows) => (
      rows.length
        ? `<h2>${escapeHtml(title)}</h2><table>${hrow(headers)}${rows.map((cells) => row(cells)).join('')}</table>`
        : ''
    );
    const prettyLabel = (key) => String(key || '')
      .replace(/_/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (match) => match.toUpperCase());
    const isPrimitive = (value) => value == null || ['string', 'number', 'boolean'].includes(typeof value);
    const formatValue = (key, value) => {
      if (value == null || value === '') return '—';
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      if (typeof value === 'number') {
        if (/(pct|rate|percentage)$/i.test(key)) return `${value.toFixed(1)}%`;
        return Number.isInteger(value)
          ? value.toLocaleString()
          : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
      }
      return String(value);
    };
    const renderKeyValueTable = (title, source, { preferredKeys = [], labelMap = {}, skipKeys = [] } = {}) => {
      if (!source || typeof source !== 'object') return '';
      const used = new Set([...preferredKeys, ...skipKeys]);
      const preferredRows = preferredKeys
        .filter((key) => Object.prototype.hasOwnProperty.call(source, key) && isPrimitive(source[key]))
        .map((key) => [labelMap[key] || prettyLabel(key), formatValue(key, source[key])]);
      const extraRows = Object.keys(source)
        .filter((key) => !used.has(key) && isPrimitive(source[key]))
        .map((key) => [labelMap[key] || prettyLabel(key), formatValue(key, source[key])]);
      return renderTable(title, ['Metric', 'Value'], [...preferredRows, ...extraRows]);
    };
    const renderObjectTable = (title, items, { preferredKeys = [], labelMap = {}, includeKeys = null } = {}) => {
      if (!Array.isArray(items) || items.length === 0) return '';
      const columnsSet = new Set();
      items.forEach((item) => {
        Object.entries(item || {}).forEach(([key, value]) => {
          if (isPrimitive(value)) columnsSet.add(key);
        });
      });
      let columns = includeKeys
        ? includeKeys.filter((key) => columnsSet.has(key))
        : [...preferredKeys.filter((key) => columnsSet.has(key)), ...[...columnsSet].filter((key) => !preferredKeys.includes(key))];
      if (columns.length === 0) return '';
      const rows = items.map((item) => columns.map((key) => formatValue(key, item?.[key])));
      return renderTable(title, columns.map((key) => labelMap[key] || prettyLabel(key)), rows);
    };

    const feedbackRows = FEEDBACK_CATEGORIES.map((category) => {
      const count = feedbackCategoryCounts[category] || 0;
      const pct = totalFeedback > 0 ? `${((count / totalFeedback) * 100).toFixed(1)}%` : '0.0%';
      return [category, count, pct];
    });

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(documentTitle)}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:20px;padding-bottom:84px}
    h1{font-size:16px;margin:0 0 2px}
    h2{font-size:13px;margin:16px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px}
    table{width:100%;border-collapse:collapse;margin-bottom:12px}
    th{background:#f0f0f0;text-align:left;padding:5px 8px;border:1px solid #ccc;font-size:11px}
    td{padding:4px 8px;border:1px solid #ddd;font-size:11px;vertical-align:top}
    .header{background:#1a7a4a;color:#fff;padding:10px 14px;margin-bottom:16px;border-radius:4px}
    .header h1{color:#fff;font-size:15px}
    .meta{font-size:10px;color:#fff;opacity:.85}
    .print-actions{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid #d1d5db;padding:12px 20px;display:flex;justify-content:flex-end;gap:10px}
    .print-btn{border:none;border-radius:8px;padding:10px 16px;font-size:12px;font-weight:600;cursor:pointer}
    .print-btn-primary{background:#16a34a;color:#fff}
    .print-btn-secondary{background:#f3f4f6;color:#4b5563}
    @media print {.no-print{display:none!important}}
    @media print{body{margin:0}}
  </style>
</head>
<body>
  <div class="header">
    <h1>MY Parliament · User Reports</h1>
    <div class="meta">Period: ${escapeHtml(rangeLabel)} &nbsp;|&nbsp; Generated: ${escapeHtml(generatedAt)}</div>
  </div>
  ${renderKeyValueTable('User Activity Summary', reportData?.userActivity || {}, {
    preferredKeys: ['bookmarks', 'discussions', 'learningResources', 'quizzesAnswered', 'feedback'],
    labelMap: {
      bookmarks: 'Total User Bookmarks',
      discussions: 'Active Discussions',
      learningResources: 'Learning Resources',
      quizzesAnswered: 'Quizzes Answered',
      feedback: 'User Feedback'
    }
  })}
  ${renderKeyValueTable('Content Statistics', reportData?.contentStats || {}, {
    preferredKeys: ['totalForumTopics', 'totalForumPosts', 'totalEduContent', 'newForumTopics', 'newForumPosts'],
    labelMap: {
      totalForumTopics: 'Total Forum Topics',
      totalForumPosts: 'Total Forum Posts / Replies',
      totalEduContent: 'Total Education Content',
      newForumTopics: 'New Forum Topics (Period)',
      newForumPosts: 'New Forum Posts (Period)'
    }
  })}
  ${renderKeyValueTable('User Statistics', reportData?.userStats || {}, {
    preferredKeys: ['avgSessionTime', 'avgBookmarksPerUser', 'avgDiscussionsPerUser', 'mostActiveDay', 'peakHour', 'totalSessions', 'bounceRate'],
    labelMap: {
      avgSessionTime: 'Average Session Time',
      avgBookmarksPerUser: 'Average Bookmarks Per User',
      avgDiscussionsPerUser: 'Average Discussions Per User',
      mostActiveDay: 'Most Active Day',
      peakHour: 'Peak Hour',
      totalSessions: 'Total Sessions',
      bounceRate: 'Bounce Rate'
    }
  })}
  ${renderTable('Feedback Categories', ['Category', 'Count', 'Share'], feedbackRows)}
  ${renderKeyValueTable('Feedback Summary', feedbackStatsData || {}, {
    preferredKeys: ['totalFeedback', 'openFeedback', 'responseCoveragePct', 'oldestOpenAgeDays', 'pendingFeedback', 'inProgressFeedback', 'resolvedFeedback', 'archivedFeedback', 'respondedFeedback', 'unrespondedFeedback'],
    labelMap: {
      totalFeedback: 'Total Feedback',
      openFeedback: 'Open Feedback',
      responseCoveragePct: 'Response Coverage',
      oldestOpenAgeDays: 'Oldest Open Age (Days)',
      pendingFeedback: 'Pending',
      inProgressFeedback: 'In Progress',
      resolvedFeedback: 'Resolved',
      archivedFeedback: 'Archived',
      respondedFeedback: 'Responded Feedback',
      unrespondedFeedback: 'Unresponded Feedback'
    },
    skipKeys: ['categoryStats', 'priorityStats', 'oldestOpenItem', 'range']
  })}
  ${renderKeyValueTable('Survey Summary', {
    ...(surveySummaryData || {}),
    latestSnapshotResponses: latestSurveySnapshotData?.totalResponses ?? 0
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
  })}
  ${renderTable(
    'Top Surveys by Responses',
    ['Survey', 'Responses', 'Questions'],
    surveyRows.map((survey) => [survey?.title || 'Untitled', survey?.responseCount ?? 0, survey?.questionsCount ?? 0])
  )}
  ${renderObjectTable('Survey Snapshot Question Stats', latestSurveySnapshotData?.questionStats || [], {
    preferredKeys: ['question', 'type', 'responses', 'average'],
    labelMap: {
      question: 'Question',
      type: 'Type',
      responses: 'Responses',
      average: 'Average'
    },
    includeKeys: ['question', 'type', 'responses', 'average']
  })}
  <p style="font-size:10px;color:#666;border-top:1px solid #eee;margin-top:20px;padding-top:6px">This report was generated from the MY Parliament User Reports dashboard using live dashboard data.</p>
  <div class="print-actions no-print">
    <button class="print-btn print-btn-secondary" onclick="window.close()">Close</button>
    <button class="print-btn print-btn-primary" onclick="window.print()">Proceed to Print</button>
  </div>
</body>
</html>`;

    return html;
  };

  const handlePrint = (timeRange) => {
    const html = generatePrintHTML(timeRange);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', 'width=980,height=760');
    if (!win) return;
    win.focus();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const PrintButton = () => {
    const isOpen = printPanel.open;
    return (
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setPrintPanel((prev) => (prev.open ? { ...prev, open: false } : { ...prev, open: true }))}
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
              {PRINT_RANGES.map((range) => (
                <label key={range.value} className="flex items-center gap-2 text-sm cursor-pointer hover:text-gray-900">
                  <input
                    type="radio"
                    name="user-report-print-range"
                    value={range.value}
                    checked={printPanel.timeRange === range.value}
                    onChange={() => setPrintPanel((prev) => ({ ...prev, timeRange: range.value }))}
                    className="accent-green-600"
                  />
                  {range.label}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  handlePrint(printPanel.timeRange);
                  setPrintPanel((prev) => ({ ...prev, open: false }));
                }}
                className="flex-1 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Print
              </button>
              <button
                onClick={() => setPrintPanel((prev) => ({ ...prev, open: false }))}
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

  const renderHeader = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {!embedded && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Activity Reports</h1>
            <p className="text-gray-600 mt-2">Comprehensive view of user engagement and platform interactions</p>
          </div>
        )}
        <div className="flex items-center space-x-4">
          <PrintButton />
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Time Range:</label>
            <select
              value={selectedTimeRangeValue}
              onChange={(e) => (
                useExternalData
                  ? onSelectedTimeRangeChange?.(e.target.value)
                  : setSelectedTimeRange(e.target.value)
              )}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
            </select>
          </div>
          <button
            onClick={() => (
              useExternalData
                ? onAutoRefreshChange?.(!autoRefreshValue)
                : setAutoRefresh(!autoRefreshValue)
            )}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              autoRefreshValue 
                ? 'bg-green-100 text-green-700 border border-green-300' 
                : 'bg-gray-100 text-gray-700 border border-gray-300'
            }`}
          >
            {autoRefreshValue ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
          <button
            onClick={useExternalData ? onRefreshData : fetchUserReportsData}
            disabled={loadingState}
            className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {loadingState ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderQuickStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total User Bookmarks</p>
            <p className="text-3xl font-bold text-indigo-600">{reportData.userActivity.bookmarks}</p>
            <p className="text-xs text-gray-500 mt-1">Across all users</p>
          </div>
          <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Active Discussions</p>
            <p className="text-3xl font-bold text-emerald-600">{reportData.userActivity.discussions}</p>
            <p className="text-xs text-gray-500 mt-1">User-generated content</p>
          </div>
          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Learning Resources</p>
            <p className="text-3xl font-bold text-purple-600">{reportData.userActivity.learningResources ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Education content views</p>
          </div>
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Quizzes Answered</p>
            <p className="text-3xl font-bold text-emerald-600">{reportData.userActivity.quizzesAnswered ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Quiz submissions in period</p>
          </div>
          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">User Feedback</p>
            <p className="text-3xl font-bold text-orange-600">{reportData.userActivity.feedback}</p>
            <p className="text-xs text-gray-500 mt-1">Platform improvements</p>
          </div>
          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
        </div>
      </div>

      {/* Content stats row */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Forum Topics</p>
            <p className="text-3xl font-bold text-teal-600">{reportData.contentStats?.totalForumTopics ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">+{reportData.contentStats?.newForumTopics ?? 0} in period</p>
          </div>
          <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Forum Posts / Replies</p>
            <p className="text-3xl font-bold text-cyan-600">{reportData.contentStats?.totalForumPosts ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">+{reportData.contentStats?.newForumPosts ?? 0} in period</p>
          </div>
          <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Education Content</p>
            <p className="text-3xl font-bold text-violet-600">{reportData.contentStats?.totalEduContent ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Total resources available</p>
          </div>
          <div className="w-12 h-12 bg-violet-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFeedbackSurveyStats = () => {
    const totalFeedback = feedbackStatsData?.totalFeedback ?? 0;
    const feedbackCategoryCounts = Object.fromEntries(
      (feedbackStatsData?.categoryStats || []).map((item) => [item._id, item.count])
    );
    const feedbackIssuePercentageData = FEEDBACK_CATEGORIES
      .map((category) => ({
        label: category,
        value: totalFeedback > 0
          ? Number((((feedbackCategoryCounts[category] || 0) / totalFeedback) * 100).toFixed(1))
          : 0
      }));

    const topFeedbackIssue = FEEDBACK_CATEGORIES
      .map((category) => ({
        label: category,
        count: feedbackCategoryCounts[category] || 0
      }))
      .sort((a, b) => b.count - a.count)[0];
    const topFeedbackIssueShare = totalFeedback > 0 && topFeedbackIssue
      ? Number(((topFeedbackIssue.count / totalFeedback) * 100).toFixed(1))
      : 0;
    const openRate = totalFeedback > 0
      ? Number((((feedbackStatsData?.openFeedback ?? 0) / totalFeedback) * 100).toFixed(1))
      : 0;

    const surveyChartData = (surveySummaryData?.topSurveys || []).length
      ? (surveySummaryData.topSurveys || []).slice(0, 5).map((survey) => ({
          label: survey.title,
          value: survey.responseCount ?? 0
        }))
      : [
          { label: 'Survey 1', value: 0 },
          { label: 'Survey 2', value: 0 },
          { label: 'Survey 3', value: 0 }
        ];

    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-3 sm:gap-4">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-900">Feedback Report</h3>
              <p className="text-sm text-gray-500">Issue type percentage for {timeRangeLabel}</p>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <p className="text-2xl font-bold text-orange-600">{totalFeedback}</p>
              <p className="text-xs text-gray-500">Total feedback</p>
            </div>
          </div>
          {feedbackStatsData ? (
            <>
              <PieChart
                title="Feedback Categories (%)"
                data={feedbackIssuePercentageData}
                colors={['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#9CA3AF']}
              />
              {totalFeedback > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                  <div className="rounded-lg bg-orange-50 p-3 text-center">
                    <p className="text-sm font-bold text-orange-600 break-words">{topFeedbackIssue?.label || '-'}</p>
                    <p className="text-xs text-gray-500">Top Issue</p>
                  </div>
                  <div className="rounded-lg bg-green-50 p-3 text-center">
                    <p className="text-lg font-bold text-green-600">{topFeedbackIssueShare}%</p>
                    <p className="text-xs text-gray-500">Top Share</p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-3 text-center">
                    <p className="text-lg font-bold text-red-600">{openRate}%</p>
                    <p className="text-xs text-gray-500">Open Rate</p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center">
                  <p className="text-sm font-medium text-gray-700">No feedback submissions in {timeRangeLabel}.</p>
                  <p className="text-xs text-gray-500 mt-1">The chart stays visible so the category layout still matches the user and admin feedback pages.</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">Loading feedback stats...</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-3 sm:gap-4">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-900">Survey Report</h3>
              <p className="text-sm text-gray-500">Response volume for {timeRangeLabel}</p>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <p className="text-2xl font-bold text-purple-600">{surveySummaryData?.totalResponses ?? 0}</p>
              <p className="text-xs text-gray-500">Total responses</p>
            </div>
          </div>
          {surveySummaryData ? (
            <>
              <PieChart
                title="Survey Response Share (%)"
                data={surveyChartData}
                colors={['#8B5CF6', '#6366F1', '#A855F7', '#EC4899', '#94A3B8']}
              />
              {(surveySummaryData?.totalResponses ?? 0) > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                  <div className="rounded-lg bg-purple-50 p-3 text-center">
                    <p className="text-lg font-bold text-purple-600">{surveySummaryData.activeSurveys ?? 0}</p>
                    <p className="text-xs text-gray-500">Active</p>
                  </div>
                  <div className="rounded-lg bg-indigo-50 p-3 text-center">
                    <p className="text-lg font-bold text-indigo-600">{surveySummaryData.surveysWithResponses ?? 0}</p>
                    <p className="text-xs text-gray-500">With Responses</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <p className="text-lg font-bold text-gray-900">{latestSurveySnapshotData?.totalResponses ?? 0}</p>
                    <p className="text-xs text-gray-500">Latest Snapshot</p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center">
                  <p className="text-sm font-medium text-gray-700">No survey responses in {timeRangeLabel}.</p>
                  <p className="text-xs text-gray-500 mt-1">The chart stays visible so the report layout remains consistent.</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">Loading survey stats...</p>
          )}
        </div>
      </div>
    );
  };

  if (!embedded && loadingState) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading user reports data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'min-h-screen bg-gray-50'}>
      <div className={embedded ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}>
        {!embedded && renderHeader()}
        {!embedded && renderQuickStats()}
        {renderFeedbackSurveyStats()}
      </div>
    </div>
  );
};

export default AdminUserReports;
