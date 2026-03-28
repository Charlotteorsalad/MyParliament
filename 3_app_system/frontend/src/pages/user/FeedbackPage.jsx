import { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApi, useAuth } from '../../hooks';
import { feedbackApi, topicApi } from '../../api';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSSEEvent } from '../../contexts/SSEContext';

function SearchableDropdown({ options = [], value, onChange, placeholder, disabled = false, loading = false, error = false }) {
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const [style, setStyle] = useState({});
    const inputRef = useRef(null);
    const containerRef = useRef(null);
    const portalRef = useRef(null);

    useEffect(() => {
        const close = (e) => {
            const clickedTrigger = containerRef.current?.contains(e.target);
            const clickedPortal = portalRef.current?.contains(e.target);
            if (!clickedTrigger && !clickedPortal) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const handleFocus = () => {
        if (disabled) return;
        if (inputRef.current) {
            const r = inputRef.current.getBoundingClientRect();
            setStyle({ position: 'fixed', top: r.bottom + 4, left: r.left, width: r.width, zIndex: 100000 });
        }
        setSearch('');
        setOpen(true);
    };

    const filtered = options.filter((opt) => opt.toLowerCase().includes(search.toLowerCase()));
    const displayValue = open ? search : (value || '');

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={displayValue}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={handleFocus}
                    disabled={disabled}
                    placeholder={placeholder}
                    className={`w-full px-3 py-2 pr-9 border rounded-lg transition-colors ${
                        error
                            ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                            : 'border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                    } ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-900'}`}
                />
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>
            {open && !disabled && ReactDOM.createPortal(
                <div ref={portalRef} style={style} className="bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                    {loading ? (
                        <div className="px-3 py-3 text-sm text-gray-400">Loading...</div>
                    ) : filtered.length === 0 ? (
                        <div className="px-3 py-3 text-sm text-gray-400">No results</div>
                    ) : (
                        filtered.map((opt) => (
                            <button
                                key={opt}
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    onChange(opt);
                                    setSearch('');
                                    setOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                    opt === value
                                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                                        : 'text-gray-700 hover:bg-gray-50 hover:text-indigo-600'
                                }`}
                            >
                                {opt}
                            </button>
                        ))
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}

export default function FeedbackPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { executeApiCall, loading, error } = useApi();
    const { user } = useAuth();
    const { t } = useLanguage();
    const FEEDBACK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
    const [activeTab, setActiveTab] = useState('feedback');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedbackType, setFeedbackType] = useState('topic-related');
    const OTHER_CATEGORIES = ['Bug Report', 'UI / Theme', 'Feature Request', 'Performance', 'Security', 'General'];
    const [feedback, setFeedback] = useState({
        parliamentaryCategory: '',
        linkedTopic: '',
        otherCategory: '',
        subject: '',
        message: '',
        priority: 'Medium'
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
    const [shakeFeedbackForm, setShakeFeedbackForm] = useState(false);
    const [shakeSurveyForm, setShakeSurveyForm] = useState(false);
    const [attachments, setAttachments] = useState([]);
    const [attachmentError, setAttachmentError] = useState('');
    const [feedbackErrors, setFeedbackErrors] = useState({});
    const [subjectError, setSubjectError] = useState('');
    const [messageError, setMessageError] = useState('');
    const [feedbackSubmitError, setFeedbackSubmitError] = useState('');
    const [satisfactionError, setSatisfactionError] = useState('');
    const [whichAreasError, setWhichAreasError] = useState('');
    const [specificImprovementsError, setSpecificImprovementsError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [surveySubmitError, setSurveySubmitError] = useState('');

    // Dynamic surveys from API
    const [activeSurveys, setActiveSurveys] = useState([]);
    const [loadingSurveys, setLoadingSurveys] = useState(false);
    const [selectedSurvey, setSelectedSurvey] = useState(null);
    const [surveyAnswers, setSurveyAnswers] = useState({});
    const [submittingSurvey, setSubmittingSurvey] = useState(false);
    const [surveyDone, setSurveyDone] = useState(false);
    const [dynamicSurveyError, setDynamicSurveyError] = useState('');
    const [sentFeedback, setSentFeedback] = useState([]);
    const [loadingSentFeedback, setLoadingSentFeedback] = useState(false);
    const [modalCategories, setModalCategories] = useState([]);
    const [modalTopics, setModalTopics] = useState([]);
    const [modalCategoriesLoading, setModalCategoriesLoading] = useState(false);
    const [modalTopicsLoading, setModalTopicsLoading] = useState(false);
    const modalPipelineRef = useRef('pipeline5');

    const triggerShake = (setShake) => {
        setShake(true);
        setTimeout(() => setShake(false), 600);
    };

    // Helper function to show alerts
    const showAlertMessage = (message, type = 'success') => {
        setAlertMessage(message);
        setAlertType(type);
        setShowAlert(true);
    };

    const formatDateTime = (value) => {
        if (!value) return t('notAvailable');
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return t('notAvailable');
        return d.toLocaleString('en-MY', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'Resolved':
                return 'bg-green-100 text-green-800';
            case 'In-Progress':
                return 'bg-blue-100 text-blue-800';
            case 'Archived':
                return 'bg-gray-100 text-gray-700';
            default:
                return 'bg-amber-100 text-amber-800';
        }
    };

    // Get topic context from URL parameters
    const urlParams = new URLSearchParams(location.search);
    const topicTitle = urlParams.get('topic');
    const topicCategory = urlParams.get('category');
    const returnTo = urlParams.get('returnTo');

    // Pre-populate feedback if coming from an issue detail page
    useEffect(() => {
        if (topicTitle && topicCategory) {
            setFeedback(prev => ({
                ...prev,
                parliamentaryCategory: topicCategory,
                linkedTopic: topicTitle,
                subject: t('feedbackOnTopicSubject').replace('{topic}', topicTitle),
                message: t('feedbackOnTopicMessageIntro').replace('{topic}', topicTitle)
            }));
        }
    }, [topicTitle, topicCategory, t]);

    // Fetch parliamentary categories for feedback form
    useEffect(() => {
        if (activeTab !== 'feedback') return;
        const load = async () => {
            setModalCategoriesLoading(true);
            try {
                let pid = 'pipeline5';
                try {
                    const def = await topicApi.getDefaultPipeline();
                    const d = def?.data || def;
                    if (d?.success && d.pipeline_id) pid = d.pipeline_id;
                } catch { /* ignore */ }
                modalPipelineRef.current = pid;
                const res = await topicApi.getFilters(pid);
                const data = res?.data || res;
                setModalCategories(data?.filters?.categories || []);
            } catch {
                setModalCategories([]);
            } finally {
                setModalCategoriesLoading(false);
            }
        };
        load();
    }, [activeTab]);

    // Fetch parliamentary topics based on selected category
    useEffect(() => {
        const cat = feedback.parliamentaryCategory;
        if (activeTab !== 'feedback' || !cat) {
            setModalTopics([]);
            return;
        }
        const load = async () => {
            setModalTopicsLoading(true);
            try {
                const res = await topicApi.getIssuePortalTopics(modalPipelineRef.current, { category: cat });
                const data = res?.data || res;
                const titles = [...new Set((data?.topics || []).map((t) => t.title).filter(Boolean))].sort();
                setModalTopics(titles);
            } catch {
                setModalTopics([]);
            } finally {
                setModalTopicsLoading(false);
            }
        };
        load();
    }, [activeTab, feedback.parliamentaryCategory]);

    // Pre-fill survey email with logged-in user's email (user can still edit)
    useEffect(() => {
        if (user?.email && !survey.email) {
            setSurvey(prev => ({ ...prev, email: user.email }));
        }
    }, [user?.email]);

    const handleAttachmentChange = (e) => {
        const files = Array.from(e.target.files || []);
        const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
        const oversized = files.filter((f) => f.size > MAX_SIZE);
        if (oversized.length > 0) {
            setAttachmentError(`File "${oversized[0].name}" exceeds the 10 MB limit.`);
            return;
        }
        const total = attachments.length + files.length;
        if (total > 5) {
            setAttachmentError('You can attach a maximum of 5 files.');
            return;
        }
        setAttachmentError('');
        setAttachments((prev) => [...prev, ...files]);
        e.target.value = '';
    };

    const removeAttachment = (index) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
        setAttachmentError('');
    };

    const handleFeedbackSubmit = async (e) => {
        e.preventDefault();
        setFeedbackSubmitError('');
        setAttachmentError('');
        const nextErrors = {
            parliamentaryCategory: feedbackType === 'topic-related' && !feedback.parliamentaryCategory.trim() ? t('parliamentaryCategoryRequired') : '',
            linkedTopic: feedbackType === 'topic-related' && !feedback.linkedTopic.trim() ? t('feedbackLinkedTopicRequired') : '',
            otherCategory: feedbackType === 'other' && !feedback.otherCategory ? 'Please select a category.' : '',
            subject: !feedback.subject.trim() ? t('subjectRequired') : '',
            message: !feedback.message.trim() ? t('messageRequired') : ''
        };
        setFeedbackErrors(nextErrors);
        setSubjectError(nextErrors.subject);
        setMessageError(nextErrors.message);
        if (Object.values(nextErrors).some(Boolean)) {
            triggerShake(setShakeFeedbackForm);
            return;
        }
        setIsSubmitting(true);

        try {
            const feedbackData = {
                title: feedback.subject,
                content: feedback.message,
                category: feedbackType === 'other' ? feedback.otherCategory : 'General',
                parliamentaryCategory: feedbackType === 'topic-related' ? feedback.parliamentaryCategory : '',
                linkedTopic: feedbackType === 'topic-related' ? feedback.linkedTopic : '',
                priority: feedback.priority,
                rating: feedback.priority === 'Critical' ? 5 :
                       feedback.priority === 'High' ? 4 :
                       feedback.priority === 'Medium' ? 3 : 2,
                attachments: feedbackType === 'other' ? attachments : []
            };

            await executeApiCall(() => feedbackApi.submitFeedback(feedbackData));
            
            // Reset form
            setFeedback({
                parliamentaryCategory: topicCategory || '',
                linkedTopic: topicTitle || '',
                otherCategory: '',
                subject: topicTitle ? t('feedbackOnTopicSubject').replace('{topic}', topicTitle) : '',
                message: topicTitle ? t('feedbackOnTopicMessageIntro').replace('{topic}', topicTitle) : '',
                priority: 'Medium'
            });
            setAttachments([]);
            setAttachmentError('');
            setFeedbackErrors({});
            setSubjectError('');
            setMessageError('');
            fetchSentFeedback();
            showAlertMessage(t('thankYouForYourFeedback'), 'success');
        } catch (err) {
            console.error('Failed to submit feedback:', err);
            setFeedbackSubmitError(t('failedToSubmitFeedback'));
            triggerShake(setShakeFeedbackForm);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSurveySubmit = async (e) => {
        e.preventDefault();
        setSurveySubmitError('');
        const satErr = !survey.satisfaction ? t('pleaseSelectSatisfaction') : '';
        const areasErr = !survey.features?.length ? t('pleaseSelectAtLeastOneArea') : '';
        const improvementsErr = !survey.improvements?.trim() ? t('specificImprovementsRequired') : '';
        const emErr = survey.contact && !survey.email?.trim() ? t('emailRequiredForFollowUp') : '';
        setSatisfactionError(satErr);
        setWhichAreasError(areasErr);
        setSpecificImprovementsError(improvementsErr);
        setEmailError(emErr);
        if (satErr || areasErr || improvementsErr || emErr) {
            triggerShake(setShakeSurveyForm);
            return;
        }
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
            setSurveySubmitError(t('failedToSubmitSurvey'));
            triggerShake(setShakeSurveyForm);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Fetch active surveys whenever user opens the Survey tab
    const fetchActiveSurveys = useCallback(async () => {
        setLoadingSurveys(true);
        try {
            const data = await feedbackApi.getActiveSurveys();
            setActiveSurveys(Array.isArray(data) ? data : []);
        } catch {
            setActiveSurveys([]);
        } finally { setLoadingSurveys(false); }
    }, []);

    const fetchSentFeedback = useCallback(async () => {
        setLoadingSentFeedback(true);
        try {
            const data = await executeApiCall(() => feedbackApi.getUserFeedback({ page: 1, limit: 50 }));
            setSentFeedback(Array.isArray(data?.feedback) ? data.feedback : []);
        } catch {
            setSentFeedback([]);
        } finally {
            setLoadingSentFeedback(false);
        }
    }, [executeApiCall]);

    useEffect(() => {
        if (activeTab === 'survey') fetchActiveSurveys();
    }, [activeTab, fetchActiveSurveys]);

    useEffect(() => {
        if (activeTab === 'sent-feedback') fetchSentFeedback();
    }, [activeTab, fetchSentFeedback]);

    // Real-time: when admin replies to this user's feedback, auto-refresh the sent list
    useSSEEvent('feedback_reply', useCallback(() => {
        fetchSentFeedback();
    }, [fetchSentFeedback]));

    const handleSelectSurvey = (sv) => {
        setSelectedSurvey(sv);
        const answerMap = {};
        (sv?.currentUserResponse?.answers || []).forEach((entry) => {
            answerMap[entry.questionId] = entry.answer;
        });
        setSurveyAnswers(answerMap);
        setSurveyDone(false);
        setDynamicSurveyError('');
    };

    const handleAnswerChange = (questionId, value) => {
        setSurveyAnswers((prev) => ({ ...prev, [questionId]: value }));
        setDynamicSurveyError('');
    };

    const handleMultiChoiceToggle = (questionId, option) => {
        setSurveyAnswers((prev) => {
            const current = Array.isArray(prev[questionId]) ? prev[questionId] : [];
            return {
                ...prev,
                [questionId]: current.includes(option)
                    ? current.filter((o) => o !== option)
                    : [...current, option]
            };
        });
        setDynamicSurveyError('');
    };

    const handleDynamicSurveySubmit = async () => {
        if (!selectedSurvey) return;
        // Validate required questions
        const missing = (selectedSurvey.questions || []).filter((q) => {
            if (!q.required) return false;
            const ans = surveyAnswers[q.id];
            if (ans === undefined || ans === null || ans === '') return true;
            if (Array.isArray(ans) && ans.length === 0) return true;
            return false;
        });
        if (missing.length > 0) {
            setDynamicSurveyError(`Please answer all required questions: ${missing.map((q) => q.text).join(', ')}`);
            return;
        }
        const answers = Object.entries(surveyAnswers).map(([questionId, answer]) => ({ questionId, answer }));
        setSubmittingSurvey(true);
        setDynamicSurveyError('');
        try {
            await feedbackApi.submitSurveyResponse(selectedSurvey._id, answers);
            setSurveyDone(true);
        } catch (err) {
            setDynamicSurveyError(err?.response?.data?.message || t('failedToSubmitSurvey'));
        } finally { setSubmittingSurvey(false); }
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
            {(returnTo || topicTitle) && (
                <button
                    type="button"
                    onClick={() => {
                        if (returnTo) navigate(returnTo);
                        else navigate(-1);
                    }}
                    className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 text-sm font-medium transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t('backToPreviousPage')}
                </button>
            )}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('sendFeedbackToAdmin')}</h2>
                <p className="text-gray-600">{t('shareYourThoughtsReportIssues')}</p>
            </div>

            {feedbackSubmitError && (
                <p className="text-sm text-red-600 font-medium mb-2">{feedbackSubmitError}</p>
            )}
            <form onSubmit={handleFeedbackSubmit} noValidate className={`space-y-6 ${shakeFeedbackForm ? 'form-shake' : ''}`}>
                {/* Feedback type radio */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Feedback Type</label>
                    <div className="flex flex-wrap gap-4">
                        {[
                            { value: 'topic-related', label: 'Topic Related', desc: 'Feedback about a specific parliamentary topic' },
                            { value: 'other', label: 'Other', desc: 'Bug reports, UI/theme issues, feature requests, etc.' }
                        ].map((opt) => (
                            <label
                                key={opt.value}
                                className={`flex items-start gap-3 flex-1 min-w-[220px] p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                    feedbackType === opt.value
                                        ? 'border-indigo-500 bg-indigo-50'
                                        : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="feedbackType"
                                    value={opt.value}
                                    checked={feedbackType === opt.value}
                                    onChange={() => {
                                        setFeedbackType(opt.value);
                                        setFeedbackErrors({});
                                        setFeedbackSubmitError('');
                                        setAttachments([]);
                                        setAttachmentError('');
                                        setFeedback(prev => ({ ...prev, parliamentaryCategory: '', linkedTopic: '', otherCategory: '' }));
                                    }}
                                    className="mt-0.5 w-4 h-4 accent-indigo-600 flex-shrink-0"
                                />
                                <div>
                                    <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('categoryLabel')} <span className="text-red-500">*</span>
                        </label>
                        {feedbackType === 'topic-related' ? (
                            <>
                                <SearchableDropdown
                                    options={modalCategories}
                                    value={feedback.parliamentaryCategory}
                                    onChange={(value) => {
                                        setFeedback(prev => ({ ...prev, parliamentaryCategory: value, linkedTopic: '' }));
                                        setFeedbackErrors(prev => ({ ...prev, parliamentaryCategory: '', linkedTopic: '' }));
                                        setFeedbackSubmitError('');
                                    }}
                                    placeholder={t('categoryLabel')}
                                    loading={modalCategoriesLoading}
                                    error={!!feedbackErrors.parliamentaryCategory}
                                />
                                {feedbackErrors.parliamentaryCategory && (
                                    <p className="mt-1 text-sm text-red-600">{feedbackErrors.parliamentaryCategory}</p>
                                )}
                            </>
                        ) : (
                            <>
                                <select
                                    value={feedback.otherCategory}
                                    onChange={(e) => {
                                        setFeedback(prev => ({ ...prev, otherCategory: e.target.value }));
                                        setFeedbackErrors(prev => ({ ...prev, otherCategory: '' }));
                                        setFeedbackSubmitError('');
                                    }}
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${feedbackErrors.otherCategory ? 'border-red-500' : 'border-gray-300'}`}
                                >
                                    <option value="">Select a category</option>
                                    {OTHER_CATEGORIES.map((cat) => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                                {feedbackErrors.otherCategory && (
                                    <p className="mt-1 text-sm text-red-600">{feedbackErrors.otherCategory}</p>
                                )}
                            </>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('priority')}</label>
                        <select
                            value={feedback.priority}
                            onChange={(e) => setFeedback(prev => ({ ...prev, priority: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            {FEEDBACK_PRIORITIES.map((priority) => (
                                <option key={priority} value={priority}>{priority}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {feedbackType === 'topic-related' && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('linkedTopicLabel')} <span className="text-red-500">*</span>
                        {!feedback.parliamentaryCategory.trim() && (
                            <span className="ml-1 text-xs text-gray-400 font-normal">({t('selectCategoryFirst')})</span>
                        )}
                    </label>
                    <SearchableDropdown
                        options={modalTopics}
                        value={feedback.linkedTopic}
                        onChange={(value) => {
                            setFeedback(prev => ({ ...prev, linkedTopic: value }));
                            setFeedbackErrors(prev => ({ ...prev, linkedTopic: '' }));
                            setFeedbackSubmitError('');
                        }}
                        placeholder={t('linkedTopicPlaceholder')}
                        disabled={!feedback.parliamentaryCategory.trim()}
                        loading={modalTopicsLoading}
                        error={!!feedbackErrors.linkedTopic}
                    />
                    {feedbackErrors.linkedTopic && (
                        <p className="mt-1 text-sm text-red-600">{feedbackErrors.linkedTopic}</p>
                    )}
                    {topicTitle && feedback.parliamentaryCategory.trim() && (
                        <p className="mt-1 text-xs text-indigo-500 flex items-center gap-1">
                            <svg className="w-3 h-3 inline" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            {t('autoFilledFromIssuePortal')}
                        </p>
                    )}
                </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('subject')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={feedback.subject}
                        onChange={(e) => {
                            setFeedback(prev => ({ ...prev, subject: e.target.value }));
                            setSubjectError('');
                            setFeedbackErrors(prev => ({ ...prev, subject: '' }));
                            setFeedbackSubmitError('');
                        }}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${subjectError ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder={t('briefDescriptionOfFeedback')}
                    />
                    {subjectError && (
                        <p className="mt-1 text-sm text-red-600">{subjectError}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('message')} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        value={feedback.message}
                        onChange={(e) => {
                            setFeedback(prev => ({ ...prev, message: e.target.value }));
                            setMessageError('');
                            setFeedbackErrors(prev => ({ ...prev, message: '' }));
                            setFeedbackSubmitError('');
                        }}
                        rows={6}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${messageError ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder={t('pleaseProvideDetailedFeedback')}
                    />
                    {messageError && (
                        <p className="mt-1 text-sm text-red-600">{messageError}</p>
                    )}
                </div>

                {/* Attachment upload — only shown for "Other" feedback type */}
                {feedbackType === 'other' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Attachments / Evidence
                            <span className="ml-1 text-xs text-gray-400 font-normal">(optional · images, PDF, Word, video · max 5 files · 10 MB each)</span>
                        </label>
                        <label className={`flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${attachmentError ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'}`}>
                            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span className="text-sm text-gray-600">Click to attach files</span>
                            <input
                                type="file"
                                multiple
                                accept="image/*,application/pdf,.doc,.docx,text/plain,video/mp4,video/quicktime"
                                onChange={handleAttachmentChange}
                                className="sr-only"
                            />
                        </label>
                        {attachmentError && (
                            <p className="mt-1 text-sm text-red-600">{attachmentError}</p>
                        )}
                        {attachments.length > 0 && (
                            <ul className="mt-2 space-y-1">
                                {attachments.map((file, i) => (
                                    <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <span className="truncate text-gray-700">{file.name}</span>
                                            <span className="text-gray-400 flex-shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeAttachment(i)}
                                            className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
                                            title="Remove"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

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

    const renderSentFeedbackTab = () => (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('viewSentFeedback')}</h2>
                <p className="text-gray-600">{t('viewSentFeedbackDescription')}</p>
            </div>

            {loadingSentFeedback ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
                    {t('loading')}
                </div>
            ) : sentFeedback.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <svg className="w-14 h-14 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('noSentFeedbackYet')}</h3>
                    <p className="text-gray-500">{t('noSentFeedbackDescription')}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {sentFeedback.map((item) => (
                        <div key={item._id || item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                                <div className="min-w-0">
                                    <h3 className="text-lg font-semibold text-gray-900 break-words">{item.title}</h3>
                                    <p className="mt-1 text-sm text-gray-500">{formatDateTime(item.createdDate || item.createdAt)}</p>
                                </div>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(item.status)}`}>
                                    {item.status || t('pending')}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-sm">
                                <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                                    <span className="font-medium text-gray-700">{t('categoryLabel')}:</span>{' '}
                                    <span className="text-gray-900">{item.parliamentaryCategory || item.category || t('notAvailable')}</span>
                                </div>
                                <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                                    <span className="font-medium text-gray-700">{t('linkedTopicLabel')}:</span>{' '}
                                    <span className="text-gray-900">{item.linkedTopic || t('notAvailable')}</span>
                                </div>
                            </div>

                            <div className="mb-4">
                                <p className="text-sm font-medium text-gray-700 mb-1">{t('message')}</p>
                                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 whitespace-pre-wrap break-words">
                                    {item.content}
                                </div>
                            </div>

                            {(() => {
                                const log = Array.isArray(item.responses) && item.responses.length > 0
                                    ? item.responses
                                    : item.adminResponse?.response
                                        ? [item.adminResponse]
                                        : [];
                                if (log.length === 0) {
                                    return (
                                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                            {t('noAdminReplyYet')}
                                        </div>
                                    );
                                }
                                return (
                                    <div className="rounded-lg border border-green-200 overflow-hidden">
                                        <div className="flex items-center gap-2 bg-green-600 px-4 py-2">
                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                            </svg>
                                            <p className="text-sm font-semibold text-white">
                                                {t('adminReply')} ({log.length})
                                            </p>
                                        </div>
                                        <div className="divide-y divide-green-100">
                                            {log.map((entry, idx) => (
                                                <div key={idx} className={`px-4 py-3 ${idx === log.length - 1 ? 'bg-green-50' : 'bg-white'}`}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                                            #{idx + 1}{idx === log.length - 1 ? ' · Latest' : ''}
                                                        </span>
                                                        <span className="text-xs text-gray-500">
                                                            {entry.respondedBy?.username || t('admin')} • {formatDateTime(entry.respondedAt)}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{entry.response}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const renderDynamicQuestion = (q, readOnly = false) => {
        const ans = surveyAnswers[q.id];
        const isRequired = q.required;

        if (q.type === 'rating') {
            return (
                <div className="flex flex-wrap gap-2">
                    {[1,2,3,4,5].map((v) => (
                        <button key={v} type="button"
                            onClick={() => !readOnly && handleAnswerChange(q.id, v)}
                            disabled={readOnly}
                            className={`w-11 h-11 rounded-xl font-semibold text-sm border-2 transition-all ${
                                ans === v
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400 hover:text-indigo-600'
                            } ${readOnly ? 'cursor-default' : ''}`}>
                            <span className="inline-flex items-center gap-1">
                                <span>{v}</span>
                                <svg className={`w-3.5 h-3.5 ${ans === v ? 'text-white' : 'text-amber-500'}`} fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.95-.69l1.07-3.292z" />
                                </svg>
                            </span>
                        </button>
                    ))}
                    {ans && <span className="ml-2 self-center text-sm text-gray-500">{ans}/5 selected</span>}
                </div>
            );
        }
        if (q.type === 'yes_no') {
            return (
                <div className="flex gap-3">
                    {['Yes', 'No'].map((opt) => (
                        <button key={opt} type="button"
                            onClick={() => !readOnly && handleAnswerChange(q.id, opt)}
                            disabled={readOnly}
                            className={`px-6 py-2.5 rounded-xl font-medium text-sm border-2 transition-all ${
                                ans === opt
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400'
                            } ${readOnly ? 'cursor-default' : ''}`}>
                            {opt}
                        </button>
                    ))}
                </div>
            );
        }
        if (q.type === 'multiple_choice') {
            const selected = Array.isArray(ans) ? ans : [];
            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(q.options || []).map((opt) => (
                        <label key={opt} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all
                            ${selected.includes(opt) ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}">
                            ${readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-indigo-50'}`}>
                            <input type="checkbox"
                                checked={selected.includes(opt)}
                                onChange={() => !readOnly && handleMultiChoiceToggle(q.id, opt)}
                                disabled={readOnly}
                                className="w-4 h-4 accent-indigo-600 flex-shrink-0"
                            />
                            <span className="text-sm text-gray-700">{opt}</span>
                        </label>
                    ))}
                </div>
            );
        }
        // text
        return (
            <textarea rows={3}
                value={ans || ''}
                onChange={(e) => !readOnly && handleAnswerChange(q.id, e.target.value)}
                placeholder={readOnly ? '' : 'Your answer...'}
                readOnly={readOnly}
                className={`w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-sm ${
                    readOnly ? 'bg-gray-50 text-gray-600 cursor-default' : ''
                }`}
            />
        );
        void isRequired; // used for validation above
    };

    const renderSurveyTab = () => {
        // ── Loading ──
        if (loadingSurveys) return (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500">Loading surveys...</p>
            </div>
        );

        // ── No active surveys ──
        if (!loadingSurveys && activeSurveys.length === 0) return (
            <div className="space-y-4">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('platformSurvey')}</h2>
                <p className="text-gray-600">{t('platformSurveyDescription')}</p>
            </div>
                <div className="text-center py-14">
                    <svg className="w-14 h-14 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-gray-500 font-medium">No active surveys right now</p>
                    <p className="text-gray-400 text-sm mt-1">Check back later for new surveys from the admin team.</p>
                </div>
            </div>
        );

        // ── Survey list (select one) ──
        if (!selectedSurvey) return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('platformSurvey')}</h2>
                    <p className="text-gray-600">Select a survey to fill out below.</p>
                </div>
                <div className="space-y-4">
                    {activeSurveys.map((sv) => (
                        <button key={sv._id} type="button" onClick={() => handleSelectSurvey(sv)}
                            className="w-full text-left bg-white border-2 border-gray-200 rounded-xl p-5 hover:border-indigo-400 hover:shadow-md transition-all group">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors mb-1">{sv.title}</h3>
                                    {sv.description && <p className="text-sm text-gray-500 line-clamp-2">{sv.description}</p>}
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                        <p className="text-xs text-gray-400">{sv.questions?.length || 0} questions</p>
                                        {sv.hasResponded && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">
                                                Answered
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-shrink-0 w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                                    <svg className="w-4 h-4 text-indigo-600 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );

        // ── Survey done ──
        if (surveyDone) return (
            <div className="text-center py-14 space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900">{t('thankYouForCompletingSurvey')}</h3>
                <p className="text-gray-500">Your response has been recorded.</p>
                <button type="button" onClick={() => { setSelectedSurvey(null); setSurveyDone(false); fetchActiveSurveys(); }}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-medium transition-colors">
                    Back to Surveys
                </button>
            </div>
        );

        const isReadOnlySurvey = !!selectedSurvey?.hasResponded;

        // ── Fill out selected survey / view submitted answers ──
        return (
        <div className="space-y-6">
            <div className="flex items-start gap-3">
                <button type="button" onClick={() => setSelectedSurvey(null)}
                    className="mt-1 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedSurvey.title}</h2>
                    {selectedSurvey.description && <p className="text-gray-600 mt-1">{selectedSurvey.description}</p>}
                    {isReadOnlySurvey && (
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>
                                You already answered this survey
                                {selectedSurvey?.currentUserResponse?.submittedAt
                                    ? ` on ${new Date(selectedSurvey.currentUserResponse.submittedAt).toLocaleString()}`
                                    : ''}
                                . You can only view your submitted answers.
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {dynamicSurveyError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-600">{dynamicSurveyError}</p>
                </div>
            )}

            <div className="space-y-6">
                {(selectedSurvey.questions || []).map((q, idx) => (
                    <div key={q.id} className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                        <p className="text-sm font-semibold text-gray-800 mb-3">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold mr-2">
                                {idx + 1}
                            </span>
                            {q.text}
                            {q.required && <span className="text-red-500 ml-1">*</span>}
                        </p>
                        {renderDynamicQuestion(q, isReadOnlySurvey)}
                    </div>
                ))}
            </div>

            {!isReadOnlySurvey && (
                <div className="flex justify-end">
                    <button type="button" onClick={handleDynamicSurveySubmit} disabled={submittingSurvey}
                        className="px-8 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                        {submittingSurvey ? (
                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('submitting')}</>
                        ) : (
                            <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>{t('submitSurvey')}</>
                        )}
                    </button>
                </div>
            )}
        </div>
        );
    };

    // Keep old static survey handlers available (no longer rendered but not breaking anything)
    const _renderOldSurveyTab = () => (
        <div className="space-y-6">
            {surveySubmitError && (
                <p className="text-sm text-red-600 font-medium mb-2">{surveySubmitError}</p>
            )}
            <form onSubmit={handleSurveySubmit} noValidate className={`space-y-6 ${shakeSurveyForm ? 'form-shake' : ''}`}>
                <div className="min-w-0">
                    <label className="block text-sm font-medium text-gray-700 mb-3">{t('howSatisfiedWithPlatform')}</label>
                    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-3 rounded-lg border-2 transition-colors min-w-0 ${satisfactionError ? 'border-red-500' : 'border-gray-200'}`}>
                        {[
                            { value: 'very-dissatisfied', label: t('veryDissatisfied'), color: 'bg-red-100 text-red-800 border-red-200' },
                            { value: 'dissatisfied', label: t('dissatisfied'), color: 'bg-orange-100 text-orange-800 border-orange-200' },
                            { value: 'neutral', label: t('neutral'), color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
                            { value: 'satisfied', label: t('satisfied'), color: 'bg-blue-100 text-blue-800 border-blue-200' },
                            { value: 'very-satisfied', label: t('verySatisfied'), color: 'bg-green-100 text-green-800 border-green-200' }
                        ].map((option) => (
                            <label key={option.value} className="cursor-pointer min-w-0">
                                <input
                                    type="radio"
                                    name="satisfaction"
                                    value={option.value}
                                    checked={survey.satisfaction === option.value}
                                    onChange={(e) => { setSurvey(prev => ({ ...prev, satisfaction: e.target.value })); setSatisfactionError(''); setSurveySubmitError(''); }}
                                    className="sr-only"
                                />
                                <div className={`p-3 text-center rounded-lg border-2 transition-all min-w-0 overflow-hidden ${
                                    survey.satisfaction === option.value 
                                        ? option.color + ' border-current' 
                                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                }`}>
                                    <div className="text-sm font-medium break-words">{option.label}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                    {satisfactionError && (
                        <p className="mt-1 text-sm text-red-600">{satisfactionError}</p>
                    )}
                </div>

                <div className="min-w-0">
                    <label className="block text-sm font-medium text-gray-700 mb-3">{t('whichAreasToImprove')}</label>
                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-lg border-2 transition-colors min-w-0 ${whichAreasError ? 'border-red-500' : 'border-gray-200'}`}>
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
                            <label key={feature.key} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer min-w-0">
                                <input
                                    type="checkbox"
                                    checked={survey.features.includes(feature.key)}
                                    onChange={() => { handleFeatureToggle(feature.key); setWhichAreasError(''); setSurveySubmitError(''); }}
                                    className="w-4 h-4 flex-shrink-0 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <span className="ml-3 text-sm text-gray-700 min-w-0 break-words">{feature.label}</span>
                            </label>
                        ))}
                    </div>
                    {whichAreasError && (
                        <p className="mt-1 text-sm text-red-600">{whichAreasError}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('specificImprovementsSuggest')}</label>
                    <textarea
                        value={survey.improvements}
                        onChange={(e) => { setSurvey(prev => ({ ...prev, improvements: e.target.value })); setSpecificImprovementsError(''); setSurveySubmitError(''); }}
                        rows={4}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${specificImprovementsError ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder={t('specificImprovementsPlaceholder')}
                    />
                    {specificImprovementsError && (
                        <p className="mt-1 text-sm text-red-600">{specificImprovementsError}</p>
                    )}
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
                            onChange={(e) => {
                                const checked = e.target.checked;
                                setSurvey(prev => ({
                                    ...prev,
                                    contact: checked,
                                    ...(checked && user?.email && !prev.email ? { email: user.email } : {})
                                }));
                                if (!checked) setEmailError('');
                            }}
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
                                onChange={(e) => { setSurvey(prev => ({ ...prev, email: e.target.value })); setEmailError(''); setSurveySubmitError(''); }}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${emailError ? 'border-red-500' : 'border-gray-300'}`}
                                placeholder={t('emailPlaceholder')}
                            />
                            {emailError && (
                                <p className="mt-1 text-sm text-red-600">{emailError}</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isSubmitting}
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 min-w-0 max-w-full">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full min-w-0">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">{t('feedbackAndSurvey')}</h1>
                    <p className="text-lg text-gray-600">{t('shareYourThoughts')}</p>
                </div>

                {/* Navigation Tabs */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-8 min-w-0 overflow-hidden">
                    <div className="border-b border-gray-200">
                        <nav className="flex flex-wrap gap-x-6 gap-y-1 px-4 sm:px-6">
                            {[
                                { id: 'feedback', label: t('sendFeedback'), icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
                                { id: 'sent-feedback', label: t('viewSentFeedback'), icon: 'M5 13l4 4L19 7M5 7h14M5 12h8' },
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

                    <div className="p-4 sm:p-8 min-w-0 overflow-hidden">
                        {activeTab === 'feedback' && renderFeedbackTab()}
                        {activeTab === 'sent-feedback' && renderSentFeedbackTab()}
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
                                         alertType === 'success' ? t('thankYou') : 
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
