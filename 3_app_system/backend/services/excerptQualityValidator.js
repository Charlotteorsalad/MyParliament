/**
 * Excerpt Quality Validator & Fixer for Issue Portal statements.
 *
 * THREE-LAYER PIPELINE:
 *
 *   Layer 1 – Local heuristics  (always runs, zero cost, < 1 ms)
 *     Hard-rejects unrecoverable text: OCR garbage (score < 35), adjournment
 *     announcements, bill-reading procedures, festive greetings, page numbers.
 *
 *   Layer 2 – LanguageTool spelling  (EXCERPT_VALIDATOR_MODE=lt)
 *     Free anonymous REST API. No key. Rate-limited 1 req / 2.1 s.
 *     Only called for borderline texts (local score 35–79).
 *
 *   Layer 3 – GPT-4o-mini FIX+FILTER  (EXCERPT_VALIDATOR_MODE=llm)  ← RECOMMENDED
 *     Single batched call does TWO things at once:
 *       a) FIXES  – corrects OCR spelling errors, removes stray symbols,
 *                   trims cut-off sentences to the last complete thought.
 *       b) FILTERS – if the whole text is garbage / off-topic / boilerplate,
 *                    returns "" so the turn is dropped.
 *     Result: precomputed excerpts are CLEAN and READABLE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONFIGURATION  (backend/.env)
 * ─────────────────────────────────────────────────────────────────────────────
 *   EXCERPT_VALIDATOR_MODE=off    local heuristics only (default, no cost)
 *   EXCERPT_VALIDATOR_MODE=lt     local + LanguageTool spelling (free, slow)
 *   EXCERPT_VALIDATOR_MODE=llm    local + GPT-4o-mini fix+filter (paid, recommended)
 *
 *   OPENAI_API_KEY=sk-...         required when MODE=llm
 *   EXCERPT_LLM_BATCH=20          excerpts per GPT call (default 20, max 30)
 *   EXCERPT_LLM_MODEL=gpt-4o-mini override model
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PUBLIC API
 * ─────────────────────────────────────────────────────────────────────────────
 *   fixAndFilterTurns(turns, topicKeywords?, opts?)
 *       → Promise<turn[]>
 *         Each returned turn has .text_excerpt REPLACED with the GPT-fixed version.
 *         Turns whose excerpt GPT returned as "" are dropped entirely.
 *
 *   validateAndFilterTurns(turns, topicKeywords?, opts?)
 *       → Promise<turn[]>   (legacy: only filters, does not fix text)
 *
 *   localCheck(text)          → { pass, score, reason }   (sync, no I/O)
 *   localQualityScore(text)   → number 0-100              (sync, no I/O)
 */

'use strict';

const https       = require('https');
const querystring = require('querystring');

// ─── Configuration ─────────────────────────────────────────────────────────
const MODE       = (process.env.EXCERPT_VALIDATOR_MODE || 'off').toLowerCase().trim();
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const LLM_MODEL  = process.env.EXCERPT_LLM_MODEL || 'gpt-4o-mini';
const LLM_BATCH  = Math.min(30, Math.max(5, parseInt(process.env.EXCERPT_LLM_BATCH || '20', 10)));

const LT_HOST          = 'api.languagetool.org';
const LT_PATH          = '/v2/check';
const LT_TIMEOUT_MS    = 7000;
const LT_INTERVAL_MS   = 2100;
const MIN_WORDS_FOR_LT = 15;
const MAX_TYPO_RATE    = 0.15;
const LLM_TIMEOUT_MS   = 30000;
const MAX_CACHE        = 15000;

let _ltLastTs = 0;
const _cache  = new Map();

// ─── OCR bad-fragment token list ────────────────────────────────────────────
const OCR_FRAGMENTS = new Set([
  'deng','sebaga','dala','untu','kepad','daripad','bahaw','adal','adak',
  'tida','bole','perl','haru','sert','sela','sebe','anta','iait','ialay',
  'masy','terlt','terl','keml','keper','pengu','keraj','pemer','menca',
  'kemllit','tfutas','jiead','ijead','ljead','iead','tlah',
  'bersidangundangundang','undangundang','ahliahli',
  'polic','impl','govn',
]);

