import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks';
import { useApi } from '../../hooks';
import { reportApi } from '../../api';
import { useLanguage } from '../../contexts/LanguageContext';
import { getImageSource, handleImageError } from '../../utils/imageUtils';
import { PieChart } from '../../components/charts/SimpleChart';
import LoginConfirmationModal from '../../components/LoginConfirmationModal';

export default function ReportModule() {
    const DEFAULT_REPORT_RANGE = '30d';
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [loginAction, setLoginAction] = useState('');
    const [reportData, setReportData] = useState({
        topics: { total: 0, active: 0, resolved: 0 },
        mps: { total: 0, active: 0, topPerformers: [] },
        forum: { totalDiscussions: 0, totalReplies: 0, activeUsers: 0 },
        feedback: { total: 0, satisfaction: 0, categories: {} },
        education: { totalResources: 0, totalViews: 0, completionRate: 0, popularTopics: [] },
        topicCategories: [],
        topicCategoriesMeta: { source: 'issue-portal-current', totalTopics: 0 },
        mostViewedTopics: []
    });
    const [userActivity, setUserActivity] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [mpViewMode, setMpViewMode] = useState('current'); // 'current' | 'all'
    const [allTimeTopMps, setAllTimeTopMps] = useState([]);
    const [allTimeLoading, setAllTimeLoading] = useState(false);
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { executeApiCall } = useApi();
    const { t } = useLanguage();

    const fetchReportData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [dashboardData, currentTopicCategoriesData, userData] = await Promise.all([
                executeApiCall(() => reportApi.getDashboardData(DEFAULT_REPORT_RANGE)),
                executeApiCall(() => reportApi.getTopicCategoriesReport('all')),
                isAuthenticated ? executeApiCall(() => reportApi.getUserReportsSummary()) : Promise.resolve(null)
            ]);

            setReportData({
                topics: dashboardData.platform?.topics || { total: 0, active: 0, resolved: 0 },
                mps: {
                    total: dashboardData.platform?.mps?.total || 0,
                    active: dashboardData.platform?.mps?.active || 0,
                    topPerformers: dashboardData.mpPerformance?.topPerformers || []
                },
                forum: dashboardData.forum || { totalDiscussions: 0, totalReplies: 0, activeUsers: 0 },
                feedback: dashboardData.feedback || { total: 0, satisfaction: 0, categories: {} },
                education: dashboardData.education || { totalResources: 0, totalViews: 0, completionRate: 0, popularTopics: [] },
                topicCategories: currentTopicCategoriesData?.categories || [],
                topicCategoriesMeta: {
                    source: 'issue-portal-current',
                    totalTopics: currentTopicCategoriesData?.totalTopics || 0
                },
                mostViewedTopics: currentTopicCategoriesData?.topViewedTopics || []
            });

            if (userData) setUserActivity(userData);
        } catch (err) {
            console.error('Failed to fetch report data:', err);
            setError('Failed to load report data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReportData();
    }, [isAuthenticated]);

    const handleMpViewChange = async (mode) => {
        if (mode === mpViewMode) return;
        setMpViewMode(mode);
        if (mode === 'all' && allTimeTopMps.length === 0) {
            try {
                setAllTimeLoading(true);
                const data = await executeApiCall(() => reportApi.getMPPerformanceReport(5, 'all'));
                setAllTimeTopMps(data?.topPerformers || []);
            } catch (err) {
                console.error('Failed to fetch all-time MP performance:', err);
            } finally {
                setAllTimeLoading(false);
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="inline-flex items-center px-4 py-2 font-semibold text-sm shadow rounded-md text-indigo-500 bg-white">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t('loadingReports')}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md mx-auto text-center">
                    <h3 className="text-lg font-semibold text-red-800 mb-2">{t('errorLoadingReports')}</h3>
                    <p className="text-red-600">{error}</p>
                </div>
            </div>
        );
    }

    const neverLabel = t('never');
    const visibleTopicCategories = reportData.topicCategories || [];
    const topicCategoriesMeta = reportData.topicCategoriesMeta || {
        source: 'issue-portal-current',
        totalTopics: 0
    };
    const mostViewedTopics = reportData.mostViewedTopics || [];
    const getTopMpRankClasses = (rank) => {
        if (rank === 0) {
            return {
                badge: 'bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-400 text-amber-950 shadow-amber-200/70',
                ring: 'ring-amber-200',
                bar: 'from-amber-400 via-yellow-400 to-orange-400',
            };
        }
        if (rank === 1) {
            return {
                badge: 'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 text-slate-800 shadow-slate-200/70',
                ring: 'ring-slate-200',
                bar: 'from-slate-300 via-slate-400 to-slate-500',
            };
        }
        if (rank === 2) {
            return {
                badge: 'bg-gradient-to-br from-orange-300 via-amber-500 to-orange-600 text-white shadow-orange-200/70',
                ring: 'ring-orange-200',
                bar: 'from-orange-400 via-amber-500 to-orange-600',
            };
        }
        return {
            badge: 'bg-gradient-to-br from-indigo-100 via-violet-100 to-fuchsia-100 text-indigo-700 shadow-indigo-100/70',
            ring: 'ring-indigo-100',
            bar: 'from-indigo-400 via-violet-400 to-fuchsia-400',
        };
    };


    // ── Print utilities ──────────────────────────────────────────────────────
    const PRINT_RANGES = [
        { value: 'week', label: 'This Week' },
        { value: 'month', label: 'This Month' },
        { value: 'year', label: 'This Year' },
        { value: 'all', label: 'All Time' },
    ];

    const generatePrintHTML = (timeRange) => {
        const now = new Date();
        const rangeLabel = PRINT_RANGES.find(r => r.value === timeRange)?.label || timeRange;
        const fileDate = now.toISOString().split('T')[0];
        const documentTitle = `user_reports_${fileDate}`;
        const rd = reportData;
        const ua = userActivity;

        const css = `body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:20px}
h1{font-size:16px;margin:0 0 2px}h2{font-size:13px;margin:16px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px}
table{width:100%;border-collapse:collapse;margin-bottom:12px}
th{background:#f0f0f0;text-align:left;padding:5px 8px;border:1px solid #ccc;font-size:11px}
td{padding:4px 8px;border:1px solid #ddd;font-size:11px}
.header{background:#4f46e5;color:#fff;padding:10px 14px;margin-bottom:16px;border-radius:4px}
.header h1{color:#fff;font-size:15px}.meta{font-size:10px;color:#fff;opacity:.85}
@media print{body{margin:0}}`;

        const row = (cells) => `<tr>${cells.map((c, i) => `<td${i === 0 ? ' style="font-weight:600"' : ''}>${c ?? '—'}</td>`).join('')}</tr>`;
        const hrow = (cells) => `<tr>${cells.map(c => `<th>${c}</th>`).join('')}</tr>`;

        let body = '';

        body += `<h2>Platform Overview</h2>
<table>${hrow(['Category', 'Metric', 'Value'])}
${row(['Topics', 'Total Issues', rd.topics.total?.toLocaleString()])}
${row(['Topics', 'Active', rd.topics.active?.toLocaleString()])}
${row(['Topics', 'Resolved', rd.topics.resolved?.toLocaleString()])}
${row(['MPs', 'Total MPs', rd.mps.total?.toLocaleString()])}
${row(['MPs', 'Active MPs', rd.mps.active?.toLocaleString()])}
${row(['Forum', 'Total Discussions', rd.forum.totalDiscussions?.toLocaleString()])}
${row(['Forum', 'Total Replies', rd.forum.totalReplies?.toLocaleString()])}
${row(['Forum', 'Active Users', rd.forum.activeUsers?.toLocaleString()])}
${row(['Education', 'Total Resources', rd.education.totalResources?.toLocaleString()])}
${row(['Education', 'Total Views', rd.education.totalViews?.toLocaleString()])}
${row(['Education', 'Completion Rate', rd.education.completionRate != null ? `${rd.education.completionRate}%` : '—'])}
${row(['Feedback', 'Total Submitted', rd.feedback.total?.toLocaleString()])}
${row(['Feedback', 'Satisfaction', rd.feedback.satisfaction != null ? `${rd.feedback.satisfaction}%` : '—'])}
</table>`;

        if (rd.topicCategories.length > 0) {
            body += `<h2>Topic Categories Distribution</h2>
<table>${hrow(['Category', 'Count', 'Percentage'])}`;
            rd.topicCategories.forEach(cat => {
                body += row([cat.name, cat.count, `${cat.percentage}%`]);
            });
            body += '</table>';
        }

        if (rd.mps.topPerformers.length > 0) {
            body += `<h2>Top Performing MPs</h2>
<table>${hrow(['Rank', 'Name', 'Party', 'Score', 'Attendance', 'Response Rate'])}`;
            rd.mps.topPerformers.slice(0, 10).forEach((mp, i) => {
                body += row([
                    `#${i + 1}`,
                    mp.name,
                    mp.party,
                    mp.performanceScore != null ? mp.performanceScore : '—',
                    mp.attendance != null ? `${mp.attendance}%` : '—',
                    mp.responseRate != null ? `${mp.responseRate}%` : '—'
                ]);
            });
            body += '</table>';
        }

        if (ua) {
            body += `<h2>My Activity Summary</h2>
<table>${hrow(['Metric', 'Value'])}
${row(['Topics Bookmarked', ua.activitySummary?.topicsBookmarked])}
${row(['MPs Followed', ua.activitySummary?.mpsFollowed])}
${row(['Education Resources Bookmarked', ua.activitySummary?.educationBookmarked])}
${row(['Discussions', ua.quickStats?.discussions])}
${row(['Learning Resources', ua.quickStats?.learning])}
${row(['Quizzes Completed', ua.learning?.quizzesCompleted])}
${row(['Average Quiz Score', ua.learning?.avgScore != null ? `${ua.learning.avgScore}%` : '—'])}
${row(['Feedback / Suggestions', ua.feedback?.suggestions])}
</table>`;

        }

        return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${documentTitle}</title><style>${css}</style></head><body>
<div class="header">
  <h1>MY Parliament · Reports</h1>
  <div class="meta">Period: ${rangeLabel} &nbsp;|&nbsp; Generated: ${now.toLocaleString()}</div>
</div>
${body}
<p style="font-size:10px;color:#666;border-top:1px solid #eee;margin-top:20px;padding-top:6px">Generated from MY Parliament public reports.</p>
</body></html>`;
    };
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-gray-50 min-w-0 max-w-full">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full min-w-0">

                {/* Header — simple text, no overall print */}
                <div className="relative z-10 mb-8 flex items-start justify-between flex-wrap gap-4">
                    <div className="min-w-0">
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4" style={{ color: '#111827' }}>
                            {isAuthenticated ? t('myReports') : t('reports')}
                        </h1>
                        <p className="text-lg text-gray-600 max-w-3xl">
                            {isAuthenticated ? t('trackYourParliamentaryEngagement') : t('explorePublicAnalytics')}
                        </p>
                    </div>
                </div>

                {/* ── Platform Analytics ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Topic Categories */}
                    <div
                        className="relative bg-gradient-to-br from-white via-sky-50/50 to-indigo-50/60 p-6 rounded-2xl shadow-sm border border-sky-100/80 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group overflow-hidden"
                        onClick={() => navigate('/reports/topic-categories')}
                    >
                        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-sky-500/8 via-indigo-500/8 to-transparent pointer-events-none" aria-hidden="true" />
                        <div className="relative flex items-start justify-between gap-4 mb-5">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-200/70 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 12h7M7 17h4M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{t('topicCategoriesDistribution')}</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {topicCategoriesMeta.totalTopics > 0
                                            ? `${topicCategoriesMeta.totalTopics} active topics currently in the Issue Portal`
                                            : 'Current category mix across active Issue Portal topics'}
                                    </p>
                                </div>
                            </div>
                            <span className="text-xs font-medium text-indigo-600 group-hover:underline whitespace-nowrap">{t('viewDetails')} →</span>
                        </div>

                        <div className="relative space-y-3">
                            {visibleTopicCategories.length > 0 ? visibleTopicCategories.slice(0, 4).map((cat, i) => (
                                <div key={i} className="rounded-2xl border border-white/80 bg-white/80 backdrop-blur-sm shadow-sm shadow-sky-100/30 p-4 hover:bg-white transition-colors">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="min-w-0 flex items-center gap-3">
                                            <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${cat.color}`} />
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-gray-900 break-words">{cat.name}</p>
                                                <p className="text-[11px] text-gray-500 mt-0.5">
                                                    {i === 0 ? 'Most discussed in this view' : `${cat.count} topics in this category`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-sm font-bold text-sky-700">{cat.percentage}%</p>
                                            <p className="text-[11px] text-gray-500">{cat.count} topics</p>
                                        </div>
                                    </div>
                                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${cat.color}`} style={{ width: `${cat.percentage}%` }} />
                                    </div>
                                </div>
                            )) : (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-6 py-8 text-center">
                                    <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-4">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6h4v6m4 0V9h2v8M5 21V5m0 16h14" />
                                        </svg>
                                    </div>
                                    <p className="text-sm font-semibold text-slate-700">No active topics in the Issue Portal yet</p>
                                    <p className="text-xs text-slate-500 mt-1">Topic category distribution will appear here once active issues are available.</p>
                                    <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate('/issues');
                                            }}
                                            className="px-3 py-2 text-xs font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                                        >
                                            Explore Issue Portal
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Most Viewed Topics (donut) */}
                    <div
                        className="relative bg-gradient-to-br from-white via-sky-50/50 to-indigo-50/60 p-6 rounded-2xl shadow-sm border border-sky-100/80 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group overflow-hidden"
                        onClick={() => navigate('/reports/most-viewed-topics')}
                    >
                        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-sky-500/8 via-indigo-500/8 to-transparent pointer-events-none" aria-hidden="true" />
                        <div className="relative flex items-start justify-between gap-4 mb-5">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-200/70 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5C7 4.5 3.27 7.61 2 12c1.27 4.39 5 7.5 10 7.5s8.73-3.11 10-7.5C20.73 7.61 17 4.5 12 4.5z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{t('mostViewedTopics')}</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">{t('mostViewedTopicsDescription')}</p>
                                </div>
                            </div>
                            <span className="text-xs font-medium text-indigo-600 group-hover:underline whitespace-nowrap">{t('viewDetails')} →</span>
                        </div>

                        <div className="relative mt-2">
                            {mostViewedTopics.length > 0 ? (
                                <PieChart
                                    title={t('topTopicsByViews')}
                                    data={mostViewedTopics.map((topic) => ({
                                        label: topic.title || topic.category || 'Untitled topic',
                                        value: Number(topic.views) || 0
                                    }))}
                                    colors={['#0ea5e9', '#6366f1', '#22c55e', '#f97316', '#e11d48']}
                                />
                            ) : (
                                <div className="w-full h-40 bg-slate-50 border border-dashed border-slate-200 rounded-xl flex items-center justify-center text-center px-4">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-700">{t('noViewDataYet')}</p>
                                        <p className="text-xs text-slate-500 mt-1">{t('mostViewedTopicsEmptyHint')}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Top MPs */}
                    <div
                        className="relative bg-gradient-to-br from-white via-indigo-50/40 to-violet-50/60 p-6 rounded-2xl shadow-sm border border-indigo-100/80 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group overflow-hidden"
                        onClick={() => navigate('/reports/mp-performance')}
                    >
                        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-indigo-500/6 via-violet-500/8 to-transparent pointer-events-none" aria-hidden="true" />
                        <div className="relative flex items-start justify-between gap-4 mb-5">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-200/70 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6h3v6m4 0V7h3v10M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{t('topPerformingMPs')}</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {mpViewMode === 'current'
                                            ? 'Current-term MPs only, ranked by composite score'
                                            : 'All recorded MPs across terms, ranked by composite score'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                {/* View mode toggle (Current / All-time) */}
                                <div
                                    className="inline-flex rounded-full bg-white/80 border border-indigo-100 shadow-sm overflow-hidden text-[11px] font-medium"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        type="button"
                                        onClick={() => handleMpViewChange('current')}
                                        className={`px-3 py-1 transition-colors ${
                                            mpViewMode === 'current'
                                                ? 'bg-indigo-600 text-white'
                                                : 'text-indigo-700 hover:bg-indigo-50'
                                        }`}
                                    >
                                        Current
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleMpViewChange('all')}
                                        className={`px-3 py-1 border-l border-indigo-100 transition-colors ${
                                            mpViewMode === 'all'
                                                ? 'bg-indigo-600 text-white'
                                                : 'text-indigo-700 hover:bg-indigo-50'
                                        }`}
                                    >
                                        All time
                                    </button>
                                </div>
                                <span className="text-xs font-medium text-indigo-600 group-hover:underline whitespace-nowrap">
                                    {t('viewDetails')} →
                                </span>
                            </div>
                        </div>
                        <div className="relative space-y-3">
                            {allTimeLoading && mpViewMode === 'all' && (
                                <p className="text-[11px] text-gray-500 text-right">Loading all-time ranking…</p>
                            )}
                            {(mpViewMode === 'current' ? reportData.mps.topPerformers : allTimeTopMps).length > 0
                                ? (mpViewMode === 'current' ? reportData.mps.topPerformers : allTimeTopMps).map((mp, i) => (
                                <div
                                    key={i}
                                    className="rounded-2xl border border-white/80 bg-white/80 backdrop-blur-sm shadow-sm shadow-indigo-100/30 p-4 hover:bg-white transition-colors"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-md ${getTopMpRankClasses(i).badge}`}>
                                                #{i + 1}
                                            </div>
                                            <div className={`w-11 h-11 rounded-2xl bg-white ring-4 ${getTopMpRankClasses(i).ring} flex items-center justify-center overflow-hidden text-sm font-semibold text-gray-700 flex-shrink-0`}>
                                                <img
                                                    src={getImageSource(mp.profilePicture, 'mp')}
                                                    alt={mp.full_name_with_titles || mp.name || 'MP'}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => handleImageError(e, 'mp')}
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-gray-900 leading-snug break-words">{mp.name}</p>
                                                        <p className="text-xs text-gray-500 mt-0.5">{mp.party}</p>
                                                    </div>
                                                    <div className="hidden sm:flex items-center px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold whitespace-nowrap">
                                                        {mp.performanceScore != null ? mp.performanceScore : '—'} {t('performanceScore')}
                                                    </div>
                                                </div>
                                                <div className="mt-3">
                                                    <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                                                        <span>{t('performanceScore')}</span>
                                                        <span className="font-semibold text-indigo-600">
                                                            {mp.performanceScore != null ? mp.performanceScore : '—'}
                                                        </span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full bg-gradient-to-r ${getTopMpRankClasses(i).bar}`}
                                                            style={{ width: `${Math.min(100, Math.max(0, Number(mp.performanceScore) || 0))}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 sm:min-w-[120px]">
                                            <div className="rounded-xl bg-emerald-50 px-3 py-2 text-center">
                                                <p className="text-[10px] uppercase tracking-wide text-emerald-600 font-semibold">{t('attendance')}</p>
                                                <p className="text-sm font-bold text-emerald-700 mt-0.5">
                                                    {mp.attendance != null ? `${mp.attendance}%` : '—'}
                                                </p>
                                            </div>
                                            <div className="rounded-xl bg-amber-50 px-3 py-2 text-center">
                                                <p className="text-[10px] uppercase tracking-wide text-amber-600 font-semibold">{t('responseRate')}</p>
                                                <p className="text-sm font-bold text-amber-700 mt-0.5">
                                                    {mp.responseRate != null ? `${mp.responseRate}%` : '—'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-sm text-gray-400 text-center py-4">{t('noActivityDataAvailable')}</p>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            <LoginConfirmationModal
                isOpen={showLoginModal}
                onClose={() => setShowLoginModal(false)}
                action={loginAction}
            />
        </div>
    );
}
