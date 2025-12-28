import { useState, useEffect } from 'react';

export default function MpDetailDrawer({ mp, onClose }) {
    const [isBookmarked, setIsBookmarked] = useState(false);
    
    // Handle modal focus and scroll prevention
    useEffect(() => {
        if (mp) {
            // Prevent body and html scroll when modal is open
            document.body.classList.add('modal-open');
            document.documentElement.classList.add('modal-open');
            
            // Focus on the modal content for accessibility
            const modalContent = document.querySelector('.modal-content');
            if (modalContent) {
                modalContent.focus();
            }
            
            // Handle escape key to close modal
            const handleEscapeKey = (event) => {
                if (event.key === 'Escape') {
                    onClose();
                }
            };
            
            document.addEventListener('keydown', handleEscapeKey);
            
            // Cleanup function
            return () => {
                // Restore body and html scroll when modal closes
                document.body.classList.remove('modal-open');
                document.documentElement.classList.remove('modal-open');
                document.removeEventListener('keydown', handleEscapeKey);
            };
        }
    }, [mp, onClose]);
    
    if (!mp) return null;

    // Handle broken image URLs and provide elegant fallbacks
    const handleImageError = (event) => {
      event.target.src = '/src/assets/image/placeholder-mp.jpg';
      event.target.onerror = null; // Prevent infinite loop
    };

    // Check if profilePicture URL is valid (not a broken Cloudinary URL)
    const isValidImageUrl = (url) => {
      if (!url) return false;
      return !url.includes('cloudinary.com/example') && 
             !url.includes('res.cloudinary.com/example');
    };

    const imageSrc = isValidImageUrl(mp.profilePicture) ? mp.profilePicture : '/src/assets/image/placeholder-mp.jpg';

    // Sample performance data - in real app, this would come from API
    const performanceData = {
      attendanceRate: 85.4,
      responseRate: 90.1,
      escalateRate: 58.8,
      topicDiscussed: 91.4,
      sentiment: 90.0
    };

    // Sample recent activities - in real app, this would come from API
    const recentActivities = [
      {
        id: 1,
        date: '2024-02-08',
        type: 'answer',
        title: 'Answer to YB Wee Kah Siong',
        description: 'Minimum wage bill amendment is raised.',
        category: 'Labor & Employment'
      },
      {
        id: 2,
        date: '2024-01-28',
        type: 'question',
        title: 'Question YB Lim XX',
        description: 'Stateless children education access and citizenship issues.',
        category: 'Education & Social Welfare'
      },
      {
        id: 3,
        date: '2024-01-15',
        type: 'debate',
        title: 'Budget Debate Participation',
        description: 'Contributed to discussion on healthcare budget allocation.',
        category: 'Healthcare & Budget'
      },
      {
        id: 4,
        date: '2024-01-10',
        type: 'motion',
        title: 'Motion on Digital Infrastructure',
        description: 'Proposed motion for rural digital connectivity improvements.',
        category: 'Technology & Infrastructure'
      }
    ];

    const handleBookmark = () => {
      setIsBookmarked(!isBookmarked);
    };

    const getActivityIcon = (type) => {
      switch (type) {
        case 'answer':
          return (
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          );
        case 'question':
          return (
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          );
        case 'debate':
          return (
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
          );
        case 'motion':
          return (
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
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

    const getActivityTypeLabel = (type) => {
      switch (type) {
        case 'answer': return 'Answer';
        case 'question': return 'Question';
        case 'debate': return 'Debate';
        case 'motion': return 'Motion';
        default: return 'Activity';
      }
    };
  
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div 
          className="modal-content" 
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Header with close button */}
          <div className="modal-header">
            <h2 id="modal-title" className="modal-title">MP Details</h2>
            <button className="modal-close" onClick={onClose}>
              <svg className="close-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

                     {/* MP Profile Section */}
           <div className="mp-profile">
             <div className="profile-header">
               <div className="profile-image-container">
                 <img 
                   className="profile-image" 
                   src={imageSrc} 
                   alt={mp.name || 'MP'} 
                   onError={handleImageError}
                 />
               </div>
               
               <div className="profile-actions">
                 <button
                   onClick={handleBookmark}
                   className={`bookmark-button ${isBookmarked ? 'bookmarked' : ''}`}
                   title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
                 >
                   <svg 
                     className="bookmark-icon" 
                     fill={isBookmarked ? "currentColor" : "none"} 
                     stroke="currentColor" 
                     viewBox="0 0 24 24"
                   >
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                   </svg>
                 </button>
                 
                 <div className="follower-count">
                   <svg className="follower-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                   </svg>
                   <span>130,735 followers</span>
                 </div>
               </div>
             </div>
             
             <div className="profile-info">
               <div className="name-and-badge">
                 <h3 className="mp-name">{mp.full_name_with_titles || mp.name || 'Unknown MP'}</h3>
                 {mp.positionInCabinet && (
                   <div className="cabinet-badge">{mp.positionInCabinet}</div>
                 )}
               </div>
              <div className="mp-details">
                <span className="detail-item">
                  <svg className="detail-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {mp.party_full_name || mp.party || 'No Party'}
                </span>
                <span className="detail-item">
                  <svg className="detail-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {mp.constituency || 'No Constituency'}
                </span>
                <span className="detail-item">
                  <svg className="detail-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {mp.positionInParliament || 'MP'} • Term {mp.parliament_term || 'Unknown'}
                </span>
                <span className="detail-item">
                  <svg className="detail-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {mp.status || 'Unknown'} Status
                </span>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="info-section">
            <h4 className="section-title">
              <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Contact Information
            </h4>
            <div className="contact-grid">
              <div className="contact-item">
                <svg className="contact-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <div>
                  <span className="contact-label">Email</span>
                  <span className="contact-value">{mp.email || 'Not available'}</span>
                </div>
              </div>
              
              <div className="contact-item">
                <svg className="contact-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <div>
                  <span className="contact-label">Phone</span>
                  <span className="contact-value">{mp.phone || 'Not available'}</span>
                </div>
              </div>
              
              <div className="contact-item">
                <svg className="contact-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <div>
                  <span className="contact-label">Fax</span>
                  <span className="contact-value">{mp.fax || 'Not available'}</span>
                </div>
              </div>
              
              <div className="contact-item">
                <svg className="contact-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <div>
                  <span className="contact-label">Seat Number</span>
                  <span className="contact-value">{mp.seatNumber || 'Not available'}</span>
                </div>
              </div>
            </div>
            
            {mp.address && (
              <div className="address-section">
                <svg className="address-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <span className="contact-label">Address</span>
                  <span className="contact-value">{mp.address}</span>
                </div>
              </div>
            )}
            
            {mp.profile_url && (
              <div className="profile-link">
                <a 
                  href={mp.profile_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="parliament-link"
                >
                  <svg className="link-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View Parliament Profile
                </a>
              </div>
            )}
          </div>

          {/* Biography Section */}
          <div className="info-section">
            <h4 className="section-title">
              <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Biography
            </h4>
            <div className="biography-content">
              <p className="biography-text">
                {mp.biography || `A dedicated Member of Parliament representing ${mp.constituency || 'their constituency'}, 
                ${mp.full_name_with_titles || mp.name || 'this MP'} has been actively involved in parliamentary 
                proceedings and constituency service. With a focus on ${mp.party_full_name || mp.party || 'their party'} 
                principles, they continue to work towards better representation and service to their constituents.`}
              </p>
            </div>
          </div>

          {/* Performance Metrics Section */}
          <div className="info-section">
            <h4 className="section-title">
              <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Performance
            </h4>
            <div className="performance-metrics">
              {/* Attendance Rate */}
              <div className="metric-item">
                <div className="metric-header">
                  <span className="metric-label">Attendance Rate</span>
                  <span className="metric-value">{performanceData.attendanceRate}%</span>
                </div>
                <div className="metric-bar">
                  <div 
                    className="metric-fill"
                    style={{ width: `${performanceData.attendanceRate}%` }}
                  ></div>
                </div>
              </div>

              {/* Response Rate */}
              <div className="metric-item">
                <div className="metric-header">
                  <span className="metric-label">Response Rate</span>
                  <span className="metric-value">{performanceData.responseRate}%</span>
                </div>
                <div className="metric-bar">
                  <div 
                    className="metric-fill"
                    style={{ width: `${performanceData.responseRate}%` }}
                  ></div>
                </div>
              </div>

              {/* Escalate Rate */}
              <div className="metric-item">
                <div className="metric-header">
                  <span className="metric-label">Escalate Rate</span>
                  <span className="metric-value">{performanceData.escalateRate}%</span>
                </div>
                <div className="metric-bar">
                  <div 
                    className="metric-fill"
                    style={{ width: `${performanceData.escalateRate}%` }}
                  ></div>
                </div>
              </div>

              {/* Topic Discussed */}
              <div className="metric-item">
                <div className="metric-header">
                  <span className="metric-label">Topic Discussed</span>
                  <span className="metric-value">{performanceData.topicDiscussed}%</span>
                </div>
                <div className="metric-bar">
                  <div 
                    className="metric-fill"
                    style={{ width: `${performanceData.topicDiscussed}%` }}
                  ></div>
                </div>
              </div>

              {/* Sentiment */}
              <div className="metric-item">
                <div className="metric-header">
                  <span className="metric-label">Sentiment</span>
                  <span className="metric-value">{performanceData.sentiment}%</span>
                </div>
                <div className="metric-bar">
                  <div 
                    className="metric-fill"
                    style={{ width: `${performanceData.sentiment}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activities Timeline */}
          <div className="info-section">
            <h4 className="section-title">
              <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Recent Activities
            </h4>
            <div className="timeline-container">
              <div className="timeline-line"></div>
              <div className="timeline-items">
                {recentActivities.map((activity, index) => (
                  <div key={activity.id} className="timeline-item">
                    <div className="timeline-icon">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span className="timeline-date">
                          {new Date(activity.date).toLocaleDateString('en-MY', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                        <span className="timeline-type">
                          {getActivityTypeLabel(activity.type)}
                        </span>
                      </div>
                      <h5 className="timeline-title">{activity.title}</h5>
                      <p className="timeline-description">{activity.description}</p>
                      <span className="timeline-category">{activity.category}</span>
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
  