// ─── Corruption patterns ────────────────────────────────────────────────────
const SYMBOL_CORRUPT_RE  = /[{}@$#^*_=|~`\\]|\uFFFD|&amp;|&lt;|&gt;/;
const ALPHA_DIGIT_MIX_RE = /[A-Za-z]{3,}\d{2,}[A-Za-z\d]*|[A-Za-z]\d{3,}[A-Za-z]/;
const SLASH_LETTERS_RE   = /[A-Za-z][/\\][A-Za-z]/;
const AMP_LETTERS_RE     = /[A-Za-z]&[A-Za-z]/;
const BULLET_OCR_RE      = /[•·‣▪▸◦‧]/;

// ─── Procedural patterns ────────────────────────────────────────────────────
const PROCEDURAL = [
  /\b(mesyuarat|persidangan|dewan(?:\s+ini)?)\b.{0,120}\bditangguh(?:kan)?\b/i,
  /\bditangguh(?:kan)?\s+(sehingga|pada|hingga)\s+\d/i,
  /\bdibacakan\s+(?:yang\s+|kali\s+)(?:kedua|ketiga|pertama)\b/i,
  /\bdikemukakan\s+bagi\s+diputuskan\b/i,
  /\bdiputuskan[,\s]+dan\s+disetujui(?:kan)?\b/i,
  /\bdisera(?:h|hkan)\s+kepada\s+dewan\s+(?:sebagai\s+)?jawatankuasa\b/i,
  /\bfasal-fasal\s+dikemukakan\s+kepada\s+jawatankuasa\b/i,
  /\bundang-?undang\s+dimaklum(?:kan)?\s+kepada\s+majlis\b/i,
  /\bjadual\s+diperintah\s+sebahagi(?:an)?\s+daripada\s+undang-?undang\b/i,
  /\bundang-?undang\s+dilaporkan\b/i,
  /\btimbalan\s+(?:yang\s+di-?pertua|speaker)\s*\(.*?\)\s*mempengerusikan\b/i,
  /\bmengucap(?:\s+selamat)?\s+(?:tahun\s+baru|hari\s+raya|deepavali|christmas|krismas)\b/i,
  /\bselamat\s+tahun\s+baru\s+cina\b/i,
  /\bramadan\s+kepada\s+semua\s+(?:umat\s+)?islam\b/i,
  /\bselamat\s+menyambut\b/i,
  /\bkesempatan\s+(?:ini\s+)?saya\s+mengucap\b/i,
  /\bahli-ahli\s+dewan\s+yang\s+hadir\b/i,
  /\bkehadiran\s+ahli\b/i,
  /^\s*saya\s+memaklum(?:\s+\w+){0,6}\s+persidangan\b/i,
  /(?:ahli-ahli\s+yang\s+berhormat[,.]?\s*){2,}/i,
];

// ─── Local scoring ──────────────────────────────────────────────────────────

function localQualityScore(text) {
  if (!text || typeof text !== 'string') return 0;
  const t = text.trim();
  if (t.length < 20) return 5;
  if (PROCEDURAL.some(re => re.test(t))) return 5;

  const tokens = t.split(/\s+/).filter(Boolean);
  const n = tokens.length;
  if (n < 4) return 20;

  let sym = 0, frag = 0, adm = 0, slash = 0, bullet = 0, numOcr = 0;
  for (const tok of tokens) {
    const bare = tok.replace(/^[()[\]"'.,;:!?…\-–—]+/, '').replace(/[()[\]"'.,;:!?…\-–—]+$/, '');
    if (!bare) continue;
    const bl = bare.toLowerCase();
    if (SYMBOL_CORRUPT_RE.test(bare))  { sym++;    continue; }
    if (BULLET_OCR_RE.test(bare))      { bullet++; continue; }
    if (SLASH_LETTERS_RE.test(bare))   { slash++;  continue; }
    if (AMP_LETTERS_RE.test(bare))     { sym++;    continue; }
    if (ALPHA_DIGIT_MIX_RE.test(bare)) { adm++;    continue; }
    if (OCR_FRAGMENTS.has(bl))         { frag++;   continue; }
    if (/^\d{2,4}$/.test(bare) && !/^(19|20)\d{2}$/.test(bare)) { numOcr++; }
  }

  const bw = sym * 2.5 + frag * 1.5 + adm + slash + bullet * 0.5;
  let score = 100;
  score -= Math.min(90, Math.round((bw / n) * 220));
  if (sym    >= 2) score -= 25;
  if (frag   >= 3) score -= 20;
  if (numOcr >= 3) score -= 30;
  return Math.max(0, Math.min(100, score));
}

function localCheck(text) {
  const score = localQualityScore(text);
  return score < 35
    ? { pass: false, score, reason: 'local:ocr_noise_or_procedural' }
    : { pass: true,  score, reason: 'local:ok' };
}

// ─── LanguageTool (mode=lt) ─────────────────────────────────────────────────

function _callLt(text) {
  return new Promise((resolve) => {
    const body = querystring.stringify({ text, language: 'auto', level: 'default' });
    const req = https.request({
      hostname: LT_HOST, path: LT_PATH, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), 'User-Agent': 'MyParliament/1.0' },
    }, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try {
          const p = JSON.parse(raw);
          const typos = (p.matches || []).filter(m => m.rule && (m.rule.issueType === 'misspelling' || /MORFOLOGIK|SPELL|TYPO/i.test(m.rule.id || '')));
          const wc = text.trim().split(/\s+/).filter(Boolean).length;
          resolve({ typoCount: typos.length, wordCount: wc, typoRate: typos.length / Math.max(1, wc) });
        } catch { resolve(null); }
      });
    });
    req.setTimeout(LT_TIMEOUT_MS, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.write(body); req.end();
  });
}

