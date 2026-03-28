/**
 * SSEContext – real-time Server-Sent Events for the whole app.
 *
 * • Connects to GET /api/sse/events (with the user's Bearer token if logged in).
 * • Reconnects automatically with exponential back-off after any disconnection.
 * • Exposes `useSSEEvent(eventName, callback)` – a hook that subscribes a
 *   component to a named SSE event; the callback is called whenever the event
 *   fires and receives the parsed JSON payload.
 *
 * Example:
 *   useSSEEvent('edu_updated', () => refetchEduList());
 *   useSSEEvent('notification',  (data) => refreshNotificationBell());
 */

import { createContext, useContext, useEffect, useRef, useCallback } from 'react';

const SSEContext = createContext(null);

const SSE_URL = 'http://localhost:5000/api/sse/events';
const MIN_RETRY_MS  = 1_000;
const MAX_RETRY_MS  = 30_000;

function getToken() {
  return (
    localStorage.getItem('token') ||
    sessionStorage.getItem('token') ||
    localStorage.getItem('tempToken') ||
    null
  );
}

export function SSEProvider({ children }) {
  // Map<eventName, Set<callback>>
  const listenersRef = useRef(new Map());
  const esRef        = useRef(null);
  const retryMsRef   = useRef(MIN_RETRY_MS);
  const retryTimer   = useRef(null);
  const unmounted    = useRef(false);

  const dispatch = useCallback((eventName, data) => {
    const cbs = listenersRef.current.get(eventName);
    if (!cbs) return;
    for (const cb of cbs) {
      try { cb(data); } catch (e) { console.error('[SSE] handler error:', e); }
    }
  }, []);

  const connect = useCallback(() => {
    if (unmounted.current) return;
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const token = getToken();
    const url   = token ? `${SSE_URL}?token=${encodeURIComponent(token)}` : SSE_URL;
    const es    = new EventSource(url);
    esRef.current = es;

    es.addEventListener('connected', () => {
      retryMsRef.current = MIN_RETRY_MS; // reset back-off on success
    });

    // Public broadcasts (user + admin)
    const publicEvents = [
      'edu_updated',
      'mp_updated',
      'forum_updated',
      'topic_updated',
      'forum_activity',
      'feedback_received',
      'user_registered',
      'announcement',
      'maintenance_notice',
    ];
    publicEvents.forEach((name) => {
      es.addEventListener(name, (e) => {
        try { dispatch(name, JSON.parse(e.data)); } catch {}
      });
    });

    // User-specific events
    const privateEvents = ['notification', 'feedback_reply'];
    privateEvents.forEach((name) => {
      es.addEventListener(name, (e) => {
        try { dispatch(name, JSON.parse(e.data)); } catch {}
      });
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      if (unmounted.current) return;
      // Exponential back-off
      retryTimer.current = setTimeout(() => {
        retryMsRef.current = Math.min(retryMsRef.current * 2, MAX_RETRY_MS);
        connect();
      }, retryMsRef.current);
    };
  }, [dispatch]);

  useEffect(() => {
    unmounted.current = false;
    connect();

    // Re-connect when user logs in or out (token changes)
    const onAuthChange = () => {
      retryMsRef.current = MIN_RETRY_MS;
      connect();
    };
    window.addEventListener('user:login',  onAuthChange);
    window.addEventListener('user:logout', onAuthChange);

    return () => {
      unmounted.current = true;
      clearTimeout(retryTimer.current);
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      window.removeEventListener('user:login',  onAuthChange);
      window.removeEventListener('user:logout', onAuthChange);
    };
  }, [connect]);

  const subscribe = useCallback((eventName, cb) => {
    if (!listenersRef.current.has(eventName)) {
      listenersRef.current.set(eventName, new Set());
    }
    listenersRef.current.get(eventName).add(cb);
    return () => listenersRef.current.get(eventName)?.delete(cb);
  }, []);

  return (
    <SSEContext.Provider value={{ subscribe }}>
      {children}
    </SSEContext.Provider>
  );
}

/**
 * Subscribe a component to a named SSE event.
 * @param {string} eventName  - e.g. 'edu_updated', 'notification'
 * @param {function} callback - called with the parsed event payload
 */
export function useSSEEvent(eventName, callback) {
  const ctx = useContext(SSEContext);
  // Keep a stable ref to the latest callback so the subscription itself
  // never needs to be torn down just because the callback reference changes.
  const cbRef = useRef(callback);
  useEffect(() => { cbRef.current = callback; });

  useEffect(() => {
    if (!ctx) return;
    const stable = (...args) => cbRef.current(...args);
    const unsub  = ctx.subscribe(eventName, stable);
    return unsub;
  }, [ctx, eventName]);
}

export default SSEContext;
