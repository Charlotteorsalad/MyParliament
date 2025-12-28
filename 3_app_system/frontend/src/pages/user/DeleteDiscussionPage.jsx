import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function DeleteDiscussionPage() {
    const { discussionId } = useParams();
    const navigate = useNavigate();
    const [discussion, setDiscussion] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Sample discussion data - in real app, this would come from API
    useEffect(() => {
        const sampleDiscussion = {
            id: parseInt(discussionId),
            title: "My Discussion on Education Policy",
            content: "I want to discuss the current education policy and its impact on students. The current system seems to lack proper oversight mechanisms, and students often feel disconnected from the decision-making process.",
            author: "Current User",
            authorId: "currentUser",
            category: "Education",
            createdAt: "2024-02-07T09:20:00Z",
            replies: 5,
            views: 67,
            isBookmarked: false,
            tags: ["education", "policy", "students"]
        };

        setDiscussion(sampleDiscussion);
    }, [discussionId]);

    const handleDelete = async () => {
        setIsDeleting(true);
        
        // Simulate API call
        setTimeout(() => {
            // In real app, this would make an API call to delete the discussion
            console.log('Discussion deleted:', discussionId);
            setIsDeleting(false);
            navigate('/forum?tab=created');
        }, 1500);
    };

    const handleReturn = () => {
        navigate('/forum?tab=created');
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-MY', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getCategoryColor = (category) => {
        const colors = {
            'Parliamentary Reform': 'bg-blue-100 text-blue-800',
            'Digital Democracy': 'bg-purple-100 text-purple-800',
            'Budget & Finance': 'bg-green-100 text-green-800',
            'Education': 'bg-yellow-100 text-yellow-800',
            'general': 'bg-gray-100 text-gray-800'
        };
        return colors[category] || colors.general;
    };

    if (!discussion) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-[95%] max-w-4xl border border-gray-200">
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Delete Discussion</h2>
                            <p className="text-sm text-gray-600">This action cannot be undone</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="mb-6">
                        <p className="text-gray-700 mb-4">
                            Are you sure you want to delete this discussion? This action will permanently remove:
                        </p>
                        
                        {/* Discussion Preview */}
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center gap-3 mb-3">
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(discussion.category)}`}>
                                    {discussion.category}
                                </span>
                                <span className="text-sm text-gray-500">
                                    {formatDate(discussion.createdAt)}
                                </span>
                            </div>
                            
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                {discussion.title}
                            </h3>
                            
                            <p className="text-gray-700 text-sm mb-3 line-clamp-3">
                                {discussion.content}
                            </p>
                            
                            <div className="flex items-center gap-6 text-sm text-gray-500">
                                <div className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    {discussion.replies} replies
                                </div>
                                <div className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    {discussion.views} views
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            <div>
                                <h4 className="text-sm font-medium text-red-800 mb-1">Warning</h4>
                                <p className="text-sm text-red-700">
                                    This will permanently delete the discussion and all its replies. This action cannot be undone.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={handleReturn}
                            disabled={isDeleting}
                            className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Return to Site
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                            {isDeleting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Yes, Delete
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