async function _ltCheck(text) {
  const now = Date.now();
  const wait = _ltLastTs + LT_INTERVAL_MS - now;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _ltLastTs = Date.now();
  return _callLt(text.slice(0, 3000));
}

// ─── GPT-4o-mini: FIX + FILTER (mode=llm) ───────────────────────────────────

/**
 * Build the fix+filter prompt.
 * GPT returns a fixed version of each text, or "" to drop it.
 */
function _buildFixPrompt(excerpts, topicKeywords) {
  const kwLine = topicKeywords.length > 0
    ? `Topic keywords: ${topicKeywords.slice(0, 20).join(', ')}`
    : 'Topic keywords: (none provided – accept any coherent statement)';

  const numbered = excerpts
    .map((ex, i) => `[${i}] ${ex.replace(/\n+/g, ' ').slice(0, 420)}`)
    .join('\n');

  const system = `You are a text repair specialist for Malaysian parliamentary Hansard (official debate transcripts).

For each excerpt, return a FIXED version by applying ONLY these corrections:

1. OCR SPELLING FIXES – correct truncated Malay/English words caused by OCR column splits:
   Common examples: "deng"→"dengan", "sebaga"→"sebagai", "dala"→"dalam", "untu"→"untuk",
   "kepad"→"kepada", "daripad"→"daripada", "bahaw"→"bahawa", "adal"→"adalah",
   "tida"→"tidak", "bole"→"boleh", "sert"→"serta", "anta"→"antara", "iait"→"iaitu".
   Remove completely unrecognisable fragments like "kemllit", "tfutas", "ijead", "terlfutas".

2. SYMBOL REMOVAL – remove stray OCR artefact characters: } { @ $ # ^ * _ | ~ \` \\ and similar.
   Replace with a space or nothing, whichever reads more naturally.

3. CUT-OFF SENTENCES – if the text clearly ends mid-sentence (trailing preposition, conjunction,
   or dangling phrase with no period), TRIM to the last complete sentence. Do not add new words.

4. DROP ENTIRELY – return "" (empty string) if the text is:
   - Pure boilerplate: session adjournment, bill reading procedure, festive greetings, roll call.
   - Completely off-topic relative to the topic keywords.
   - Still unreadable after cleanup (more noise than real content).
   - Only honorifics with no substance ("Terima kasih Yang Berhormat." alone).

CRITICAL RULES – do NOT violate:
- Do NOT add information that was not in the original text.
- Do NOT rephrase, improve, or expand — only fix what is clearly broken.
- Keep the speaker's original words and parliamentary style.
- Normal parliamentary phrases are FINE: "Yang Berhormat", "Tuan Speaker",
  "Perdana Menteri", "[Tepuk]", "[Ketawa]", "(Kemaskini: …)".
- Mixed Malay/English is NORMAL in Malaysian Parliament.

Return ONLY a raw JSON array (no markdown, no explanation):
[{"id":0,"fixed":"corrected text or empty string"},{"id":1,"fixed":"..."},...]`;

  return { system, user: `${kwLine}\n\nExcerpts to fix:\n${numbered}` };
}

/**
 * Call OpenAI chat completions.
 * Returns parsed array of { id, fixed } or null on any error.
 * Uses 'Connection: close' to prevent socket-reuse hang-ups.
 * One retry on transient failure (socket error / timeout), then falls back to null.
 */
async function _callOpenAI(messages, maxTokens) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await _callOpenAIOnce(messages, maxTokens);
    if (result !== '__retry') return result;   // success or hard null
    if (attempt === 1) {
      console.warn('[ExcerptValidator] transient socket error – retrying once after 2s…');
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.warn('[ExcerptValidator] retry failed – skipping batch (safe fallback)');
  return null;
}

