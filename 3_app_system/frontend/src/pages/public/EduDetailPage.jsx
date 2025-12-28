import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks';
import { useAuth } from '../../hooks';
import { eduApi, quizApi } from '../../api';
import { useLanguage } from '../../contexts/LanguageContext';

export default function EduDetailPage() {
    const { resourceId } = useParams();
    const navigate = useNavigate();
    const [selectedAnswers, setSelectedAnswers] = useState({});
    const [showResults, setShowResults] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [resourceData, setResourceData] = useState(null);
    const [quizSubmission, setQuizSubmission] = useState(null);
    const [loading, setLoading] = useState(true);
    const { isAuthenticated } = useAuth();
    const [error, setError] = useState(null);
    const { executeApiCall } = useApi();
    const { t } = useLanguage();

  // Helper function to check for valid image data (MongoDB Base64 only)
  const hasValidImage = (image) => {
    return image && image.data && image.contentType;
  };

    useEffect(() => {
        const fetchResourceData = async () => {
            try {
                setLoading(true);
                const data = await executeApiCall(() => eduApi.getById(resourceId));
                setResourceData(data);
            } catch (err) {
                setError(t('errorLoadingResource'));
                console.error('Error fetching resource:', err);
            } finally {
                setLoading(false);
            }
        };

        if (resourceId) {
            fetchResourceData();
        }
    }, [resourceId, executeApiCall]);


    const handleAnswerSelect = (questionIndex, answerIndex) => {
        setSelectedAnswers(prev => ({
            ...prev,
            [questionIndex]: answerIndex
        }));
    };

    const handleSubmitQuiz = async () => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        try {
            const answers = Object.values(selectedAnswers);
            const result = await executeApiCall(() => 
                quizApi.submitQuiz({
                    resourceId,
                    answers,
                    timeSpent: 0 // You can implement time tracking if needed
                })
            );

            setQuizSubmission(result.submission);
            setShowResults(true);
        } catch (err) {
            console.error('Failed to submit quiz:', err);
            setError('Failed to submit quiz. Please try again.');
        }
    };

    const handleBookmark = () => {
        setIsBookmarked(!isBookmarked);
    };

    const getScore = () => {
        if (!resourceData.quiz || !resourceData.quiz.questions) return 0;
        let correct = 0;
        resourceData.quiz.questions.forEach((question, questionIndex) => {
            if (selectedAnswers[questionIndex] === question.correctAnswer) {
                correct++;
            }
        });
        return correct;
    };

    const getScoreColor = (score, total) => {
        const percentage = (score / total) * 100;
        if (percentage >= 80) return 'text-green-600';
        if (percentage >= 60) return 'text-yellow-600';
        return 'text-red-600';
    };

    // Helper function to get file icon based on file type
    const getFileIcon = (file) => {
        const type = file.mimeType || file.type;
        if (type.startsWith('image/')) return '🖼️';
        if (type.startsWith('video/')) return '🎥';
        if (type.startsWith('audio/')) return '🎵';
        if (type.includes('pdf')) return '📄';
        if (type.includes('word')) return '📝';
        if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
        if (type.includes('powerpoint') || type.includes('presentation')) return '📈';
        return '📎';
    };

    // Helper function to format file size
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-indigo-500 bg-white transition ease-in-out duration-150">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('loadingEducationalResource')}
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (error || !resourceData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md mx-auto">
                        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-red-800 mb-2">{t('errorLoadingResource')}</h3>
                        <p className="text-red-600 mb-4">{error || t('resourceNotFound')}</p>
                        <button
                            onClick={() => navigate('/edu')}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                            {t('backToResources')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-4xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                {resourceData.title || resourceData.name}
                            </h1>
                            <p className="text-lg text-gray-600">
                                {resourceData.category || 'Educational Resource'}
                            </p>
                        </div>
                        <button
                            onClick={handleBookmark}
                            className="p-3 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <svg 
                                className={`w-6 h-6 transition-colors ${
                                    isBookmarked 
                                        ? 'text-yellow-500 fill-current' 
                                        : 'text-gray-400 hover:text-yellow-500'
                                }`} 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-8">
                {/* Content Section */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-8">
                    <div className="p-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('content')}</h2>
                        
                        {/* Image */}
                        <div className="mb-6">
                            <div className="h-64 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg overflow-hidden">
                                {hasValidImage(resourceData.image) ? (
                                <img 
                                        src={resourceData.image.data} 
                                    alt={resourceData.title || resourceData.name}
                                    className="w-full h-full object-cover"
                                />
                                ) : null}
                                
                                <div className="w-full h-full flex items-center justify-center" style={{display: hasValidImage(resourceData.image) ? 'none' : 'flex'}}>
                                    <div className="text-center">
                                        <svg className="w-12 h-12 text-emerald-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                        <p className="text-emerald-600 font-medium">{t('educationalContent')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Themes */}
                        {(resourceData.themes && resourceData.themes.length > 0) && (
                            <div className="mb-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('relatedThemes')}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {resourceData.themes.map((theme, index) => (
                                        <span 
                                            key={index}
                                            className="px-3 py-1 bg-indigo-100 text-indigo-800 text-sm font-medium rounded-full"
                                        >
                                            {theme}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('description')}</h3>
                            <p className="text-gray-700 leading-relaxed">
                                {resourceData.description}
                            </p>
                        </div>

                        {/* Content */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('content')}</h3>
                            <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                                {resourceData.content}
                            </div>
                        </div>

                        {/* Content Attachments */}
                        {resourceData.contentAttachments && resourceData.contentAttachments.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">📎 {t('contentAttachments')}</h3>
                                <div className="space-y-4">
                                    {resourceData.contentAttachments.map((attachment, index) => (
                                        <div key={index} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                            <span className="text-2xl">{getFileIcon(attachment)}</span>
                                            <div className="flex-1">
                                                <div className="text-sm font-medium text-gray-900">{attachment.originalName || attachment.name}</div>
                                                <div className="text-xs text-gray-500">{formatFileSize(attachment.size)}</div>
                                            </div>
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        // Convert relative URL to full backend URL
                                                        const fullUrl = attachment.url.startsWith('http') 
                                                          ? attachment.url 
                                                          : `http://localhost:5000${attachment.url}`;
                                                        console.log('Opening file:', fullUrl);
                                                        console.log('Original URL:', attachment.url);
                                                        window.open(fullUrl, '_blank', 'noopener,noreferrer');
                                                    }}
                                                    className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded hover:bg-blue-200 transition-colors"
                                                >
                                                    👁️ {t('view')}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const link = document.createElement('a');
                                                        link.href = attachment.url;
                                                        link.download = attachment.originalName || attachment.name;
                                                        link.click();
                                                    }}
                                                    className="px-3 py-1 text-xs font-medium text-green-600 bg-green-100 rounded hover:bg-green-200 transition-colors"
                                                >
                                                    📥 {t('download')}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quiz Section */}
                {resourceData.quiz && resourceData.quiz.questions && resourceData.quiz.questions.length > 0 && (
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                        <div className="p-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('quizzes')}</h2>
                            
                            {resourceData.quiz.questions.map((question, questionIndex) => (
                            <div key={questionIndex} className="mb-8">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                        {t('question')} {questionIndex + 1}: {question.question}
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {question.options.map((option, optionIndex) => (
                                        <label 
                                            key={optionIndex}
                                            className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                                selectedAnswers[questionIndex] === optionIndex
                                                    ? 'border-indigo-500 bg-indigo-50'
                                                    : 'border-gray-200 hover:border-gray-300'
                                            } ${
                                                showResults && quizSubmission
                                                    ? optionIndex === question.correctAnswer
                                                        ? 'border-green-500 bg-green-50'
                                                        : selectedAnswers[questionIndex] === optionIndex && optionIndex !== question.correctAnswer
                                                        ? 'border-red-500 bg-red-50'
                                                        : 'border-gray-200'
                                                    : ''
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name={`question-${questionIndex}`}
                                                value={optionIndex}
                                                checked={selectedAnswers[questionIndex] === optionIndex}
                                                onChange={() => handleAnswerSelect(questionIndex, optionIndex)}
                                                className="sr-only"
                                            />
                                            <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                                                selectedAnswers[questionIndex] === optionIndex
                                                    ? 'border-indigo-500 bg-indigo-500'
                                                    : 'border-gray-300'
                                            } ${
                                                showResults && quizSubmission
                                                    ? optionIndex === question.correctAnswer
                                                        ? 'border-green-500 bg-green-500'
                                                        : selectedAnswers[questionIndex] === optionIndex && optionIndex !== question.correctAnswer
                                                        ? 'border-red-500 bg-red-500'
                                                        : 'border-gray-300'
                                                    : ''
                                            }`}>
                                                {selectedAnswers[questionIndex] === optionIndex && (
                                                    <div className="w-2 h-2 bg-white rounded-full"></div>
                                                )}
                                            </div>
                                            <span className="text-gray-700 font-medium">
                                                {String.fromCharCode(65 + optionIndex)}. {option}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* Quiz Actions */}
                        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={handleSubmitQuiz}
                                    disabled={Object.keys(selectedAnswers).length !== resourceData.quiz.questions.length || !isAuthenticated}
                                    className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                >
                                    {!isAuthenticated ? t('loginToSubmitQuiz') : t('submitQuiz')}
                                </button>
                                
                                {showResults && quizSubmission && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">{t('scoreLabel')}</span>
                                        <span className={`text-lg font-bold ${getScoreColor(quizSubmission.score, 100)}`}>
                                            {quizSubmission.score}%
                                        </span>
                                        <span className={`text-sm ${quizSubmission.passed ? 'text-green-600' : 'text-red-600'}`}>
                                            {quizSubmission.passed ? t('passed') : t('failed')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Quiz Attachments */}
                        {resourceData.quizAttachments && resourceData.quizAttachments.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">🧩 {t('quizAttachments')}</h3>
                                <div className="space-y-4">
                                    {resourceData.quizAttachments.map((attachment, index) => (
                                        <div key={index} className="flex items-center space-x-4 p-4 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors">
                                            <span className="text-2xl">{getFileIcon(attachment)}</span>
                                            <div className="flex-1">
                                                <div className="text-sm font-medium text-gray-900">{attachment.originalName || attachment.name}</div>
                                                <div className="text-xs text-gray-500">{formatFileSize(attachment.size)}</div>
                                            </div>
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        // Convert relative URL to full backend URL
                                                        const fullUrl = attachment.url.startsWith('http') 
                                                          ? attachment.url 
                                                          : `http://localhost:5000${attachment.url}`;
                                                        console.log('Opening file:', fullUrl);
                                                        console.log('Original URL:', attachment.url);
                                                        window.open(fullUrl, '_blank', 'noopener,noreferrer');
                                                    }}
                                                    className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded hover:bg-blue-200 transition-colors"
                                                >
                                                    👁️ View
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const link = document.createElement('a');
                                                        link.href = attachment.url;
                                                        link.download = attachment.originalName || attachment.name;
                                                        link.click();
                                                    }}
                                                    className="px-3 py-1 text-xs font-medium text-green-600 bg-green-100 rounded hover:bg-green-200 transition-colors"
                                                >
                                                    📥 Download
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    </div>
                )}

                
                {/* Back to Resources Button */}
                <div className="mt-8 text-center">
                    <button
                        onClick={() => navigate('/edu')}
                        className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        {t('backToResources')}
                    </button>
                </div>
            </div>
        </div>
    );
}
