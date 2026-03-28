import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportApi } from '../../api';
import { useApi } from '../../hooks';
import { useLanguage } from '../../contexts/LanguageContext';
import { LoadingSpinner } from '../../components/ui';

const PRINT_RANGES = [
    { value: 'current', label: 'Current Distribution' },
    { value: 'all', label: 'All Categories' },
];

const formatNumber = (value) => (
    value == null || Number.isNaN(Number(value)) ? '—' : Number(value).toLocaleString()
);

const formatPercent = (value) => (
    value == null || Number.isNaN(Number(value)) ? '—' : `${Number(value).toFixed(0)}%`
);

export default function TopicCategoriesReport() {
    const navigate = useNavigate();
    const { executeApiCall } = useApi();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [printPanel, setPrintPanel] = useState({ open: false, timeRange: 'current' });
    const [report, setReport] = useState({ totalTopics: 0, categories: [], pipelineId: 'pipeline5' });

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setLoading(true);
                setError(null);
                const data = await executeApiCall(() => reportApi.getTopicCategoriesReport('all'));
                if (!cancelled) {
                    setReport({
                        totalTopics: data?.totalTopics || 0,
                        categories: data?.categories || [],
                        pipelineId: data?.pipelineId || 'pipeline5',
                    });
                }
            } catch (err) {
                console.error('Failed to fetch topic categories report:', err);
                if (!cancelled) setError('Failed to load topic categories report');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, [executeApiCall]);

    const stats = useMemo(() => {
        const items = report.categories || [];
        const topCategory = items[0] || null;
        const concentratedShare = items.slice(0, 3).reduce((sum, item) => sum + (Number(item.percentage) || 0), 0);

        return {
            totalTopics: report.totalTopics || 0,
            categoryCount: items.length,
            topCategory,
            concentratedShare,
        };
    }, [report]);

    const generatePrintHTML = (timeRange) => {
        const now = new Date();
        const rangeLabel = PRINT_RANGES.find(r => r.value === timeRange)?.label || timeRange;
        const fileDate = now.toISOString().split('T')[0];
        const documentTitle = `topic_categories_report_${fileDate}`;
        const rows = report.categories.map((category, index) => `
            <tr>
                <td>#${index + 1}</td>
                <td>${category.name || '—'}</td>
                <td>${formatNumber(category.count)}</td>
                <td>${formatPercent(category.percentage)}</td>
                <td>${formatNumber(category.views)}</td>
                <td>${formatNumber(category.bookmarks)}</td>
            </tr>
        `).join('');

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${documentTitle}</title>
    <style>
        body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:20px}
        h1{font-size:16px;margin:0 0 2px}
        h2{font-size:13px;margin:16px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px}
        table{width:100%;border-collapse:collapse;margin-bottom:12px}
        th{background:#f0f0f0;text-align:left;padding:6px 8px;border:1px solid #ccc;font-size:11px}
        td{padding:5px 8px;border:1px solid #ddd;font-size:11px;vertical-align:top}
        .header{background:#2563eb;color:#fff;padding:10px 14px;margin-bottom:16px;border-radius:4px}
        .meta{font-size:10px;color:#fff;opacity:.85}
        .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}
        .stat{border:1px solid #ddd;border-radius:6px;padding:10px}
        .stat-label{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.04em}
        .stat-value{font-size:16px;font-weight:700;margin-top:4px}
        .print-actions{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid #d1d5db;padding:12px 20px;display:flex;justify-content:flex-end;gap:10px}
        .print-btn{border:none;border-radius:8px;padding:10px 16px;font-size:12px;font-weight:600;cursor:pointer}
        .print-btn-primary{background:#2563eb;color:#fff}
        .print-btn-secondary{background:#f3f4f6;color:#4b5563}
        @media print {.no-print{display:none!important} body{margin:0;padding:0}}
    </style>
</head>
<body>
    <div class="header">
        <h1>MY Parliament · Topic Categories Report</h1>
        <div class="meta">View: ${rangeLabel} &nbsp;|&nbsp; Pipeline: ${report.pipelineId || 'pipeline5'} &nbsp;|&nbsp; Generated: ${now.toLocaleString()}</div>
    </div>
    <div class="stats">
        <div class="stat"><div class="stat-label">Total Topics</div><div class="stat-value">${formatNumber(stats.totalTopics)}</div></div>
        <div class="stat"><div class="stat-label">Categories</div><div class="stat-value">${formatNumber(stats.categoryCount)}</div></div>
        <div class="stat"><div class="stat-label">Top Category</div><div class="stat-value">${stats.topCategory?.name || '—'}</div></div>
        <div class="stat"><div class="stat-label">Top 3 Share</div><div class="stat-value">${formatPercent(stats.concentratedShare)}</div></div>
    </div>
    <h2>Topic Categories Distribution</h2>
    <table>
        <thead>
            <tr>
                <th>Rank</th>
                <th>Category</th>
                <th>Topics</th>
                <th>Share</th>
                <th>Views</th>
                <th>Bookmarks</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>
    <div class="print-actions no-print">
        <button class="print-btn print-btn-secondary" onclick="window.close()">Close</button>
        <button class="print-btn print-btn-primary" onclick="window.print()">Proceed to Print</button>
    </div>
</body>
</html>`;
    };

    const handlePrint = (timeRange) => {
        const html = generatePrintHTML(timeRange || printPanel.timeRange);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank', 'width=1000,height=760');
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
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 min-w-0 overflow-x-hidden">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 w-full min-w-0">
                <div className="bg-gradient-to-br from-slate-50 via-sky-50 to-indigo-100 border border-slate-200 p-4 sm:p-6 lg:p-8 rounded-2xl mb-6 sm:mb-8 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                    <button 
                                type="button"
                        onClick={() => navigate('/reports')}
                        className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                                aria-label={t('backToPreviousPage')}
                    >
                        <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                            <div className="min-w-0 flex-1">
                                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800 leading-tight break-words">{t('topicCategoriesDistribution')}</h1>
                                <p className="text-xs sm:text-sm lg:text-base text-slate-600 mt-1 break-words">
                                    Real-time category mix across active Issue Portal topics.
                                </p>
                            </div>
                        </div>

                        <div className="flex w-full sm:w-auto flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 relative shrink-0">
                            <button
                                type="button"
                                onClick={() => navigate('/issues')}
                                className="px-3 py-2 sm:py-1.5 text-xs font-medium text-sky-700 bg-white border border-sky-200 rounded-lg hover:bg-sky-50 transition-colors whitespace-nowrap"
                            >
                                Open Issue Portal
                            </button>
                            <button
                                type="button"
                                onClick={() => setPrintPanel(p => ({ ...p, open: !p.open }))}
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
                                        {PRINT_RANGES.map(r => (
                                            <label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer hover:text-gray-900">
                                                <input
                                                    type="radio"
                                                    name="print-range-topic-categories"
                                                    value={r.value}
                                                    checked={printPanel.timeRange === r.value}
                                                    onChange={() => setPrintPanel(p => ({ ...p, timeRange: r.value }))}
                                                    className="accent-indigo-600"
                                                />
                                                {r.label}
                                            </label>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { handlePrint(printPanel.timeRange); setPrintPanel(p => ({ ...p, open: false })); }}
                                            className="flex-1 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                        >
                                            {t('print')}
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
            </div>
        </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                        <p className="text-sm font-medium text-gray-600">Total Topics</p>
                        <p className="text-2xl font-bold text-slate-800 mt-1">{formatNumber(stats.totalTopics)}</p>
                        <p className="text-sm text-gray-500 mt-2">Active issues currently visible in the Issue Portal</p>
                    </div>
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                        <p className="text-sm font-medium text-gray-600">Categories</p>
                        <p className="text-2xl font-bold text-sky-600 mt-1">{formatNumber(stats.categoryCount)}</p>
                        <p className="text-sm text-gray-500 mt-2">Distinct categories in the current pipeline</p>
                    </div>
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                        <p className="text-sm font-medium text-gray-600">Top Category</p>
                        <p className="text-2xl font-bold text-indigo-600 mt-1 break-words">{stats.topCategory?.name || '—'}</p>
                        <p className="text-sm text-gray-500 mt-2">
                            {stats.topCategory ? `${formatPercent(stats.topCategory.percentage)} of all active topics` : 'No category data available'}
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                        <p className="text-sm font-medium text-gray-600">Top 3 Share</p>
                        <p className="text-2xl font-bold text-amber-600 mt-1">{formatPercent(stats.concentratedShare)}</p>
                        <p className="text-sm text-gray-500 mt-2">How concentrated discussion is across the leading categories</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden min-w-0">
                    <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 break-words">{t('topicCategoriesDistribution')}</h2>
                            <p className="text-xs sm:text-sm text-gray-500 mt-1 break-words">
                                Ranked by share of active Issue Portal topics in pipeline `{report.pipelineId}`.
                            </p>
                        </div>
                        <span className="text-sm text-gray-500 shrink-0">{report.categories.length} items</span>
                    </div>

                    <div className="divide-y divide-gray-100 overflow-x-hidden">
                        {report.categories.length > 0 ? report.categories.map((category, index) => (
                            <div key={`${category.name}-${index}`} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors min-w-0">
                                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 xl:gap-6">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                                            <span className="w-8 sm:w-10 text-base sm:text-lg font-bold text-gray-400 shrink-0">#{index + 1}</span>
                                            <div className="w-4 h-4 mt-1 rounded-full flex-shrink-0 bg-slate-200">
                                                <div className={`w-4 h-4 rounded-full ${category.color || 'bg-sky-500'}`} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-base sm:text-lg font-semibold text-gray-900 leading-snug break-words">{category.name || 'Unknown Category'}</p>
                                                <p className="text-sm text-gray-500 mt-1">
                                                    {formatNumber(category.count)} topics in this category
                                                </p>
                                                <div className="mt-3">
                                                    <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                                                        <span>Distribution Share</span>
                                                        <span className="font-semibold text-sky-600">{formatPercent(category.percentage)}</span>
                                                    </div>
                                                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${category.color || 'bg-sky-500'}`}
                                                            style={{ width: `${Math.min(100, Math.max(0, Number(category.percentage) || 0))}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                </div>
                            </div>

                                    <div className="w-full xl:w-auto xl:max-w-xs grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 shrink-0">
                                        <div className="bg-sky-50 rounded-xl p-4 text-center">
                                            <p className="text-xs uppercase tracking-wide text-sky-500 font-semibold">Topics</p>
                                            <p className="text-xl font-bold text-sky-700 mt-1">{formatNumber(category.count)}</p>
                                        </div>
                                        <div className="bg-indigo-50 rounded-xl p-4 text-center">
                                            <p className="text-xs uppercase tracking-wide text-indigo-500 font-semibold">Share</p>
                                            <p className="text-xl font-bold text-indigo-700 mt-1">{formatPercent(category.percentage)}</p>
                                        </div>
                                        <div className="bg-amber-50 rounded-xl p-4 text-center">
                                            <p className="text-xs uppercase tracking-wide text-amber-500 font-semibold">Views</p>
                                            <p className="text-xl font-bold text-amber-700 mt-1">{formatNumber(category.views)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="p-8 text-center text-gray-500">No topic category data available.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