function _callOpenAIOnce(messages, maxTokens) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model:       LLM_MODEL,
      messages,
      temperature: 0,
      max_tokens:  maxTokens,
    });

    const req = https.request({
      hostname: 'api.openai.com',
      path:     '/v1/chat/completions',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization':  `Bearer ${OPENAI_KEY}`,
        'Connection':     'close',   // fresh TCP connection every time → no keep-alive hang-up
      },
    }, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.error) {
            console.warn('[ExcerptValidator] OpenAI error:', parsed.error.message || JSON.stringify(parsed.error));
            resolve(null); return;
          }
          const content = (parsed.choices?.[0]?.message?.content || '').trim();
          const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
          let arr;
          try {
            arr = JSON.parse(cleaned);
          } catch {
            const m = cleaned.match(/\[[\s\S]*\]/);
            if (m) arr = JSON.parse(m[0]);
          }
          if (!Array.isArray(arr)) {
            arr = arr?.results || arr?.excerpts || arr?.items || Object.values(arr || {})[0];
          }
          resolve(Array.isArray(arr) ? arr : null);
        } catch (e) {
          console.warn('[ExcerptValidator] parse error:', e.message);
          resolve(null);
        }
      });
    });

    // On timeout or socket error: signal caller to retry once, then give up
    req.setTimeout(LLM_TIMEOUT_MS, () => {
      req.destroy();
      resolve('__retry');
    });
    req.on('error', () => resolve('__retry'));
    req.write(body); req.end();
  });
}

/**
 * Batch-fix a list of excerpts via GPT-4o-mini.
 * @returns {Promise<Map<number,string>|null>}  id → fixed text (or "" to drop)
 */
async function _llmFixBatch(excerpts, topicKeywords) {
  if (!OPENAI_KEY) {
    console.warn('[ExcerptValidator] OPENAI_API_KEY not set – skipping LLM');
    return null;
  }
  const { system, user } = _buildFixPrompt(excerpts, topicKeywords);
  // Token budget: each excerpt ~120 words input + up to 120 words output → ~240 tokens/excerpt
  const maxTokens = Math.min(4000, excerpts.length * 250);
  const results = await _callOpenAI(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    maxTokens
  );
  if (!results) return null;

  const map = new Map();
  for (const r of results) {
    if (typeof r.id === 'number') {
      map.set(r.id, typeof r.fixed === 'string' ? r.fixed.trim() : null);
    }
  }
  return map;
}

// ─── Cache helpers ──────────────────────────────────────────────────────────
function _cacheSet(key, value) {
  if (_cache.size >= MAX_CACHE) _cache.delete(_cache.keys().next().value);
  _cache.set(key, value);
}

// ─── Public: fix + filter (primary for precompute) ──────────────────────────

/**
 * Fix spelling/symbols/cut-offs AND filter bad excerpts in a single GPT pass.
 *
 * Each returned turn has its .text_excerpt REPLACED with the GPT-corrected version.
 * Turns dropped by GPT (fixed === "") are removed from the output.
 *
 * In mode=off  → only local heuristic filter, text unchanged.
 * In mode=lt   → local filter + LanguageTool reject (no text fix).
 * In mode=llm  → local filter + GPT fix + drop if GPT returns "".
 *
 * @param {object[]} turns          – array of turn objects with .text_excerpt
 * @param {string[]} topicKeywords  – topic cluster keywords
 * @param {{ verbose?: boolean }} opts
 * @returns {Promise<object[]>}     – filtered turns with fixed text_excerpt
 */
