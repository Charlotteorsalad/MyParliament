import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { removeHonorifics } from '../utils/mpUtils';

// Add CSS styles for full window and tabs
const tabStyles = `
  .modal-header {
    background: linear-gradient(to right, #4f46e5, #3730a3);
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
    position: sticky;
    top: 0;
    z-index: 50;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
    flex-shrink: 0;
    width: 100%;
    box-sizing: border-box;
  }
  
  .modal-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: white;
    margin: 0;
    flex: 1;
  }
  
  .modal-close {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    border-radius: 0.5rem;
    padding: 0.5rem;
    cursor: pointer;
    transition: background-color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .modal-close:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  
  .close-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: white;
  }
  
  .tab-navigation {
    background-color: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    padding: 0 2rem;
    flex-shrink: 0;
    width: 100%;
    box-sizing: border-box;
  }
  
  .tab-nav {
    display: flex;
    gap: 0.25rem;
    padding: 0.75rem 0;
  }
  
  .tab-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s;
    border: none;
    background: none;
    cursor: pointer;
    color: #6b7280;
  }
  
  .tab-button:hover {
    background-color: #f3f4f6;
    color: #374151;
  }
  
  .tab-button.active {
    background-color: #4f46e5;
    color: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .tab-icon {
    font-size: 1.1rem;
  }
  
  .tab-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 2rem;
    background-color: #fafafa;
    min-height: 0;
    width: 100%;
    box-sizing: border-box;
  }
  
  /* Responsive adjustments for full window */
  @media (max-width: 768px) {
    .modal-header {
      padding: 1rem 1.5rem;
    }
    
    .modal-title {
      font-size: 1.25rem;
    }
    
    .tab-navigation {
      padding: 0 1.5rem;
    }
    
    .tab-content {
      padding: 1.5rem;
    }
    
    .tab-button {
      padding: 0.5rem 1rem;
      font-size: 0.8rem;
    }
    
    .tab-icon {
      font-size: 1rem;
    }
  }
  
  /* Ensure full height usage */
  .mp-profile, .info-section {
    margin-bottom: 2rem;
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
  }
  
  .mp-profile:last-child, .info-section:last-child {
    margin-bottom: 0;
  }
  
  /* Parliamentary History Timeline */
  .history-timeline {
    position: relative;
    padding-left: 2rem;
  }
  
  .history-timeline::before {
    content: '';
    position: absolute;
    left: 0.75rem;
    top: 0;
    bottom: 0;
    width: 2px;
    background: linear-gradient(to bottom, #4f46e5, #3730a3);
  }
  
  .history-item {
    position: relative;
    margin-bottom: 1.5rem;
    padding-left: 1.5rem;
  }
  
  .history-item:last-child {
    margin-bottom: 0;
  }
  
  .history-marker {
    position: absolute;
    left: -2.25rem;
    top: 0.5rem;
    width: 1rem;
    height: 1rem;
    background: #4f46e5;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .history-content {
    background: #f8fafc;
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
    border: 1px solid #e2e8f0;
    transition: all 0.2s ease;
  }
  
  .history-content:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    transform: translateY(-1px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  
  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  
  .history-term {
    font-weight: 700;
    color: #1e293b;
    font-size: 0.95rem;
  }
  
  .history-status {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    background: #4f46e5;
    color: white;
  }
  
  .history-details {
    display: grid;
    gap: 0.5rem;
  }
  
  .history-party, .history-constituency {
    font-size: 0.875rem;
    color: #475569;
  }
  
  .history-party strong, .history-constituency strong {
    color: #1e293b;
    font-weight: 600;
  }
  
  /* First Time Simple Display */
  .first-time-simple {
    margin-top: 1rem;
    padding: 1rem;
    background: #f8fafc;
    border-radius: 0.5rem;
    border: 1px solid #e2e8f0;
    width: 100%;
    box-sizing: border-box;
  }
  
  .first-time-simple p {
    margin: 0;
    color: #64748b;
    font-size: 0.875rem;
    text-align: center;
    word-wrap: break-word;
  }
  
  /* Ensure all text content wraps properly */
  .tab-content * {
    word-wrap: break-word;
    overflow-wrap: break-word;
    max-width: 100%;
  }
  
  /* Specific styling for long addresses and text */
  .contact-value, .address-text, .biography-text {
    word-break: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
  }
  
  .performance-grid {
    display: grid;
    gap: 1rem;
    margin-top: 1rem;
  }
  
  .performance-item {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
  }
  
  .performance-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.5rem;
  }
  
  .performance-bar {
    width: 100%;
    height: 0.5rem;
    background-color: #e5e7eb;
    border-radius: 0.25rem;
    overflow: hidden;
    margin-bottom: 0.5rem;
  }
  
  .performance-progress {
    height: 100%;
    background-color: #4f46e5;
    transition: width 0.3s ease;
  }
  
  .performance-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: #4f46e5;
  }
  
  .activities-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1rem;
  }
  
  .activity-item {
    display: flex;
    gap: 1rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
    transition: box-shadow 0.2s;
  }
  
  .activity-item:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  
  .activity-content {
    flex: 1;
  }
  
  .activity-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  
  .activity-title {
    font-weight: 600;
    color: #111827;
  }
  
  .activity-date {
    font-size: 0.75rem;
    color: #6b7280;
  }
  
  .activity-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin-bottom: 0.5rem;
  }
  
  .activity-tags {
    display: flex;
    gap: 0.5rem;
  }
  
  .activity-tag {
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
  }
  
  .activity-tag.category {
    background-color: #f3f4f6;
    color: #374151;
  }
  
  .activity-tag.type {
    background-color: #dbeafe;
    color: #1e40af;
  }
`;

