import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TopicCategoriesReport = () => {
    const navigate = useNavigate();
    const [selectedPeriod, setSelectedPeriod] = useState('30d');
    const [selectedFormat, setSelectedFormat] = useState('pdf');

    // Sample data for demonstration
    const topicCategoriesData = {
        totalTopics: 156,
        categories: [
            {
                name: 'Healthcare',
                count: 45,
                percentage: 29,
                color: 'bg-blue-500',
                trend: '+12%',
                trendDirection: 'up',
                subcategories: [
                    { name: 'Mental Health', count: 15, percentage: 33 },
                    { name: 'Public Health', count: 12, percentage: 27 },
                    { name: 'Medical Services', count: 10, percentage: 22 },
                    { name: 'Health Policy', count: 8, percentage: 18 }
                ],
                recentTopics: [
                    'Mental Health Support for Students',
                    'Public Hospital Funding',
                    'COVID-19 Response Strategy',
                    'Mental Health Act Amendment'
                ]
            },
            {
                name: 'Education',
                count: 38,
                percentage: 24,
                color: 'bg-green-500',
                trend: '+8%',
                trendDirection: 'up',
                subcategories: [
                    { name: 'Higher Education', count: 14, percentage: 37 },
                    { name: 'Primary Education', count: 12, percentage: 32 },
                    { name: 'Vocational Training', count: 8, percentage: 21 },
                    { name: 'Education Policy', count: 4, percentage: 10 }
                ],
                recentTopics: [
                    'University Funding Allocation',
                    'Digital Learning Infrastructure',
                    'Teacher Training Programs',
                    'Student Loan Reform'
                ]
            },
            {
                name: 'Environment',
                count: 32,
                percentage: 21,
                color: 'bg-emerald-500',
                trend: '+15%',
                trendDirection: 'up',
                subcategories: [
                    { name: 'Climate Change', count: 12, percentage: 38 },
                    { name: 'Renewable Energy', count: 10, percentage: 31 },
                    { name: 'Conservation', count: 6, percentage: 19 },
                    { name: 'Pollution Control', count: 4, percentage: 12 }
                ],
                recentTopics: [
                    'Carbon Neutrality Roadmap',
                    'Renewable Energy Investment',
                    'Forest Conservation Program',
                    'Plastic Waste Reduction'
                ]
            },
            {
                name: 'Economy',
                count: 28,
                percentage: 18,
                color: 'bg-yellow-500',
                trend: '-3%',
                trendDirection: 'down',
                subcategories: [
                    { name: 'Economic Policy', count: 10, percentage: 36 },
                    { name: 'Trade & Commerce', count: 8, percentage: 29 },
                    { name: 'Employment', count: 6, percentage: 21 },
                    { name: 'Financial Services', count: 4, percentage: 14 }
                ],
                recentTopics: [
                    'Economic Recovery Plan',
                    'Trade Agreement Negotiations',
                    'Job Creation Initiatives',
                    'Banking Sector Reform'
                ]
            },
            {
                name: 'Security',
                count: 13,
                percentage: 8,
                color: 'bg-red-500',
                trend: '+5%',
                trendDirection: 'up',
                subcategories: [
                    { name: 'National Security', count: 5, percentage: 38 },
                    { name: 'Cybersecurity', count: 4, percentage: 31 },
                    { name: 'Law Enforcement', count: 3, percentage: 23 },
                    { name: 'Border Security', count: 1, percentage: 8 }
                ],
                recentTopics: [
                    'Cybersecurity Framework',
                    'Border Control Measures',
                    'Law Enforcement Training',
                    'National Security Strategy'
                ]
            }
        ],
        trends: {
            '7d': { total: 12, change: '+3' },
            '30d': { total: 45, change: '+8' },
            '90d': { total: 156, change: '+23' }
        }
    };

    const renderHeader = () => (
        <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 border border-slate-200 p-8 rounded-2xl mb-8 shadow-sm">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/reports')}
                        className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                    >
                        <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Topic Categories Distribution</h1>
                        <p className="text-slate-600 mt-1">Comprehensive analysis of parliamentary topics by category and trends</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <select 
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        className="px-4 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                    </select>
                    <select 
                        value={selectedFormat}
                        onChange={(e) => setSelectedFormat(e.target.value)}
                        className="px-4 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="pdf">PDF</option>
                        <option value="excel">Excel</option>
                        <option value="csv">CSV</option>
                    </select>
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export Report
                    </button>
                </div>
            </div>
        </div>
    );

    const renderOverviewStats = () => (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-600">Total Topics</p>
                        <p className="text-2xl font-bold text-slate-800">{topicCategoriesData.totalTopics}</p>
                    </div>
                    <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">Across all categories</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-600">Categories</p>
                        <p className="text-2xl font-bold text-slate-800">{topicCategoriesData.categories.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                    </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">Active categories</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-600">This Period</p>
                        <p className="text-2xl font-bold text-slate-800">{topicCategoriesData.trends[selectedPeriod].total}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                    </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">{topicCategoriesData.trends[selectedPeriod].change} from previous</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-600">Top Category</p>
                        <p className="text-2xl font-bold text-slate-800">Healthcare</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                    </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">29% of all topics</p>
            </div>
        </div>
    );

    const renderCategoryDetails = () => (
        <div className="space-y-6">
            {topicCategoriesData.categories.map((category, index) => (
                <div key={index} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <div className={`w-4 h-4 rounded-full ${category.color}`}></div>
                                <h3 className="text-xl font-semibold text-gray-900">{category.name}</h3>
                                <span className="text-2xl font-bold text-gray-800">{category.count}</span>
                                <span className="text-sm text-gray-500">topics ({category.percentage}%)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${
                                    category.trendDirection === 'up' ? 'text-green-600' : 'text-red-600'
                                }`}>
                                    {category.trend}
                                </span>
                                <svg className={`w-4 h-4 ${
                                    category.trendDirection === 'up' ? 'text-green-600' : 'text-red-600'
                                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
                                        category.trendDirection === 'up' 
                                            ? "M7 17l9.2-9.2M17 17V7H7" 
                                            : "M17 7l-9.2 9.2M7 7v10h10"
                                    } />
                                </svg>
                            </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                                className={`h-3 rounded-full ${category.color}`}
                                style={{width: `${category.percentage}%`}}
                            ></div>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div>
                                <h4 className="text-lg font-semibold text-gray-900 mb-4">Subcategories</h4>
                                <div className="space-y-3">
                                    {category.subcategories.map((sub, subIndex) => (
                                        <div key={subIndex} className="flex items-center justify-between">
                                            <span className="text-sm text-gray-700">{sub.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-gray-900">{sub.count}</span>
                                                <span className="text-xs text-gray-500">({sub.percentage}%)</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-lg font-semibold text-gray-900 mb-4">Recent Topics</h4>
                                <div className="space-y-2">
                                    {category.recentTopics.map((topic, topicIndex) => (
                                        <div key={topicIndex} className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${category.color}`}></div>
                                            <span className="text-sm text-gray-700">{topic}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    const renderTrendsChart = () => (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Category Trends Over Time</h3>
            <div className="space-y-4">
                {topicCategoriesData.categories.map((category, index) => (
                    <div key={index} className="flex items-center gap-4">
                        <div className="flex items-center gap-2 w-24">
                            <div className={`w-3 h-3 rounded-full ${category.color}`}></div>
                            <span className="text-sm font-medium text-gray-700">{category.name}</span>
                        </div>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div 
                                className={`h-2 rounded-full ${category.color}`}
                                style={{width: `${category.percentage}%`}}
                            ></div>
                        </div>
                        <div className="w-16 text-right">
                            <span className="text-sm font-medium text-gray-900">{category.count}</span>
                        </div>
                        <div className="w-16 text-right">
                            <span className="text-sm text-gray-500">{category.percentage}%</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderInsights = () => (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-200">
            <h3 className="text-lg font-semibold text-indigo-900 mb-4">Key Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h4 className="font-medium text-indigo-800 mb-2">Top Performing Categories</h4>
                    <ul className="space-y-1 text-sm text-indigo-700">
                        <li>• Healthcare leads with 29% of all topics</li>
                        <li>• Environment shows highest growth (+15%)</li>
                        <li>• Education maintains steady engagement</li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-medium text-indigo-800 mb-2">Emerging Trends</h4>
                    <ul className="space-y-1 text-sm text-indigo-700">
                        <li>• Mental health topics increasing rapidly</li>
                        <li>• Climate change discussions growing</li>
                        <li>• Digital transformation in education</li>
                    </ul>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {renderHeader()}
                {renderOverviewStats()}
                {renderTrendsChart()}
                {renderCategoryDetails()}
                {renderInsights()}
            </div>
        </div>
    );
};

export default TopicCategoriesReport;
