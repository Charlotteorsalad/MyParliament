import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function ReplyDiscussionPage() {
    const { discussionId } = useParams();
    const navigate = useNavigate();
    const [discussion, setDiscussion] = useState(null);
    const [replies, setReplies] = useState([]);
    const [newReply, setNewReply] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Sample discussion data - in real app, this would come from API
    useEffect(() => {
        const sampleDiscussion = {
            id: parseInt(discussionId),
            title: "Parliamentary Reform Discussion",
            content: "What are your thoughts on the recent parliamentary reform proposals? I believe we need more transparency in the legislative process. The current system seems to lack proper oversight mechanisms, and citizens often feel disconnected from the decision-making process. How can we improve this?",
            author: "John Smith",
            authorId: "user1",
            category: "Parliamentary Reform",
            createdAt: "2024-02-10T10:30:00Z",
            replies: 12,
            views: 156,
            isBookmarked: false,
            tags: ["reform", "transparency", "legislation"]
        };

        const sampleReplies = [
            {
                id: 1,
                content: "I completely agree with your points about transparency. The current system does seem opaque to many citizens. I think implementing more public consultations and live streaming of committee meetings would be a good start.",
                author: "Sarah Johnson",
                authorId: "user2",
                createdAt: "2024-02-10T11:15:00Z",
                likes: 8,
                isLiked: false
            },
            {
                id: 2,
                content: "Great discussion! I'd like to add that we should also consider digital tools for citizen engagement. Many other countries have successfully implemented online platforms where citizens can submit questions and feedback directly to their representatives.",
                author: "Mike Chen",
                authorId: "user3",
                createdAt: "2024-02-10T12:30:00Z",
                likes: 12,
                isLiked: true
            },
            {
                id: 3,
                content: "While I agree with the need for reform, we should be careful not to rush into changes without proper analysis. What specific transparency measures are you proposing?",
                author: "Emily Davis",
                authorId: "user4",
                createdAt: "2024-02-10T14:45:00Z",
                likes: 5,
                isLiked: false
            }
        ];

        setDiscussion(sampleDiscussion);
        setReplies(sampleReplies);
    }, [discussionId]);

    const handleSubmitReply = async () => {
        if (!newReply.trim()) return;

        setIsSubmitting(true);
        
        // Simulate API call
        setTimeout(() => {
            const reply = {
                id: Date.now(),
                content: newReply,
                author: "Current User",
                authorId: "currentUser",
                createdAt: new Date().toISOString(),
                likes: 0,
                isLiked: false
            };

            setReplies(prev => [...prev, reply]);
            setNewReply('');
            setIsSubmitting(false);
        }, 1000);
    };

    const handleLikeReply = (replyId) => {
        setReplies(prev => prev.map(reply => 
            reply.id === replyId 
                ? { 
                    ...reply, 
                    isLiked: !reply.isLiked,
                    likes: reply.isLiked ? reply.likes - 1 : reply.likes + 1
                }
                : reply
        ));
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
                    <p className="text-gray-600">Loading discussion...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            <div className="max-w-4xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => navigate('/forum')}
                        className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-4 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Forum
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Reply to Discussion</h1>
                    <p className="text-lg text-gray-600">Share your thoughts and engage with the community</p>
                </div>

                {/* Original Discussion */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(discussion.category)}`}>
                            {discussion.category}
                        </span>
                        <span className="text-sm text-gray-500">
                            {formatDate(discussion.createdAt)}
                        </span>
                    </div>
                    
                    <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                        {discussion.title}
                    </h2>
                    
                    <div className="flex items-start gap-4 mb-6">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="font-medium text-gray-900">{discussion.author}</span>
                                <span className="text-sm text-gray-500">•</span>
                                <span className="text-sm text-gray-500">Original Post</span>
                            </div>
                            <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                                {discussion.content}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-gray-500 pt-4 border-t border-gray-200">
                        <div className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {replies.length} replies
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

                {/* Reply Form */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Post Your Reply</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Your Response
                            </label>
                            <textarea
                                value={newReply}
                                onChange={(e) => setNewReply(e.target.value)}
                                rows={6}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                                placeholder="Share your thoughts on this discussion..."
                            />
                        </div>
                        <div className="flex justify-end">
                            <button
                                onClick={handleSubmitReply}
                                disabled={!newReply.trim() || isSubmitting}
                                className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Posting...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                        Post Reply
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Replies Section */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-6">
                        Replies ({replies.length})
                    </h3>
                    
                    {replies.length === 0 ? (
                        <div className="text-center py-8">
                            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <p className="text-gray-500">No replies yet. Be the first to share your thoughts!</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {replies.map((reply) => (
                                <div key={reply.id} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="font-medium text-gray-900">{reply.author}</span>
                                                <span className="text-sm text-gray-500">•</span>
                                                <span className="text-sm text-gray-500">{formatDate(reply.createdAt)}</span>
                                            </div>
                                            <p className="text-gray-700 leading-relaxed mb-3">
                                                {reply.content}
                                            </p>
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => handleLikeReply(reply.id)}
                                                    className={`flex items-center gap-1 text-sm transition-colors ${
                                                        reply.isLiked 
                                                            ? 'text-red-600' 
                                                            : 'text-gray-500 hover:text-red-600'
                                                    }`}
                                                >
                                                    <svg 
                                                        className={`w-4 h-4 ${reply.isLiked ? 'fill-current' : ''}`} 
                                                        fill="none" 
                                                        stroke="currentColor" 
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                                    </svg>
                                                    {reply.likes} {reply.likes === 1 ? 'like' : 'likes'}
                                                </button>
                                                <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                    </svg>
                                                    Reply
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

