import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks';
import { useApi } from '../../hooks';
import { usePin } from '../../contexts/PinContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { reportApi } from '../../api';
import { LoadingSpinner, Button } from '../../components/ui';
import { 
  ReportHeader, 
  QuickStatsGrid, 
  TopicCategoriesChart, 
  MPPerformanceChart, 
  UserActivitySummary, 
  MPInteractionsChart, 
  ActivityTimeline, 
  UserReportsList 
} from '../../components/reports';

const ReportModule = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [reportData, setReportData] = useState(null);
    const [userSummary, setUserSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { executeApiCall } = useApi();
    const { PinButton } = usePin();
    const { t } = useLanguage();

    // Fetch data from API
    useEffect(() => {
        const fetchReportData = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const [dashboardData, mpPerformanceData, userSummaryData] = await Promise.all([
                    executeApiCall(() => reportApi.getDashboardData()),
                    executeApiCall(() => reportApi.getMPPerformanceReport(5)),
                    isAuthenticated ? executeApiCall(() => reportApi.getUserReportsSummary()) : Promise.resolve(null)
                ]);

                setReportData(dashboardData);
                setUserSummary(userSummaryData);
            } catch (err) {
                console.error('Failed to fetch report data:', err);
                setError(t('failedToLoadReports'));
            } finally {
                setLoading(false);
            }
        };

        fetchReportData();
    }, [executeApiCall, isAuthenticated]);

    // Header is now handled by ReportHeader component

    // Quick stats are now handled by QuickStatsGrid component

    // Analytics charts are now handled by individual chart components

    // User reports are now handled by UserReportsList component


    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <div>
                        <QuickStatsGrid userSummary={userSummary} isAuthenticated={isAuthenticated} />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                            <TopicCategoriesChart />
                            <MPPerformanceChart reportData={reportData} />
                            <UserActivitySummary />
                            <MPInteractionsChart />
                            <ActivityTimeline />
                        </div>
                    </div>
                );
            case 'reports':
                return <UserReportsList />;
            default:
                return null;
        }
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
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-500 mb-4">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <Button 
                        onClick={() => window.location.reload()}
                        variant="primary"
                    >
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <ReportHeader isAuthenticated={isAuthenticated} />

                {/* Navigation Tabs */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-8">
                    <div className="border-b border-gray-200">
                        <nav className="flex space-x-8 px-6">
                            {[
                                { id: 'reports-overview', name: t('overview'), icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z' },
                                { id: 'reports-my', name: t('myReports'), icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id.replace('reports-', ''))}
                                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                                        activeTab === tab.id.replace('reports-', '')
                                            ? 'border-indigo-500 text-indigo-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                                        </svg>
                                        {tab.name}
                                        {isAuthenticated && (
                                            <PinButton
                                                tabId={tab.id}
                                                tabName={tab.name}
                                                module="Reports"
                                                className="ml-2"
                                            />
                                        )}
                                    </div>
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* Tab Content */}
                {renderTabContent()}
                
                {/* Show login prompt for non-authenticated users */}
                {!isAuthenticated && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-8">
                        <div className="flex items-center">
                            <svg className="w-6 h-6 text-yellow-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            <div>
                                <h3 className="text-lg font-medium text-yellow-800">{t('loginRequiredForPersonalReports')}</h3>
                                <p className="text-yellow-700 mt-1">
                                    {t('loginToViewPersonalReports')}
                                </p>
                                <Button 
                                    onClick={() => navigate('/login')}
                                    variant="primary"
                                    className="mt-3"
                                >
                                    {t('loginToViewReports')}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportModule;