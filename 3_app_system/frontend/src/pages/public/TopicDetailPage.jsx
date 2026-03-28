import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { topicApi, userApi } from "../../api";
import { useApi } from "../../hooks";
import { useAuth } from "../../hooks";
import { useLanguage } from "../../contexts/LanguageContext";
import { LoadingSpinner } from "../../components/ui";
import { cleanDisplayExcerpt, getExcerptPreview } from "../../utils/excerptDisplay";
import { useSSEEvent } from "../../contexts/SSEContext";

function TopicDetailPage() {
  const { topicId } = useParams();
  const navigate   = useNavigate();
  const location   = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const scrollToDateYMD = searchParams.get('scrollToDate') || ''; // YYYY-MM-DD
  const { executeApiCall, loading } = useApi();
  const { isAuthenticated } = useAuth();
  const { language, t } = useLanguage();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [timelineBlink, setTimelineBlink] = useState(false);
  const [dateBlockBlink, setDateBlockBlink] = useState(false);
  const timelineRef = useRef(null);
  const mostRecentTurnRef = useRef(null);
  const scrollToDateBlockRef = useRef(null);
  const scrollToFirstConversationRef = useRef(null);
  const [issue, setIssue] = useState(null);   // full precomputed issue document
  const [error, setError] = useState(null);
  const viewRecordedRef = useRef(null);       // avoid double record (e.g. Strict Mode)

  // Record issue view for trending "By views" (any visitor, once per issue load)
  useEffect(() => {
    if (!issue || !topicId) return;
    if (viewRecordedRef.current === topicId) return;
    viewRecordedRef.current = topicId;
    topicApi.recordIssueView(topicId);
  }, [issue, topicId]);

  // Initial follow state can be passed from IssuePortal via location.state
  useEffect(() => {
    if (location.state && typeof location.state.isFollowed === 'boolean') {
      setIsBookmarked(location.state.isFollowed);
    }
  }, [location.state]);

  const returnTo = new URLSearchParams(location.search).get('returnTo');

  // Log view for Personal Activities (only when authenticated and issue is loaded)
  useEffect(() => {
    if (!isAuthenticated || !issue) return;
    userApi.logView('issue', topicId, issue.title || issue.name_en || topicId);
  }, [isAuthenticated, topicId, issue]);

  // ─── Fetch precomputed issue from cache ────────────────────────────────────
  useEffect(() => {
    if (!topicId) return;

    const prefetched = location.state?.prefetchedIssue;
    if (prefetched && String(prefetched._id) === String(topicId)) {
      setIssue(prefetched);
      setError(null);
      return;
    }

    const fetchIssue = async () => {
      try {
        setError(null);

        // Primary: GET /api/issue-portal/issue/:issueId  (MongoDB _id)
        const response = await executeApiCall(() => topicApi.getIssueById(topicId));
        const data = response?.data || response;

        if (data?.issue) {
          setIssue(data.issue);
          return;
        }

        // Fallback: legacy route /:pipelineId/:topicIdentifier (cluster_id or ObjectId)
        const legacy = await executeApiCall(() =>
          topicApi.getIssueDetail('pipeline5', topicId)
        );
        const legacyData = legacy?.data || legacy;
        if (legacyData?.topic) {
          // Normalise legacy shape to match precomputed shape
          setIssue({
            ...legacyData.topic,
            title:    legacyData.topic.title    || legacyData.topic.name_en || `Topic ${topicId}`,
            title_ms: legacyData.topic.title_ms || legacyData.topic.name_ms || '',
            timeline: legacyData.statements     || [],
          });
          return;
        }

        setError('Issue not found');
      } catch (err) {
        console.error('[TopicDetailPage] fetch error:', err);
        setError('Failed to load topic details');
      }
    };

    fetchIssue();
  }, [topicId, executeApiCall]);

  // Real-time: re-fetch if admin updates this topic, or if forum moderation hides a post in the linked discussion
  useSSEEvent('topic_updated', useCallback((data) => {
    if (!topicId) return;
    if (!data?.id || data.id === topicId) {
      executeApiCall(() => topicApi.getIssueById(topicId))
        .then((res) => { const d = res?.data || res; if (d?.issue) setIssue(d.issue); })
        .catch(() => {});
    }
  }, [topicId, executeApiCall]));

  // Sync isBookmarked with user profile when opening directly (or after refresh)
  useEffect(() => {
    if (!isAuthenticated || !topicId) return;
    const loadFollowState = async () => {
      try {
        const profile = await userApi.getProfile();
        const list = profile?.followedTopics || [];
        const idStr = String(topicId);
        const followed = list.some((t) => String(t._id ?? t.id) === idStr);
        setIsBookmarked(followed);
      } catch {
        // Fail silently; star will stay at last known state
      }
    };
    loadFollowState();
  }, [isAuthenticated, topicId]);

  // ─── Derived values ────────────────────────────────────────────────────────
  // Timeline is injected from GET /api/issue-portal/issue/:issueId (precomputed in issuePortalService).
  const timeline = issue?.timeline || [];

  const topicTitle = issue
    ? (language === 'en' ? issue.title : issue.title_ms || issue.title)
    : '';

  const latestUpdateDate = issue?.latest_date
    ? new Date(issue.latest_date).toLocaleDateString('en-MY', {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    : null;

  // Most recent statement excerpt for the header summary card
  const mostRecentTurn = timeline.length > 0 ? timeline[timeline.length - 1] : null;

  // Localized topic description (backend stores English only; we rebuild with t() for BM)
  const displayDescription = (() => {
    if (!issue) return '';
    const theme = (language === 'bm' ? (issue.title_ms || issue.title) : issue.title) || '';
    const cat = (issue.category || '').trim();
    const st = Math.max(0, Number(issue.statement_count) || 0);
    const mp = Math.max(0, Number(issue.mp_count) || 0);
    const doc = Math.max(0, Number(issue.doc_count) || 0);
    const parts = [];
    if (theme && cat) {
      parts.push(`${t('topicDescDiscussionsOn')} "${theme}" ${t('topicDescUnder')} ${cat}.`);
    } else if (theme) {
      parts.push(`${t('topicDescDiscussionsOn')} "${theme}".`);
    } else if (cat) {
      parts.push(`${t('topicDescUnderTheme')} ${cat}.`);
    } else {
      parts.push(t('topicDescRecorded'));
    }
    if (st > 0 || mp > 0 || doc > 0) {
      const scaleParts = [];
      if (st > 0) scaleParts.push(`${st} ${st !== 1 ? t('topicDescStatements') : t('topicDescStatement')}`);
      if (mp > 0) scaleParts.push(`${mp} ${mp !== 1 ? t('topicDescMPs') : t('topicDescMP')}`);
      if (doc > 0) scaleParts.push(`${doc} ${doc !== 1 ? t('topicDescSourceDocs') : t('topicDescSourceDoc')}`);
      if (scaleParts.length) parts.push(`${t('topicDescThisTopicSpans')} ${scaleParts.join(', ')}.`);
    }
    const rawDesc = issue.description || '';
    const excerptMatch = rawDesc.match(/Recent debate content:\s*(.+)/s);
    const excerpt = excerptMatch ? excerptMatch[1].trim() : '';
    if (excerpt) parts.push(`${t('topicDescRecentDebate')} ${excerpt}`);
    return parts.join(' ');
  })();

  // Group timeline turns by date (newest-first for display)
  const turnsByDate = timeline.reduce((acc, turn) => {
    const key = turn.date
      ? new Date(turn.date).toLocaleDateString('en-MY', {
          year: 'numeric', month: 'numeric', day: 'numeric',
        })
      : 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(turn);
    return acc;
  }, {});

  // Normalize timeline dateKey to YYYY-MM-DD for comparison and sorting
  const dateKeyToYMD = (key) => {
    if (!key || key === 'Unknown') return '';
    const parts = String(key).split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    const d = new Date(key);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  };

  // 1. Latest date above: sort dates descending (newest first)
  const sortedDateKeys = Object.keys(turnsByDate).sort((a, b) => {
    if (a === 'Unknown') return 1;
    if (b === 'Unknown') return -1;
    const ymdA = dateKeyToYMD(a);
    const ymdB = dateKeyToYMD(b);
    return ymdB.localeCompare(ymdA);
  });

  // When opened from session link with scrollToDate: scroll to that date block and blink first conversation
  useEffect(() => {
    if (!issue || !scrollToDateYMD || !scrollToDateBlockRef.current) return;
    scrollToDateBlockRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setDateBlockBlink(true);
    const t = setTimeout(() => setDateBlockBlink(false), 2600);
    return () => clearTimeout(t);
  }, [issue, scrollToDateYMD]);

  // Within each date: 2. Latest conversation above (higher group = later in doc); 3. Latest reply above
  const groupTurnsByConversation = (turns) => {
    const byGroup = {};
    for (const turn of turns) {
      const g = turn.conversation_group ?? 0;
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push(turn);
    }
    const ids = Object.keys(byGroup).map(Number).sort((a, b) => a - b);
    // 2. Newest conversation first (reverse so higher group id = later in document is above)
    return [...ids].reverse().map((groupId) => ({
      groupId,
      // 3. Newest reply first within each conversation
      turns: [...(byGroup[groupId] || [])].reverse(),
    }));
  };

  // Lock body scroll when login modal is open
  const prevOverflow = useRef(null);
  useEffect(() => {
    if (showLoginModal) {
      prevOverflow.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = prevOverflow.current ?? '';
      prevOverflow.current = null;
    }
    return () => {
      document.body.style.overflow = prevOverflow.current ?? '';
    };
  }, [showLoginModal]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleBookmark = async () => {
    if (!isAuthenticated) { setShowLoginModal(true); return; }
    const idStr = String(issue?._id || topicId);
    if (!idStr) return;

    const wasFollowed = isBookmarked;
    // Optimistic toggle
    setIsBookmarked(!wasFollowed);
    try {
      if (wasFollowed) {
        await userApi.unfollowTopic(idStr);
      } else {
        await userApi.followTopic(idStr);
      }
    } catch (err) {
      console.error('Failed to toggle topic follow:', err);
      // Revert on error
      setIsBookmarked(prev => !prev);
    }
  };

  const handleViewDiscussion = () => {
    const params = new URLSearchParams({ topic: topicTitle });
    if (issue?.category) params.set('category', issue.category);
    navigate(`/forum?${params.toString()}`);
  };

  const handleFeedback = () => {
    if (isAuthenticated) {
      const params = new URLSearchParams({ topic: topicTitle });
      if (issue?.category) params.set('category', issue.category);
      params.set('returnTo', `${location.pathname}${location.search}`);
      navigate(`/feedback?${params.toString()}`);
    } else {
      setShowLoginModal(true);
    }
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const getPartyColor = (party) => {
    if (!party) return 'bg-gray-500';
    const p = party.toLowerCase();
    if (p.includes('ph') || p.includes('pakatan'))   return 'bg-blue-500';
    if (p.includes('bn') || p.includes('barisan'))   return 'bg-red-500';
    if (p.includes('pn') || p.includes('perikatan')) return 'bg-green-500';
    if (p.includes('pas'))                           return 'bg-purple-500';
    if (p.includes('dap'))                           return 'bg-orange-500';
    return 'bg-gray-500';
  };

  /**
   * Sentiment thresholds (0–100 scale, 2 decimal places):
   * - ≥ 70.00: Positive (good) → green badge
   * - 45.00–69.99: Neutral → amber badge
   * - < 45.00: Negative (bad) → red badge
   * 
   * These thresholds are applied to both:
   * 1. XLM-RoBERTa zero-shot scores (when Python service is available)
   * 2. Keyword-based fallback scores (when service unavailable)
   */
  const SENTIMENT_THRESHOLD_POSITIVE = 70.0;
  const SENTIMENT_THRESHOLD_NEGATIVE = 45.0;

  const getSentimentColor = (s) => {
    if (s >= SENTIMENT_THRESHOLD_POSITIVE) return 'bg-emerald-500';
    if (s >= SENTIMENT_THRESHOLD_NEGATIVE) return 'bg-amber-400';
    return 'bg-rose-500';
  };
  const getSentimentLabel = (s) => {
    if (s >= SENTIMENT_THRESHOLD_POSITIVE) {
      return { text: 'Positive', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' };
    }
    if (s >= SENTIMENT_THRESHOLD_NEGATIVE) {
      return { text: 'Neutral',  cls: 'bg-amber-50  text-amber-700  ring-1 ring-amber-200' };
    }
    return { text: 'Negative', cls: 'bg-rose-50   text-rose-700   ring-1 ring-rose-200' };
  };
  const getActionStyle = (type) => {
    switch (type) {
      case 'escalate':    return { label: t('turnTypeEscalate'),     cls: 'bg-rose-100   text-rose-700'   };
      case 'ask':         return { label: t('turnTypeAsk'),          cls: 'bg-blue-100   text-blue-700'   };
      case 'interjection':return { label: t('turnTypeInterjection'), cls: 'bg-violet-100 text-violet-700' };
      default:            return { label: t('turnTypeReply'),        cls: 'bg-slate-100  text-slate-600'  };
    }
  };
  // Tooltip: how we determine each type (rule-based, for transparency / reporting)
  const getActionTooltip = (type) => {
    switch (type) {
      case 'escalate':    return 'Rule: text contains complaint/demand words (escalat, aduan, protes, bantah, minta penjelasan segera).';
      case 'ask':         return 'Rule: text has "?" or question words (adakah, apakah, …) or request phrases (saya ingin bertanya, mohon penjelasan, please explain).';
      case 'interjection':return 'Rule: procedural only (terima kasih, sokong, setuju, yang berhormat, ya tuan, etc.). Not based on length.';
      default:            return 'Rule: default for substantive statement/answer that did not match Ask, Interjection or Escalate.';
    }
  };

  const formatDateKey = (key) => {
    if (key === 'Unknown') return 'Unknown date';
    const d = new Date(key);
    if (isNaN(d.getTime())) return key;
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  };

  // ─── Loading / error states ────────────────────────────────────────────────
  if (loading && !issue) {
    return (
      <div className="w-full bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text={t('loadingTopicDetails')} />
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="w-full bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('topicNotFoundTitle')}</h2>
          <p className="text-gray-600 mb-4">
            {error || t('topicNotFoundMessage')}
          </p>
          <button
            onClick={() => navigate('/issues')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            {t('backToIssuePortal')}
          </button>
        </div>
      </div>
    );
  }

  // ─── Main render ───────────────────────────────────────────────────────────
  return (
    <>
    <div className="w-full max-w-full min-w-0 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full max-w-6xl mx-auto min-w-0">

        {/* Back */}
        <button
          onClick={() => {
            if (returnTo) navigate(returnTo);
            else navigate(-1);
          }}
          className="flex items-center text-indigo-600 hover:text-indigo-700 mb-6 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('backToPreviousPage')}
        </button>

        {/* ── Header card ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 mb-6">
          {/* Title row */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex-1">
              {/* Category + quality */}
              <div className="flex flex-wrap items-start gap-2.5 mb-2">
                {issue.category && (
                  <span className="inline-flex max-w-full items-center px-3 py-1.5 rounded-full text-xs font-semibold leading-snug bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-normal break-words">
                    {issue.category}
                  </span>
                )}
                {issue.label_quality && issue.label_quality !== 'unknown' && (
                  <span className={`inline-flex max-w-full items-center px-3 py-1.5 rounded-full text-xs font-semibold leading-snug whitespace-normal break-words ${
                    issue.label_quality === 'high'   ? 'bg-green-50 text-green-700 border border-green-200'  :
                    issue.label_quality === 'medium' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                       'bg-gray-50 text-gray-600 border border-gray-200'
                  }`}>
                    {issue.label_quality} {t('qualityLabel')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{topicTitle}</h1>
                <button
                  onClick={handleBookmark}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
                  aria-label="Bookmark"
                >
                  <svg
                    className={`w-6 h-6 transition-colors ${isBookmarked ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}`}
                    fill={isBookmarked ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </button>
              </div>

              {latestUpdateDate && (
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {t('latestUpdateLabel')} {latestUpdateDate}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <button
                onClick={handleViewDiscussion}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {t('viewTopicDiscussion')}
              </button>
              <button
                onClick={handleFeedback}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                {t('feedbackOnTopic')}
              </button>
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-indigo-700">{issue.statement_count || 0}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('statementsLabel')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-indigo-700">{issue.mp_count || 0}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('mpsInvolved')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-indigo-700">{issue.doc_count || 0}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('sourceDocuments')}</p>
            </div>
          </div>

          {/* Topic description (localized so "Parliamentary discussions on...", "This topic spans...", "Recent debate content:" follow UI language) */}
          {displayDescription && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('topicDescription')}</h3>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-gray-700 leading-relaxed text-sm">{displayDescription}</p>
              </div>
            </div>
          )}

          {/* Most recent update — summary of latest development (proposal: "most recent facts, summaries, and content displayed prominently") */}
          {mostRecentTurn && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('mostRecentUpdate')}</h3>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm font-medium text-gray-900 mb-1">
                  {mostRecentTurn.mp_name}
                  <span className="font-normal text-gray-500 ml-2">
                    {mostRecentTurn.session_label}
                    {mostRecentTurn.date && (
                      <span className="ml-1">
                        · {new Date(mostRecentTurn.date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </span>
                </p>
                <p className="text-gray-700 leading-relaxed text-sm">
                  {getExcerptPreview(mostRecentTurn.text_excerpt || '', 220) || '—'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    mostRecentTurnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimelineBlink(true);
                    window.setTimeout(() => setTimelineBlink(false), 2600);
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline mt-2 text-left"
                >
                  {t('clickHereToViewTimeline')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Timeline ─────────────────────────────────────────────────────── */}
        <div ref={timelineRef} id="parliamentary-timeline" className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {t('parliamentaryTimeline')}
                <span className="ml-2 text-base font-normal text-gray-500">
                  ({timeline.length} {t('turnsLabel')}, {sortedDateKeys.length} {t('sessionDatesLabel')})
                </span>
              </h2>
            </div>
          </div>
          {timeline.length > 0 && sortedDateKeys.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="text-sm text-gray-500">{t('jumpToDate')}</span>
              {sortedDateKeys.map((dateKey) => {
                const ymd = dateKeyToYMD(dateKey);
                const isActive = scrollToDateYMD === ymd;
                const turns = turnsByDate[dateKey] || [];
                const sessionLabels = [...new Set(turns.map((t) => t.session_label).filter(Boolean))];
                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => {
                      setSearchParams((prev) => {
                        const p = new URLSearchParams(prev);
                        p.set('scrollToDate', ymd);
                        return p;
                      });
                    }}
                    className={`text-sm font-medium rounded-lg px-3 py-1.5 transition-colors text-left ${isActive ? 'bg-indigo-100 text-indigo-800' : 'text-indigo-600 hover:bg-indigo-50'}`}
                  >
                    <span>{formatDateKey(dateKey)}</span>
                    {sessionLabels.length > 0 && (
                      <span className="text-gray-500 font-normal ml-1.5">· {sessionLabels.join(', ')}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {timeline.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {t('noParliamentaryRecords')}
                {' '}{t('runPrecomputeHint')}
              </p>
            </div>
          ) : (
            <div className="relative">
              {sortedDateKeys.map((dateKey) => {
                const isScrollTargetDate = dateKeyToYMD(dateKey) === scrollToDateYMD;
                const groups = groupTurnsByConversation(turnsByDate[dateKey]);
                return (
                <details
                  key={dateKey}
                  ref={isScrollTargetDate ? scrollToDateBlockRef : null}
                  open
                  className={`group/date relative mb-6 rounded-xl border border-gray-200 bg-white/50 overflow-visible ${isScrollTargetDate && dateBlockBlink ? 'timeline-segment-blink' : ''}`}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-left font-medium text-gray-700 hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
                    <svg className="w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 group-open/date:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm font-semibold text-gray-700">
                      {formatDateKey(dateKey)}
                    </span>
                    <span className="text-xs text-gray-400 font-normal ml-1">
                      ({groups.length} {groups.length !== 1 ? t('conversationsLabel') : t('conversationLabel')})
                    </span>
                  </summary>

                  <div className="px-4 pb-4 space-y-4">
                    {groups.map(({ groupId, turns: groupTurns }, groupIndex) => (
                      <details
                        key={`${dateKey}-g${groupId}`}
                        ref={isScrollTargetDate && groupIndex === 0 ? scrollToFirstConversationRef : null}
                        className={`group rounded-xl border border-gray-200 bg-gray-50/60 overflow-hidden ${isScrollTargetDate && groupIndex === 0 && dateBlockBlink ? 'timeline-segment-blink' : ''}`}
                        open
                      >
                        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-left font-medium text-gray-700 hover:bg-gray-100/80 [&::-webkit-details-marker]:hidden">
                          <svg className="w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-sm font-semibold uppercase tracking-wide text-gray-600">
                            {t('conversationN')} {groupId + 1}
                          </span>
                          <span className="text-xs text-gray-400 font-normal">
                            ({groupTurns.length} {groupTurns.length !== 1 ? t('turnsLabel') : t('turnLabel')})
                          </span>
                          {groupTurns[0]?.session_label && (
                            <span className="text-xs text-gray-400 font-normal ml-1">
                              · {groupTurns[0].session_label}
                            </span>
                          )}
                        </summary>
                        <div className="border-t border-gray-200 bg-white/50 px-4 pb-4 pt-2">
                          {/* Purple line: inside turns container so height = turns only; ends at last turn (bottom-2), behind labels; black dot at line end */}
                          <div className="relative pl-2 space-y-4">
                            <div className="absolute left-[4rem] top-0 bottom-1 w-0.5 -translate-x-1/2 bg-indigo-300 pointer-events-none z-0" aria-hidden />
                            <div className="absolute left-[4rem] bottom-1 -translate-x-1/2 w-4 h-4 rounded-full bg-black pointer-events-none z-0" aria-hidden />
                            {groupTurns.map((turn, idx) => (
                              <div
                                key={`${turn.doc_id}-${idx}`}
                                ref={turn === mostRecentTurn ? mostRecentTurnRef : null}
                                className={`flex gap-3 rounded-lg relative z-10 ${turn === mostRecentTurn && timelineBlink ? 'timeline-segment-blink' : ''}`}
                              >
                                {(() => { const a = getActionStyle(turn.action_type); return (
                                  <span
                                    className={`flex-shrink-0 w-28 px-2 py-0.5 rounded-md text-xs font-medium self-start text-center ${a.cls}`}
                                    title={getActionTooltip(turn.action_type)}
                                  >
                                    {a.label}
                                  </span>
                                ); })()}

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getPartyColor(turn.party)}`}>
                                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                      </svg>
                                    </div>

                                    <div className="flex-1 min-w-0 ml-3">
                                      <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <p className="font-semibold text-gray-900 text-sm">{turn.mp_name}</p>
                                        {turn.party && (
                                          <span className={`px-2 py-0.5 rounded-full text-white text-xs font-medium ${getPartyColor(turn.party)}`}>
                                            {turn.party}
                                          </span>
                                        )}
                                      </div>

                                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 shadow-sm mb-2">
                                        <p className="text-gray-700 text-sm leading-relaxed">
                                          {cleanDisplayExcerpt(turn.text_excerpt || '') || '—'}
                                        </p>
                                      </div>

                                      <div className="flex items-center gap-4 flex-wrap mb-2">
                                        {turn.sentiment !== undefined && turn.sentiment !== null && (
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-gray-500 text-xs font-medium">{t('sentimentLabel')}</span>
                                            <span className="text-xs font-mono font-semibold text-gray-700">
                                              {typeof turn.sentiment === 'number' ? turn.sentiment.toFixed(2) + '%' : '—'}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>

    {/* Login required modal — sibling of main content, high z-index */}
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

export default TopicDetailPage;
