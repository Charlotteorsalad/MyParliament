import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchActiveNotice } from '../api/config';
import { useLanguage } from '../contexts/LanguageContext';
import { useSSEEvent } from '../contexts/SSEContext';

/**
 * MaintenanceBanner
 *
 * - Polls the server every 60 s for maintenance status.
 * - Once a pre-notice is received, sets an EXACT setTimeout to fire right at
 *   the maintenance start time → instantly switches to full-screen block and
 *   logs the user out without waiting for the next poll.
 * - Countdown ticks every minute (> 1 h left), every 10 s (≤ 60 min left),
 *   and every 1 s during the final minute.
 */
export default function MaintenanceBanner() {
  const [notice, setNotice] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const { language } = useLanguage();

  const hasForcedLogoutRef = useRef(false);
  const startTimerRef = useRef(null);
  const tickIntervalRef = useRef(null);
  const tickModeRef = useRef(null);

  /* ── logout helper ── */
  const forceUserLogout = useCallback(() => {
    if (hasForcedLogoutRef.current) return;
    hasForcedLogoutRef.current = true;
    localStorage.removeItem('token');
    localStorage.removeItem('tempToken');
    sessionStorage.removeItem('token');
    window.dispatchEvent(new CustomEvent('user:logout'));
  }, []);

  /* ── load notice from server ── */
  const load = useCallback(async () => {
    try {
      const n = await fetchActiveNotice();
      setNotice(n);
      if (n) setDismissed(false);
    } catch {
      // silently ignore
    }
  }, []);

  /* ── live updates via SSE (maintenance_notice) ── */
  useSSEEvent('maintenance_notice', (payload) => {
    if (!payload) return;
    // Normalise shape to match fetchActiveNotice() result
    const next = {
      type: payload.type,
      title: payload.title,
      message: payload.message,
      startTime: payload.startTime,
      endTime: payload.endTime,
    };
    setNotice(next);
    setDismissed(false);
  });

  /* ── 60-second server poll ── */
  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  /* ── adaptive countdown ticker ── */
  const resetTicker = useCallback((startMs) => {
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    const msLeft = startMs ? startMs - Date.now() : Infinity;
    let interval = 60_000;
    let mode = 'minutes';
    if (msLeft <= 60_000) {
      interval = 1_000;
      mode = 'seconds';
    } else if (msLeft <= 60 * 60 * 1000) {
      interval = 10_000;
      mode = 'ten-seconds';
    }
    tickModeRef.current = mode;
    tickIntervalRef.current = setInterval(() => setNow(Date.now()), interval);
  }, []);

  useEffect(() => {
    resetTicker(null);
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    };
  }, [resetTicker]);

  /* ── Exact-time setTimeout when we know startMs ── */
  useEffect(() => {
    if (startTimerRef.current) clearTimeout(startTimerRef.current);

    const startMs = notice?.startTime ? new Date(notice.startTime).getTime() : null;
    if (!startMs) return;

    resetTicker(startMs);

    const delay = startMs - Date.now();
    if (delay <= 0) {
      // Already past start – handle immediately
      forceUserLogout();
      setNow(Date.now());
      return;
    }

    startTimerRef.current = setTimeout(() => {
      // Fires exactly at maintenance start
      setNow(Date.now());   // triggers isMaintenanceActive
      forceUserLogout();
      load();               // re-fetch so notice.type becomes 'maintenance'
    }, delay);

    return () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
    };
  }, [notice?.startTime, forceUserLogout, load, resetTicker]);

  /* ── derived values ── */
  const message = notice
    ? (language === 'bm' && notice.messageBM ? notice.messageBM : notice.message)
    : '';
  const startMs = notice?.startTime ? new Date(notice.startTime).getTime() : null;
  const endMs   = notice?.endTime   ? new Date(notice.endTime).getTime()   : null;

  const isMaintenanceActive = !!notice && (
    notice.type === 'maintenance' ||
    (startMs !== null && endMs !== null && now >= startMs && now <= endMs)
  );

  const endLabel = notice?.endTime
    ? new Date(notice.endTime).toLocaleString(language === 'bm' ? 'ms-MY' : 'en-MY', {
        dateStyle: 'medium', timeStyle: 'short',
      })
    : '';

  useEffect(() => {
    if (!startMs || now >= startMs) return;

    const msLeft = startMs - now;
    const nextMode = msLeft <= 60_000 ? 'seconds' : msLeft <= 60 * 60 * 1000 ? 'ten-seconds' : 'minutes';
    const currentMode = tickModeRef.current;

    if (currentMode !== nextMode) {
      resetTicker(startMs);
    }
  }, [startMs, now, resetTicker]);

  /* ── force logout side-effect when isMaintenanceActive flips ── */
  useEffect(() => {
    if (isMaintenanceActive) forceUserLogout();
  }, [isMaintenanceActive, forceUserLogout]);

  /* ── countdown label ── */
  const countdownLabel = (() => {
    if (!notice || startMs === null || now >= startMs) return '';
    const diffMs = startMs - now;
    const totalSec = Math.ceil(diffMs / 1000);
    const totalMin = Math.ceil(diffMs / 60_000);

    if (totalMin > 60) {
      const h = Math.floor(diffMs / 3_600_000);
      const safe = Math.max(h, 1);
      return language === 'bm'
        ? `Bermula dalam ${safe} jam`
        : `Starts in ${safe} hour${safe === 1 ? '' : 's'}`;
    }
    if (totalSec <= 60) {
      return language === 'bm'
        ? `Bermula dalam ${totalSec} saat`
        : `Starts in ${totalSec} second${totalSec === 1 ? '' : 's'}`;
    }
    return language === 'bm'
      ? `Bermula dalam ${totalMin} minit`
      : `Starts in ${totalMin} minute${totalMin === 1 ? '' : 's'}`;
  })();

  if (!notice) return null;

  const displayTitle = (isMaintenanceActive && notice.type !== 'maintenance')
    ? notice.title.replace(/^Upcoming Maintenance/i, 'System Maintenance')
    : notice.title;

  /* ── Full-screen maintenance page ── */
  if (isMaintenanceActive) {
    return (
      <div className="fixed inset-0 z-[10001] flex flex-col items-center justify-center bg-gray-900 text-white px-6 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-violet-500/20">
          <svg className="h-10 w-10 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.7}
              d="M14.7 6.3a3.5 3.5 0 0 0-4.95 4.95L4 17v3h3l5.75-5.75a3.5 3.5 0 0 0 4.95-4.95l-2.1 2.1-3-3 2.1-2.1Z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.7}
              d="M13 14l-1.5 1.5M6.5 17.5l1-1"
            />
          </svg>
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-violet-300">
          MY Parliament
        </p>

        <h1 className="mb-4 text-2xl sm:text-3xl font-bold">{displayTitle}</h1>

        <p className="mb-6 max-w-lg text-base sm:text-lg text-gray-300 leading-relaxed">
          {message}
        </p>

        {endLabel && (
          <div className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-5 py-3 text-sm text-violet-100">
            {language === 'bm'
              ? <><span>Dijangka selesai: </span><strong>{endLabel}</strong></>
              : <><span>Expected to resume: </span><strong>{endLabel}</strong></>}
          </div>
        )}

        <p className="mt-8 text-xs text-gray-500">
          {language === 'bm'
            ? 'Kami memohon maaf atas kesulitan ini.'
            : 'We apologise for the inconvenience.'}
        </p>
        <p className="mt-2 text-xs text-gray-500">
          You may refresh the browser upon that time.
        </p>
      </div>
    );
  }

  /* ── Pre-maintenance warning banner ── */
  if (dismissed) return null;

  return (
    <div
      role="alert"
      className="relative z-[200] w-full bg-amber-500 text-white text-sm print:hidden"
    >
      <div className="mx-auto max-w-7xl px-4 py-2.5 flex items-start sm:items-center gap-3">
        <svg className="h-5 w-5 shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>

        <div className="flex-1 min-w-0">
          <span className="font-semibold mr-1">{displayTitle}:</span>
          <span>{message}</span>
          {countdownLabel && (
            <span className="ml-2 inline-flex rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
              {countdownLabel}
            </span>
          )}
          {endLabel && (
            <span className="ml-1 opacity-90">
              {language === 'bm' ? `(sehingga ${endLabel})` : `(until ${endLabel})`}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded p-1 hover:bg-amber-600 transition-colors"
          aria-label="Dismiss notice"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