// Inject styles - force update by removing old styles first
if (typeof document !== 'undefined') {
  // Remove old styles if they exist
  const oldStyle = document.getElementById('mp-detail-window-styles');
  if (oldStyle) {
    oldStyle.remove();
  }
  
  // Create new styles with updated colors
  const style = document.createElement('style');
  style.id = 'mp-detail-window-styles';
  style.textContent = tabStyles;
  document.head.appendChild(style);
}

export default function MpDetailWindow({ mp, onClose }) {
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const { t } = useLanguage();
    
    // Handle window focus and keyboard navigation
    useEffect(() => {
        if (mp) {
            // Handle escape key to close window
            const handleEscapeKey = (event) => {
                if (event.key === 'Escape') {
                    onClose();
                }
            };
            
            document.addEventListener('keydown', handleEscapeKey);
            
            // Cleanup function
            return () => {
                document.removeEventListener('keydown', handleEscapeKey);
            };
        }
    }, [mp, onClose]);
    
    if (!mp) return null;

    // Handle broken image URLs
    const handleImageError = (event) => {
        event.target.src = '/src/assets/image/placeholder-mp.jpg';
        event.target.onerror = null;
    };

    const isValidImageUrl = (url) => {
        if (!url) return false;
        return !url.includes('cloudinary.com/example') && 
               !url.includes('res.cloudinary.com/example');
    };

    const imageSrc = isValidImageUrl(mp.profilePicture) ? mp.profilePicture : '/src/assets/image/placeholder-mp.jpg';

    // Performance data (from MP model or defaults)
    const performanceData = {
        attendanceRate: mp.performance?.attendanceRate || 85.4,
        responseRate: mp.performance?.responseRate || 90.1,
        escalateRate: mp.performance?.escalateRate || 58.8
    };

    // Sentiment analysis data
    const sentimentData = mp.sentimentAnalysis || {
        score: 4.2,
        content: "Generally positive public reception",
        date: "2024-02-15"
    };

    // Recent activities (from MP model or sample data)
    const recentActivities = mp.mentionedInHansard?.slice(0, 4) || [
        {
            id: 1,
            date: '2024-02-08',
            type: 'answer',
            title: 'Healthcare Budget Discussion',
            description: 'Addressed concerns about rural healthcare funding allocation.',
            category: 'Healthcare'
        },
        {
            id: 2,
            date: '2024-01-28',
            type: 'question',
            title: 'Education Infrastructure',
            description: 'Raised questions about school infrastructure improvements.',
            category: 'Education'
        }
    ];

    const handleBookmark = () => {
        setIsBookmarked(!isBookmarked);
    };

    const getPerformanceColor = (rate) => {
        if (rate >= 80) return 'text-green-600 bg-green-100';
        if (rate >= 60) return 'text-yellow-600 bg-yellow-100';
        return 'text-red-600 bg-red-100';
    };

    const getPerformanceBarColor = (rate) => {
        if (rate >= 80) return 'bg-green-500';
        if (rate >= 60) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const renderPerformanceBar = (rate, label) => (
        <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">{label}</span>
                <span className={`text-sm font-bold px-2 py-1 rounded-full ${getPerformanceColor(rate)}`}>
                    {rate}%
                </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                    className={`h-2 rounded-full transition-all duration-300 ${getPerformanceBarColor(rate)}`}
                    style={{ width: `${rate}%` }}
                ></div>
            </div>
        </div>
    );

    const getActivityIcon = (type) => {
        const iconClasses = "w-4 h-4 text-white";
        switch (type) {
            case 'answer':
                return (
                    <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
                        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </div>
                );
            case 'question':
                return (
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                );
            default:
                return (
                    <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                );
        }
    };

    const tabs = [
        { id: 'overview', label: t('tabOverview'), icon: '👤' },
        { id: 'performance', label: t('tabPerformance'), icon: '📊' }
    ];

    return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
            <div 
                className="flex-1 flex flex-col" 
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                {/* Header with close button */}
                <div className="modal-header">
                    <h2 id="modal-title" className="modal-title">{t('mpDetails')}</h2>
                    <button className="modal-close" onClick={onClose}>
                        <svg className="close-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="tab-navigation">
                    <nav className="tab-nav">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                            >
                                <span className="tab-icon">{tab.icon}</span>
                                <span className="tab-label">{tab.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="tab-content">
                    {activeTab === 'overview' && (
                        <>
                            {/* MP Profile Section */}
                            <div className="mp-profile">
                                <div className="profile-header">
                                    <div className="profile-image-container">
                                        <img 
                                            className="profile-image" 
                                            src={imageSrc} 
                                            alt={mp.name || t('mpShort')} 
                                            onError={handleImageError}
                                        />
                                    </div>
                                    
                                    <div className="profile-actions">
                                        <button
                                            onClick={handleBookmark}
                                            className={`bookmark-button ${isBookmarked ? 'bookmarked' : ''}`}
                                            title={isBookmarked ? t('removeBookmark') : t('addBookmark')}
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
                                            <span>130,735 {t('followers')}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="profile-info">
                                    <div className="name-and-badge">
                                        <h3 className="mp-name">{removeHonorifics(mp.full_name_with_titles || mp.name) || t('unknownMP')}</h3>
                                        {mp.positionInCabinet && (
                                            <div className="cabinet-badge">{mp.positionInCabinet}</div>
                                        )}
                                    </div>
                                    <div className="mp-details">
                                        <span className="detail-item">
                                            <svg className="detail-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                            </svg>
                                            {mp.party === 'historical_party' ? t('unknown') : (mp.party_full_name || mp.party || t('noParty'))}
                                        </span>
                                        <span className="detail-item">
                                            <svg className="detail-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            {mp.constituency?.replace(/^P\d+\s*/, '') || t('noConstituency')}
                                        </span>
                                        <span className="detail-item">
                                            <svg className="detail-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {mp.positionInParliament || t('mpShort')} • {t('term')} {mp.parliament_term || t('unknown')}
                                        </span>
                                        <span className="detail-item">
                                            <svg className="detail-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                            {mp.status === 'current' ? t('currentTerm') : mp.status === 'historical' ? t('pastTerm') : t('unknownStatus')}
                                        </span>
                                        <span className="detail-item">
                                            <svg className="detail-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {(mp.parliamentary_history && mp.parliamentary_history.length > 1) ? 
                                                `${t('veteranMP')} (${mp.parliamentary_history.length} ${t('veteranTermsServed')})` : 
                                                t('firstTimeMP')
                                            }
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Biography Section */}
                            <div className="info-section">
                                <h4 className="section-title">
                                    <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    {t('biography')}
                                </h4>
                                <div className="biography-content">
                                    <p className="biography-text">
                                        {mp.biography || `${t('biographyDefault1')} ${mp.constituency?.replace(/^P\d+\s*/, '') || t('noConstituency')}, 
                                        ${removeHonorifics(mp.full_name_with_titles || mp.name) || t('mpShort')} ${t('biographyDefault2')} ${mp.party === 'historical_party' ? t('noParty') : (mp.party_full_name || mp.party || t('noParty'))} 
                                        ${t('biographyDefault3')}`}
                                    </p>
                                </div>
                            </div>

                            {/* Parliamentary History Section */}
                            <div className="info-section">
                                <h4 className="section-title">
                                    <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {t('parliamentaryHistory')}
                                </h4>
                                
                                {(mp.parliamentary_history && mp.parliamentary_history.length > 0) ? (
                                    <div className="history-timeline">
                                        {mp.parliamentary_history
                                            .sort((a, b) => (b.term_number || 0) - (a.term_number || 0))
                                            .map((term, index) => (
                                                <div key={index} className="history-item">
                                                    <div className="history-marker"></div>
                                                    <div className="history-content">
                                                        <div className="history-header">
                                                            <span className="history-term">{term.parliament_term || `${t('term')} ${term.term_number}`}</span>
                                                            <span className="history-status">
                                                                {term.status === 'current' ? t('current') : t('pastTermShort')}
                                                            </span>
                                                        </div>
                                                        <div className="history-details">
                                                            <div className="history-party">
                                                                <strong>{t('partyLabel')}</strong> {term.party_full_name || term.party || t('unknown')}
                                                            </div>
                                                            <div className="history-constituency">
                                                                <strong>{t('constituencyLabel')}</strong> {term.constituency_name || term.constituency?.replace(/^[A-Z]\d+\s*/, '') || t('unknown')}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        }
                                    </div>
                                ) : (
                                    <div className="first-time-simple">
                                        <p>{t('firstTime')}</p>
                                    </div>
                                )}
                            </div>

                            {/* Contact Information Section */}
                            <div className="info-section">
                                <h4 className="section-title">
                                    <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    {t('contactInformation')}
                                </h4>
                                <div className="contact-grid">
                                    {mp.email && (
                                        <div className="contact-item">
                                            <svg className="contact-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                            <div>
                                                <span className="contact-label">{t('email')}</span>
                                                <span className="contact-value">{mp.email}</span>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {mp.phone && (
                                        <div className="contact-item">
                                            <svg className="contact-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                            </svg>
                                            <div>
                                                <span className="contact-label">{t('phone')}</span>
                                                <span className="contact-value">{mp.phone}</span>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {mp.fax && (
                                        <div className="contact-item">
                                            <svg className="contact-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                            </svg>
                                            <div>
                                                <span className="contact-label">{t('fax')}</span>
                                                <span className="contact-value">{mp.fax}</span>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {mp.seatNumber && (
                                        <div className="contact-item">
                                            <svg className="contact-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                            </svg>
                                            <div>
                                                <span className="contact-label">{t('seatNumber')}</span>
                                                <span className="contact-value">{mp.seatNumber}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {mp.address && (
                                    <div className="address-section">
                                        <svg className="address-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <div>
                                            <span className="contact-label">{t('address')}</span>
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
                                            {t('viewParliamentProfile')}
                                        </a>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === 'performance' && (
                        <>
                            {/* Performance Metrics Section */}
                            <div className="info-section">
                                <h4 className="section-title">
                                    <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    {t('performanceMetrics')}
                                </h4>
                                <div className="performance-grid">
                                    <div className="performance-item">
                                        <div className="performance-label">{t('parliamentAttendance')}</div>
                                        <div className="performance-bar">
                                            <div className="performance-progress" style={{ width: `${performanceData.attendanceRate}%` }}></div>
                                        </div>
                                        <div className="performance-value">{performanceData.attendanceRate}%</div>
                                    </div>
                                    <div className="performance-item">
                                        <div className="performance-label">{t('responseRate')}</div>
                                        <div className="performance-bar">
                                            <div className="performance-progress" style={{ width: `${performanceData.responseRate}%` }}></div>
                                        </div>
                                        <div className="performance-value">{performanceData.responseRate}%</div>
                                    </div>
                                    <div className="performance-item">
                                        <div className="performance-label">{t('escalationRate')}</div>
                                        <div className="performance-bar">
                                            <div className="performance-progress" style={{ width: `${performanceData.escalateRate}%` }}></div>
                                        </div>
                                        <div className="performance-value">{performanceData.escalateRate}%</div>
                                    </div>
                                </div>
                            </div>

                            {/* Parliamentary Activity Section */}
                            <div className="info-section">
                                <h4 className="section-title">
                                    <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    {t('recentParliamentaryActivity')}
                                </h4>
                                <div className="activities-list">
                                    {recentActivities.map((activity) => (
                                        <div key={activity.id} className="activity-item">
                                            <div className="activity-icon">
                                                {getActivityIcon(activity.type)}
                                            </div>
                                            <div className="activity-content">
                                                <div className="activity-header">
                                                    <h5 className="activity-title">{activity.title}</h5>
                                                    <span className="activity-date">{activity.date}</span>
                                                </div>
                                                <p className="activity-description">{activity.description}</p>
                                                <div className="activity-tags">
                                                    <span className="activity-tag category">{activity.category}</span>
                                                    <span className="activity-tag type">{activity.type}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}


                </div>
            </div>
        </div>
    );
}
