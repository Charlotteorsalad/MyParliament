import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportApi } from '../../api';
import { useApi } from '../../hooks';
import { useLanguage } from '../../contexts/LanguageContext';
import { LoadingSpinner } from '../../components/ui';
import { PieChart } from '../../components/charts/SimpleChart';

const TOP_VIEWED_LIMIT = 20;

const PRINT_RANGES = [
  { value: 'current', label: 'Current list' },
  { value: 'all', label: 'All in ranking' },
];

const formatNumber = (value) =>
  value == null || Number.isNaN(Number(value)) ? '—' : Number(value).toLocaleString();

export default function MostViewedTopicsReport() {
  const navigate = useNavigate();
  const { executeApiCall } = useApi();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [printPanel, setPrintPanel] = useState({ open: false, timeRange: 'current' });
  const [report, setReport] = useState({ topViewedTopics: [], pipelineId: 'pipeline5' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await executeApiCall(() =>
          reportApi.getTopicCategoriesReport('all', TOP_VIEWED_LIMIT)
        );
        if (!cancelled) {
          setReport({
            topViewedTopics: data?.topViewedTopics || [],
            pipelineId: data?.pipelineId || 'pipeline5',
          });
        }
      } catch (err) {
        console.error('Failed to fetch most viewed topics report:', err);
        if (!cancelled) setError('Failed to load most viewed topics report');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [executeApiCall]);

  const topics = report.topViewedTopics || [];
  const stats = useMemo(() => {
    const totalViews = topics.reduce((sum, t) => sum + (Number(t.views) || 0), 0);
    return {
      totalViews,
      topicCount: topics.length,
      topViews: topics[0] ? Number(topics[0].views) || 0 : 0,
    };
  }, [topics]);

  const generatePrintHTML = (timeRange) => {
    const now = new Date();
    const rangeLabel = PRINT_RANGES.find((r) => r.value === timeRange)?.label || timeRange;
    const fileDate = now.toISOString().split('T')[0];
    const documentTitle = `most_viewed_topics_report_${fileDate}`;
    const rows = topics
      .map(
        (topic, index) =>
          `<tr><td>#${index + 1}</td><td>${(topic.title || topic.category || 'Untitled topic').replace(/</g, '&lt;')}</td><td>${(topic.category || '—').replace(/</g, '&lt;')}</td><td>${formatNumber(topic.views)}</td></tr>`
      )
      .join('');
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${documentTitle}</title>
<style>
body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:20px}
h1{font-size:16px;margin:0 0 2px}h2{font-size:13px;margin:16px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px}
table{width:100%;border-collapse:collapse;margin-bottom:12px}
th{background:#f0f0f0;text-align:left;padding:6px 8px;border:1px solid #ccc;font-size:11px}
td{padding:5px 8px;border:1px solid #ddd;font-size:11px}
.header{background:#0ea5e9;color:#fff;padding:10px 14px;margin-bottom:16px;border-radius:4px}
.meta{font-size:10px;color:#fff;opacity:.85}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
.stat{border:1px solid #ddd;border-radius:6px;padding:10px}
.stat-label{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.04em}
.stat-value{font-size:16px;font-weight:700;margin-top:4px}
.print-actions{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid #d1d5db;padding:12px 20px;display:flex;justify-content:flex-end;gap:10px}
.print-btn{border:none;border-radius:8px;padding:10px 16px;font-size:12px;font-weight:600;cursor:pointer}
.print-btn-primary{background:#0ea5e9;color:#fff}
.print-btn-secondary{background:#f3f4f6;color:#4b5563}
@media print{.no-print{display:none!important}body{margin:0;padding:0}}
</style></head><body>
<div class="header">
  <h1>MY Parliament · Most Viewed Topics</h1>
  <div class="meta">View: ${rangeLabel} &nbsp;|&nbsp; Pipeline: ${report.pipelineId} &nbsp;|&nbsp; Generated: ${now.toLocaleString()}</div>
</div>
<div class="stats">
  <div class="stat"><div class="stat-label">Topics in ranking</div><div class="stat-value">${formatNumber(stats.topicCount)}</div></div>
  <div class="stat"><div class="stat-label">Total views</div><div class="stat-value">${formatNumber(stats.totalViews)}</div></div>
  <div class="stat"><div class="stat-label">Top topic views</div><div class="stat-value">${formatNumber(stats.topViews)}</div></div>
</div>
<h2>Top topics by views</h2>
<table>
  <thead><tr><th>Rank</th><th>Topic</th><th>Category</th><th>Views</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<p style="font-size:10px;color:#666;border-top:1px solid #eee;margin-top:20px;padding-top:6px">Generated from MY Parliament · Issue Portal viewCount.</p>
<div class="print-actions no-print">
  <button class="print-btn print-btn-secondary" onclick="window.close()">Close</button>
  <button class="print-btn print-btn-primary" onclick="window.print()">Proceed to Print</button>
</div>
</body></html>`;
  };

  const handlePrint = (timeRange) => {
    const html = generatePrintHTML(timeRange || printPanel.timeRange);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', 'width=900,height=700');
    if (!win) return;
    win.focus();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text={t('loadingReports')} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <h3 className="text-lg font-semibold text-red-800 mb-2">{t('errorLoadingReports')}</h3>
          <p className="text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Back to Reports
          </button>
        </div>
      </div>
    );
  }

  const donutData = topics.slice(0, 8).map((topic) => ({
    label: topic.title || topic.category || 'Untitled topic',
    value: Number(topic.views) || 0,
  }));

  return (
    <div className="min-h-screen bg-gray-50 min-w-0 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 w-full min-w-0">
        <div className="bg-gradient-to-br from-slate-50 via-sky-50 to-indigo-100 border border-slate-200 p-4 sm:p-6 lg:p-8 rounded-2xl mb-6 sm:mb-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => navigate('/reports')}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors shrink-0"
                aria-label={t('backToPreviousPage')}
              >
                <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800 leading-tight break-words">
                  {t('mostViewedTopics')}
                </h1>
                <p className="text-xs sm:text-sm lg:text-base text-slate-600 mt-1 break-words">
                  {t('mostViewedTopicsDescription')}
                </p>
              </div>
            </div>
            <div className="flex w-full sm:w-auto flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 relative shrink-0">
              <button
                type="button"
                onClick={() => navigate('/issues')}
                className="px-3 py-2 sm:py-1.5 text-xs font-medium text-sky-700 bg-white border border-sky-200 rounded-lg hover:bg-sky-50 transition-colors whitespace-nowrap"
              >
                Explore Issue Portal
              </button>
              <button
                type="button"
                onClick={() => setPrintPanel((p) => ({ ...p, open: !p.open }))}
                className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg transition-colors whitespace-nowrap"
                title="Print report"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                {t('print')}
              </button>
              {printPanel.open && (
                <div className="absolute left-0 right-0 sm:left-auto sm:right-0 top-full mt-2 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-full sm:w-56">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Select view</p>
                  <div className="space-y-1 mb-3">
                    {PRINT_RANGES.map((r) => (
                      <label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer hover:text-gray-900">
                        <input
                          type="radio"
                          name="print-range-most-viewed-topics"
                          value={r.value}
                          checked={printPanel.timeRange === r.value}
                          onChange={() => setPrintPanel((p) => ({ ...p, timeRange: r.value }))}
                          className="accent-indigo-600"
                        />
                        {r.label}
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        handlePrint(printPanel.timeRange);
                        setPrintPanel((p) => ({ ...p, open: false }));
                      }}
                      className="flex-1 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      {t('print')}
                    </button>
                    <button
                      onClick={() => setPrintPanel((p) => ({ ...p, open: false }))}
                      className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <p className="text-sm font-medium text-gray-600">{t('mostViewedTopics')}</p>
            <p className="text-2xl font-bold text-sky-600 mt-1">{formatNumber(stats.topicCount)}</p>
            <p className="text-sm text-gray-500 mt-2">Topics in this ranking</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <p className="text-sm font-medium text-gray-600">Total views</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{formatNumber(stats.totalViews)}</p>
            <p className="text-sm text-gray-500 mt-2">Issue Portal view count</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <p className="text-sm font-medium text-gray-600">Top topic views</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{formatNumber(stats.topViews)}</p>
            <p className="text-sm text-gray-500 mt-2">Highest single-topic views</p>
          </div>
        </div>

        {topics.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-6 sm:mb-8 min-w-0">
            <div className="p-4 sm:p-6 border-b border-gray-100">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 break-words">{t('topTopicsByViews')}</h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 break-words">
                Pipeline: {report.pipelineId} · Issue Portal viewCount
              </p>
            </div>
            <div className="p-4 sm:p-6 flex flex-col lg:flex-row gap-6 lg:gap-8 min-w-0">
              <div className="flex-shrink-0 flex justify-center lg:w-72 xl:w-80 max-w-full overflow-hidden">
                <PieChart
                  title={t('topTopicsByViews')}
                  data={donutData}
                  colors={['#0ea5e9', '#6366f1', '#22c55e', '#f97316', '#e11d48', '#8b5cf6', '#14b8a6', '#f59e0b']}
                />
              </div>
              <div className="flex-1 min-w-0 overflow-x-hidden">
                <div className="divide-y divide-gray-100">
                  {topics.map((topic, index) => (
                    <div
                      key={topic._id || index}
                      className="py-3 sm:py-4 lg:py-5 hover:bg-gray-50/50 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-w-0"
                    >
                      <div className="min-w-0 flex items-start gap-2 sm:gap-3 flex-1">
                        <span className="w-7 sm:w-8 text-sm sm:text-base font-bold text-gray-400 shrink-0">
                          #{index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm sm:text-base font-semibold text-gray-900 break-words">
                            {topic.title || topic.category || 'Untitled topic'}
                          </p>
                          {topic.category && (
                            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 break-words">{topic.category}</p>
                          )}
                        </div>
                      </div>
                      <div className="sm:text-right shrink-0 pl-9 sm:pl-0">
                        <p className="text-base sm:text-lg font-bold text-sky-600">{formatNumber(topic.views)}</p>
                        <p className="text-xs text-gray-500">views</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {topics.length === 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 sm:p-8 text-center min-w-0">
            <p className="text-sm sm:text-base text-gray-600 font-medium break-words">{t('noViewDataYet')}</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-2 break-words px-2">{t('mostViewedTopicsEmptyHint')}</p>
            <button
              type="button"
              onClick={() => navigate('/issues')}
              className="mt-4 px-4 py-2 text-sm font-medium bg-sky-600 text-white rounded-lg hover:bg-sky-700"
            >
              Explore Issue Portal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
