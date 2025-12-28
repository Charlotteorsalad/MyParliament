import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks';
import { useApi } from '../../hooks';
import { reportApi } from '../../api';
import { useLanguage } from '../../contexts/LanguageContext';
import LoginConfirmationModal from '../../components/LoginConfirmationModal';

const ReportModule = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [loginAction, setLoginAction] = useState('');
    const [reportData, setReportData] = useState({
        topics: { total: 0, active: 0, resolved: 0 },
        mps: { total: 0, active: 0, topPerformers: [] },
        forum: { totalDiscussions: 0, totalReplies: 0, activeUsers: 0 },
        feedback: { total: 0, satisfaction: 0, categories: {} },
        education: { totalResources: 0, totalViews: 0, completionRate: 0, popularTopics: [] },
        topicCategories: []
    });
    const [userActivity, setUserActivity] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { executeApiCall } = useApi();
    const { t } = useLanguage();

    // Load report data
    useEffect(() => {
        const fetchReportData = async () => {
            try {
                setLoading(true);
                const [dashboardData, topicCategoriesData, userData] = await Promise.all([
                    executeApiCall(() => reportApi.getDashboardData()),
                    executeApiCall(() => reportApi.getTopicCategoriesReport()),
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
                    topicCategories: topicCategoriesData?.categories || []
                });

                if (userData) {
                    setUserActivity(userData);
                }
            } catch (err) {
                console.error('Failed to fetch report data:', err);
                setError('Failed to load report data');
            } finally {
                setLoading(false);
            }
        };

        fetchReportData();
    }, [executeApiCall, isAuthenticated]);

    const renderHeader = () => (
        <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 border border-slate-200 p-8 rounded-2xl mb-8 shadow-sm">
            <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                </div>
                <h1 className="text-4xl font-bold text-slate-800 mb-3">{isAuthenticated ? t('myReports') : t('reports')}</h1>
                <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                    {isAuthenticated
                        ? t('trackYourParliamentaryEngagement')
                        : t('explorePublicAnalytics')}
                </p>
            </div>
        </div>
    );

    const renderQuickStats = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div 
                className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow group cursor-pointer"
                onClick={() => isAuthenticated ? navigate('/reports/bookmarks') : navigate('/login')}
            >
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-sm font-medium text-gray-600">{t('myBookmarks')}</p>
                        <p className="text-3xl font-bold text-indigo-600">{userActivity?.quickStats?.bookmarks || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                    </div>
                </div>
                <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{t('topics')}</span>
                        <span className="font-medium text-indigo-600">{reportData.topics.total}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{t('mps')}</span>
                        <span className="font-medium text-emerald-600">{reportData.mps.total}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                        {reportData.topics.total > 0 ? t('dataAvailable') : t('noTopicsYet')}
                    </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-center text-indigo-600 text-sm font-medium">
                        <span>{t('viewDetails')}</span>
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </div>
            </div>

            <div 
                className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow group cursor-pointer"
                onClick={() => isAuthenticated ? navigate('/reports/discussions') : navigate('/login')}
            >
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-sm font-medium text-gray-600">My Discussions</p>
                        <p className="text-3xl font-bold text-emerald-600">{userActivity?.quickStats?.discussions || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </div>
                </div>
                <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Replies</span>
                        <span className="font-medium text-emerald-600">{reportData.forum.totalReplies}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Views</span>
                        <span className="font-medium text-blue-600">{reportData.education.totalViews}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                        {reportData.forum.totalDiscussions > 0 ? 'Forum active' : 'No discussions yet'}
                    </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-center text-emerald-600 text-sm font-medium">
                        <span>{t('viewDetails')}</span>
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </div>
            </div>

            <div 
                className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow group cursor-pointer"
                onClick={() => isAuthenticated ? navigate('/reports/learning') : navigate('/login')}
            >
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-sm font-medium text-gray-600">My Learning</p>
                        <p className="text-3xl font-bold text-purple-600">{userActivity?.quickStats?.learning || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </div>
                </div>
                <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Resources</span>
                        <span className="font-medium text-purple-600">15</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Quizzes</span>
                        <span className="font-medium text-indigo-600">8</span>
                    </div>
                    <div className="text-xs text-gray-500">
                        Avg score: 85%
                    </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-center text-purple-600 text-sm font-medium">
                        <span>{t('viewDetails')}</span>
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </div>
            </div>

            <div 
                className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow group cursor-pointer"
                onClick={() => isAuthenticated ? navigate('/reports/activity') : navigate('/login')}
            >
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-sm font-medium text-gray-600">My Activity</p>
                        <p className="text-3xl font-bold text-orange-600">{userActivity?.quickStats?.activities || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                </div>
                <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">This Month</span>
                        <span className="font-medium text-orange-600">+5</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Last Activity</span>
                        <span className="font-medium text-green-600">2h ago</span>
                    </div>
                    <div className="text-xs text-gray-500">
                        Most active day: Tuesday
                    </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-center text-orange-600 text-sm font-medium">
                        <span>{t('viewDetails')}</span>
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderAnalyticsCharts = () => (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Topic Categories Chart */}
            <div 
                className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 group cursor-pointer"
                onClick={() => navigate('/reports/topic-categories')}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">Topic Categories Distribution</h3>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                if (!isAuthenticated) {
                                    setLoginAction('export this chart');
                                    setShowLoginModal(true);
                                }
                            }}
                            className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 hover:bg-gray-50 text-gray-700"
                            title={isAuthenticated ? 'Export chart (coming soon)' : 'Login to export'}
                        >
                            Export
                        </button>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex items-center text-indigo-600 text-sm font-medium">
                                <span>{t('viewDetails')}</span>
                                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    {reportData.topicCategories && reportData.topicCategories.length > 0 ? (
                        reportData.topicCategories.map((category, index) => (
                        <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full ${category.color}`}></div>
                                <span className="text-sm font-medium text-gray-700">{category.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-32 bg-gray-200 rounded-full h-2">
                                    <div 
                                        className={`h-2 rounded-full ${category.color}`} 
                                        style={{width: `${category.percentage}%`}}
                                    ></div>
                                </div>
                                <span className="text-sm text-gray-600 w-8 text-right">{category.count}</span>
                            </div>
                        </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            <p>No topic categories data available</p>
                            <p className="text-sm">Start your machine learning process to generate topic insights</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MP Performance Chart */
            }
            <div 
                className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 group cursor-pointer"
                onClick={() => navigate('/reports/mp-performance')}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">Top Performing MPs</h3>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                if (!isAuthenticated) {
                                    setLoginAction('export this chart');
                                    setShowLoginModal(true);
                                }
                            }}
                            className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 hover:bg-gray-50 text-gray-700"
                            title={isAuthenticated ? 'Export chart (coming soon)' : 'Login to export'}
                        >
                            Export
                        </button>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex items-center text-indigo-600 text-sm font-medium">
                                <span>{t('viewDetails')}</span>
                                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    {reportData.mps.topPerformers.map((mp, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                                    <span className="text-sm font-bold text-indigo-600">#{index + 1}</span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{mp.name}</p>
                                    <p className="text-xs text-gray-500">{mp.party}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">{mp.responses} responses</p>
                                <p className="text-xs text-gray-500">{mp.attendance}% attendance</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* My Activity Summary - auth only */}
            {isAuthenticated && (
            <div 
                className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 group cursor-pointer"
                onClick={() => navigate('/reports/activity-summary')}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">My Activity Summary</h3>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center text-indigo-600 text-sm font-medium">
                            <span>{t('viewDetails')}</span>
                            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-900">Topics Bookmarked</p>
                                <p className="text-xs text-gray-500">Issues you're following</p>
                            </div>
                        </div>
                        <span className="text-lg font-bold text-blue-600">12</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-900">Forum Discussions</p>
                                <p className="text-xs text-gray-500">Discussions you've participated in</p>
                            </div>
                        </div>
                        <span className="text-lg font-bold text-green-600">8</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-900">Educational Resources</p>
                                <p className="text-xs text-gray-500">Resources you've accessed</p>
                            </div>
                        </div>
                        <span className="text-lg font-bold text-purple-600">15</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-900">Feedback Submitted</p>
                                <p className="text-xs text-gray-500">Feedback you've provided</p>
                            </div>
                        </div>
                        <span className="text-lg font-bold text-orange-600">3</span>
                    </div>
                </div>
            </div>
            )}

            {/* My MP Interactions - auth only */}
            {isAuthenticated && (
            <div 
                className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 group cursor-pointer"
                onClick={() => navigate('/reports/mp-interactions')}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">My MP Interactions</h3>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center text-indigo-600 text-sm font-medium">
                            <span>{t('viewDetails')}</span>
                            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-gray-900">MPs You Follow</h4>
                            <span className="text-sm text-gray-500">5 MPs</span>
                        </div>
                        <div className="flex -space-x-2">
                            {[
                                { name: 'Ahmad', party: 'PH', color: 'bg-blue-500' },
                                { name: 'Sarah', party: 'BN', color: 'bg-red-500' },
                                { name: 'Lim', party: 'DAP', color: 'bg-green-500' },
                                { name: 'Hassan', party: 'PAS', color: 'bg-purple-500' },
                                { name: 'Priya', party: 'PKR', color: 'bg-yellow-500' }
                            ].map((mp, index) => (
                                <div key={index} className={`w-8 h-8 rounded-full ${mp.color} flex items-center justify-center text-white text-xs font-bold border-2 border-white`}>
                                    {mp.name[0]}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-indigo-50 rounded-lg">
                            <div className="text-lg font-bold text-indigo-600">12</div>
                            <div className="text-xs text-gray-600">Questions Asked</div>
                        </div>
                        <div className="text-center p-3 bg-emerald-50 rounded-lg">
                            <div className="text-lg font-bold text-emerald-600">8</div>
                            <div className="text-xs text-gray-600">Responses Received</div>
                        </div>
                    </div>
                </div>
            </div>
            )}

            {/* Recent Activity Timeline - auth only */}
            {isAuthenticated && (
            <div 
                className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 lg:col-span-2 group cursor-pointer"
                onClick={() => navigate('/reports/activity-timeline')}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">Your Recent Activity</h3>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center text-indigo-600 text-sm font-medium">
                            <span>{t('viewDetails')}</span>
                            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    {userActivity && userActivity.recentActivity ? (
                        userActivity.recentActivity.map((activity, index) => (
                            <div key={index} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                                <div className={`p-2 rounded-lg ${activity.bgColor || 'bg-gray-100'}`}>
                                    <svg className={`w-4 h-4 ${activity.color || 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={activity.icon} />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                                    <p className="text-sm text-gray-600 truncate">{activity.details}</p>
                                    <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            <p>No recent activity</p>
                            <p className="text-sm">Start engaging with the platform to see your activity here</p>
                        </div>
                    )}
                </div>
            </div>
            )}
        </div>
    );

    const renderUserReports = () => (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">My Reports</h2>
                <p className="text-gray-600">View and export your personal parliamentary activity reports.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                    {
                        title: 'My Activity Summary',
                        description: 'Complete overview of your platform engagement, bookmarks, and interactions',
                        icon: 'M13 10V3L4 14h7v7l9-11h-7z',
                        color: 'text-blue-600',
                        bgColor: 'bg-blue-100',
                        lastUpdated: '2 hours ago',
                        dataPoints: ['12 bookmarks', '8 discussions', '15 resources', '23 total activities']
                    },
                    {
                        title: 'My Learning Progress',
                        description: 'Educational resources accessed, quiz scores, and learning achievements',
                        icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
                        color: 'text-purple-600',
                        bgColor: 'bg-purple-100',
                        lastUpdated: '1 day ago',
                        dataPoints: ['15 resources', '8 quizzes', '85% avg score', '3 certificates']
                    },
                    {
                        title: 'My MP Interactions',
                        description: 'MPs you follow, questions asked, responses received, and engagement history',
                        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
                        color: 'text-green-600',
                        bgColor: 'bg-green-100',
                        lastUpdated: '3 hours ago',
                        dataPoints: ['5 MPs followed', '12 questions', '8 responses', '4 parties']
                    },
                    {
                        title: 'My Discussion History',
                        description: 'All your forum posts, replies, and community participation details',
                        icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
                        color: 'text-orange-600',
                        bgColor: 'bg-orange-100',
                        lastUpdated: '5 hours ago',
                        dataPoints: ['8 discussions', '23 replies', '156 views', '3 topics']
                    },
                    {
                        title: 'My Bookmark Collection',
                        description: 'All your bookmarked topics and MPs with detailed information and notes',
                        icon: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z',
                        color: 'text-indigo-600',
                        bgColor: 'bg-indigo-100',
                        lastUpdated: '1 hour ago',
                        dataPoints: ['8 topics', '4 MPs', '3 categories', '12 total']
                    },
                    {
                        title: 'My Feedback & Surveys',
                        description: 'All feedback submitted, surveys completed, and suggestions provided',
                        icon: 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
                        color: 'text-red-600',
                        bgColor: 'bg-red-100',
                        lastUpdated: '2 days ago',
                        dataPoints: ['3 feedback', '2 surveys', '1 suggestion', '4.2 rating']
                    },
                    {
                        title: 'My Voting History',
                        description: 'Track your participation in polls, surveys, and public opinion votes on parliamentary topics',
                        icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
                        color: 'text-emerald-600',
                        bgColor: 'bg-emerald-100',
                        lastUpdated: '4 hours ago',
                        dataPoints: ['12 votes cast', '8 polls', '3 surveys', '75% participation']
                    },
                    {
                        title: 'My Topic Interests',
                        description: 'Analysis of your most engaged topics, categories, and trending interests over time',
                        icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
                        color: 'text-pink-600',
                        bgColor: 'bg-pink-100',
                        lastUpdated: '6 hours ago',
                        dataPoints: reportData.topicCategories.length > 0 
                            ? reportData.topicCategories.map(cat => cat.name).slice(0, 4)
                            : ['No topics yet']
                    },
                    {
                        title: 'My Engagement Timeline',
                        description: 'Chronological view of your platform activity, milestones, and engagement patterns',
                        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
                        color: 'text-cyan-600',
                        bgColor: 'bg-cyan-100',
                        lastUpdated: '1 hour ago',
                        dataPoints: ['45 days active', '23 streak', '5 milestones', '3 achievements']
                    },
                    {
                        title: 'My Community Impact',
                        description: 'Measure your influence in discussions, helpful responses, and community contributions',
                        icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
                        color: 'text-amber-600',
                        bgColor: 'bg-amber-100',
                        lastUpdated: '8 hours ago',
                        dataPoints: ['15 helpful', '3 featured', '89 likes', '12 shares']
                    },
                    {
                        title: 'My Learning Achievements',
                        description: 'Certificates earned, courses completed, and knowledge milestones achieved',
                        icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
                        color: 'text-violet-600',
                        bgColor: 'bg-violet-100',
                        lastUpdated: '1 day ago',
                        dataPoints: ['3 certificates', '5 courses', '2 badges', 'Expert level']
                    },
                    {
                        title: 'My Notification History',
                        description: 'Track all notifications received, responses to your content, and platform updates',
                        icon: 'M15 17h5l-5 5v-5zM4.828 7l2.586 2.586a2 2 0 002.828 0L12 7H4.828zM4.828 17l2.586-2.586a2 2 0 012.828 0L12 17H4.828z',
                        color: 'text-teal-600',
                        bgColor: 'bg-teal-100',
                        lastUpdated: '30 minutes ago',
                        dataPoints: ['45 notifications', '12 replies', '8 mentions', '3 updates']
                    },
                    {
                        title: 'My Platform Usage Stats',
                        description: 'Detailed analytics of your platform usage, session times, and feature utilization',
                        icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
                        color: 'text-slate-600',
                        bgColor: 'bg-slate-100',
                        lastUpdated: '12 hours ago',
                        dataPoints: ['2.5h avg session', '15 logins', '8 features used', 'Mobile 60%']
                    }
                ].map((report, index) => (
                    <div 
                        key={index} 
                        className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow cursor-pointer group"
                        onClick={() => navigate(`/reports/${report.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`)}
                    >
                        <div className="flex items-start gap-4 mb-4">
                            <div className={`w-12 h-12 ${report.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                                <svg className={`w-6 h-6 ${report.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={report.icon} />
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{report.title}</h3>
                                <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                            </div>
                        </div>
                        
                        <div className="mb-4">
                            <p className="text-xs text-gray-500 mb-2">Last updated: {report.lastUpdated}</p>
                            <div className="flex flex-wrap gap-2">
                                {report.dataPoints.map((point, pointIndex) => (
                                    <span key={pointIndex} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                                        {point}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex items-center justify-center text-indigo-600 text-sm font-medium">
                                <span>{t('viewDetails')}</span>
                                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );


    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <div>
                        {isAuthenticated && renderQuickStats()}
                        {renderAnalyticsCharts()}
                    </div>
                );
            case 'reports':
                return renderUserReports();
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-indigo-500 bg-white transition ease-in-out duration-150">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Loading reports...
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md mx-auto">
                        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Reports</h3>
                        <p className="text-red-600">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {renderHeader()}

                {/* Navigation Tabs */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-8">
                    <div className="border-b border-gray-200">
                        <nav className="flex space-x-8 px-6">
                            {(isAuthenticated
                                ? [
                                    { id: 'overview', name: t('overview'), icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z' },
                                    { id: 'reports', name: t('myReports'), icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
                                  ]
                                : [
                                    { id: 'overview', name: t('overview'), icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z' }
                                  ]).map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                                        activeTab === tab.id
                                            ? 'border-indigo-500 text-indigo-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                                        </svg>
                                        {tab.name}
                                    </div>
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* Tab Content */}
                {renderTabContent()}
            </div>

            {/* Login Confirmation Modal */}
            <LoginConfirmationModal
                isOpen={showLoginModal}
                onClose={() => setShowLoginModal(false)}
                action={loginAction}
            />
        </div>
    );
};

export default ReportModule;