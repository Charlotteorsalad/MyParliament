import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { userApi } from '../../api';

export default function BookmarkCollectionReport() {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [printPanel, setPrintPanel] = useState({ open: false, timeRange: 'month' });

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const profileRes = await userApi.getProfile().catch(() => null);
                if (!cancelled) setProfile(profileRes || null);
            } catch {
                if (!cancelled) setProfile(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, []);

    const total =
        (profile?.followedTopics?.length || 0) +
        (profile?.followedMPs?.length || 0) +
        (profile?.bookmarkedEduContent?.length || 0) +
        (profile?.bookmarkedDiscussions?.length || 0);
    const topicsCount = profile?.followedTopics?.length || 0;
    const mpsCount = profile?.followedMPs?.length || 0;
    const eduCount = profile?.bookmarkedEduContent?.length || 0;
    const forumCount = profile?.bookmarkedDiscussions?.length || 0;

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
        const documentTitle = `user_bookmark_collection_report_${fileDate}`;
        const css = `body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:20px}
h1{font-size:16px;margin:0 0 2px}h2{font-size:13px;margin:16px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px}
table{width:100%;border-collapse:collapse;margin-bottom:12px}
th{background:#f0f0f0;text-align:left;padding:5px 8px;border:1px solid #ccc;font-size:11px}
td{padding:4px 8px;border:1px solid #ddd;font-size:11px}
.header{background:#4338ca;color:#fff;padding:10px 14px;margin-bottom:16px;border-radius:4px}
.header h1{color:#fff;font-size:15px}.meta{font-size:10px;color:#fff;opacity:.85}
@media print{body{margin:0}}`;

        const row = (cells) => `<tr>${cells.map((c, i) => `<td${i === 0 ? ' style="font-weight:600"' : ''}>${c ?? '—'}</td>`).join('')}</tr>`;
        const hrow = (cells) => `<tr>${cells.map(c => `<th>${c}</th>`).join('')}</tr>`;

        let body = `<h2>Summary</h2>
<table>${hrow(['Category', 'Count'])}
${row(['Total Bookmarks', total])}
${row(['Followed Issue Topics', topicsCount])}
${row(['Followed MPs', mpsCount])}
${row(['Bookmarked Educational Resources', eduCount])}
${row(['Bookmarked Forum Discussions', forumCount])}
</table>`;

        if (profile?.followedTopics?.length > 0) {
            body += `<h2>Followed Issue Topics (${profile.followedTopics.length})</h2>
<table>${hrow(['#', 'Title', 'Category', 'Last Updated'])}`;
            profile.followedTopics.forEach((item, i) => {
                const date = item.updatedAt || item.createdAt;
                body += row([i + 1, item.title || '—', item.category || '—', date ? new Date(date).toLocaleDateString() : '—']);
            });
            body += '</table>';
        }

        if (profile?.followedMPs?.length > 0) {
            body += `<h2>Followed MPs (${profile.followedMPs.length})</h2>
<table>${hrow(['#', 'Name', 'Party', 'Constituency', 'State'])}`;
            profile.followedMPs.forEach((item, i) => {
                body += row([i + 1, item.name || '—', item.party_full_name || item.party || '—',
                    [item.constituency_code, item.constituency_name || item.constituency].filter(Boolean).join(' — ') || '—',
                    item.state || '—']);
            });
            body += '</table>';
        }

        if (profile?.bookmarkedEduContent?.length > 0) {
            body += `<h2>Bookmarked Educational Resources (${profile.bookmarkedEduContent.length})</h2>
<table>${hrow(['#', 'Title', 'Category'])}`;
            profile.bookmarkedEduContent.forEach((item, i) => {
                body += row([i + 1, item.title || item.name || '—', item.category || '—']);
            });
            body += '</table>';
        }

        if (profile?.bookmarkedDiscussions?.length > 0) {
            body += `<h2>Bookmarked Forum Discussions (${profile.bookmarkedDiscussions.length})</h2>
<table>${hrow(['#', 'Title', 'Category', 'Posted'])}`;
            profile.bookmarkedDiscussions.forEach((item, i) => {
                body += row([i + 1, item.title || '—', item.category || '—',
                    item.createdAt ? new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—']);
            });
            body += '</table>';
        }

        return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${documentTitle}</title><style>${css}
body{padding-bottom:84px}
.print-actions{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid #d1d5db;padding:12px 20px;display:flex;justify-content:flex-end;gap:10px}
.print-btn{border:none;border-radius:8px;padding:10px 16px;font-size:12px;font-weight:600;cursor:pointer}
.print-btn-primary{background:#4f46e5;color:#fff}
.print-btn-secondary{background:#f3f4f6;color:#4b5563}
@media print {.no-print{display:none!important}}
</style></head><body>
<div class="header">
  <h1>MY Parliament · Bookmark Collection Report</h1>
  <div class="meta">Period: ${rangeLabel} &nbsp;|&nbsp; Generated: ${now.toLocaleString()}</div>
</div>
${body}
<p style="font-size:10px;color:#666;border-top:1px solid #eee;margin-top:20px;padding-top:6px">Generated from MY Parliament — Bookmark Collection Report.</p>
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

    const renderHeader = () => (
        <div className="bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-100 border border-slate-200 p-4 sm:p-6 lg:p-8 rounded-2xl mb-6 sm:mb-8 shadow-sm print:bg-white print:shadow-none print:border-b print:rounded-none print:border-slate-200 print:pb-4 print:mb-6">
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .bookmark-report-page { background: #fff !important; padding: 0 !important; }
                    .bookmark-report-page .print\\:doc-title { font-size: 1.5rem; font-weight: 700; color: #1e293b; margin-bottom: 0.25rem; }
                    .bookmark-report-page .print\\:doc-desc { font-size: 0.875rem; color: #64748b; }
                    .bookmark-report-page .print\\:doc-date { font-size: 0.75rem; color: #94a3b8; margin-top: 0.5rem; }
                    .bookmark-report-page .print-stats-grid { box-shadow: none !important; border: 1px solid #e2e8f0 !important; border-radius: 0 !important; }
                    .bookmark-report-page .print-section { box-shadow: none !important; border: 1px solid #e2e8f0 !important; border-radius: 0 !important; margin-bottom: 1rem !important; }
                    .bookmark-report-page a { color: #1e293b !important; text-decoration: none !important; }
                }
            `}</style>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0">
                <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                    <button
                        type="button"
                        onClick={() => navigate('/reports')}
                        className="no-print p-2 hover:bg-white/50 rounded-lg transition-colors shrink-0"
                        aria-label={t('backToPreviousPage')}
                    >
                        <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800 print:doc-title break-words">{t('reportMyBookmarkCollectionTitle')}</h1>
                        <p className="text-xs sm:text-sm lg:text-base text-slate-600 mt-1 print:doc-desc break-words">{t('reportMyBookmarkCollectionDesc')}</p>
                        <p className="hidden print:block print:doc-date" aria-hidden="true">{new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 no-print relative shrink-0">
                    <button
                        type="button"
                        onClick={() => setPrintPanel(p => ({ ...p, open: !p.open }))}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg transition-colors"
                        title="Print report"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        {t('print')}
                    </button>
                    {printPanel.open && (
                        <div className="absolute right-0 top-9 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-56">
                            <p className="text-xs font-semibold text-gray-700 mb-2">Select period</p>
                            <div className="space-y-1 mb-3">
                                {PRINT_RANGES.map(r => (
                                    <label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer hover:text-gray-900">
                                        <input
                                            type="radio"
                                            name="print-range-bookmark"
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
            </div>
        </div>
    );

    const renderOverviewStats = () => (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 print-stats-grid">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-600">{t('total')}</p>
                        <p className="text-2xl font-bold text-slate-800">{total}</p>
                    </div>
                    <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                    </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">{t('bookmarks')}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 print-stats-grid">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-600">{t('topics')}</p>
                        <p className="text-2xl font-bold text-indigo-600">{topicsCount}</p>
                    </div>
                    <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                    </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">{t('issuePortal')} / {t('followedTopics')}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 print-stats-grid">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-600">{t('mps')}</p>
                        <p className="text-2xl font-bold text-emerald-600">{mpsCount}</p>
                    </div>
                    <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">{t('mpsFollowed')}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 print-stats-grid">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-600">{t('bookmarkedEduContent')}</p>
                        <p className="text-2xl font-bold text-amber-600">{eduCount}</p>
                    </div>
                    <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">{t('bookmarkedEduContent')}</p>
            </div>
        </div>
    );

    // Label-value line for report detail
    const DetailLine = ({ label, value }) => (value != null && String(value).trim() !== '' ? (
        <p className="text-sm text-gray-700 mt-1"><span className="font-medium text-gray-600">{label}:</span> {String(value)}</p>
    ) : null);

    // Show description only if meaningful (not empty, not same as title, not trivial single char). Truncate long text.
    const MAX_DESC_LENGTH = 100; // Summary only for print-friendly report
    const formatDescription = (desc, title) => {
        if (desc == null) return null;
        const s = String(desc).trim();
        if (s.length === 0) return null;
        const t = (title && String(title).trim()) || '';
        if (t && s === t) return null; // same as title
        if (s.length <= 2 && /^[\w\s]$/.test(s)) return null; // trivial e.g. "w"
        return s.length > MAX_DESC_LENGTH ? s.slice(0, MAX_DESC_LENGTH) + '…' : s;
    };

    // Report-style section: each item as a detailed block with label-value pairs
    const renderReportSection = (title, items, renderRow, emptyKey) => (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-4 sm:mb-6 print-section min-w-0">
            <div className="p-4 sm:p-6 border-b border-gray-100">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 break-words">{title}</h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">{items?.length || 0} {t('items')}</p>
            </div>
            <div className="p-4 sm:p-6 min-w-0 overflow-x-hidden">
                {items?.length ? (
                    <div className="space-y-0 divide-y divide-gray-100">
                        {items.map((item, index) => (
                            <div
                                key={item._id || item.id || index}
                                className="py-4 first:pt-0"
                            >
                                {renderRow(item, index)}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-sm py-2">{t(emptyKey)}</p>
                )}
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-slate-600">{t('loading')}...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 bookmark-report-page min-w-0 overflow-x-hidden">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 w-full min-w-0 print:max-w-none print:py-6">
                {renderHeader()}
                {renderOverviewStats()}

                {renderReportSection(
                    t('followedTopics') + ' (' + t('issuePortal') + ')',
                    profile?.followedTopics,
                    (item) => (
                        <div className="space-y-1">
                            <p className="font-semibold text-gray-900 text-base">{item.title || 'Topic'}</p>
                            <DetailLine label={t('category')} value={item.category} />
                            {formatDescription(item.description || (item.content && item.content.slice(0, 500)), item.title) && (
                                <p className="text-sm text-gray-600 mt-1">{formatDescription(item.description || (item.content && item.content.slice(0, 500)), item.title)}</p>
                            )}
                            {(item.updatedAt || item.createdAt) && (
                                <DetailLine label={t('updatedLabel')} value={new Date(item.updatedAt || item.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })} />
                            )}
                        </div>
                    ),
                    'noTopicsYet'
                )}
                {renderReportSection(
                    t('followedMPs'),
                    profile?.followedMPs,
                    (item) => (
                        <div className="space-y-1">
                            <p className="font-semibold text-gray-900 text-base">{item.name || 'MP'}</p>
                            <DetailLine label={t('partyLabel')} value={item.party_full_name || item.party} />
                            <DetailLine label={t('constituencyLabel')} value={[item.constituency_code, item.constituency_name || item.constituency].filter(Boolean).join(' — ') || item.constituency} />
                            <DetailLine label={t('stateLabel')} value={item.state} />
                        </div>
                    ),
                    'noMPsFollowedYet'
                )}
                {renderReportSection(
                    t('bookmarkedEduContent'),
                    profile?.bookmarkedEduContent,
                    (item) => (
                        <div className="space-y-1">
                            <p className="font-semibold text-gray-900 text-base">{item.title || item.name || 'Resource'}</p>
                            <DetailLine label={t('category')} value={item.category} />
                            {formatDescription(item.description, item.title || item.name) && (
                                <p className="text-sm text-gray-600 mt-1">{formatDescription(item.description, item.title || item.name)}</p>
                            )}
                        </div>
                    ),
                    'noEduBookmarks'
                )}
                {renderReportSection(
                    t('bookmarkedDiscussions'),
                    profile?.bookmarkedDiscussions,
                    (item) => (
                        <div className="space-y-1">
                            <p className="font-semibold text-gray-900 text-base">{item.title || 'Discussion'}</p>
                            <DetailLine label={t('category')} value={item.category} />
                            {item.createdAt && (
                                <DetailLine label={t('postedLabel')} value={new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} />
                            )}
                            {formatDescription(item.description, item.title) && (
                                <p className="text-sm text-gray-600 mt-1">{formatDescription(item.description, item.title)}</p>
                            )}
                        </div>
                    ),
                    'noDiscussionsYet'
                )}
            </div>
        </div>
    );
}
