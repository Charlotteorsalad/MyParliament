/**
 * Calls Python XLM-RoBERTa zero-shot sentiment service (EN + Malay).
 * Used by issue portal precompute to get 0–100 sentiment per turn.
 * On failure or if service not configured, caller keeps keyword-based sentiment.
 *
 * NOTE: Sentiment is written to MongoDB during precompute, NOT at API request time.
 *       Re-run precompute after this service is up to see XLM-RoBERTa scores.
 */
const SENTIMENT_BASE_URL = process.env.SENTIMENT_SERVICE_URL || 'http://127.0.0.1:5002';
const SENTIMENT_TIMEOUT_MS = parseInt(process.env.SENTIMENT_TIMEOUT_MS, 10) || 60000;

let _serviceAvailable = null; // null = unknown, true/false after first check

/** Ping /health once on startup to confirm the service is up. */
async function checkHealth() {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${SENTIMENT_BASE_URL}/health`, { signal: controller.signal });
    clearTimeout(id);
    _serviceAvailable = res.ok;
    if (res.ok) {
      console.log(`[sentimentService] XLM-RoBERTa service ready at ${SENTIMENT_BASE_URL}`);
    } else {
      console.warn(`[sentimentService] Service responded with status ${res.status} – using keyword fallback`);
    }
  } catch {
    _serviceAvailable = false;
    console.warn(`[sentimentService] Service not reachable at ${SENTIMENT_BASE_URL} – using keyword fallback`);
  }
}

/**
 * Batch sentiment for many texts.
 * @param {string[]} texts - segment texts (same order as turns)
 * @returns {Promise<number[]|null>} scores 0–100 per text, or null (caller keeps keyword-based score)
 */
async function getBatchSentiment(texts) {
  if (!texts || texts.length === 0) return [];
  if (!SENTIMENT_BASE_URL) return null;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), SENTIMENT_TIMEOUT_MS);
    const res = await fetch(`${SENTIMENT_BASE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts }),
      signal: controller.signal,
    });
    clearTimeout(id);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(data.scores)) return null;
    _serviceAvailable = true;
    return data.scores;
  } catch (err) {
    if (_serviceAvailable !== false) {
      console.warn('[sentimentService] getBatchSentiment failed:', err.message);
    }
    _serviceAvailable = false;
    return null;
  }
}

module.exports = { getBatchSentiment, checkHealth };
