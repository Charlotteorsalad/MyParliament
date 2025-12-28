import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

function TopicDetailPage() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [topic, setTopic] = useState(null);

  // Sample topic data - in real app, this would come from API
  const sampleTopics = {
    1: {
      id: 1,
      title: "Economic Recovery Plan",
      description: "Government initiatives for post-pandemic economic recovery and job creation. This comprehensive plan includes stimulus packages, infrastructure investments, and support for small and medium enterprises to boost economic growth and employment opportunities.",
      latestUpdate: "The Ministry of Finance has announced additional funding of RM50 billion for the economic recovery plan, focusing on digital transformation and green technology initiatives.",
      latestUpdateDate: "2024-01-15",
      category: "Economy",
      views: 1250,
      bookmarks: 89,
      timeline: [
        {
          id: 1,
          date: "2024-01-15",
          type: "update",
          title: "Funding Announcement",
          content: "Additional RM50 billion allocated for economic recovery initiatives",
          sentiment: 78.5,
          keywords: ["funding", "recovery", "investment"]
        },
        {
          id: 2,
          date: "2024-01-12",
          type: "reply",
          mp: "YB. Steven Sim",
          content: "Answer the issue with one suggestion on bill amendment for better SME support mechanisms",
          sentiment: 85.5,
          keywords: ["SME", "amendment", "support"]
        },
        {
          id: 3,
          date: "2024-01-10",
          type: "escalate",
          mp: "YB. Wee Ka Siong",
          content: "Escalate the previous issue of infrastructure development delays in rural areas",
          sentiment: 69.5,
          keywords: ["infrastructure", "rural", "delays"]
        },
        {
          id: 4,
          date: "2024-01-08",
          type: "reply",
          mp: "YB. Lim Guan Eng",
          content: "Propose alternative funding mechanisms for digital transformation projects",
          sentiment: 82.0,
          keywords: ["digital", "transformation", "funding"]
        }
      ]
    },
    2: {
      id: 2,
      title: "Healthcare Reform",
      description: "Comprehensive healthcare system improvements and accessibility measures. This reform aims to enhance healthcare quality, reduce waiting times, and improve access to medical services across all regions of Malaysia.",
      latestUpdate: "New healthcare facilities will be constructed in 15 rural areas, with telemedicine services to be expanded nationwide by end of 2024.",
      latestUpdateDate: "2024-01-12",
      category: "Health",
      views: 2100,
      bookmarks: 156,
      timeline: [
        {
          id: 1,
          date: "2024-01-12",
          type: "update",
          title: "Facility Expansion",
          content: "15 new healthcare facilities approved for rural areas",
          sentiment: 88.2,
          keywords: ["facilities", "rural", "healthcare"]
        },
        {
          id: 2,
          date: "2024-01-10",
          type: "reply",
          mp: "YB. Dr. Adham Baba",
          content: "Address concerns about healthcare worker shortages in rural clinics",
          sentiment: 76.8,
          keywords: ["healthcare workers", "shortage", "rural"]
        }
      ]
    }
  };

  useEffect(() => {
    // Simulate API call to fetch topic details
    const topicData = sampleTopics[topicId] || sampleTopics[1];
    setTopic(topicData);
  }, [topicId]);

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
  };

  const handleViewDiscussion = () => {
    // Navigate to forum to view existing discussions about this topic
    navigate(`/forum?topic=${encodeURIComponent(topic?.title)}&category=${encodeURIComponent(topic?.category)}&view=true`);
  };

  const handleFeedback = () => {
    // Navigate to feedback page with topic context
    navigate(`/feedback?topic=${encodeURIComponent(topic?.title)}&category=${encodeURIComponent(topic?.category)}`);
  };

  const handleCreateDiscussion = () => {
    // Navigate to forum to create new discussion about this topic
    navigate(`/forum?topic=${encodeURIComponent(topic?.title)}&category=${encodeURIComponent(topic?.category)}&create=true`);
  };

  const getTimelineIcon = (type) => {
    switch (type) {
      case "reply":
        return (
          <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        );
      case "escalate":
        return (
          <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        );
      case "update":
        return (
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const getTimelineLabel = (type) => {
    switch (type) {
      case "reply":
        return "Replies";
      case "escalate":
        return "Escalate";
      case "update":
        return "Update";
      default:
        return "Activity";
    }
  };

  const getSentimentColor = (sentiment) => {
    if (sentiment >= 80) return "bg-green-500";
    if (sentiment >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  if (!topic) {
    return (
      <div className="w-full bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading topic details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full max-w-6xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-indigo-600 hover:text-indigo-700 mb-6 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Issue Portal
        </button>

        {/* Topic Header Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mr-3">
                  {topic.title}
                </h1>
                <button
                  onClick={handleBookmark}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
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
              <p className="text-gray-600 mb-4">
                Latest update: {new Date(topic.latestUpdateDate).toLocaleDateString('en-MY', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 lg:ml-6">
              <button
                onClick={handleViewDiscussion}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                View Topic Discussion
              </button>
              <button
                onClick={handleCreateDiscussion}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Topic Discussion
              </button>
              <button
                onClick={handleFeedback}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                Feedback on Topic
              </button>
            </div>
          </div>

          {/* Topic Description */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Topic Description</h3>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-gray-700 leading-relaxed">{topic.description}</p>
            </div>
          </div>

          {/* Latest Update Content */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Latest Update Content</h3>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-gray-700 leading-relaxed">{topic.latestUpdate}</p>
            </div>
          </div>
        </div>

        {/* Timeline Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Timeline</h2>
          
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300"></div>
            
            <div className="space-y-8">
              {topic.timeline.map((item, index) => (
                <div key={item.id} className="relative flex items-start">
                  {/* Timeline Icon */}
                  <div className="relative z-10 flex-shrink-0">
                    {getTimelineIcon(item.type)}
                  </div>
                  
                  {/* Content */}
                  <div className="ml-6 flex-1">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      {/* Date and Type */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-500">
                          {new Date(item.date).toLocaleDateString('en-MY', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-200 text-gray-700">
                          {getTimelineLabel(item.type)}
                        </span>
                      </div>

                      {/* MP Info (if applicable) */}
                      {item.mp && (
                        <div className="flex items-center mb-3">
                          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <span className="font-medium text-gray-900">{item.mp}</span>
                        </div>
                      )}

                      {/* Content */}
                      <p className="text-gray-700 mb-4 leading-relaxed">{item.content}</p>

                      {/* Sentiment and Keywords */}
                      <div className="space-y-3">
                        {/* Sentiment */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-600">Sentiment:</span>
                            <span className="text-sm font-semibold text-gray-900">{item.sentiment}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${getSentimentColor(item.sentiment)}`}
                              style={{ width: `${item.sentiment}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Keywords */}
                        <div>
                          <span className="text-sm font-medium text-gray-600">Keywords: </span>
                          <div className="inline-flex flex-wrap gap-1 mt-1">
                            {item.keywords.map((keyword, idx) => (
                              <span 
                                key={idx}
                                className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full"
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TopicDetailPage;
