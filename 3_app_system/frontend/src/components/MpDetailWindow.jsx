import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks';
import { useLanguage } from '../contexts/LanguageContext';
import { removeHonorifics, formatAddress, formatConstituency, isHistoricalParty } from '../utils/mpUtils';
import { getExcerptPreview } from '../utils/excerptDisplay';
import topicApi from '../api/topicApi';
import { userApi } from '../api';

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
  
  .tab-navigation .tab-button.active {
    background: transparent !important;
    background-color: transparent !important;
    color: #4f46e5;
    font-weight: 600;
    border: none;
    border-bottom: 3px solid #4f46e5;
    border-radius: 0;
    box-shadow: none;
  }
  
  .tab-icon {
    font-size: 1.1rem;
  }
  
  .tab-content {
    flex: 0 1 auto;
    max-height: min(70vh, 600px);
    overflow-y: auto;
    overflow-x: hidden;
    padding: 2rem 2rem 4rem 2rem;
    background-color: #fafafa;
    min-height: 0;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }
  
  .tab-content .profile-link {
    margin-bottom: 2rem;
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
      padding: 1.5rem 1.5rem 3rem 1.5rem;
    }
    
    .tab-content .profile-link {
      margin-bottom: 1.5rem;
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
    left: -1.65rem;
    top: -0.5rem;
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
  .contact-empty-message {
    color: #6b7280;
    font-size: 0.9375rem;
    margin: 0.5rem 0 0;
  }
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

  .loading-spinner {
    width: 1.25rem;
    height: 1.25rem;
    border: 2px solid #e5e7eb;
    border-top-color: #4f46e5;
    border-radius: 50%;
    animation: mpDetailSpinner 0.7s linear infinite;
  }
  @keyframes mpDetailSpinner {
    to { transform: rotate(360deg); }
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

export default function MpDetailWindow({ mp, onClose, returnToUrl, onFollowToggle }) {
    const [isBookmarked, setIsBookmarked] = useState(Boolean(mp?.isFollowed));
    const [activeTab, setActiveTab] = useState('overview');
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [portalStatements, setPortalStatements] = useState([]);
    const [portalPerformance, setPortalPerformance] = useState(null);
    const [loadingPortalStatements, setLoadingPortalStatements] = useState(false);
    const [expandedAttendanceTerms, setExpandedAttendanceTerms] = useState({});
    const [followerCount, setFollowerCount] = useState(
        typeof mp?.followerCount === 'number' ? mp.followerCount : 0
    );
    const { t } = useLanguage();

    // Keep local bookmark state in sync with latest mp.isFollowed from parent
    useEffect(() => {
        setIsBookmarked(Boolean(mp?.isFollowed));
    }, [mp?.isFollowed]);

    // Keep local followerCount in sync with latest mp.followerCount from parent
    useEffect(() => {
        setFollowerCount(typeof mp?.followerCount === 'number' ? mp.followerCount : 0);
    }, [mp?.followerCount]);

    const toggleAttendanceTerm = (termKey) => {
        setExpandedAttendanceTerms((prev) => ({ ...prev, [termKey]: !prev[termKey] }));
    };
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const loggedViewForRef = useRef(null);

    // Log MP profile view for Personal Activities (once per MP per open)
    useEffect(() => {
        if (!isAuthenticated || !mp) return;
        const mpId = mp._id || mp.id || mp.mp_id;
        if (!mpId) return;
        const id = String(mpId);
        if (loggedViewForRef.current === id) return;
        loggedViewForRef.current = id;
        userApi.logView('mp', mpId, mp.name || mp.full_name_with_titles || mpId);
    }, [isAuthenticated, mp]);

    useEffect(() => {
        if (!mp) {
            setPortalStatements([]);
            setPortalPerformance(null);
            return;
        }
        const mpName = mp.name;
        const mpFullName = mp.full_name_with_titles;
        const mpParliamentTerm = mp.parliament_term;
        if (!mpName) {
            setPortalStatements([]);
            setPortalPerformance(null);
            return;
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        setLoadingPortalStatements(true);
        topicApi.getStatementsByMp(mpName, mpFullName, 8, mpParliamentTerm, { signal: controller.signal })
            .then((res) => {
                if (res?.data?.statements && Array.isArray(res.data.statements)) {
                    setPortalStatements(res.data.statements);
                } else {
                    setPortalStatements([]);
                }
                if (res?.data?.performance && typeof res.data.performance === 'object') {
                    setPortalPerformance(res.data.performance);
                } else {
                    setPortalPerformance(null);
                }
            })
            .catch(() => {
                setPortalStatements([]);
                setPortalPerformance(null);
            })
            .finally(() => {
                clearTimeout(timeoutId);
                setLoadingPortalStatements(false);
            });
        return () => {
            controller.abort();
            clearTimeout(timeoutId);
        };
    }, [mp?.name, mp?.full_name_with_titles]);
    
    // Lock body scroll when window is open; only inner modal scrolls (no padding — avoids pushing dashboard left)
    useEffect(() => {
        if (mp) {
            document.body.classList.add('modal-open');
            document.documentElement.classList.add('modal-open');
            return () => {
                document.body.classList.remove('modal-open');
                document.documentElement.classList.remove('modal-open');
            };
        }
    }, [mp]);

    // Lock body scroll when login modal is open, restore when closed
    useEffect(() => {
        if (showLoginModal) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [showLoginModal]);

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

    // Performance data: from Issue Portal (backend-computed) first, else MP model; no dummy defaults
    const fromPortal = portalPerformance && typeof portalPerformance === 'object';
    const perf = fromPortal ? portalPerformance : mp.performance;
    const hasPerformanceData = [
        perf?.attendanceRate, perf?.responseRate, perf?.askRate,
        perf?.escalateRate, perf?.interjectionRate, perf?.sentimentScore,
    ].some((v) => typeof v === 'number' && !Number.isNaN(v));
    const performanceData = {
        attendanceRate:   typeof perf?.attendanceRate   === 'number' && !Number.isNaN(perf.attendanceRate)   ? perf.attendanceRate   : null,
        responseRate:     typeof perf?.responseRate     === 'number' && !Number.isNaN(perf.responseRate)     ? perf.responseRate     : null,
        askRate:          typeof perf?.askRate          === 'number' && !Number.isNaN(perf.askRate)          ? perf.askRate          : null,
        escalateRate:     typeof perf?.escalateRate     === 'number' && !Number.isNaN(perf.escalateRate)     ? perf.escalateRate     : null,
        interjectionRate: typeof perf?.interjectionRate === 'number' && !Number.isNaN(perf.interjectionRate) ? perf.interjectionRate : null,
        sentimentScore:   typeof perf?.sentimentScore   === 'number' && !Number.isNaN(perf.sentimentScore)   ? perf.sentimentScore   : null,
        attendanceByPenggal: Array.isArray(perf?.attendanceByPenggal) ? perf.attendanceByPenggal : [],
        attendanceByTerm:    Array.isArray(perf?.attendanceByTerm)    ? perf.attendanceByTerm    : [],
    };
    const unavailableText = t('dataCurrentlyNotAvailable') || 'Data is currently not available.';

    // Build attendance-by-term list for collapse UI: use all terms (current + historical) when available
    const attendanceTerms = (() => {
        const byTerm = performanceData.attendanceByTerm || [];
        if (byTerm.length > 0) {
            // Use termNum (number) as key; filter out terms with no session data
            return byTerm
                .filter((term) => term.total > 0 || (term.byPenggal || []).length > 0)
                .map((term) => ({
                    termKey: String(term.term),
                    termLabel: t('parliamentTermLabel')?.replace('{n}', term.term) || `Parliament ${term.term}`,
                    termRate: term.rate,
                    attended: term.attended,
                    total: term.total,
                    byPenggal: term.byPenggal || [],
                }));
        }
        const byPenggal = performanceData.attendanceByPenggal || [];
        if (byPenggal.length === 0) return [];
        const termKey = mp?.parliament_term ? String(mp.parliament_term).replace(/\D/g, '') || '15' : '15';
        const termLabel = t('parliamentTermLabel')?.replace('{n}', termKey) || `Parliament Term ${termKey}`;
        return [{ termKey, termLabel, termRate: performanceData.attendanceRate, byPenggal }];
    })();

    // Latest parliament term (numeric max) for showing the global "updated" label.
    // We only show the "updated: YYYY-MM-DD" text on the most recent parliament's
    // latest penggal, not for every historical term.
    const latestAttendanceTermKey =
        attendanceTerms.length > 0
            ? String(
                  Math.max(
                      ...attendanceTerms.map((term) => {
                          const n = parseInt(term.termKey, 10);
                          return Number.isNaN(n) ? 0 : n;
                      })
                  )
              )
            : null;

    const isTermExpanded = (termKey) => expandedAttendanceTerms[termKey] === true;

    // Attendance is 0/0 or 0/xxx → show "No data available for this MP" in the attendance region
    const hasNoAttendanceData =
        performanceData.attendanceRate === 0 ||
        (attendanceTerms.length > 0 &&
            attendanceTerms.every((t) => {
                const totalAttended =
                    t.attended ??
                    (t.byPenggal || []).reduce((sum, p) => sum + (p.attended || 0), 0);
                return totalAttended === 0;
            }));

    // Sentiment analysis data
    const sentimentData = mp.sentimentAnalysis || {
        score: 4.2,
        content: "Generally positive public reception",
        date: "2024-02-15"
    };

    // Recent activities: real data only — Issue Portal statements, or MP model mentionedInHansard (no mock/sample)
    const recentActivities = (() => {
        if (portalStatements.length > 0) {
            return portalStatements.map((s, idx) => ({
                id: s.issueId || `portal-${idx}`,
                issueId: s.issueId || null,
                date: s.date ? (typeof s.date === 'string' ? s.date.slice(0, 10) : new Date(s.date).toISOString().slice(0, 10)) : '',
                type: s.action_type === 'ask' ? 'question' : (s.action_type === 'reply' || s.action_type === 'escalate' ? 'answer' : s.action_type || 'reply'),
                title: s.issueTitle || 'Parliamentary debate',
                description: getExcerptPreview(s.text_excerpt || '', 200),
                category: s.category || 'Other',
            }));
        }
        if (Array.isArray(mp.mentionedInHansard) && mp.mentionedInHansard.length > 0) {
            return mp.mentionedInHansard.slice(0, 8).map((h, idx) => ({
                id: h.id ?? `hansard-${idx}`,
                issueId: h.issueId ?? null,
                date: h.date ?? '',
                type: h.type ?? 'reply',
                title: h.title ?? '',
                description: h.description ?? '',
                category: h.category ?? 'Other',
            }));
        }
        return [];
    })();

    const isActivityLink = (activity) => {
        const id = activity.issueId ?? activity.id;
        return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id) && activity.date;
    };

    const handleBookmark = async () => {
        if (!isAuthenticated) {
            setShowLoginModal(true);
            return;
        }
        const id = String(mp?._id || mp?.id);
        if (!id) return;

        const nextFollowed = !isBookmarked;
        // Optimistic toggle
        setIsBookmarked(nextFollowed);
        setFollowerCount((prev) => {
            const delta = nextFollowed ? 1 : -1;
            const next = (prev || 0) + delta;
            return next < 0 ? 0 : next;
        });
        try {
            if (isBookmarked) {
                await userApi.unfollowMP(id);
            } else {
                await userApi.followMP(id);
            }
            // Notify parent so the card star on the list also updates
            onFollowToggle?.(id, nextFollowed);
        } catch (err) {
            console.error('Failed to toggle MP follow from detail window:', err);
            // Revert on error
            setIsBookmarked(prev => !prev);
            setFollowerCount((prev) => {
                const delta = nextFollowed ? -1 : 1;
                const next = (prev || 0) + delta;
                return next < 0 ? 0 : next;
            });
        }
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
        { id: 'overview', label: t('tabOverview'), icon: '' },
        { id: 'performance', label: t('tabPerformance'), icon: '' }
    ];

    return (
        <>
            <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-40" aria-hidden="true" onClick={onClose} />
            <div className="fixed top-4 left-4 right-4 bottom-6 sm:top-6 sm:left-6 sm:right-6 sm:bottom-8 md:top-8 md:left-8 md:right-8 md:bottom-10 lg:top-12 lg:left-12 lg:right-12 lg:bottom-16 z-50 flex flex-col bg-white rounded-2xl shadow-xl overflow-hidden max-h-[90vh] h-max">
                <div
                    className="flex flex-col min-h-0"
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modal-title"
                >
                    {/* Header with close button */}
                    <div className="modal-header">
                    <h2 id="modal-title" className="modal-title">{t('mpDetails')}</h2>
                    <div className="flex items-center gap-2">
                        {returnToUrl && (
                            <Link
                                to={returnToUrl}
                                className="modal-close flex items-center gap-1.5 px-3 py-2 text-white text-sm font-medium rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                                onClick={onClose}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                {t('backToPreviousPage')}
                            </Link>
                        )}
                        <button className="modal-close" onClick={onClose} aria-label="Close">
                            <svg className="close-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
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
                                            <span>{(followerCount ?? 0).toLocaleString()} {t('followers')}</span>
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
                                            {isHistoricalParty(mp.party) ? t('unknown') : (mp.party_full_name || mp.party || t('noParty'))}
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
                                            {(mp.parliamentary_history && mp.parliamentary_history.length > 0) ? 
                                                `${t('veteranMP')} (${mp.parliamentary_history.length + 1} ${t('veteranTermsServed')})` : 
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
                                        ${removeHonorifics(mp.full_name_with_titles || mp.name) || t('mpShort')} ${t('biographyDefault2')} ${isHistoricalParty(mp.party) ? t('unknown') : (mp.party_full_name || mp.party || t('noParty'))} 
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
                                                                <strong>{t('partyLabel')}</strong> {(() => {
                                                                    const p = term.party_full_name || term.party || '';
                                                                    const isUnknown = !p || /^historical[_ ]?party$/i.test(String(p).trim());
                                                                    return isUnknown ? t('unknown') : p;
                                                                })()}
                                                            </div>
                                                            <div className="history-constituency">
                                                                <strong>{t('constituencyLabel')}</strong> {formatConstituency(term.constituency_name || term.constituency) || t('unknown')}
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
                            <div className="info-section contact-detail-region">
                                <h4 className="section-title">
                                    <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    {t('contactInformation')}
                                </h4>
                                {!(mp.email || mp.phone || mp.fax || mp.seatNumber || mp.address || mp.profile_url) ? (
                                    <p className="contact-empty-message">{t('noContactData')}</p>
                                ) : (
                                <>
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
                                            <span className="contact-value">{formatAddress(mp.address)}</span>
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
                                </>
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === 'performance' && (
                        <>
                            {/* Performance Metrics Section — real data only, no dummy values */}
                            <div className="info-section">
                                <h4 className="section-title">
                                    <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    {t('performanceMetrics')}
                                </h4>
                                {(loadingPortalStatements && !hasPerformanceData) ? (
                                    <div className="flex items-center gap-2 py-4 text-gray-500 text-sm">
                                        <span className="loading-spinner" aria-hidden />
                                        <span>{t('loading') || 'Loading…'}</span>
                                    </div>
                                ) : !hasPerformanceData ? (
                                    <p className="text-gray-500 text-sm py-2">{t('performanceDataNotAvailable') || 'Performance data not available for this MP.'}</p>
                                ) : (
                                    <div className="performance-grid">
                                        <div className="performance-item">
                                            <div className="performance-label">{t('parliamentAttendance')}</div>
                                            {hasNoAttendanceData ? (
                                                <p className="text-gray-500 text-sm py-2">{t('performanceDataNotAvailable') || 'No data available for this MP.'}</p>
                                            ) : performanceData.attendanceRate != null ? (
                                                <>
                                                    {/* Overall = sum of all parliament terms */}
                                                    <div className="performance-bar">
                                                        <div className="performance-progress" style={{ width: `${Math.min(100, Math.max(0, performanceData.attendanceRate))}%` }}></div>
                                                    </div>
                                                    <div className="performance-value">{performanceData.attendanceRate}%</div>
                                                    {/* Collapsible by Parliament term → Penggal */}
                                                    {attendanceTerms.length > 0 && (
                                                        <div className="mt-2 border-t border-indigo-100 pt-2 space-y-1">
                                                            {attendanceTerms.map(({ termKey, termLabel, termRate, attended, total, byPenggal }) => {
                                                                const expanded = isTermExpanded(termKey);
                                                                const isLatestTerm = latestAttendanceTermKey && termKey === latestAttendanceTermKey;
                                                                // Find the latest penggal for "updated" date display
                                                                const latestPg = byPenggal.length > 0
                                                                    ? [...byPenggal].sort((a, b) => b.penggal - a.penggal)[0]
                                                                    : null;
                                                                return (
                                                                    <div key={termKey} className="rounded border border-gray-200 overflow-hidden">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => toggleAttendanceTerm(termKey)}
                                                                            className="w-full flex items-center justify-between gap-2 py-1.5 px-2 text-left hover:bg-gray-50 transition-colors"
                                                                        >
                                                                            <span className="text-xs text-gray-400 font-normal">{termLabel}</span>
                                                                            <div className="flex items-center gap-2 ml-auto">
                                                                                {termRate != null && (
                                                                                    <span className="text-xs font-medium text-gray-500">{termRate}%</span>
                                                                                )}
                                                                                <svg
                                                                                    className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
                                                                                    fill="none"
                                                                                    stroke="currentColor"
                                                                                    viewBox="0 0 24 24"
                                                                                >
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                                </svg>
                                                                            </div>
                                                                        </button>
                                                                        {expanded && (
                                                                            <div className="px-2 pb-2 pt-0 space-y-1.5 bg-gray-50/50">
                                                                                {byPenggal.map((pg, pgIdx) => {
                                                                                    const pgRate = pg.rate ?? 0;
                                                                                    // Show \"updated: date\" only on the latest *parliament term*'s
                                                                                    // latest penggal (global freshest attendance data).
                                                                                    const isLatestPg = isLatestTerm && latestPg && pg.penggal === latestPg.penggal;
                                                                                    return (
                                                                                        <div key={pg.penggal}>
                                                                                            <div className="flex items-center gap-2">
                                                                                                <span className="text-xs text-gray-400 w-20 shrink-0">
                                                                                                    Penggal {pg.penggal}
                                                                                                </span>
                                                                                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                                                                    <div
                                                                                                        className="h-full rounded-full"
                                                                                                        style={{
                                                                                                            width: `${Math.min(100, Math.max(0, pgRate))}%`,
                                                                                                            backgroundColor: pgRate >= 80 ? '#22c55e' : pgRate >= 60 ? '#f59e0b' : '#ef4444',
                                                                                                        }}
                                                                                                    />
                                                                                                </div>
                                                                                                <span className="text-xs font-medium text-gray-500 w-10 text-right shrink-0">
                                                                                                    {pg.rate != null ? `${pg.rate}%` : '—'}
                                                                                                </span>
                                                                                                <span className="text-xs text-gray-400 shrink-0">
                                                                                                    ({pg.attended}/{pg.total})
                                                                                                </span>
                                                                                            </div>
                                                                                            {isLatestPg && pg.latestDate && (
                                                                                                <div className="mt-0.5 ml-20 text-xs text-gray-300 italic">
                                                                                                    updated: {pg.latestDate}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <p className="text-gray-500 text-sm py-2">{unavailableText}</p>
                                            )}
                                        </div>
                                        <div className="performance-item">
                                            <div className="performance-label">{t('responseRate')}</div>
                                            {performanceData.responseRate != null ? (
                                                <>
                                                    <div className="performance-bar">
                                                        <div className="performance-progress" style={{ width: `${Math.min(100, Math.max(0, performanceData.responseRate))}%` }}></div>
                                                    </div>
                                                    <div className="performance-value">{performanceData.responseRate}%</div>
                                                </>
                                            ) : (
                                                <p className="text-gray-500 text-sm py-2">{unavailableText}</p>
                                            )}
                                        </div>
                                        <div className="performance-item">
                                            <div className="performance-label">{t('escalationRate')}</div>
                                            {performanceData.escalateRate != null ? (
                                                <>
                                                    <div className="performance-bar">
                                                        <div className="performance-progress" style={{ width: `${Math.min(100, Math.max(0, performanceData.escalateRate))}%` }}></div>
                                                    </div>
                                                    <div className="performance-value">{performanceData.escalateRate}%</div>
                                                </>
                                            ) : (
                                                <p className="text-gray-500 text-sm py-2">{unavailableText}</p>
                                            )}
                                        </div>
                                        <div className="performance-item">
                                            <div className="performance-label">{t('askRate') || 'Ask Rate'}</div>
                                            {performanceData.askRate != null ? (
                                                <>
                                                    <div className="performance-bar">
                                                        <div className="performance-progress" style={{ width: `${Math.min(100, Math.max(0, performanceData.askRate))}%` }}></div>
                                                    </div>
                                                    <div className="performance-value">{performanceData.askRate}%</div>
                                                </>
                                            ) : (
                                                <p className="text-gray-500 text-sm py-2">{unavailableText}</p>
                                            )}
                                        </div>
                                        <div className="performance-item">
                                            <div className="performance-label">{t('interjectionRate') || 'Interjection Rate'}</div>
                                            {performanceData.interjectionRate != null ? (
                                                <>
                                                    <div className="performance-bar">
                                                        <div className="performance-progress" style={{ width: `${Math.min(100, Math.max(0, performanceData.interjectionRate))}%` }}></div>
                                                    </div>
                                                    <div className="performance-value">{performanceData.interjectionRate}%</div>
                                                </>
                                            ) : (
                                                <p className="text-gray-500 text-sm py-2">{unavailableText}</p>
                                            )}
                                        </div>
                                        <div className="performance-item">
                                            <div className="performance-label">{t('sentimentScore') || 'Sentiment Score'}</div>
                                            {performanceData.sentimentScore != null ? (
                                                <>
                                                    <div className="performance-bar">
                                                        <div
                                                            className="performance-progress"
                                                            style={{
                                                                width: `${Math.min(100, Math.max(0, performanceData.sentimentScore))}%`,
                                                                backgroundColor: performanceData.sentimentScore >= 70 ? '#22c55e' : performanceData.sentimentScore >= 45 ? '#f59e0b' : '#ef4444',
                                                            }}
                                                        ></div>
                                                    </div>
                                                    <div className="performance-value">
                                                        {performanceData.sentimentScore}
                                                    </div>
                                                </>
                                            ) : (
                                                <p className="text-gray-500 text-sm py-2">{unavailableText}</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Parliamentary Activity Section (from Issue Portal when available) */}
                            <div className="info-section">
                                <h4 className="section-title">
                                    <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    {t('recentParliamentaryActivity')}
                                </h4>
                                <div className="activities-list">
                                    {loadingPortalStatements && recentActivities.length === 0 ? (
                                        <div className="flex items-center gap-2 py-4 text-gray-500 text-sm">
                                            <span className="loading-spinner" aria-hidden />
                                            <span>{t('loading') || 'Loading…'}</span>
                                        </div>
                                    ) : recentActivities.length === 0 ? (
                                        <p className="text-gray-500 text-sm py-4">{unavailableText}</p>
                                    ) : (
                                        recentActivities.map((activity) => {
                                            const issueId = activity.issueId ?? activity.id;
                                            const hasIssueLink = isActivityLink(activity);
                                            const linkTo = hasIssueLink
                                                ? `/topic/${issueId}?scrollToDate=${encodeURIComponent(activity.date)}`
                                                : '/';
                                            const content = (
                                                <>
                                                    <div className="activity-icon">
                                                        {getActivityIcon(activity.type)}
                                                    </div>
                                                    <div className="activity-content flex-1 min-w-0">
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
                                                    <span className="flex-shrink-0 self-center text-indigo-600 text-sm font-medium whitespace-nowrap">
                                                        {hasIssueLink ? (t('viewInIssuePortal') || 'View in Issue Portal') + ' →' : (t('browseIssuePortal') || 'Browse Issue Portal') + ' →'}
                                                    </span>
                                                </>
                                            );
                                            const handleActivityClick = (e) => {
                                                e.preventDefault();
                                                onClose();
                                                navigate(linkTo);
                                            };
                                            return (
                                                <div key={activity.id} className="activity-item">
                                                    <Link
                                                        to={linkTo}
                                                        onClick={handleActivityClick}
                                                        className="flex items-start gap-3 w-full cursor-pointer rounded-lg -m-1 p-1 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-inset hover:bg-indigo-50/70 transition-colors"
                                                    >
                                                        {content}
                                                    </Link>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </>
                    )}


                </div>
                </div>
            </div>

            {/* Login required modal — sibling of main content, high z-index; body scroll locked via useEffect */}
            {showLoginModal && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowLoginModal(false); }}
                >
                    <div className="w-full max-w-[600px] bg-white rounded-xl shadow-xl p-6" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                        <p className="text-gray-700 text-base mb-6">
                            {t('loginRequiredForBookmark')}
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowLoginModal(false); }}
                                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowLoginModal(false); navigate('/login'); }}
                                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium"
                            >
                                {t('login')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