async function fixAndFilterTurns(turns, topicKeywords = [], opts = {}) {
  if (!turns || turns.length === 0) return turns;

  // ── Layer 1: local (always) ──────────────────────────────────────────────
  const afterLocal  = [];
  let localRejected = 0;

  for (let i = 0; i < turns.length; i++) {
    const { pass, score, reason } = localCheck(turns[i].text_excerpt || '');
    if (pass) {
      afterLocal.push({ origIdx: i, turn: turns[i], localScore: score });
    } else {
      localRejected++;
      if (opts.verbose) _logReject(score, reason, turns[i].text_excerpt);
    }
  }
  if (localRejected > 0) {
    console.log(`  [Validator/local] ${localRejected}/${turns.length} rejected`);
  }
  if (MODE === 'off' || afterLocal.length === 0) {
    return afterLocal.map(x => x.turn);
  }

  // ── Layer 2: LanguageTool (mode=lt) ─────────────────────────────────────
  if (MODE === 'lt') {
    const out = [];
    let ltRej = 0;
    for (const { turn, localScore } of afterLocal) {
      if (localScore >= 80) { out.push(turn); continue; }
      const wc = (turn.text_excerpt || '').trim().split(/\s+/).length;
      if (wc < MIN_WORDS_FOR_LT) { out.push(turn); continue; }
      const lt = await _ltCheck(turn.text_excerpt);
      if (lt && lt.typoRate > MAX_TYPO_RATE) {
        ltRej++;
        if (opts.verbose) _logReject(localScore, `lt:spelling(${lt.typoCount}/${lt.wordCount})`, turn.text_excerpt);
      } else {
        out.push(turn);
      }
    }
    if (ltRej > 0) console.log(`  [Validator/lt] ${ltRej} rejected`);
    return out;
  }

  // ── Layer 3: GPT fix + filter (mode=llm) ────────────────────────────────
  if (MODE === 'llm') {
    const finalTurns = [];
    let llmRej = 0, llmFixed = 0;

    const INTER_BATCH_DELAY_MS = 300; // gentle pause between API calls

    // Process in batches of LLM_BATCH
    for (let start = 0; start < afterLocal.length; start += LLM_BATCH) {
      if (start > 0) await new Promise(r => setTimeout(r, INTER_BATCH_DELAY_MS));
      const chunk      = afterLocal.slice(start, start + LLM_BATCH);
      const texts      = chunk.map(x => x.turn.text_excerpt || '');
      const fixedMap   = await _llmFixBatch(texts, topicKeywords);

      for (let j = 0; j < chunk.length; j++) {
        const { turn, localScore } = chunk[j];
        const original = turn.text_excerpt || '';

        if (!fixedMap) {
          // API failed → pass original (safe fallback)
          finalTurns.push(turn);
          continue;
        }

        const fixed = fixedMap.get(j);

        if (fixed === null || fixed === undefined) {
          // GPT didn't return a result for this index → keep original
          finalTurns.push(turn);
          continue;
        }

        if (fixed === '') {
          // GPT decided this excerpt is not salvageable → drop
          llmRej++;
          if (opts.verbose) _logReject(localScore, 'llm:dropped', original);
          continue;
        }

        // GPT returned a fixed version
        if (fixed !== original) {
          llmFixed++;
          if (opts.verbose) {
            console.log(`  [Validator/llm] FIXED: "${original.slice(0, 60)}…" → "${fixed.slice(0, 60)}…"`);
          }
        }

        // Replace excerpt with fixed version; run local sanitize as final pass
        finalTurns.push({ ...turn, text_excerpt: fixed });
      }
    }

    if (llmRej   > 0) console.log(`  [Validator/llm] ${llmRej} dropped (not salvageable)`);
    if (llmFixed > 0) console.log(`  [Validator/llm] ${llmFixed} excerpts repaired`);
    return finalTurns;
  }

  return afterLocal.map(x => x.turn);
}

/**
 * Legacy: filter only (no text fixing). Kept for backwards compatibility.
 * Prefer fixAndFilterTurns() for precompute.
 */
async function validateAndFilterTurns(turns, topicKeywords = [], opts = {}) {
  return fixAndFilterTurns(turns, topicKeywords, opts);
}

/**
 * Validate a single excerpt (no fixing). Used for live/non-batch paths.
 */
async function validateExcerpt(text, topicKeywords = []) {
  if (!text || text.trim().length < 20) return { pass: false, score: 0, reason: 'too_short' };
  const cacheKey = text.trim().slice(0, 240);
  if (_cache.has(cacheKey)) return _cache.get(cacheKey);

  const local = localCheck(text);
  if (!local.pass) {
    const r = { pass: false, score: local.score, reason: local.reason };
    _cacheSet(cacheKey, r); return r;
  }

  if (MODE === 'lt' && local.score < 80) {
    const wc = text.trim().split(/\s+/).filter(Boolean).length;
    if (wc >= MIN_WORDS_FOR_LT) {
      const lt = await _ltCheck(text);
      if (lt && lt.typoRate > MAX_TYPO_RATE) {
        const r = { pass: false, score: Math.max(0, local.score - Math.round(lt.typoRate * 100)), reason: `lt:spelling(${lt.typoCount}/${lt.wordCount})` };
        _cacheSet(cacheKey, r); return r;
      }
    }
  }

  const r = { pass: true, score: local.score, reason: 'ok' };
  _cacheSet(cacheKey, r);
  return r;
}

function _logReject(score, reason, text) {
  const snippet = (text || '').replace(/\s+/g, ' ').slice(0, 90);
  console.log(`    REJECT score=${score} (${reason}): ${snippet}…`);
}

module.exports = {
  fixAndFilterTurns,
  validateAndFilterTurns,
  validateExcerpt,
  localCheck,
  localQualityScore,
  MODE,
};
