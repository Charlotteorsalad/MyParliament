import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApi } from '../../hooks';
import { feedbackApi } from '../../api';
import { useLanguage } from '../../contexts/LanguageContext';

export default function FeedbackPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { executeApiCall, loading, error } = useApi();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState('feedback');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState({
        type: 'general',
        subject: '',
        message: '',
        priority: 'medium',
        category: 'general'
    });
    const [survey, setSurvey] = useState({
        satisfaction: '',
        improvements: '',
        features: [],
        comments: '',
        contact: false,
        email: ''
    });
    const [showAlert, setShowAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [alertType, setAlertType] = useState('success'); // 'error', 'success', 'warning'

    // Helper function to show alerts
    const showAlertMessage = (message, type = 'success') => {
        setAlertMessage(message);
        setAlertType(type);
        setShowAlert(true);
    };

    // Get topic context from URL parameters
    const urlParams = new URLSearchParams(location.search);
    const topicTitle = urlParams.get('topic');
    const topicCategory = urlParams.get('category');

    // Pre-populate feedback if coming from a topic
    useEffect(() => {
        if (topicTitle && topicCategory) {
            setFeedback(prev => ({
                ...prev,
                subject: `Feedback on: ${topicTitle}`,
                category: topicCategory.toLowerCase().replace(/\s+/g, '-'),
                message: `I would like to provide feedback regarding the topic "${topicTitle}".\n\n`
            }));
        }
    }, [topicTitle, topicCategory]);

    const handleFeedbackSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const feedbackData = {
                title: feedback.subject,
                content: feedback.message,
                category: feedback.type === 'general' ? 'General' : 
                         feedback.type === 'bug' ? 'Bug' :
                         feedback.type === 'feature' ? 'Feature Request' :
                         feedback.type === 'improvement' ? 'Suggestion' :
                         feedback.type === 'complaint' ? 'Complaint' : 'General',
                rating: feedback.priority === 'high' ? 5 : 
                       feedback.priority === 'medium' ? 3 : 1
            };

            await executeApiCall(() => feedbackApi.submitFeedback(feedbackData));
            
            // Reset form
            setFeedback({
                type: 'general',
                subject: '',
                message: '',
                priority: 'medium',
                category: 'general'
            });
            showAlertMessage(t('thankYouForYourFeedback'), 'success');
        } catch (err) {
            console.error('Failed to submit feedback:', err);
            showAlertMessage(t('failedToSubmitFeedback'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSurveySubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const surveyData = {
                title: 'Platform Survey Response',
                content: `Satisfaction: ${survey.satisfaction}\n\nImprovements: ${survey.improvements}\n\nFeatures: ${survey.features.join(', ')}\n\nComments: ${survey.comments}\n\nContact: ${survey.contact ? 'Yes' : 'No'}${survey.contact && survey.email ? `\nEmail: ${survey.email}` : ''}`,
                category: 'General',
                rating: survey.satisfaction === 'very-satisfied' ? 5 :
                       survey.satisfaction === 'satisfied' ? 4 :
                       survey.satisfaction === 'neutral' ? 3 :
                       survey.satisfaction === 'dissatisfied' ? 2 : 1
            };

            await executeApiCall(() => feedbackApi.submitFeedback(surveyData));
            
            // Reset form
            setSurvey({
                satisfaction: '',
                improvements: '',
                features: [],
                comments: '',
                contact: false,
                email: ''
            });
            showAlertMessage(t('thankYouForCompletingSurvey'), 'success');
        } catch (err) {
            console.error('Failed to submit survey:', err);
            showAlertMessage(t('failedToSubmitSurvey'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFeatureToggle = (feature) => {
        setSurvey(prev => ({
            ...prev,
            features: prev.features.includes(feature)
                ? prev.features.filter(f => f !== feature)
                : [...prev.features, feature]
        }));
    };

    const renderFeedbackTab = () => (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('sendFeedbackToAdmin')}</h2>
                <p className="text-gray-600">{t('shareYourThoughtsReportIssues')}</p>
            </div>

            <form onSubmit={handleFeedbackSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('feedbackType')}</label>
                        <select
                            value={feedback.type}
                            onChange={(e) => setFeedback(prev => ({ ...prev, type: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="general">{t('generalFeedback')}</option>
                            <option value="bug">{t('bugReport')}</option>
                            <option value="feature">{t('featureRequest')}</option>
                            <option value="improvement">{t('improvementSuggestion')}</option>
                            <option value="complaint">{t('complaint')}</option>
                            <option value="compliment">{t('compliment')}</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('priority')}</label>
                        <select
                            value={feedback.priority}
                            onChange={(e) => setFeedback(prev => ({ ...prev, priority: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="low">{t('low')}</option>
                            <option value="medium">{t('medium')}</option>
                            <option value="high">{t('high')}</option>
                            <option value="urgent">{t('urgent')}</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('category')}</label>
                    <select
                        value={feedback.category}
                        onChange={(e) => setFeedback(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="general">{t('general')}</option>
                        <option value="parliamentary">{t('parliamentaryIssues')}</option>
                        <option value="education">{t('educationalContent')}</option>
                        <option value="forum">{t('discussionForum')}</option>
                        <option value="mp-dashboard">{t('mpDashboard')}</option>
                        <option value="user-interface">{t('userInterface')}</option>
                        <option value="performance">{t('performance')}</option>
                        <option value="security">{t('security')}</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('subject')}</label>
                    <input
                        type="text"
                        value={feedback.subject}
                        onChange={(e) => setFeedback(prev => ({ ...prev, subject: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder={t('briefDescriptionOfFeedback')}
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('message')}</label>
                    <textarea
                        value={feedback.message}
                        onChange={(e) => setFeedback(prev => ({ ...prev, message: e.target.value }))}
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder={t('pleaseProvideDetailedFeedback')}
                        required
                    />
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                {t('submitting')}
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                                {t('submitFeedback')}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );

    const renderSurveyTab = () => (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('platformSurvey')}</h2>
                <p className="text-gray-600">{t('platformSurveyDescription')}</p>
            </div>

            <form onSubmit={handleSurveySubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">{t('howSatisfiedWithPlatform')}</label>
                    <div className="grid grid-cols-5 gap-3">
                        {[
                            { value: 'very-dissatisfied', label: t('veryDissatisfied'), color: 'bg-red-100 text-red-800 border-red-200' },
                            { value: 'dissatisfied', label: t('dissatisfied'), color: 'bg-orange-100 text-orange-800 border-orange-200' },
                            { value: 'neutral', label: t('neutral'), color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
                            { value: 'satisfied', label: t('satisfied'), color: 'bg-blue-100 text-blue-800 border-blue-200' },
                            { value: 'very-satisfied', label: t('verySatisfied'), color: 'bg-green-100 text-green-800 border-green-200' }
                        ].map((option) => (
                            <label key={option.value} className="cursor-pointer">
                                <input
                                    type="radio"
                                    name="satisfaction"
                                    value={option.value}
                                    checked={survey.satisfaction === option.value}
                                    onChange={(e) => setSurvey(prev => ({ ...prev, satisfaction: e.target.value }))}
                                    className="sr-only"
                                />
                                <div className={`p-3 text-center rounded-lg border-2 transition-all ${
                                    survey.satisfaction === option.value 
                                        ? option.color + ' border-current' 
                                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                }`}>
                                    <div className="text-sm font-medium">{option.label}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">{t('whichAreasToImprove')}</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                            { key: 'User Interface Design', label: t('userInterfaceDesign') },
                            { key: 'Navigation & Usability', label: t('navigationUsability') },
                            { key: 'Educational Content Quality', label: t('educationalContentQuality') },
                            { key: 'Discussion Forum Features', label: t('discussionForumFeatures') },
                            { key: 'MP Dashboard Information', label: t('mpDashboardInformation') },
                            { key: 'Search Functionality', label: t('searchFunctionality') },
                            { key: 'Mobile Experience', label: t('mobileExperience') },
                            { key: 'Loading Speed', label: t('loadingSpeed') },
                            { key: 'Content Organization', label: t('contentOrganization') },
                            { key: 'Notification System', label: t('notificationSystem') }
                        ].map((feature) => (
                            <label key={feature.key} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={survey.features.includes(feature.key)}
                                    onChange={() => handleFeatureToggle(feature.key)}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <span className="ml-3 text-sm text-gray-700">{feature.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('specificImprovementsSuggest')}</label>
                    <textarea
                        value={survey.improvements}
                        onChange={(e) => setSurvey(prev => ({ ...prev, improvements: e.target.value }))}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder={t('specificImprovementsPlaceholder')}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('additionalComments')}</label>
                    <textarea
                        value={survey.comments}
                        onChange={(e) => setSurvey(prev => ({ ...prev, comments: e.target.value }))}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder={t('additionalCommentsPlaceholder')}
                    />
                </div>

                <div className="border-t border-gray-200 pt-6">
                    <div className="flex items-center mb-4">
                        <input
                            type="checkbox"
                            id="contact"
                            checked={survey.contact}
                            onChange={(e) => setSurvey(prev => ({ ...prev, contact: e.target.checked }))}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <label htmlFor="contact" className="ml-3 text-sm text-gray-700">
                            {t('contactForFollowUp')}
                        </label>
                    </div>
                    
                    {survey.contact && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('emailAddress')}</label>
                            <input
                                type="email"
                                value={survey.email}
                                onChange={(e) => setSurvey(prev => ({ ...prev, email: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder={t('emailPlaceholder')}
                            />
                        </div>
                    )}
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isSubmitting || !survey.satisfaction}
                        className="px-8 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                {t('submitting')}
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {t('submitSurvey')}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            <div className="max-w-4xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-4 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        {t('back')}
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('feedbackAndSurvey')}</h1>
                    <p className="text-lg text-gray-600">{t('shareYourThoughts')}</p>
                    
                    {/* Topic Context Banner */}
                    {topicTitle && topicCategory && (
                        <div className="mt-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">{t('providingFeedbackFor')} {topicTitle}</h3>
                                    <p className="text-sm text-gray-600">Category: {topicCategory}</p>
                                </div>
                                <button
                                    onClick={() => navigate('/feedback')}
                                    className="ml-auto px-3 py-1 text-sm text-emerald-600 hover:text-emerald-700 border border-emerald-300 rounded-md hover:bg-emerald-50 transition-colors"
                                >
                                    {t('generalFeedback')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation Tabs */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-8">
                    <div className="border-b border-gray-200">
                        <nav className="flex space-x-8 px-6">
                            {[
                                { id: 'feedback', label: t('sendFeedback'), icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
                                { id: 'survey', label: t('platformSurvey'), icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                                        activeTab === tab.id
                                            ? 'border-indigo-500 text-indigo-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                                    </svg>
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    <div className="p-8">
                        {activeTab === 'feedback' && renderFeedbackTab()}
                        {activeTab === 'survey' && renderSurveyTab()}
                    </div>
                </div>
            </div>

            {/* In-App Alert Modal */}
            {showAlert && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                        <div className="p-6">
                            <div className="flex items-center">
                                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                                    alertType === 'error' ? 'bg-red-100' : 
                                    alertType === 'success' ? 'bg-green-100' : 
                                    'bg-yellow-100'
                                }`}>
                                    {alertType === 'error' ? (
                                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    ) : alertType === 'success' ? (
                                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : (
                                        <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    )}
                                </div>
                                <div className="ml-4">
                                    <h3 className={`text-lg font-medium ${
                                        alertType === 'error' ? 'text-red-900' : 
                                        alertType === 'success' ? 'text-green-900' : 
                                        'text-yellow-900'
                                    }`}>
                                        {alertType === 'error' ? t('error') : 
                                         alertType === 'success' ? t('success') : 
                                         t('warning')}
                                    </h3>
                                    <p className={`mt-1 text-sm ${
                                        alertType === 'error' ? 'text-red-700' : 
                                        alertType === 'success' ? 'text-green-700' : 
                                        'text-yellow-700'
                                    }`}>
                                        {alertMessage}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end">
                                <button
                                    onClick={() => setShowAlert(false)}
                                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                                        alertType === 'error' ? 'bg-red-600 hover:bg-red-700 text-white' : 
                                        alertType === 'success' ? 'bg-green-600 hover:bg-green-700 text-white' : 
                                        'bg-yellow-600 hover:bg-yellow-700 text-white'
                                    }`}
                                >
                                    {t('ok')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
