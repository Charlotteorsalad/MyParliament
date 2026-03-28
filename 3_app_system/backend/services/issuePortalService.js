/**
 * IssuePortalService
 *
 * Two responsibilities:
 *   1. READ  – serve precomputed data from Topic collection to HTTP routes
 *   2. WRITE – precompute (offline or on-demand) by walking:
 *              hansard_inference → hansard_cpatf / hansard_segmented
 *              and writing one document per (cluster × mesyuarat) into Topic.
 *
 * Granularity model:
 *   One Topic document = one SMALL ISSUE = one cluster debated in one Mesyuarat.
 *   e.g. "PTPTN Policy – P15 Penggal 5 Mesyuarat 1" is a single document.
 *   A cluster covering 30 mesyuarat → 30 separate issue documents.
 *
 * Collection layout (Topic):
 *   pipeline_id       string       "pipeline5"
 *   topic_cluster_id  number       cluster index from inference
 *   session_key       string       "P15_5_1" | "year_2026_q1" (unique within pipeline+cluster)
 *   session_label     string       "P15 Penggal 5 Mesyuarat 1" (human readable)
 *   parlimen          number|null  15
 *   penggal           number|null  5
 *   mesyuarat         number|null  1
 *   title             string       "<TopicLabel> – <SessionLabel>"
 *   title_ms          string
 *   description       string
 *   category          string       tech badge: rule-based from issue keywords (_inferCategory), not random
 *   cluster_label     string       coalition badge: from ML pipeline (hansard_topic / topic_labels), not random
 *   keywords          string[]
 *   label_quality     string       "high" | "medium" | "low" | "unknown"
 *   earliest_date     Date
 *   latest_date       Date
 *   statement_count   number
 *   mp_count          number
 *   doc_count         number
 *   computed_at       Date
 *   timeline          Turn[]       (excluded in list view, included in detail view)
 *
 * Turn:
 *   doc_id            string
 *   mp_name           string
 *   party             string
 *   date              Date | null
 *   session_label     string
 *   text_excerpt      string
 *   sentiment         number
 *   keywords          string[]
 *   action_type          "reply" | "escalate" | "ask" | "interjection"
 *   conversation_group   number  – group id for Q&A block (incremented on each Ask)
 *   parlimen             number|null
 *   penggal              number|null
 *   mesyuarat            number|null
 */

'use strict';

const { MongoClient, ObjectId } = require('mongodb');
const sentimentService   = require('./sentimentService');
const excerptValidator   = require('./excerptQualityValidator');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = 'MyParliament';
const CACHE_COLLECTION = 'Topic';

const MAX_TURNS_PER_ISSUE = 500; // fixed cap: balance disk vs integrity; best segments only
const MIN_TURNS_PER_ISSUE = 1;   // allow one turn so one period can show multiple topics (e.g. 医疗, 教育, 交通)
const MAX_TURNS_PER_CONVERSATION = 8; // ~5 meaningful back-and-forths; more if substantive

// Pipeline name mapping
const PIPELINE_NAMES = {
  'pipeline1': 'TF-IDF + KMeans Clustering (Classical Baseline)',
  'pipeline2': 'TF-IDF + LDA (Classical Generative Baseline)',
  'pipeline3': 'CPATF + MEHTC-Hybrid (TF-IDF + Entity Jaccard Only)',
  'pipeline4': 'MEHTC + XLM-RoBERTa Zero-shot',
  'pipeline5': 'MEHTC + LoRA-GRPO Fine-tuned XLM-RoBERTa',
  'pipeline6': 'Multilingual-E5-Large (External SOTA Baseline)',
};

// P1/P2: source docs are HansardDocument, but we read from hansard_segmented
//        which pre-segments each day into individual speaker turns via segmentation_output[].
//        hansard_segmented.parent_doc_id links back to HansardDocument._id.
// P3-P6: use hansard_cpatf (cleaned + segmented via segments_cleaned[]).
const RAW_PIPELINES = new Set(['pipeline1', 'pipeline2']);
const RAW_COLLECTION = 'HansardDocument';

const STOPWORDS = new Set([
  // English
  'the','and','for','that','this','with','are','but','not','you','all','can',
  'had','her','his','was','one','our','out','has','have','been','were','will',
  'would','could','should','about','into','through','during','before','after',
  'above','below','between','from','they','them','their','then','than','also',
  'more','very','just','said','each','some','than','too','its','your','who',
  'which','when','where','what','how','does','did','get','got','let','may',
  // Malay / Bahasa Malaysia
  'yang','dan','untuk','dengan','adalah','ini','itu','ada','telah','dalam',
  'pada','oleh','daripada','kepada','bahawa','juga','akan','bagi','seperti',
  'lebih','kami','saya','kita','anda','tidak','boleh','harus','perlu','setiap',
  'semua','atau','tetapi','jika','maka','ialah','kepada','antara','selepas',
  'sebelum','ketika','apabila','kerana','namun','walau','serta','iaitu',
  // Discourse/filler connectives
  'berikut','sebanyak','sebagai','termasuk','misalnya','semasa','seperti',
  'seramai','sejumlah','setelah','selain','seiring','berjumlah','melalui',
  'berkaitan','berhubung','mengenai','berkenaan','sehingga','sekitar',
  // Parliamentary boilerplate
  'menteri','pertua','pengerusi','speaker','dipertua',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Class
// ─────────────────────────────────────────────────────────────────────────────

class IssuePortalService {
  constructor(mongoUri) {
    if (!mongoUri) throw new Error('IssuePortalService: mongoUri is required');
    this.mongoUri = mongoUri;
    this._client  = null;
  }

  // ─── Connection ──────────────────────────────────────────────────────────

  async _getDb() {
    if (!this._client) {
      this._client = new MongoClient(this.mongoUri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      });
      await this._client.connect();
    }
    return this._client.db(DB_NAME);
  }

  async disconnect() {
    if (this._client) {
      await this._client.close();
      this._client = null;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Load individual name tokens from the Mp collection.
   * Returns a Set of lowercase single-word tokens (len >= 4, non-numeric)
   * extracted from: name, full_name_with_titles, original_name_variations.
   *
   * Used to dynamically enrich noise/stopword filters so we never have to
   * manually maintain a list of politician names.
   *
   * Results are cached on the instance for the lifetime of the process.
   *
   * @returns {Promise<Set<string>>}
   */
  async _loadMpNameTokens() {
    if (this._mpNameTokens) return this._mpNameTokens;
    try {
      const db = await this._getDb();
      const mps = await db.collection('MP').find(
        {},
        { projection: { name: 1, full_name_with_titles: 1, original_name_variations: 1 } }
      ).toArray();

      const tokens = new Set();
      const addTokens = str => {
        if (!str) return;
        str.toLowerCase()
          .split(/[\s,.'()\-]+/)
          .forEach(w => {
            const clean = w.replace(/[^\w]/g, '');
            if (clean.length >= 4 && !/^\d+$/.test(clean)) tokens.add(clean);
          });
      };

      for (const mp of mps) {
        addTokens(mp.name);
        addTokens(mp.full_name_with_titles);
        for (const v of (mp.original_name_variations || [])) addTokens(v);
      }

      this._mpNameTokens = tokens;
      console.log(`[IssuePortalService] Loaded ${tokens.size} MP name tokens from Mp collection`);
    } catch (err) {
      console.warn('[IssuePortalService] Could not load MP name tokens:', err.message);
      this._mpNameTokens = new Set();
    }
    return this._mpNameTokens;
  }

  // ─── READ (from cache) ────────────────────────────────────────────────────

  /**
   * Get all issues for a pipeline – list view (timeline excluded).
   * Each document now represents a single (cluster × mesyuarat) issue.
   *
   * @param {string}  pipelineId
   * @param {object}  opts
   * @param {string}  [opts.session]    Filter to a specific session_label
   * @param {string}  [opts.category]       Filter by category (tech badge: Technology, Other, Legal)
   * @param {string}  [opts.cluster_label] Filter by cluster_label (coalition badge)
   * @param {string}  [opts.quality]           Filter by label_quality (high|medium|low)
   * @param {boolean} [opts.includeLowQuality] If false (default), exclude low-quality issues
   * @param {number}  [opts.parlimen]          Filter by parlimen number (scalar field)
   * @param {number}  [opts.penggal]           Filter by penggal number (scalar field)
   * @param {number}  [opts.mesyuarat]         Filter by mesyuarat number (scalar field)
   */
  async getAllTopics(pipelineId, opts = {}) {
    const db = await this._getDb();

    const query = { pipeline_id: pipelineId };
    if (opts.session)        query.session_label   = opts.session;
    if (opts.category)       query.category        = opts.category;
    if (opts.cluster_label)  query.cluster_label   = opts.cluster_label;
    if (opts.quality)        query.label_quality   = opts.quality;
    else if (opts.includeLowQuality !== true) query.label_quality = { $in: ['high', 'medium', 'unknown'] };

    if (opts.parlimen != null) {
      query.parlimen = typeof opts.parlimen === 'number'
        ? opts.parlimen : parseInt(opts.parlimen, 10);
    }
    if (opts.penggal != null) {
      query.penggal = typeof opts.penggal === 'number'
        ? opts.penggal : parseInt(opts.penggal, 10);
    }
    if (opts.mesyuarat != null) {
      query.mesyuarat = typeof opts.mesyuarat === 'number'
        ? opts.mesyuarat : parseInt(opts.mesyuarat, 10);
    }

    const raw = await db
      .collection(CACHE_COLLECTION)
      .find(query, { projection: { timeline: 0 } })
      .sort({ latest_date: -1, statement_count: -1, mp_count: -1 })
      .toArray();

    return raw.map(doc => ({
      _id:             doc._id.toString(),
      cluster_id:      doc.topic_cluster_id,
      pipeline_id:     doc.pipeline_id,
      session_key:      doc.session_key     || '',
      session_label:    doc.session_label   || '',
      parlimen:         doc.parlimen        || null,
      penggal:          doc.penggal         || null,
      mesyuarat:        doc.mesyuarat       || null,
      cluster_label:    doc.cluster_label   || '',
      cluster_label_ms: doc.cluster_label_ms || '',
      title:            doc.title           || `Topic ${doc.topic_cluster_id}`,
      title_ms:         doc.title_ms        || '',
      description:     doc.description    || '',
      category:        doc.category       || 'Other',
      keywords:        doc.keywords       || [],
      label_quality:   doc.label_quality  || 'unknown',
      statement_count: doc.statement_count || 0,
      mp_count:        doc.mp_count        || 0,
      doc_count:       doc.doc_count       || 0,
      earliest_date:   doc.earliest_date   || null,
      lastUpdated:     doc.latest_date     || null,
      computed_at:     doc.computed_at     || null,
      featured:        doc.label_quality === 'high',
      views:           0,
      bookmarks:       0,
    }));
  }

  /**
   * Get a single issue by its MongoDB _id – detail view (timeline included).
   */
  async getIssueById(issueId) {
    const db = await this._getDb();
    let oid;
    try {
      oid = new ObjectId(issueId);
    } catch {
      return null;
    }
    return db.collection(CACHE_COLLECTION).findOne({ _id: oid });
  }

  /**
   * Increment view count for an issue (any visitor, no auth).
   * Used for trending "By views" and avoids missing counts when users are not logged in.
   */
  async incrementIssueViewCount(issueId) {
    const db = await this._getDb();
    let oid;
    try {
      oid = new ObjectId(issueId);
    } catch {
      return { matched: 0 };
    }
    const result = await db.collection(CACHE_COLLECTION).updateOne(
      { _id: oid },
      { $inc: { viewCount: 1 } }
    );
    return { matched: result.matchedCount, modified: result.modifiedCount };
  }

  /**
   * Get a single issue by pipeline + cluster_id (legacy URL support).
   * Returns the most recent session document for that cluster.
   */
  async getIssueByClusterId(pipelineId, clusterId) {
    const db = await this._getDb();
    return db.collection(CACHE_COLLECTION)
      .find({
        pipeline_id:      pipelineId,
        topic_cluster_id: parseInt(clusterId, 10),
      })
      .sort({ latest_date: -1 })
      .limit(1)
      .next();
  }

  /**
   * Get recent parliamentary statements for an MP from the precomputed Topic cache.
   *
   * @param {string[]} nameVariants - Different normalised name variants to match against timeline.mp_name
   * @param {number} [limit=8]     - Max number of turns to return (global, across issues)
   * @returns {Promise<Array<{
   *   issueId: string,
   *   date: Date|null,
   *   action_type: string,
   *   text_excerpt: string,
   *   category: string,
   *   issueTitle: string
   * }>>}
   */
  _toParliamentNumber(parliamentTerm) {
    if (parliamentTerm === null || parliamentTerm === undefined) return null;
    const num = parseInt(String(parliamentTerm).replace(/\D/g, ''), 10);
    return Number.isNaN(num) || num <= 0 ? null : num;
  }

  async getRecentStatementsForMp(nameVariants, limit = 8, parliamentTerm = null) {
    const names = Array.isArray(nameVariants)
      ? [...new Set(nameVariants.map(n => (n || '').trim()).filter(Boolean))]
      : [];
    if (!names.length || limit <= 0) return [];

    const db = await this._getDb();
    const col = db.collection(CACHE_COLLECTION);
    const parliamentNum = this._toParliamentNumber(parliamentTerm);

    // Normalise: strip titles + lowercase — identical to precomputeMpIssueSpeakingStats.js
    const _norm = n => n
      .replace(/\b(Yang\s+Berhormat|YB|Tuan|Puan|Dato'?|Datuk|Dr\.?|Tan\s+Sri)\s+/gi, '')
      .replace(/\s+/g, ' ').trim().toLowerCase();

    const normVariants = [...new Set(names.map(_norm))].filter(v => v.length >= 2);

    // Same fuzzy check as precompute's belongsToMp — substring match, case-insensitive
    const belongsToMp = (turnName) => {
      if (!turnName) return false;
      const normTurn = _norm(turnName);
      if (normVariants.some(v => normTurn === v || normTurn.includes(v) || v.includes(normTurn))) return true;
      const rawTurn = turnName.trim().toLowerCase();
      return names.some(v => rawTurn.includes(v.toLowerCase()) || v.toLowerCase().includes(rawTurn));
    };

    // Build a case-insensitive OR regex so the initial DB $match catches all name forms
    // (all-caps, with/without titles, etc.) without relying on exact string equality.
    const escaped = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regexStr = escaped.join('|');

    const matchStage = { 'timeline.mp_name': { $regex: regexStr, $options: 'i' } };
    if (parliamentNum) matchStage.parlimen = parliamentNum;

    const pipeline = [
      { $match: matchStage },
      {
        $project: {
          title: 1,
          category: 1,
          timeline: {
            $filter: {
              input: '$timeline',
              as: 'turn',
              cond: { $regexMatch: { input: '$$turn.mp_name', regex: regexStr, options: 'i' } },
            },
          },
        },
      },
      { $unwind: '$timeline' },
      { $sort: { 'timeline.date': -1 } },
      { $limit: 100 }, // fetch extra so in-memory fuzzy filter has enough candidates
      {
        $project: {
          _id: 0,
          issueId:      { $toString: '$_id' },
          issueTitle:   '$title',
          category:     { $ifNull: ['$category', 'Other'] },
          date:         '$timeline.date',
          text_excerpt: '$timeline.text_excerpt',
          action_type:  '$timeline.action_type',
          mp_name:      '$timeline.mp_name', // kept for in-memory fuzzy check, stripped before return
        },
      },
    ];

    const rows = await col.aggregate(pipeline).toArray();
    console.log(`[getRecentStatements] parlimen=${parliamentNum || 'all'} regexCandidates=${rows.length} for names=${JSON.stringify(names.slice(0, 3))}`);

    // In-memory fuzzy filter — mirrors precompute's belongsToMp exactly
    const matched = rows.filter(r => belongsToMp(r.mp_name));
    console.log(`[getRecentStatements] afterFuzzyMatch=${matched.length}`);

    // Do NOT re-apply the excerpt quality filter here — the precompute already filtered
    // bad data when building Topic documents. Re-filtering drops turns that contributed
    // to the response rate (all turns count there) but have short/noisy excerpts.
    const seen = new Set();
    const deduped = [];
    for (const { mp_name: _mpName, ...row } of matched) {
      const excerpt = (row.text_excerpt || '').trim();
      const dateKey = row.date ? new Date(row.date).toISOString().slice(0, 10) : '';
      const textKey = excerpt.toLowerCase().slice(0, 180);
      const key = `${dateKey}|${textKey}`;
      if (!textKey || seen.has(key)) continue;
      seen.add(key);
      deduped.push({ ...row, text_excerpt: excerpt });
      if (deduped.length >= limit) break;
    }
    return deduped;
  }

  async getLiveSpeakingStatsForMp(nameVariants, parliamentTerm = null) {
    const names = Array.isArray(nameVariants)
      ? [...new Set(nameVariants.map(n => (n || '').trim()).filter(Boolean))]
      : [];
    if (!names.length) {
      return {
        responseRate: null,
        askRate: null,
        escalateRate: null,
        interjectionRate: null,
        sentimentScore: null,
      };
    }

    const db = await this._getDb();
    const col = db.collection(CACHE_COLLECTION);
    const parliamentNum = this._toParliamentNumber(parliamentTerm);

    const _norm = n => n
      .replace(/\b(Yang\s+Berhormat|YB|Tuan|Puan|Dato'?|Datuk|Dr\.?|Tan\s+Sri)\s+/gi, '')
      .replace(/\s+/g, ' ').trim().toLowerCase();

    const normVariants = [...new Set(names.map(_norm))].filter(v => v.length >= 2);
    const belongsToMp = (turnName) => {
      if (!turnName) return false;
      const normTurn = _norm(turnName);
      if (normVariants.some(v => normTurn === v || normTurn.includes(v) || v.includes(normTurn))) return true;
      const rawTurn = turnName.trim().toLowerCase();
      return names.some(v => rawTurn.includes(v.toLowerCase()) || v.toLowerCase().includes(rawTurn));
    };

    const escaped = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regexStr = escaped.join('|');
    const matchStage = { 'timeline.mp_name': { $regex: regexStr, $options: 'i' } };
    if (parliamentNum) matchStage.parlimen = parliamentNum;

    const rows = await col.aggregate([
      { $match: matchStage },
      {
        $project: {
          timeline: {
            $filter: {
              input: '$timeline',
              as: 'turn',
              cond: { $regexMatch: { input: '$$turn.mp_name', regex: regexStr, options: 'i' } },
            },
          },
        },
      },
      { $unwind: '$timeline' },
      {
        $project: {
          _id: 0,
          mp_name: '$timeline.mp_name',
          action_type: '$timeline.action_type',
          sentiment: '$timeline.sentiment',
        },
      },
    ]).toArray();

    const matched = rows.filter(r => belongsToMp(r.mp_name));
    let nReply = 0, nAsk = 0, nEscalate = 0, nInterjection = 0;
    let sentSum = 0, sentCount = 0;

    for (const turn of matched) {
      const at = (turn.action_type || 'reply').toLowerCase();
      if (at === 'reply') nReply++;
      else if (at === 'ask') nAsk++;
      else if (at === 'escalate') nEscalate++;
      else if (at === 'interjection') nInterjection++;
      else nReply++;

      if (typeof turn.sentiment === 'number' && !Number.isNaN(turn.sentiment)) {
        sentSum += turn.sentiment;
        sentCount += 1;
      }
    }

    const totalTurns = nReply + nAsk + nEscalate + nInterjection;
    const round1 = v => Math.round(v * 10) / 10;

    return {
      responseRate: totalTurns > 0 ? round1((nReply / totalTurns) * 100) : null,
      askRate: totalTurns > 0 ? round1((nAsk / totalTurns) * 100) : null,
      escalateRate: totalTurns > 0 ? round1((nEscalate / totalTurns) * 100) : null,
      interjectionRate: totalTurns > 0 ? round1((nInterjection / totalTurns) * 100) : null,
      sentimentScore: sentCount > 0 ? round1(sentSum / sentCount) : null,
    };
  }

  /**
   * Compute performance metrics for an MP.
   *
   * Surfaces precomputed data from:
   *   - precomputeMpAttendance.js   → attendanceRate / attendanceByTerm
   *   - precomputeMpIssueSpeakingStats.js → responseRate / askRate / escalateRate /
   *                                         interjectionRate / sentimentScore
   *
   * Returns a safe empty structure when no data is available so the frontend can
   * render gracefully (shows "—" instead of crashing).
   *
   * @param {string[]} nameVariants
   * @param {string|null} parliamentTerm
   * @param {{ rate:number, byTerm:Array }|null} precomputedAttendance
   * @param {{ responseRate:number|null, askRate:number|null, escalateRate:number|null,
   *           interjectionRate:number|null, sentimentScore:number|null }|null} precomputedSpeaking
   * @returns {Promise<{
   *   attendanceRate: number|null,
   *   attendanceByTerm: Array,
   *   attendanceByPenggal: Array,
   *   responseRate: number|null,
   *   askRate: number|null,
   *   escalateRate: number|null,
   *   interjectionRate: number|null,
   *   sentimentScore: number|null,
   * }>}
   */
  async getPerformanceForMp(nameVariants, parliamentTerm = null, precomputedAttendance = null, precomputedSpeaking = null) {
    const liveSpeaking =
      this._toParliamentNumber(parliamentTerm) !== null
        ? await this.getLiveSpeakingStatsForMp(nameVariants, parliamentTerm)
        : null;
    const speaking = liveSpeaking || precomputedSpeaking || {};
    const base = {
      responseRate:     typeof speaking.responseRate     === 'number' ? speaking.responseRate     : null,
      askRate:          typeof speaking.askRate          === 'number' ? speaking.askRate          : null,
      escalateRate:     typeof speaking.escalateRate     === 'number' ? speaking.escalateRate     : null,
      interjectionRate: typeof speaking.interjectionRate === 'number' ? speaking.interjectionRate : null,
      sentimentScore:   typeof speaking.sentimentScore   === 'number' ? speaking.sentimentScore   : null,
    };

    if (precomputedAttendance && typeof precomputedAttendance.rate === 'number') {
      return {
        attendanceRate: precomputedAttendance.rate,
        attendanceByTerm: Array.isArray(precomputedAttendance.byTerm) ? precomputedAttendance.byTerm : [],
        attendanceByPenggal: [],
        ...base,
      };
    }

    return {
      attendanceRate: null,
      attendanceByTerm: [],
      attendanceByPenggal: [],
      ...base,
    };
  }

  /**
   * Get precompute status across all pipelines.
   */
  async getPrecomputeStatus() {
    const db = await this._getDb();
    const rows = await db
      .collection(CACHE_COLLECTION)
      .aggregate([
        {
          $group: {
            _id:           '$pipeline_id',
            issue_count:   { $sum: 1 },
            last_computed: { $max: '$computed_at' },
            avg_turns:     { $avg: '$statement_count' },
            total_turns:   { $sum: '$statement_count' },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();
    return rows;
  }

  /**
   * Get the default pipeline config for Issue Portal (user-facing).
   * Returns { pipeline_id, include_low_quality }.
   */
  async getDefaultPipeline() {
    const db = await this._getDb();
    const config = await db.collection('IssuePortalConfig').findOne({ type: 'default_pipeline' });
    return {
      pipeline_id: config?.pipeline_id || 'pipeline5',
      include_low_quality: config?.include_low_quality === true,
    };
  }

  /**
   * Set the default pipeline and display options for Issue Portal (admin only).
   * @param {string} pipelineId
   * @param {boolean} [includeLowQuality] - whether to show low-quality topics on Issue Portal
   */
  async setDefaultPipeline(pipelineId, includeLowQuality) {
    const db = await this._getDb();
    const doc = {
      type: 'default_pipeline',
      pipeline_id: pipelineId,
      include_low_quality: includeLowQuality === true,
      updated_at: new Date(),
    };
    await db.collection('IssuePortalConfig').replaceOne(
      { type: 'default_pipeline' },
      doc,
      { upsert: true }
    );
    return { success: true, pipeline_id: pipelineId, include_low_quality: doc.include_low_quality };
  }

  /**
   * Get detailed precompute report with quality metrics, category breakdown, etc.
   * Used for admin ML performance dashboard.
   */
  async getPrecomputeReport() {
    const db = await this._getDb();
    const collection = db.collection(CACHE_COLLECTION);
    const [aggregated] = await collection.aggregate(
      [
        { $match: { pipeline_id: { $exists: true, $ne: null } } },
        {
          $facet: {
            totals: [{ $count: 'totalDocs' }],
            pipelineStats: [
              {
                $group: {
                  _id: '$pipeline_id',
                  issue_count: { $sum: 1 },
                  last_computed: { $max: '$computed_at' },
                  avg_turns: { $avg: '$statement_count' },
                  total_turns: { $sum: '$statement_count' },
                  avg_mp_count: { $avg: '$mp_count' },
                  avg_doc_count: { $avg: '$doc_count' },
                  total_doc_count: { $sum: '$doc_count' },
                  earliest_date: { $min: '$earliest_date' },
                  latest_date: { $max: '$latest_date' },
                },
              },
              { $sort: { _id: 1 } },
            ],
            qualityStats: [
              {
                $group: {
                  _id: {
                    pipeline_id: '$pipeline_id',
                    quality: { $ifNull: ['$label_quality', 'unknown'] },
                  },
                  count: { $sum: 1 },
                },
              },
              {
                $group: {
                  _id: '$_id.pipeline_id',
                  quality_distribution: {
                    $push: {
                      quality: '$_id.quality',
                      count: '$count',
                    },
                  },
                },
              },
              { $sort: { _id: 1 } },
            ],
            categoryStats: [
              {
                $group: {
                  _id: {
                    pipeline_id: '$pipeline_id',
                    category: { $ifNull: ['$category', 'Other'] },
                  },
                  count: { $sum: 1 },
                },
              },
              {
                $group: {
                  _id: '$_id.pipeline_id',
                  category_distribution: {
                    $push: {
                      category: '$_id.category',
                      count: '$count',
                    },
                  },
                },
              },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ],
      { allowDiskUse: true }
    ).toArray();

    const totalDocs = aggregated?.totals?.[0]?.totalDocs || 0;
    const pipelineStats = aggregated?.pipelineStats || [];
    const qualityStats = aggregated?.qualityStats || [];
    const categoryStats = aggregated?.categoryStats || [];

    console.log(`[IssuePortalService] getPrecomputeReport: Found ${totalDocs} documents with pipeline_id in ${CACHE_COLLECTION}`);

    // Merge stats
    const qualityByPipeline = new Map(qualityStats.map((entry) => [entry._id, entry]));
    const categoryByPipeline = new Map(categoryStats.map((entry) => [entry._id, entry]));

    const report = pipelineStats.map((stat) => {
      const quality = qualityByPipeline.get(stat._id);
      const category = categoryByPipeline.get(stat._id);

      return {
        pipeline_id: stat._id,
        pipeline_name: PIPELINE_NAMES[stat._id] || stat._id,
        issue_count: stat.issue_count || 0,
        last_computed: stat.last_computed || null,
        avg_turns: Math.round((stat.avg_turns || 0) * 100) / 100,
        total_turns: stat.total_turns || 0,
        avg_mp_count: Math.round((stat.avg_mp_count || 0) * 100) / 100,
        avg_doc_count: Math.round((stat.avg_doc_count || 0) * 100) / 100,
        total_doc_count: stat.total_doc_count || 0,
        date_range: {
          earliest: stat.earliest_date || null,
          latest: stat.latest_date || null,
        },
        quality_distribution: quality?.quality_distribution || [],
        category_distribution: category?.category_distribution || [],
      };
    });

    const result = {
      pipelines: report,
      summary: {
        total_pipelines: report.length,
        total_issues: report.reduce((sum, p) => sum + p.issue_count, 0),
        total_turns: report.reduce((sum, p) => sum + p.total_turns, 0),
        pipelines_with_data: report.filter((p) => p.issue_count > 0).length,
      },
    };
    
    console.log(`[IssuePortalService] getPrecomputeReport: Returning ${result.pipelines.length} pipelines, ${result.summary.total_issues} total issues`);
    return result;
  }

  // ─── WRITE (precompute) ───────────────────────────────────────────────────

  /**
   * Precompute all issues for one pipeline and write to issue_portal_issues.
   *
   * @param {string}  pipelineId  e.g. "pipeline5"
   * @param {boolean} force       overwrite existing documents
   * @returns {{ processed: number, skipped: number, error?: string }}
   */
  async precompute(pipelineId, force = false) {
    const db = await this._getDb();
    console.log(`\n[Precompute] ── ${pipelineId} ──────────────────────────────────`);

    // Warm the MP name token cache so _buildSessionTfIdf and _isRelevantTurn can use it
    await this._loadMpNameTokens();

    const topicCol     = db.collection('hansard_topic');
    const inferenceCol = db.collection('hansard_inference');
    const cacheCol     = db.collection(CACHE_COLLECTION);

    // Ensure indexes.
    // Unique key: (pipeline_id, topic_cluster_id, session_key) — one issue per cluster per mesyuarat.
    // Drop legacy index that keyed only on (pipeline_id, topic_cluster_id) if it exists.
    for (const legacyName of [
      'pipeline_id_1_topic_cluster_id_1',
      'pipeline_id_1_topic_cluster_id_1_session_key_1',
    ]) {
      try { await cacheCol.dropIndex(legacyName); } catch { /* ignore */ }
    }
    await cacheCol.createIndex(
      { pipeline_id: 1, topic_cluster_id: 1, session_key: 1 },
      {
        unique: true,
        partialFilterExpression: {
          pipeline_id:      { $exists: true, $type: 'string' },
          topic_cluster_id: { $exists: true, $type: 'int' },
          session_key:      { $exists: true, $type: 'string' },
        },
      }
    );
    await cacheCol.createIndex({ pipeline_id: 1, latest_date: -1 });
    await cacheCol.createIndex({ pipeline_id: 1, parlimen: 1, penggal: 1, mesyuarat: 1 });

    // 1. Load inference mapping (docIds → cluster indices)
    const inference = await inferenceCol.findOne({ pipelineId });
    if (!inference) {
      const msg = `No inference document for ${pipelineId}`;
      console.warn(`[Precompute] ${msg}`);
      return { processed: 0, skipped: 0, error: msg };
    }

    const docIds   = inference.docIds   || [];
    const clusters = inference.clusters || [];
    console.log(`[Precompute] ${docIds.length} inference documents`);

    // 2. Build cluster → [docId] map first (needed for fallback topic generation)
    const clusterDocIds = {};
    docIds.forEach((id, i) => {
      const cid = clusters[i];
      if (cid === undefined || cid === null) return;
      if (!clusterDocIds[cid]) clusterDocIds[cid] = [];
      clusterDocIds[cid].push(id);
    });
    
    // Keep cluster_topics and topic_labels in memory for fallback (don't null them)
    const clusterTopics = inference.cluster_topics || {};
    const topicLabels = inference.topic_labels || {};
    
    // 3. Load topic labels - try hansard_topic first, fallback to hansard_inference
    let topics = await topicCol.find({ pipeline_id: pipelineId }).toArray();
    if (topics.length === 0) {
      // Fallback: derive topics from hansard_inference
      console.log(`[Precompute] No topics in hansard_topic, deriving from hansard_inference...`);
      
      // Get unique cluster IDs from clusterDocIds
      const uniqueClusterIds = [...new Set(Object.keys(clusterDocIds).map(id => parseInt(id, 10)))].sort((a, b) => a - b);
      
      topics = uniqueClusterIds.map(clusterId => {
        const clusterIdStr = String(clusterId);
        const keywords = clusterTopics[clusterIdStr] || [];
        const label = topicLabels[clusterIdStr] || {};
        
        return {
          cluster_id: clusterId,
          keywords: keywords,
          topic_label: {
            name_en: label.name_en || `Topic ${clusterId}`,
            name_ms: label.name_ms || `Topik ${clusterId}`,
            description: label.description || (keywords.length > 0 
              ? `Parliamentary discussions on ${keywords.slice(0, 3).join(', ')}`
              : `Parliamentary discussions`),
            label_quality: label.label_quality || 'medium',
          },
          metadata: {
            label_quality: label.label_quality || 'medium',
          },
        };
      });
      
      if (topics.length === 0) {
        const msg = `No topics found for ${pipelineId} (neither in hansard_topic nor derivable from hansard_inference)`;
        console.warn(`[Precompute] ${msg}`);
        return { processed: 0, skipped: 0, error: msg };
      }
      console.log(`[Precompute] Derived ${topics.length} topics from hansard_inference`);
    }
    console.log(`[Precompute] ${topics.length} topics`);
    
    // Free inference arrays from memory – they can be several MB
    inference.docIds   = null;
    inference.clusters = null;

    // 4. Choose source collection
    // P1/P2: hansard_segmented — covers ALL HansardDocuments (1959–present),
    //        matched by parent_doc_id (ObjectId). Each doc has segmentation_output[]
    //        with individual speaker turns {speaker, constituency, text}.
    // P3-P6: hansard_cpatf — segments_cleaned[] per speaker turn.
    const isRaw      = RAW_PIPELINES.has(pipelineId);
    const srcColName = isRaw ? 'hansard_segmented' : 'hansard_cpatf';
    const srcCol     = db.collection(srcColName);
    console.log(`[Precompute] Source collection: ${srcColName}`);

    let processed = 0;
    let skipped   = 0;

    // 5. Process each topic cluster
    for (const topic of topics) {
      const clusterId     = topic.cluster_id;
      const topicKeywords = topic.keywords || [];
      const topicDocIds   = clusterDocIds[clusterId] || [];

    if (topicDocIds.length === 0) {
        console.log(`[Precompute]   cluster ${String(clusterId).padEnd(4)} SKIP – no documents assigned in inference`);
        skipped++;
        continue;
      }

      // Build ObjectId array (tolerate strings that are not valid ObjectIds)
      const objIds = topicDocIds.reduce((acc, id) => {
        try { acc.push(new ObjectId(id)); } catch { /* skip malformed */ }
        return acc;
      }, []);

      if (objIds.length === 0) {
        console.log(`[Precompute]   cluster ${String(clusterId).padEnd(4)} SKIP – all docIds malformed`);
        skipped++;
        continue;
      }

      // 6. Fetch all turns for this cluster from the source collection.
      //    No hard cap here — we cap per-issue later after splitting by session.

      const allTurns = [];

      if (isRaw) {
        // ── hansard_segmented (P1/P2) ────────────────────────────────────────
        const aggPipeline = [
          { $match:   { parent_doc_id: { $in: objIds } } },
          { $sort:    { hansardDate: 1 } },
          { $project: {
              parent_doc_id: 1, hansardDate: 1,
              parlimen: 1, penggal: 1, mesyuarat: 1, parlimen_range: 1,
              segmentation_output: 1,
          }},
          { $unwind: '$segmentation_output' },
          { $project: {
              parent_doc_id: 1, hansardDate: 1,
              parlimen: 1, penggal: 1, mesyuarat: 1, parlimen_range: 1,
              speaker:  '$segmentation_output.speaker',
              party:    '$segmentation_output.constituency',
              seg_text: { $substrCP: [
                { $ifNull: ['$segmentation_output.text', ''] }, 0, 1000
              ]},
          }},
        ];

        const cursor = srcCol.aggregate(aggPipeline, { allowDiskUse: true });
        for await (const row of cursor) {
          const text = (row.seg_text || '').trim();
          if (text.length < 20) continue;
          const docDate = row.hansardDate ? new Date(row.hansardDate) : null;
          let sessionLabel = this._formatSession(row);
          if (!sessionLabel && docDate) sessionLabel = this._formatDateForSession(docDate);
          allTurns.push(
            this._buildTurn(
              row.parent_doc_id?.toString(),
              row.speaker, row.party,
              docDate, sessionLabel,
              text, topicKeywords,
              row.parlimen, row.penggal, row.mesyuarat
            )
          );
        }

      } else {
        // ── hansard_cpatf (P3-P6) ────────────────────────────────────────────
        const aggPipeline = [
          { $match:   { _id: { $in: objIds } } },
          { $sort:    { hansardDate: 1 } },
          { $project: {
              hansardDate: 1, speaker: 1, party: 1,
              parlimen: 1, penggal: 1, mesyuarat: 1, parlimen_range: 1,
              segments_cleaned: 1,
              cleaned_text: { $substrCP: [{ $ifNull: ['$cleaned_text', ''] }, 0, 2000] },
          }},
          { $unwind: { path: '$segments_cleaned', preserveNullAndEmptyArrays: true } },
          { $project: {
              hansardDate: 1, party: 1,
              parlimen: 1, penggal: 1, mesyuarat: 1, parlimen_range: 1,
              speaker: { $ifNull: ['$segments_cleaned.speaker', '$speaker'] },
              seg_text: { $substrCP: [
                { $ifNull: ['$segments_cleaned.cleaned_text', '$cleaned_text'] }, 0, 2000
              ]},
          }},
        ];

        const cursor = srcCol.aggregate(aggPipeline, { allowDiskUse: true });
        for await (const row of cursor) {
          const text = (row.seg_text || '').trim();
          if (text.length < 20) continue;
          const docDate = row.hansardDate ? new Date(row.hansardDate) : null;
          let sessionLabel = this._formatSession(row);
          if (!sessionLabel && docDate) sessionLabel = this._formatDateForSession(docDate);
          allTurns.push(
            this._buildTurn(
              row._id?.toString(),
              row.speaker, row.party,
              docDate, sessionLabel,
              text, topicKeywords,
              row.parlimen, row.penggal, row.mesyuarat
            )
          );
        }
      }

      if (allTurns.length === 0) {
        console.log(`[Precompute]   cluster ${String(clusterId).padEnd(4)} SKIP – no turns extracted`);
        skipped++;
        continue;
      }

      // 7. Split turns by (parlimen, penggal, mesyuarat) → one issue per session.
      //    Turns that lack session metadata are grouped by calendar year.
      const sessionBuckets = new Map(); // session_key → { parlimen, penggal, mesyuarat, session_label, turns[] }

      for (const turn of allTurns) {
        let key, sessionLabel, p, g, m;
        if (turn.parlimen && turn.penggal && turn.mesyuarat) {
          p = turn.parlimen; g = turn.penggal; m = turn.mesyuarat;
          key = `P${p}_${g}_${m}`;
          sessionLabel = `P${p} Penggal ${g} Mesyuarat ${m}`;
        } else if (turn.date) {
          const yr = turn.date.getFullYear();
          const q = Math.floor(turn.date.getMonth() / 3) + 1; // 1–4
          key = `year_${yr}_q${q}`;
          sessionLabel = `${yr} Q${q}`;
          p = null; g = null; m = null;
        } else {
          key = 'unknown';
          sessionLabel = 'Unknown Session';
          p = null; g = null; m = null;
        }

        if (!sessionBuckets.has(key)) {
          sessionBuckets.set(key, { parlimen: p, penggal: g, mesyuarat: m, session_key: key, session_label: sessionLabel, turns: [] });
        }
        sessionBuckets.get(key).turns.push(turn);
      }

      // 8. For each session bucket, write one Topic document (one small issue)
      const topicLabel = topic.topic_label || topic;
      const baseTitle    = topicLabel.name_en   || `Topic ${clusterId}`;
      const baseTitleMs  = topicLabel.name_ms   || `Topik ${clusterId}`;
      const description  = topicLabel.description || '';
      const labelQuality = topic.metadata?.label_quality || topicLabel.label_quality || 'unknown';

      // TF-IDF across all sessions of this cluster — computed once, used per session
      const tfidfMap = this._buildSessionTfIdf(sessionBuckets);

      for (const [sessionKey, bucket] of sessionBuckets) {
        const { parlimen: p, penggal: g, mesyuarat: m, session_label: sessionLabel, turns } = bucket;

        if (turns.length < MIN_TURNS_PER_ISSUE) continue;

        // Skip if already computed for this (cluster, session) when not forcing
        if (!force) {
          const exists = await cacheCol.findOne(
            { pipeline_id: pipelineId, topic_cluster_id: clusterId, session_key: sessionKey },
            { projection: { _id: 1 } }
          );
          if (exists) { skipped++; continue; }
        }

        // Sort chronologically, cap length
        turns.sort((a, b) => {
          const ta = a.date ? a.date.getTime() : 0;
          const tb = b.date ? b.date.getTime() : 0;
          return ta - tb;
        });
        let capped = turns.slice(-MAX_TURNS_PER_ISSUE);
        this._assignConversationGroups(capped);
        // _filterAndValidateTurns = conversation filter + excerptQualityValidator
        // In mode=llm: GPT also FIXES spelling/OCR/cut-off sentences before storing
        capped = await this._filterAndValidateTurns(capped, topicKeywords);

        const distinctMPs  = new Set(capped.map(t => t.mp_name).filter(Boolean)).size;
        const validDates   = capped.map(t => t.date).filter(Boolean);
        const latestDate   = validDates.length > 0
          ? new Date(Math.max(...validDates.map(d => d.getTime()))) : null;
        const earliestDate = validDates.length > 0
          ? new Date(Math.min(...validDates.map(d => d.getTime()))) : null;

        // Use TF-IDF to find the terms most distinctive to THIS session
        // (words common across all sessions of the cluster score near zero).
        const generatedTitle = this._titleFromTfIdf(tfidfMap.get(sessionKey));
        const issueTitle   = generatedTitle || baseTitle;
        const issueTitleMs = generatedTitle || baseTitleMs;
        const category     = this._inferCategory(topicKeywords);
        const generatedDescription = this._generateTopicDescription({
          title:            issueTitle,
          category,
          statement_count: capped.length,
          mp_count:        distinctMPs,
          doc_count:       objIds.length,
          timeline:        capped,
        });
        const finalDescription = (generatedDescription && generatedDescription.trim())
          ? generatedDescription.trim()
          : description;

        const issueDoc = {
          pipeline_id:      pipelineId,
          topic_cluster_id: clusterId,
          session_key:      sessionKey,
          session_label:    sessionLabel,
          parlimen:         p || null,
          penggal:          g || null,
          mesyuarat:        m || null,
          cluster_label:    baseTitle,       // broad topic badge (e.g. "Coalition Affairs")
          cluster_label_ms: baseTitleMs,
          title:            issueTitle,      // session-specific title from turn keywords
          title_ms:         issueTitleMs,
          description:      finalDescription,
          category,
          keywords:         topicKeywords,
          label_quality:    labelQuality,    // overwritten below by content validation
          earliest_date:    earliestDate,
          latest_date:      latestDate,
          statement_count:  capped.length,
          mp_count:         distinctMPs,
          doc_count:        objIds.length,
          computed_at:      new Date(),
          timeline:         capped,
        };
        issueDoc.label_quality = this._computeIssueQuality(issueDoc);

        await cacheCol.replaceOne(
          { pipeline_id: pipelineId, topic_cluster_id: clusterId, session_key: sessionKey },
          issueDoc,
          { upsert: true }
        );

        processed++;
        console.log(
          `[Precompute]   cluster ${String(clusterId).padEnd(4)} ` +
          `[${sessionKey}] "${issueTitle.substring(0, 50)}" ` +
          `turns=${capped.length} MPs=${distinctMPs}`
        );
      } // end sessionBuckets loop
    } // end topics loop

    console.log(
      `[Precompute] ${pipelineId} finished: ` +
      `processed=${processed} skipped=${skipped}`
    );

    // Final pass: recompute all titles using pipeline-level TF-IDF.
    // This is strictly better than within-cluster IDF because the corpus is
    // the full pipeline (hundreds of sessions), so words like "Berhormat"
    // that appear across ALL sessions get IDF ≈ 0 with no stopword list needed.
    if (processed > 0) {
      console.log(`[Precompute] Running pipeline-level title refresh...`);
      const titleResult = await this.refreshTitles(pipelineId);
      console.log(`[Precompute] Titles updated: ${titleResult.updated} / ${titleResult.total}`);
    }

    return { processed, skipped };
  }

  /**
   * Recompute titles for all issues of a pipeline using pipeline-level TF-IDF.
   *
   * The corpus = every Topic document for this pipeline.
   * IDF(term) = log( (N+1) / (df+1) )  where N = total docs, df = docs containing term.
   *
   * Words common across many sessions score near zero automatically — no stopword
   * list is required, though we still strip obvious boilerplate for speed.
   *
   * @param {string} pipelineId
   * @returns {Promise<{updated: number, total: number}>}
   */
  async refreshTitles(pipelineId) {
    const db  = await this._getDb();
    const col = db.collection(CACHE_COLLECTION);
    const MAX_PHRASE_WORDS_PER_TURN = 24;
    const MIN_PHRASE_COUNT_PER_DOC = 2;
    const MAX_PHRASES_PER_DOC = 40;

    const NOISE = new Set([
      // Basic Malay function words
      'yang', 'dan', 'ini', 'itu', 'untuk', 'dengan', 'tidak', 'ada', 'dalam',
      'pada', 'dari', 'akan', 'telah', 'boleh', 'juga', 'adalah', 'oleh', 'atau',
      'kepada', 'saya', 'kita', 'kami', 'mereka', 'beliau', 'dia', 'tuan', 'puan',
      'bahawa', 'kerana', 'jika', 'maka', 'tetapi', 'namun', 'sudah', 'sedang',
      'lebih', 'setiap', 'bagi', 'masa', 'semua', 'lain', 'sama', 'hanya',
      // Basic English function words
      'the', 'and', 'for', 'this', 'that', 'with', 'have', 'will', 'been',
      'said', 'has', 'were', 'from', 'also', 'more', 'when', 'than', 'are',
      'not', 'but', 'they', 'their', 'which', 'into', 'about', 'here', 'there',
      // Month names (temporal markers, not policy topics)
      'januari', 'februari', 'april', 'julai', 'ogos', 'oktober', 'november', 'disember',
      'january', 'february', 'march', 'july', 'august', 'october', 'december',
      // Garbled "Yang Berhormat" / honorific OCR variants and name fragments
      'berhormat', 'berbormat', 'serhormat', 'berhorman', 'berhonnat',
      'yangbe', 'yangb', 'yanbge', 'yangber', 'tuanp', 'enger', 'enguesr', 'tuany', 'tuayna', 'idak',
      'juhar', 'hajijuhar', 'hajijamaluddin', 'datukhaji', 'datukhajijuhar', 'datupke',
      // Parliamentary honorific / names (not policy topics)
      'dato', 'haji', 'datuk', 'datok', 'almarhum', 'raja', 'hamid', 'amin',
      // Known OCR garbage / meaningless tokens
      'berdir', 'koperas', 'nourambelmeb', 'keraj', 'rumahk', 'tidakj', 'tuapne', 'bagnun',
      'saymai', 'timbalamnc', 'behrorm', 'ahinad', 'nubuh', 'sekaran', 'maksupd', 'anggapreamnb',
      'perdanmae', 'kepadanyoal', 'begibtaun', 'penge', 'rumahk', 'yanbge', 'bangun', 'enguesr',
      'apakaphi', 'pertu', 'haij', 'paragraph', 'tuanp',
      // Parliamentary boilerplate
      'pertua', 'pengerusi', 'speaker', 'dipertua', 'menteri',
      // Greetings / procedural (never valid as issue titles)
      'terima', 'kasih', 'thank', 'sokong', 'setuju', 'baik',
      // Discourse/filler connectives (not policy nouns)
      'berikut', 'sebanyak', 'sebagai', 'iaitu', 'termasuk', 'misalnya',
      'semasa', 'antara', 'seperti', 'seramai', 'sejumlah', 'setelah',
      'sebelum', 'selain', 'seiring', 'berjumlah', 'melalui', 'berkaitan',
      'berhubung', 'mengenai', 'berkenaan', 'sehingga', 'sekitar',
      'sementara', 'kemudian', 'selanjutnya', 'akhirnya',
      // Single-word generic verbs/prepositions that leak through
      'sebut', 'tentang', 'lain', 'sama', 'atas', 'bawa', 'cara',
      // Common English action verbs (poor topic titles)
      'make', 'made', 'take', 'took', 'give', 'gave', 'said', 'done', 'went',
      // Misc recurring noise words
      'clan', 'rang', 'tang',
      // OCR concatenations / garbled tokens that slip through keyword extraction
      'unclang', 'mempasti', 'yangdi',
      // Person name fragments not handled by NAME_LIKE (single-word forms)
      'ariff', 'tamby', 'rafizi', 'muhyiddin', 'hishammuddin', 'khairy', 'najib',
      'mahathir', 'anwar', 'azmin', 'shahidan', 'zahid',
      // Constituency names used as stand-alone title words (not meaningful as policy topics)
      'besut', 'indera', 'renggam', 'pandan',
    ]);
    const isNoiseWord = w => w.length < 4 || NOISE.has(w) || /^\d+$/.test(w) || /^(19|20)\d{2}$/.test(w);
    // A multi-word term is noise if ANY component word is noise
    const isNoise = term => term.split(' ').some(isNoiseWord);

    // Helper: tokenise a text excerpt into clean words
    const tokenise = text =>
      (text || '')
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => !isNoiseWord(w));

    // Load keywords (unigrams) + text excerpts (for phrase extraction) + cluster label
    const docs = await col.find(
      { pipeline_id: pipelineId },
      { projection: { _id: 1, cluster_label: 1, 'timeline.keywords': 1, 'timeline.text_excerpt': 1 } }
    ).toArray();

    const N = docs.length;
    if (N === 0) return { updated: 0, total: 0 };

    // Load MP name tokens once; enrich NOISE immediately, NAME_LIKE after its declaration below
    const mpNameTokens = await this._loadMpNameTokens();
    mpNameTokens.forEach(t => NOISE.add(t));

    // Step 1 — TF per doc: unigrams from keywords + a bounded set of repeated bigrams
    // from text excerpts. Without pruning, pipeline-wide DF can explode on OCR-heavy
    // corpora because almost every extracted phrase is unique.
    const docTf = new Map();
    for (const doc of docs) {
      const tf = new Map();
      const phraseTf = new Map();
      for (const turn of (doc.timeline || [])) {
        // Unigrams from stored keywords
        for (const kw of (turn.keywords || [])) {
          const w = kw.toLowerCase().trim();
          if (!isNoiseWord(w)) tf.set(w, (tf.get(w) || 0) + 1);
        }
        // Bigrams from text excerpt (actual adjacency in source text), bounded so
        // a single long excerpt cannot flood the pipeline-level DF map.
        const words = tokenise(turn.text_excerpt).slice(0, MAX_PHRASE_WORDS_PER_TURN);
        for (let i = 0; i < words.length - 1; i++) {
          const bigram = `${words[i]} ${words[i + 1]}`;
          if (!isNoise(bigram) && this._isValidWord(bigram)) {
            phraseTf.set(bigram, (phraseTf.get(bigram) || 0) + 1);
          }
        }
      }

      const frequentPhrases = [...phraseTf.entries()]
        .filter(([, count]) => count >= MIN_PHRASE_COUNT_PER_DOC)
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_PHRASES_PER_DOC);
      for (const [phrase, count] of frequentPhrases) {
        tf.set(phrase, count);
      }

      docTf.set(doc._id.toString(), tf);
    }

    // Step 2 — DF (pipeline-level: how many Topic docs contain this term)
    const df = new Map();
    for (const tf of docTf.values()) {
      for (const term of tf.keys()) {
        df.set(term, (df.get(term) || 0) + 1);
      }
    }

    const cap = w =>
      w.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

    // Words that look like person names / honorifics — if title is "X Y" and both in this set, use cluster_label
    const NAME_LIKE = new Set([
      'juhar', 'hamid', 'raja', 'amin', 'dato', 'datuk', 'haji', 'tun', 'tan', 'sri', 'puan', 'datin',
      'mahathir', 'anwar', 'najib', 'abdul', 'ahmad', 'mohamad', 'muhamad', 'ibrahim', 'ismail',
      'salleh', 'aziz', 'shafie', 'hasan', 'hussein', 'khairy', 'hishammuddin', 'zahid', 'mahfuz',
      'lim', 'guan', 'kit', 'siong', 'keat', 'nik', 'azmin', 'karpal', 'johar',
      'vijandran', 'daud', 'shahidan', 'idris', 'jamil', 'jamaluddin', 'badruddin', 'amiruldin',
      'chandra', 'chia', 'eric', 'patto', 'frusis', 'encik', 'chee', 'chong', 'dominic', 'joseph',
      'bakar', 'dakar', 'abang', 'siti', 'zaharah', 'paduka', 'hajah', 'bani', 'akbarkhan',
      'tuany', 'tuanp', 'enger', 'yangbe', 'yanbge', 'hanafiah', 'nilam', 'shah', 'junaidi',
      // Additional person name fragments
      'ariff', 'tamby', 'rafizi', 'muhyiddin', 'mukhriz', 'kadir', 'vijay', 'zulkifli',
      // Constituency names — prevent "Besut Kuala", "Gombak Renggam" etc from being titles
      'besut', 'indera', 'gombak', 'renggam', 'pandan', 'ampang', 'seremban', 'bentong',
    ]);
    // Dynamically add live MP name tokens from the Mp collection
    mpNameTokens.forEach(t => NAME_LIKE.add(t));

    // Step 3 — Score each doc, pick best valid term(s), bulk-update
    const bulkOps = [];
    for (const doc of docs) {
      const tf = docTf.get(doc._id.toString());
      if (!tf || tf.size === 0) continue;

      // OCR quality gate: count how many distinct valid unigrams this session has.
      // Very low count → the source text is garbled OCR; fall back to cluster label.
      const validUnigramCount = [...tf.keys()]
        .filter(term => !term.includes(' ') && !isNoise(term) && this._isValidWord(term))
        .length;
      if (validUnigramCount < 3) {
        const fallback = doc.cluster_label || null;
        if (fallback) {
          bulkOps.push({
            updateOne: { filter: { _id: doc._id }, update: { $set: { title: fallback, title_ms: fallback } } },
          });
        }
        continue;
      }

      // Rank all terms by TF-IDF, then keep only linguistically valid ones.
      // Phrases (bigrams/trigrams) get a score boost: a coherent phrase from the actual
      // text is more meaningful than two independently chosen words.
      const scored = [...tf.entries()]
        .map(([term, count]) => {
          const idf = Math.log((N + 1) / ((df.get(term) || 0) + 1));
          const wordCount = term.split(' ').length;
          const phraseBoost = wordCount === 2 ? 1.8 : wordCount >= 3 ? 1.4 : 1.0;
          return [term, count * idf * phraseBoost];
        })
        .filter(([, score]) => score > 0)
        .sort((a, b) => b[1] - a[1])
        .filter(([w]) => !isNoise(w) && this._isValidWord(w));

      let newTitle;
      if (scored.length === 0) {
        newTitle = doc.cluster_label || null;
      } else {
        const [topTerm, topScore] = scored[0];
        if (topScore < 1.0) {
          // Nothing distinctive enough — fall back to cluster label
          newTitle = doc.cluster_label || null;
        } else if (topTerm.includes(' ')) {
          // Already a coherent phrase from actual text adjacency — use directly
          newTitle = cap(topTerm);
        } else {
          // Single best word: add a second only when it is ≥ 25% as distinctive
          const useSecond =
            scored.length >= 2 &&
            !scored[1][0].includes(' ') &&
            scored[1][1] >= topScore * 0.25;
          newTitle = useSecond
            ? `${cap(topTerm)} ${cap(scored[1][0])}`
            : cap(topTerm);
        }
      }

      // If title looks like "PersonName PersonName", prefer cluster_label
      if (newTitle && doc.cluster_label) {
        const parts = newTitle.split(/\s+/);
        if (parts.length === 2) {
          const [a, b] = parts.map(p => p.toLowerCase());
          if (NAME_LIKE.has(a) && NAME_LIKE.has(b)) newTitle = doc.cluster_label;
        }
      }

      if (newTitle) {
        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { title: newTitle, title_ms: newTitle } },
          },
        });
      }
    }

    if (bulkOps.length > 0) {
      await col.bulkWrite(bulkOps, { ordered: false });
    }

    return { updated: bulkOps.length, total: N };
  }

  /**
   * Incremental update: Add new documents from recent mesyuarat to existing topics.
   * 
   * Strategy:
   * 1. Find mesyuarat that haven't been processed yet (based on date ranges)
   * 2. For each mesyuarat, find documents in that date range
   * 3. Use hansard_inference to get cluster assignments for these new docs
   * 4. Append new turns to existing topic timelines
   * 5. Update topic stats (latest_date, statement_count, etc.)
   * 
   * @param {string} pipelineId - Pipeline ID (e.g., 'pipeline5')
   * @param {Date|null} sinceDate - Only process mesyuarat after this date (default: last computed date)
   * @returns {Promise<{updated: number, newMesyuarat: number}>}
   */
  async incrementalUpdate(pipelineId, sinceDate = null) {
    const db = await this._getDb();
    console.log(`\n[Incremental Update] ── ${pipelineId} ──────────────────────────────────`);

    const inferenceCol = db.collection('hansard_inference');
    const cacheCol     = db.collection(CACHE_COLLECTION);
    const isRaw        = RAW_PIPELINES.has(pipelineId);
    const srcColName   = isRaw ? 'hansard_segmented' : 'hansard_cpatf';
    const srcCol       = db.collection(srcColName);

    // Load inference mapping
    const inference = await inferenceCol.findOne({ pipelineId });
    if (!inference) {
      const msg = `No inference document for ${pipelineId}`;
      console.warn(`[Incremental Update] ${msg}`);
      return { created: 0, skipped: 0, newSessions: 0, error: msg };
    }

    const rawDocIds      = inference.docIds   || [];
    const rawClusters    = inference.clusters || [];
    const clusterTopics  = inference.cluster_topics || {};
    const topicLabels    = inference.topic_labels   || {};

    // docId → clusterId lookup
    const docIdToCluster = new Map();
    rawDocIds.forEach((id, i) => {
      const cid = rawClusters[i];
      if (cid !== undefined && cid !== null) docIdToCluster.set(id.toString(), cid);
    });

    // Determine date threshold
    let thresholdDate = sinceDate;
    if (!thresholdDate) {
      const latestDoc = await cacheCol
        .find({ pipeline_id: pipelineId }, { projection: { latest_date: 1 } })
        .sort({ latest_date: -1 })
        .limit(1)
        .next();
      if (latestDoc && latestDoc.latest_date) {
        thresholdDate = latestDoc.latest_date;
        console.log(`[Incremental Update] Threshold: ${thresholdDate.toISOString().split('T')[0]}`);
      } else {
        console.log(`[Incremental Update] No existing topics, falling back to full precompute`);
        return await this.precompute(pipelineId, false);
      }
    }

    // Find distinct (parlimen, penggal, mesyuarat) sessions newer than threshold
    const dateField = isRaw ? 'hansardDate' : 'hansardDate';
    const matchStage = isRaw
      ? { parent_doc_id: { $exists: true } }
      : { _id: { $exists: true } };

    const newSessions = await srcCol.aggregate([
      { $match: {
          ...matchStage,
          hansardDate: { $gt: thresholdDate },
          parlimen:   { $exists: true, $ne: null },
          penggal:    { $exists: true, $ne: null },
          mesyuarat:  { $exists: true, $ne: null },
      }},
      { $group: {
          _id: { parlimen: '$parlimen', penggal: '$penggal', mesyuarat: '$mesyuarat' },
          count: { $sum: 1 },
      }},
      { $sort: { '_id.parlimen': 1, '_id.penggal': 1, '_id.mesyuarat': 1 } },
    ], { allowDiskUse: true }).toArray();

    if (newSessions.length === 0) {
      console.log(`[Incremental Update] No new sessions after ${thresholdDate.toISOString().split('T')[0]}`);
      return { created: 0, skipped: 0, newSessions: 0 };
    }
    console.log(`[Incremental Update] ${newSessions.length} new session(s) to process`);

    let created = 0;
    let skipped = 0;

    for (const sess of newSessions) {
      const { parlimen: p, penggal: g, mesyuarat: m } = sess._id;
      const sessionKey   = `P${p}_${g}_${m}`;
      const sessionLabel = `P${p} Penggal ${g} Mesyuarat ${m}`;

      // Find all doc _ids in this session
      const sessionDocsCursor = srcCol.find(
        { hansardDate: { $gt: thresholdDate }, parlimen: p, penggal: g, mesyuarat: m },
        { projection: { _id: 1 } }
      );
      const sessionDocIds = [];
      for await (const d of sessionDocsCursor) sessionDocIds.push(d._id);

      // Map docs to clusters
      const clusterToObjIds = new Map();
      for (const oid of sessionDocIds) {
        const cid = docIdToCluster.get(oid.toString());
        if (cid === undefined || cid === null) continue;
        if (!clusterToObjIds.has(cid)) clusterToObjIds.set(cid, []);
        clusterToObjIds.get(cid).push(oid);
      }

      if (clusterToObjIds.size === 0) {
        console.log(`[Incremental Update]   ${sessionKey}: no inference-mapped docs, skip`);
        continue;
      }

      for (const [cid, objIds] of clusterToObjIds) {
        const cidStr     = String(cid);
        const keywords   = clusterTopics[cidStr] || [];
        const label      = topicLabels[cidStr]    || {};
        const baseTitle  = label.name_en  || `Topic ${cid}`;
        const baseTitleMs = label.name_ms || `Topik ${cid}`;

        // Skip if this (cluster, session) already exists
        const existing = await cacheCol.findOne(
          { pipeline_id: pipelineId, topic_cluster_id: cid, session_key: sessionKey },
          { projection: { _id: 1 } }
        );
        if (existing) { skipped++; continue; }

        // Extract turns
        const turns = await this._extractTurnsForDocs(db, srcCol, isRaw, objIds, keywords);
        if (turns.length < MIN_TURNS_PER_ISSUE) { skipped++; continue; }

        turns.sort((a, b) => {
          const ta = a.date ? a.date.getTime() : 0;
          const tb = b.date ? b.date.getTime() : 0;
          return ta - tb;
        });
        let capped = turns.slice(-MAX_TURNS_PER_ISSUE);
        this._assignConversationGroups(capped);
        capped = this._filterAndCapConversations(capped);

        const distinctMPs  = new Set(capped.map(t => t.mp_name).filter(Boolean)).size;
        const validDates   = capped.map(t => t.date).filter(Boolean);
        const latestDate   = validDates.length > 0
          ? new Date(Math.max(...validDates.map(d => d.getTime()))) : null;
        const earliestDate = validDates.length > 0
          ? new Date(Math.min(...validDates.map(d => d.getTime()))) : null;

        // Incremental path: only one session available, use single-session TF-IDF
        // (treated as a 1-doc corpus — still removes stopwords and pure noise)
        const singleBucket = new Map([[sessionKey, { turns: capped }]]);
        const generatedTitle = this._titleFromTfIdf(
          this._buildSessionTfIdf(singleBucket).get(sessionKey)
        );
        const category = this._inferCategory(keywords);
        const issueTitle = generatedTitle || baseTitle;
        const generatedDescription = this._generateTopicDescription({
          title:            issueTitle,
          category,
          statement_count: capped.length,
          mp_count:        distinctMPs,
          doc_count:       objIds.length,
          timeline:        capped,
        });
        const finalDescription = (generatedDescription && generatedDescription.trim())
          ? generatedDescription.trim()
          : (label.description || '');

        const issueDoc = {
          pipeline_id:      pipelineId,
          topic_cluster_id: cid,
          session_key:      sessionKey,
          session_label:    sessionLabel,
          parlimen:         p,
          penggal:          g,
          mesyuarat:        m,
          cluster_label:    baseTitle,
          cluster_label_ms: baseTitleMs,
          title:            issueTitle,
          title_ms:         generatedTitle || baseTitleMs,
          description:      finalDescription,
          category,
          keywords,
          label_quality:    label.label_quality || 'medium', // overwritten by content validation
          earliest_date:    earliestDate,
          latest_date:      latestDate,
          statement_count:  capped.length,
          mp_count:         distinctMPs,
          doc_count:        objIds.length,
          computed_at:      new Date(),
          timeline:         capped,
        };
        issueDoc.label_quality = this._computeIssueQuality(issueDoc);

        await cacheCol.insertOne(issueDoc);
        created++;
        console.log(
          `[Incremental Update]   cluster ${String(cid).padEnd(4)} [${sessionKey}]` +
          ` "${issueDoc.title.substring(0, 45)}" turns=${capped.length}`
        );
      }
    }

    console.log(
      `\n[Incremental Update] ${pipelineId} done: ` +
      `created=${created} skipped=${skipped} sessions=${newSessions.length}`
    );
    return { created, skipped, newSessions: newSessions.length };
  }

  /**
   * Extract and build Turn objects for a list of source doc ObjectIds.
   * @private
   */
  async _extractTurnsForDocs(db, srcCol, isRaw, objIds, topicKeywords) {
    if (!objIds || objIds.length === 0) return [];

    const safeObjIds = objIds.map(id => {
      if (id instanceof ObjectId) return id;
      try { return new ObjectId(id); } catch { return null; }
    }).filter(Boolean);

    if (safeObjIds.length === 0) return [];

    const turns = [];
    const segmentTexts = []; // same order as turns, for optional XLM-RoBERTa sentiment

    if (isRaw) {
      const cursor = srcCol.aggregate([
        { $match: { parent_doc_id: { $in: safeObjIds } } },
        { $sort: { hansardDate: 1 } },
        { $project: {
            parent_doc_id: 1, hansardDate: 1,
            parlimen: 1, penggal: 1, mesyuarat: 1, parlimen_range: 1,
            segmentation_output: 1,
        }},
        { $unwind: '$segmentation_output' },
        { $project: {
            parent_doc_id: 1, hansardDate: 1,
            parlimen: 1, penggal: 1, mesyuarat: 1, parlimen_range: 1,
            speaker:  '$segmentation_output.speaker',
            party:    '$segmentation_output.constituency',
            seg_text: { $substrCP: [{ $ifNull: ['$segmentation_output.text', ''] }, 0, 2000] },
        }},
      ], { allowDiskUse: true });

      for await (const row of cursor) {
        let text = this._sanitizeExcerptText((row.seg_text || '').trim(), 2000);
        if (text.length < 30) continue;  // skip very short fragments
        if (!this._isRelevantTurn(text, topicKeywords)) continue;
        
        // Try to get better text from parent document if segment text is poor quality
        const betterText = await this._getBetterTextFromParent(
          db, row.parent_doc_id?.toString(), row.speaker, text, true
        );
        text = this._sanitizeExcerptText(betterText || text, 1200);
        
        // Final quality check after extraction - filter out if still poor quality
        if (!this._isRelevantTurn(text, topicKeywords)) continue;
        if (text.trim().length < 30) continue;
        
        segmentTexts.push(text);
        const docDate = row.hansardDate ? new Date(row.hansardDate) : null;
        let slabel = this._formatSession(row);
        if (!slabel && docDate) slabel = this._formatDateForSession(docDate);
        turns.push(this._buildTurn(
          row.parent_doc_id?.toString(), row.speaker, row.party,
          docDate, slabel, text, topicKeywords,
          row.parlimen, row.penggal, row.mesyuarat
        ));
      }
    } else {
      const cursor = srcCol.aggregate([
        { $match: { _id: { $in: safeObjIds } } },
        { $sort: { hansardDate: 1 } },
        { $project: {
            hansardDate: 1, speaker: 1, party: 1,
            parlimen: 1, penggal: 1, mesyuarat: 1, parlimen_range: 1,
            segments_cleaned: 1,
            cleaned_text: { $substrCP: [{ $ifNull: ['$cleaned_text', ''] }, 0, 2000] },
        }},
        { $unwind: { path: '$segments_cleaned', preserveNullAndEmptyArrays: true } },
        { $project: {
            hansardDate: 1, party: 1,
            parlimen: 1, penggal: 1, mesyuarat: 1, parlimen_range: 1,
            speaker:  { $ifNull: ['$segments_cleaned.speaker', '$speaker'] },
            seg_text: { $substrCP: [
              { $ifNull: ['$segments_cleaned.cleaned_text', '$cleaned_text'] }, 0, 2000
            ]},
        }},
      ], { allowDiskUse: true });

      for await (const row of cursor) {
        let text = this._sanitizeExcerptText((row.seg_text || '').trim(), 2000);
        if (text.length < 30) continue;  // skip very short fragments
        if (!this._isRelevantTurn(text, topicKeywords)) continue;
        
        // For P3-P6, try to get better text from parent document
        // Note: row._id is the parent doc ID for cleaned pipelines
        const betterText = await this._getBetterTextFromParent(
          db, row._id?.toString(), row.speaker, text, false
        );
        text = this._sanitizeExcerptText(betterText || text, 1200);
        
        // Final quality check after extraction - filter out if still poor quality
        if (!this._isRelevantTurn(text, topicKeywords)) continue;
        if (text.trim().length < 30) continue;
        
        segmentTexts.push(text);
        const docDate = row.hansardDate ? new Date(row.hansardDate) : null;
        let slabel = this._formatSession(row);
        if (!slabel && docDate) slabel = this._formatDateForSession(docDate);
        turns.push(this._buildTurn(
          row._id?.toString(), row.speaker, row.party,
          docDate, slabel, text, topicKeywords,
          row.parlimen, row.penggal, row.mesyuarat
        ));
      }
    }

    /**
     * OVERWRITE sentiment with XLM-RoBERTa zero-shot if Python service is available.
     * 
     * HOW XLM-RoBERTa WORKS:
     * 1. Model: joeddav/xlm-roberta-large-xnli (multilingual zero-shot NLI)
     * 2. Labels: ["positive", "negative", "neutral"]
     * 3. Process: Converts each label to hypothesis → "This text is positive/negative/neutral"
     * 4. NLI: Model scores entailment for each hypothesis → returns probability distribution
     * 5. Mapping: positive prob - negative prob → scaled to 0–100 (50 = neutral)
     * 
     * SCALE: 0–100
     *   - 0–44: Negative (red badge)
     *   - 45–69: Neutral  (amber badge)
     *   - 70–100: Positive (green badge)
     * 
     * FALLBACK: If service unavailable/fails → keeps keyword-based score from _computeSentiment()
     */
    if (segmentTexts.length > 0) {
      const scores = await sentimentService.getBatchSentiment(segmentTexts);
      if (scores && scores.length === turns.length) {
        let overwritten = 0;
        for (let i = 0; i < turns.length; i++) {
          const s = scores[i];
          if (typeof s === 'number' && s >= 0 && s <= 100) {
            turns[i].sentiment = Math.round(s * 100) / 100; // 2 decimal places
            overwritten++;
          }
        }
        if (overwritten > 0) {
          console.log(`[Precompute] Used XLM-RoBERTa sentiment for ${overwritten}/${turns.length} turns`);
        }
      } else {
        console.log(`[Precompute] Using keyword-based sentiment (XLM-RoBERTa service unavailable)`);
      }
    }

    return turns;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Try to get better text from parent HansardDocument.full_text if segment text is poor quality.
   * Falls back to segment text if parent doc not found or extraction fails.
   */
  async _getBetterTextFromParent(db, docId, speaker, segmentText, isRaw) {
    if (!docId || !speaker || !segmentText) return segmentText;
    const cleanSeg = segmentText.trim();
    
    // Check if segment text is poor quality (too short, repetitive, or meaningless)
    const isPoorQuality = 
      cleanSeg.length < 80 || // lowered threshold - more aggressive
      /^\.{1,5}$/.test(cleanSeg) || // just dots
      /^[^a-zA-Z\u0600-\u06FF]*$/.test(cleanSeg) || // no letters
      /^(.{1,10})\s*\1\s*\1/.test(cleanSeg) || // repetitive words (e.g., "sekejap sekejap sekejap")
      /^(baru|belum|terima kasih|sikit saja|dah sebut|ya|tak|okey|ok|ha|eh|ah)[\s.,]*$/i.test(cleanSeg) || // meaningless fragments
      /^(mic|speaker|suara)[\s\w]*(terberhenti|mati|berhenti)/i.test(cleanSeg) || // technical issues
      cleanSeg.length < 150 && /^(arau|pandan|sekejap)[\s.,]*$/i.test(cleanSeg); // very short with meaningless words

    // More aggressively try to get better text - only skip if text is clearly good
    if (!isPoorQuality && cleanSeg.length >= 250 && !cleanSeg.includes('..') && !cleanSeg.endsWith('.')) {
      return segmentText; // segment text seems good enough
    }

    try {
      const rawCol = db.collection(RAW_COLLECTION);
      // For both raw and cleaned pipelines, docId can be used to find parent document
      // For P1/P2: docId is parent_doc_id from hansard_segmented
      // For P3-P6: docId is _id from hansard_cpatf (which corresponds to HansardDocument._id)
      const parentDoc = await rawCol.findOne(
        { _id: new ObjectId(docId) },
        { projection: { full_text: 1 } }
      );
      if (!parentDoc?.full_text) return segmentText;

      const fullText = parentDoc.full_text || '';
      // Find speaker's turn in full_text - try multiple strategies
      const nameParts = speaker.replace(/\s*(YB|Tuan|Puan|Dato|Datuk|Dr|Tan Sri)\s*/gi, '').trim().split(/\s+/).filter(Boolean);
      let bestMatch = -1;
      
      // Strategy 1: Find speaker name parts
      for (const part of nameParts) {
        if (part.length < 3) continue;
        const idx = fullText.indexOf(part);
        if (idx !== -1 && (bestMatch === -1 || idx < bestMatch)) {
          bestMatch = idx;
        }
      }
      
      // Strategy 2: If no match, try finding common patterns like "YB Tuan X:" or "Tuan X:"
      if (bestMatch === -1) {
        const patterns = [
          new RegExp(`(?:YB\\s+)?(?:Tuan|Puan|Dato|Datuk|Dr|Tan Sri)\\s+${nameParts[nameParts.length - 1]}[^.]*:`, 'i'),
          new RegExp(`${nameParts[nameParts.length - 1]}[^.]*:`, 'i')
        ];
        for (const pattern of patterns) {
          const match = fullText.match(pattern);
          if (match) {
            bestMatch = fullText.indexOf(match[0]);
            break;
          }
        }
      }
      
      if (bestMatch === -1) return segmentText;

      // Extract a better excerpt: find the start of the speaker's statement
      // Look backwards from match to find sentence start or newline
      let start = bestMatch;
      const contextBefore = fullText.slice(Math.max(0, bestMatch - 200), bestMatch);
      const lastNewline = contextBefore.lastIndexOf('\n');
      const lastPeriod = contextBefore.lastIndexOf('.');
      if (lastNewline > lastPeriod) {
        start = bestMatch - 200 + lastNewline + 1;
      } else if (lastPeriod > -1) {
        start = bestMatch - 200 + lastPeriod + 1;
      } else {
        start = Math.max(0, bestMatch - 100);
      }

      // Extract full paragraph (up to 1000 chars for complete context)
      const excerpt = this._excerptFromSpeakerToPeriod(
        fullText.slice(start),
        speaker,
        1000
      );
      
      // Only use if it's significantly better (longer and more meaningful)
      if (excerpt.length > cleanSeg.length + 50 || (isPoorQuality && excerpt.length > 100)) {
        return excerpt;
      }
      
      return segmentText;
    } catch {
      return segmentText; // fallback to segment text
    }
  }

  /**
   * Extract full paragraph from speaker's turn, not just sentences ending with period.
   * Takes the entire speaker's statement until next speaker or natural break.
   * @param {string} text   - segment text (e.g. up to 1000 chars)
   * @param {string} speaker - MP name for locating start
   * @param {number} maxLen - max excerpt length (default 800 for full paragraphs)
   * @returns {string}
   */
  _excerptFromSpeakerToPeriod(text, speaker, maxLen = 800) {
    if (!text || typeof text !== 'string') return '';
    const t = text.trim();
    if (t.length === 0) return '';

    // Find start: where speaker name (or last name word) appears, so we skip "Yang Berhormat..." prefix
    let start = 0;
    if (speaker && typeof speaker === 'string') {
      const nameParts = speaker.replace(/\s*(YB|Tuan|Puan|Dato|Datuk|Dr|Tan Sri)\s*/gi, '').trim().split(/\s+/).filter(Boolean);
      for (const part of nameParts) {
        if (part.length < 3) continue; // skip "a/l", "bin"
        const idx = t.indexOf(part);
        if (idx !== -1 && idx < 400) { start = idx; break; }
      }
      // If no name found, try common prefix so we skip "YB Tuan X." and start from next sentence
      if (start === 0 && /^(\s*Yang\s+Berhormat\s+|\s*YB\s+|\s*Tuan\s+|\s*Puan\s+)/i.test(t)) {
        const afterPrefix = t.match(/^(\s*Yang\s+Berhormat\s+|\s*YB\s+|\s*Tuan\s+|\s*Puan\s+)[^.]*\./i);
        if (afterPrefix) start = Math.min(afterPrefix[0].length, t.length);
      }
    }

    const from = t.slice(start);
    if (from.length === 0) return t.slice(0, maxLen);

    // Extract full paragraph: look for natural breaks (newline, next speaker pattern, or maxLen)
    // Look for next speaker pattern (YB Tuan/Puan/Dato/etc.)
    const nextSpeakerPattern = /(\n\s*(?:Yang\s+Berhormat|YB|Tuan|Puan|Dato|Datuk|Dr|Tan Sri)\s+[^:]+:)/i;
    const nextSpeakerMatch = from.match(nextSpeakerPattern);
    
    if (nextSpeakerMatch && nextSpeakerMatch.index < maxLen) {
      // Found next speaker, extract up to that point
      return from.slice(0, nextSpeakerMatch.index).trim();
    }
    
    // Look for double newline (paragraph break)
    const doubleNewline = from.indexOf('\n\n');
    if (doubleNewline !== -1 && doubleNewline < maxLen) {
      return from.slice(0, doubleNewline).trim();
    }
    
    // Look for single newline followed by capital letter (likely next statement)
    const newlinePattern = /\n\s+[A-Z\u0600-\u06FF]/;
    const newlineMatch = from.match(newlinePattern);
    if (newlineMatch && newlineMatch.index < maxLen && newlineMatch.index > 100) {
      return from.slice(0, newlineMatch.index).trim();
    }
    
    // If no natural break found, take up to maxLen (full paragraph)
    return from.slice(0, maxLen).trim() || t.slice(0, maxLen);
  }

  /**
   * Returns true if the turn text is relevant to the topic (contains at least one keyword).
   * Prevents short procedural phrases and unrelated segments from cluttering the timeline.
   */
  _isRelevantTurn(text, topicKeywords = []) {
    if (!text) return false;
    const cleanText = this._sanitizeExcerptText(text, 1200).trim();
    const lower = cleanText.toLowerCase();
    
    // —— Filter out meaningless / unrelated segments (best selection for 500 fixed turns) ——
    if (cleanText.length < 30) return false;
    if (/^\.{1,10}$/.test(cleanText) || /^\.\.\.+$/.test(cleanText)) return false;
    if (/^(ya|tak|okey|ok|ha|eh|ah|um|er)[\s.,!?]*$/i.test(cleanText)) return false;
    if (/\b(mic|speaker|suara|audio|sound)\b.*\b(tak|tidak|tak\s*berfungsi|terberhenti|mati|berhenti|rosak)\b/i.test(lower)) return false;
    if (/\b(tak|tidak)\s*(berfungsi|berhenti).*(mic|speaker|suara)/i.test(lower)) return false;
    if (/mic\s+saya\s+(tak|tidak)/i.test(lower) && /berfungsi|berhenti|terputus/i.test(lower)) return false;
    if (/^\[.*\]$/.test(cleanText)) return false;
    if (/^(sekejap|baru|belum|sikit\s+saja|dah\s+sebut)[\s.,]*$/i.test(cleanText)) return false;
    if (/^(.{1,5})\s*\1\s*\1\s*\1/.test(cleanText)) return false;
    if (/^[^a-zA-Z\u0600-\u06FF]*\.{2,}\s*$/.test(cleanText)) return false;
    if (this._isProceduralOnlyText(cleanText)) return false;
    if (this._hasTooMuchOcrNoise(cleanText)) return false;

    // Honorific / procedural only – no substantive content
    if (/^(honorable|honourable)(\s+member)?[\s.,!?]*$/i.test(cleanText)) return false;
    if (/^(terima kasih)(\s+(tuan|puan|speaker|yang berhormat|dato|datuk|mr|madam))?[\s.,!?]*$/i.test(cleanText)) return false;
    if (/^(thank you)(\s+(tuan|puan|mr|madam|speaker))?[\s.,!?]*$/i.test(cleanText)) return false;
    if (/^(tuan|puan)\s+speaker[\s.,!?]*$/i.test(cleanText)) return false;
    if (/^(yang berhormat)\s+[^.]{0,60}[.\s!?]*$/i.test(cleanText) && cleanText.length < 85) return false; // YB + name/title only, no substance
    if (/^(\s*honorable\s+member\s*[,.\s!?]*)+$/i.test(cleanText)) return false;

    // Short turns (30–49 chars) with no question mark are likely procedural — require genuine question
    if (cleanText.length < 50 && !text.includes('?')) return false;

    // OCR-heavy turns: more than 70% of words are digit-only or very short → garbage
    const words = cleanText.split(/\s+/);
    const garbageWords = words.filter(w => /^\d+$/.test(w) || w.length <= 2 || /[{}@$%#^*_=<>|~`]/.test(w)).length;
    if (words.length >= 4 && garbageWords / words.length > 0.7) return false;
    
    // Genuine question with enough content
    if (text.includes('?') && cleanText.length >= 30) return true;
    
    if (topicKeywords.length === 0) return true;

    // Keyword relevance — filter out noisy/person-name keywords to avoid false positives
    const NOISY_KW_BASE = new Set([
      'vijandran', 'juhar', 'datukhajijuhar', 'unclang', 'mempasti', 'yangdi',
      'ariff', 'tamby', 'rahim', 'mahathir', 'najib', 'anwar', 'khairy', 'azmin',
    ]);
    // Check both sets directly — avoids copying 1471 tokens on every turn call
    const isNoisyKw = kw => NOISY_KW_BASE.has(kw) || (this._mpNameTokens && this._mpNameTokens.has(kw));
    const cleanKws = topicKeywords.filter(kw => kw && kw.length >= 4 && !isNoisyKw(kw.toLowerCase()));
    if (cleanKws.length === 0) {
      // All keywords are noisy; fall back to length-based relevance
      return cleanText.length >= 80;
    }
    return cleanKws.some(kw => lower.includes(kw.toLowerCase()));
  }

  /**
   * Classify speech turn type using RULE-BASED pattern matching (no ML).
   * Used for timeline labels only; not ground truth. Priority: escalate > ask > interjection > reply.
   *
   * HOW WE DETERMINE EACH TYPE (for reporting / teacher):
   * - Ask:    (1) Text contains "?"  OR  (2) Malay question words (adakah, apakah, ...)  OR
   *           (3) Explicit request phrases ("saya ingin bertanya", "boleh tuan jelaskan", "mohon penjelasan")  OR
   *           (4) English request ("can the minister explain", "please clarify").
   * - Interjection: ONLY procedural / acknowledgement phrases (terima kasih, sokong, setuju, yang berhormat, ...)
   *           OR very short procedural opener (e.g. "Ya tuan."). We do NOT use length alone.
   * - Escalate: Keywords for complaint/demand (escalat, aduan, protes, bantah, minta penjelasan segera).
   * - Reply:   Default (substantive answer or statement that didn’t match ask/interjection/escalate).
   */
  _classifyActionType(text) {
    if (!text) return 'reply';
    const t = text.trim();
    const lower = t.toLowerCase();

    // Escalate: urgent complaint/demand language
    if (/escalat|bangkitkan|aduan|protes|bantah|keberatan|minta penjelasan segera/i.test(t)) return 'escalate';

    // Ask: strong signals – question mark or explicit question/request phrases only
    if (t.includes('?')) return 'ask';
    if (/\b(adakah|apakah|bilakah|bagaimanakah|mengapakah|siapakah|berapakah|dimanakah|ke manakah)\b/i.test(t)) return 'ask';
    if (/\b(saya ingin bertanya|saya bertanya|boleh (tuan|puan|dato|datuk) (jelaskan|terangkan)|ingin mengetahui|mohon penjelasan|ingin tahu)\b/i.test(t)) return 'ask';
    if (/\b(can (the minister|he|she|you)|could (the minister|he|she)|would (the minister|he|she)|please (explain|clarify|state))\b/i.test(lower)) return 'ask';

    // Interjection: ONLY procedural / acknowledgement – no length-based guess
    const proceduralStart = /^(terima kasih|tuan speaker|yang berhormat|ya tuan|baik tuan|sokong|tidak sokong|setuju|tidak setuju|dengar|heard|saya setuju|saya sokong)[,.\s]/i;
    if (proceduralStart.test(t)) return 'interjection';
    // Very short procedural-only (e.g. "Ya tuan." "Setuju.") – must be mostly procedural words
    if (t.length <= 50 && /^(ya|tak|setuju|sokong|terima kasih|baik|dengar)[\s.,!?]*$/i.test(t)) return 'interjection';

    return 'reply';
  }

  /**
   * Compute issue content quality (high | medium | low) for validation.
   * Real parliamentary topics (cf. parlimen.gov.my, soalan lisan) have:
   * - Substantive titles (ministry, policy area, question subject), not just honorifics or names
   * - Enough substantive exchanges (multiple turns)
   * Marks as low when title is procedural-only, person-name-only, or timeline too thin.
   */
  _computeIssueQuality(issueDoc) {
    const title = (issueDoc.title || '').trim();
    const count = issueDoc.statement_count || 0;
    const lower = title.toLowerCase();

    // Low only when clearly procedural / thank-you / honorific-only or pure person name
    const proceduralOnly = /^(honorable|honourable|terima kasih|thank you|yang berhormat|tuan speaker|puan speaker)(\s+(member|tuan|puan|speaker|dato|datuk|mr|madam))?[\s.,!?]*$/i;
    const mostlyProcedural = /^(honorable|honourable|terima kasih|yang berhormat|tuan speaker)\b/i.test(title) && title.length < 50;

    if (title.length < 8) return 'low';
    if (proceduralOnly.test(title) || mostlyProcedural) return 'low';
    if (count < 5) return 'low';

    // Title is only honorific + person name (e.g. "YB Dato' Ahmad") – not a real topic
    const honorificPlusName = /^(YB|Yang Berhormat|Tuan|Puan|Dato'?|Datuk|Dr\.?|Tan Sri)\s+[\w\s.]{1,60}$/i.test(title) && title.length < 55;
    const substantiveKeyword = /\b(soalan|question|kementerian|ministry|pendidikan|education|policy|dasar|belanjawan|budget|ekonomi|economy|kesihatan|health|undang|act|akta|isu|issue|tentang|about|hospital|suruhanjaya|commission|guru|tambahan|sekolah|school|pelajaran|infrastruktur|infrastructure|jawapan|answer|menteri|minister|parlimen|parliament|dewan|rakyat|negara|padu|madani)\b/i.test(lower);
    if (honorificPlusName && !substantiveKeyword) return 'low';
    // Do NOT mark low just for short title or missing keyword – keeps meaningful topics (e.g. Padu Madani)

    const hasSubstance = title.length >= 15 && !/^(honorable|honourable|terima kasih|thank you|yang berhormat)\s*$/i.test(title);
    if (count >= 15 && hasSubstance) return 'high';
    return 'medium';
  }

  /**
   * Generate a short, accurate topic description from issue metadata and timeline content.
   * Used when precomputing so each topic has a consistent, readable description.
   * @param {Object} opts
   * @param {string} opts.title - Issue/topic title
   * @param {string} opts.category - Inferred category (e.g. Coalition & Government Affairs)
   * @param {number} opts.statement_count
   * @param {number} opts.mp_count
   * @param {number} opts.doc_count
   * @param {Array<{ text_excerpt?: string }>} opts.timeline - Turns with text_excerpt
   * @returns {string}
   */
  _generateTopicDescription(opts) {
    const { title, category, statement_count, mp_count, doc_count, timeline } = opts || {};
    const parts = [];

    // Sentence 1: theme (title + category)
    const theme = (title || '').trim();
    const cat = (category || '').trim();
    if (theme && cat) {
      parts.push(`Parliamentary discussions on "${theme}" under ${cat}.`);
    } else if (theme) {
      parts.push(`Parliamentary discussions on "${theme}".`);
    } else if (cat) {
      parts.push(`Parliamentary discussions under the theme of ${cat}.`);
    } else {
      parts.push('Parliamentary discussions recorded in this session.');
    }

    // Sentence 2: scale
    const st = Math.max(0, Number(statement_count) || 0);
    const mp = Math.max(0, Number(mp_count) || 0);
    const doc = Math.max(0, Number(doc_count) || 0);
    if (st > 0 || mp > 0 || doc > 0) {
      const scaleParts = [];
      if (st > 0) scaleParts.push(`${st} statement${st !== 1 ? 's' : ''}`);
      if (mp > 0) scaleParts.push(`${mp} MP${mp !== 1 ? 's' : ''}`);
      if (doc > 0) scaleParts.push(`${doc} source document${doc !== 1 ? 's' : ''}`);
      if (scaleParts.length) {
        parts.push(`This topic spans ${scaleParts.join(', ')}.`);
      }
    }

    // Optional: short excerpt from latest substantive turn (first ~140 chars, cleaned)
    const turns = Array.isArray(timeline) ? timeline : [];
    for (let i = turns.length - 1; i >= 0; i--) {
      const text = (turns[i].text_excerpt || '').trim();
      if (text.length < 40) continue;
      // Skip purely procedural openings
      if (/^(terima kasih|thank you|yang berhormat|tuan speaker|puan speaker|baik\.?|ya\.?)[\s.,!?]*$/i.test(text)) continue;
      let excerpt = text.replace(/\s+/g, ' ').trim();
      // Drop leading "YB Name — Session" style prefix if present
      excerpt = excerpt.replace(/^[^—]+—\s*/i, '').trim();
      if (excerpt.length < 30) continue;
      excerpt = excerpt.substring(0, 140);
      if (excerpt.length === 140) excerpt += '…';
      parts.push(`Recent debate content: ${excerpt}`);
      break;
    }

    return parts.join(' ');
  }

  /**
   * Assign conversation_group to each turn so the frontend can group one Q&A block.
   * Within one mesyuarat (same session), we increment group when we see an "Ask";
   * turns before the first Ask get group 0, first Ask + following replies get group 1, etc.
   */
  _assignConversationGroups(turns) {
    let groupId = 0;
    for (const turn of turns) {
      if (turn.action_type === 'ask') groupId++;
      turn.conversation_group = groupId;
    }
    return turns;
  }

  /** True if turn is substantive; false for meaningless interjection / procedural only. */
  _isMeaningfulTurn(turn) {
    const text = (turn.text_excerpt || '').trim();
    const lower = text.toLowerCase();
    if (text.length < 40) return false;
    if (/^\.{1,10}$/.test(text) || /^(ya|tak|okey|ok|ha|eh|ah)[\s.,!?]*$/i.test(text)) return false;
    if (/^(terima kasih|tuan speaker|yang berhormat|ya tuan|baik tuan|sokong|tidak sokong|setuju|tidak setuju)[,.\s]*$/i.test(text)) return false;
    if (/^(honorable|honourable)(\s+member)?[\s.,!?]*$/i.test(text)) return false;
    if (/^(terima kasih)(\s+(tuan|puan|speaker|yang berhormat|dato|datuk|mr|madam))?[\s.,!?]*$/i.test(text)) return false;
    if (/^(thank you)(\s+(tuan|puan|mr|madam|speaker))?[\s.,!?]*$/i.test(text)) return false;
    if (/^(tuan|puan)\s+speaker[\s.,!?]*$/i.test(text)) return false;
    if (/^(\s*honorable\s+member\s*[,.\s!?]*)+$/i.test(text)) return false;
    if (/^(yang berhormat)\s+[^.]{0,60}[.\s!?]*$/i.test(text) && text.length < 85) return false;
    if (/^(mic|speaker|suara).*(tak|tidak|berhenti|berfungsi)/i.test(lower)) return false;
    if (turn.action_type === 'interjection' && text.length < 60) return false;
    return true;
  }

  /**
   * Async wrapper around _filterAndCapConversations that additionally runs the
   * excerptQualityValidator on each turn's text_excerpt.
   *
   * Called from the precompute loop.  Falls back gracefully: if validation throws,
   * returns the conversation-filtered list without quality filtering.
   *
   * @param {object[]} turns          – turns for one session bucket
   * @param {string[]} topicKeywords  – topic cluster keywords (for relevance check)
   * @param {boolean}  verbose        – print rejected excerpts
   * @returns {Promise<object[]>}
   */
  async _filterAndValidateTurns(turns, topicKeywords = [], verbose = false) {
    // Step 1 – rule-based conversation filter (sync, unchanged)
    const conversationFiltered = this._filterAndCapConversations(turns);

    // Step 2 – quality validator (local always; API only when EXCERPT_VALIDATOR_MODE=api)
    try {
      const validated = await excerptValidator.fixAndFilterTurns(
        conversationFiltered,
        topicKeywords,
        { verbose }
      );
      // If validator stripped everything, fall back to the conversation-filtered list
      // so we don't accidentally produce empty issue cards.
      return validated.length > 0 ? validated : conversationFiltered;
    } catch (err) {
      console.warn('[IssuePortalService] _filterAndValidateTurns error (falling back):', err.message);
      return conversationFiltered;
    }
  }

  /**
   * Drop meaningless turns, then cap each conversation to MAX_TURNS_PER_CONVERSATION.
   * Does not truncate text; only drops whole turns. Re-assigns conversation_group after filter.
   */
  _filterAndCapConversations(turns) {
    const meaningful = turns.filter(t => this._isMeaningfulTurn(t));
    if (meaningful.length === 0) return turns;
    this._assignConversationGroups(meaningful);
    const byGroup = new Map();
    for (const t of meaningful) {
      const g = t.conversation_group ?? 0;
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g).push(t);
    }
    const out = [];
    const sortedGroups = [...byGroup.keys()].sort((a, b) => a - b);
    for (const g of sortedGroups) {
      const groupTurns = byGroup.get(g);
      out.push(...groupTurns.slice(0, MAX_TURNS_PER_CONVERSATION));
    }
    return this._mergeSingleTurnConversations(out);
  }

  /**
   * Merge any conversation that has only one turn into the previous (or next) group
   * so we never show "CONVERSATION X (1 turn)" in the UI.
   */
  _mergeSingleTurnConversations(turns) {
    if (turns.length <= 1) return turns;
    const byGroup = new Map();
    for (const t of turns) {
      const g = t.conversation_group ?? 0;
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g).push(t);
    }
    const sortedIds = [...byGroup.keys()].sort((a, b) => a - b);
    for (const g of sortedIds) {
      const list = byGroup.get(g);
      if (list.length !== 1) continue;
      const prev = byGroup.get(g - 1);
      const nextId = sortedIds.find(id => id > g);
      const next = nextId != null ? byGroup.get(nextId) : null;
      if (prev && prev.length > 0) {
        prev.push(list[0]);
        byGroup.set(g, []);
      } else if (next) {
        next.unshift(list[0]);
        byGroup.set(g, []);
      }
      // else: only one group with one turn, leave as-is
    }
    const out = [];
    let newId = 0;
    for (const g of sortedIds) {
      const list = byGroup.get(g);
      if (list.length === 0) continue;
      for (const t of list) {
        t.conversation_group = newId;
        out.push(t);
      }
      newId++;
    }
    return out;
  }

  /** Capitalize first letter and first letter after . ? ! for display. */
  _capitalizeSentences(str) {
    if (!str || typeof str !== 'string') return str;
    const s = str.trim();
    if (!s) return s;
    let needCap = true;
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (needCap && /[a-z]/.test(c)) {
        out += c.toUpperCase();
        needCap = false;
      } else {
        out += c;
        if (/[.!?]/.test(c)) needCap = true;
      }
    }
    return out;
  }

  // ─── Text quality helpers ─────────────────────────────────────────────────

  /**
   * True if text is purely procedural (adjournment, bill readings, festive greetings).
   * Delegates to excerptQualityValidator's richer pattern set.
   */
  _isProceduralOnlyText(text) {
    if (!text || typeof text !== 'string') return false;
    return excerptValidator.localQualityScore(text.trim()) < 10 &&
      // double-check it wasn't just very short
      text.trim().length >= 20;
  }

  /**
   * True if text has too many OCR corrupted tokens (symbols, truncated words, alpha-digit junk).
   * Uses the richer OCR_FRAGMENTS list from excerptQualityValidator.
   */
  _hasTooMuchOcrNoise(text) {
    if (!text || typeof text !== 'string') return true;
    const t = text.trim();
    if (!t) return true;
    // score < 35 covers both procedural AND heavy OCR noise
    return excerptValidator.localQualityScore(t) < 35;
  }

  /**
   * Clean a raw text excerpt:
   *   - Remove control characters
   *   - Strip stray symbol characters  (} @ $ % # ^ * _ | ~ ` \)
   *   - Remove OCR truncated word fragments (deng, sebaga, kemllit …)
   *   - Fix OCR split hyphenations  (word- nextline word → word-word)
   *   - Trim trailing procedural sentence (ditangguh …)
   *   - Truncate to maxLen
   */
  _sanitizeExcerptText(text, maxLen = 800) {
    if (!text || typeof text !== 'string') return '';

    // Only remove tokens that are completely unreadable garbage (not truncated Malay words).
    // Partial Malay words like "deng"/"dala"/"untu" are OCR column-split artefacts but still
    // intelligible — removing them makes statements look broken. Keep only truly garbled tokens.
    const BAD_FRAGMENTS = [
      'kemllit', 'tfutas', 'jiead', 'iead',
      'bersidangundangundang', 'ahliahli',
    ];

    let out = text
      // 1. control characters → space
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      // 2. OCR split-hyphen: "kata- \nnext" → "kata-next"
      .replace(/([A-Za-z\u0600-\u06FF])-\s+([A-Za-z\u0600-\u06FF])/g, '$1-$2')
      // 3. stray symbol chars → space (keep [ ] ( ) - which are valid)
      .replace(/[{}@$%#^*_=|~`\\]+/g, ' ')
      // 3b. ampersand-joined OCR artefacts: kemllit&ian → kemllit ian
      .replace(/([A-Za-z])&([A-Za-z])/g, '$1 $2')
      // 4. HTML entities that leaked through
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      // 5. replacement char
      .replace(/\uFFFD/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 6. Remove standalone bad-fragment tokens
    for (const frag of BAD_FRAGMENTS) {
      out = out.replace(new RegExp(`(?<![A-Za-z])${frag}(?![A-Za-z])`, 'gi'), ' ');
    }

    // 7. Tidy up spacing around punctuation
    out = out
      .replace(/\s+([,.;:!?…])/g, '$1')
      .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
      .replace(/\[\s+/g, '[').replace(/\s+\]/g, ']')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // 8. Trim trailing procedural tail (adjournment announcement appended to real content)
    const cutIdx = out.search(/\b(?:mesyuarat|persidangan|dewan(?:\s+ini)?)\b.{0,120}\bditangguh(?:kan)?\b/i);
    if (cutIdx >= 60) out = out.slice(0, cutIdx).replace(/[,.\s]+$/, '').trim();

    if (out.length > maxLen) out = `${out.slice(0, maxLen).trimEnd()}…`;
    return out;
  }

  /**
   * True if excerpt is safe to show in the UI (not empty, not procedural, not corrupted).
   * Synchronous — uses only local scoring (no API call).
   */
  _isDisplayableExcerpt(text) {
    if (!text || typeof text !== 'string') return false;
    const t = text.trim();
    if (t.length < 40) return false;
    return excerptValidator.localCheck(t).pass;
  }

  _buildTurn(docId, speaker, party, date, sessionLabel, text, topicKeywords, parlimen = null, penggal = null, mesyuarat = null) {
    // Extract full paragraph instead of just sentences
    const cleanedText = this._sanitizeExcerptText(text, 2000);
    const raw = this._excerptFromSpeakerToPeriod(cleanedText, speaker, 1500) || cleanedText.substring(0, 1500);
    const excerpt = this._sanitizeExcerptText(this._capitalizeSentences(raw), 1500);
    return {
      doc_id:        docId,
      mp_name:       speaker || 'Unknown',
      party:         party   || '',
      date,
      session_label: sessionLabel,
      text_excerpt:  excerpt,
      sentiment:     this._computeSentiment(cleanedText),
      keywords:      this._extractKeywords(cleanedText, topicKeywords),
      action_type:   this._classifyActionType(cleanedText),
      parlimen:      parlimen || null,
      penggal:       penggal || null,
      mesyuarat:     mesyuarat || null,
    };
  }

  _formatSession(doc) {
    if (doc.parlimen_range) return `Parlimen ${doc.parlimen_range}`;
    if (doc.parlimen && doc.penggal && doc.mesyuarat)
      return `P${doc.parlimen} Penggal ${doc.penggal} Mesyuarat ${doc.mesyuarat}`;
    if (doc.parlimen) return `Parlimen ${doc.parlimen}`;
    return '';
  }

  /** Format a date for use as session_label when doc has no parlimen/penggal. */
  _formatDateForSession(date) {
    if (!date || !(date instanceof Date)) return '';
    try {
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return date.toISOString().slice(0, 10);
    }
  }

  /**
   * Strip common hansard header lines from raw OCR/content so excerpt is closer to debate content.
   * Targets: "Bil. N", weekday names, "MALAYSIA", "PENYATA RASMI PARLIMEN", "DEWAN RAKYAT", date lines.
   */
  _stripRawHansardHeader(text) {
    if (!text || text.length < 30) return text || '';
    const lines = text.split(/\r?\n/);
    const skip = /^(Bil\.\s*\d+|\d+\s+(Isnin|Selasa|Rabu|Khamis|Jumaat|Sabtu|Ahad|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+\d+|MALAYSIA|PENYATA RASMI PARLIMEN|DEWAN RAKYAT|DEWAN NEGARA|\d{1,2}\s+(Januari|Februari|Mac|April|Mei|Jun|Julai|Ogos|September|Oktober|November|Disember|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})$/i;
    let start = 0;
    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      const line = lines[i].trim();
      if (line.length === 0) { start = i + 1; continue; }
      if (skip.test(line)) { start = i + 1; continue; }
      if (/^\d{1,2}\s+\w+\s+\d{4}$/.test(line)) { start = i + 1; continue; }
      break;
    }
    const body = lines.slice(start).join('\n').trim();
    return body.length >= 20 ? body : text;
  }

  /**
   * Try to extract first speaker name from raw hansard text (e.g. "Tuan X Y Z:" or "Puan A B:").
   * Used when HansardDocument has no speaker field (P1/P2 raw pipeline).
   */
  _extractSpeakerFromRawText(text) {
    if (!text || text.length < 10) return null;
    const m = text.match(/(?:Tuan|Puan|Yang berhormat)\s+([^:\n]+?)\s*:/i);
    if (m) return m[1].trim();
    const m2 = text.match(/(?:Datuk|Dato\'?|Dr\.?)\s+([^:\n]+?)\s*:/i);
    if (m2) return m2[1].trim();
    return null;
  }

  /**
   * FALLBACK: Keyword-based sentiment (positive/negative word list). Not an ML model.
   * 
   * HOW IT WORKS:
   * 1. Base score = 50.00 (true neutral; was 65 which made most text look "positive")
   * 2. Scan text for negative words → score -= 2.0 per match (stronger spread)
   * 3. Scan text for positive words → score += 2.0 per match
   * 4. Clamp to 25.00–75.00 so scores spread around neutral instead of clustering at 65
   * 5. Returns 2 decimal places
   * 
   * NOTE: This is ONLY used if XLM-RoBERTa service is unavailable.
   *       Run sentiment_zeroshot (Python) during precompute for ML-based scores.
   * 
   * SCALE: 0–100 (50=neutral). Frontend: < 45 = Negative, 45–69.99 = Neutral, ≥ 70 = Positive
   */
  _computeSentiment(text) {
    if (!text || text.length < 20) return 50.00;
    const lower = text.toLowerCase();
    const negative = [
      'tidak','bukan','tiada','gagal','masalah','krisis','ditolak','salah','lemah',
      'no ','not ','fail','problem','crisis','concern','reject','oppose','wrong',
      'bad','poor','decline','decrease','worse','against','disagree','opposition',
    ];
    const positive = [
      'berjaya','baik','positif','sokong','setuju','meningkat','bertambah','tegas',
      'success','good','positive','support','agree','improve','increase','achieve',
      'excellent','benefit','progress','growth','approve','welcome','commend',
    ];
    const step = 2.0;
    let score = 50.0;
    negative.forEach(p => { if (lower.includes(p)) score -= step; });
    positive.forEach(p => { if (lower.includes(p)) score += step; });
    const clamped = Math.max(25.0, Math.min(75.0, score));
    return Math.round(clamped * 100) / 100;
  }

  /**
   * Extract meaningful keywords from turn text (filters out noise/meaningless words).
   * 
   * HOW IT WORKS:
   * 1. Tokenize text → lowercase, remove punctuation, split by whitespace
   * 2. Filter: length > 3, not in STOPWORDS, not noise patterns
   * 3. Match against topicKeywords (from ML pipeline cluster labels):
   *    - If text contains ≥ 2 topic keywords → use ONLY matched keywords
   *    - Otherwise → use ALL words (fallback to frequency-based)
   * 4. Count frequency of each word in the selected pool
   * 5. Return top 3 most frequent MEANINGFUL words
   * 
   * FILTERS OUT:
   * - STOPWORDS (the, yang, dalam, etc.)
   * - Common verbs (meng-, meny-, diper-, di-, etc.)
   * - Name fragments (tuan, puan, yang berhormat, etc.)
   * - Numbers (pure digits)
   * - Single-letter or very short words (< 4 chars)
   * 
   * EXAMPLE:
   *   Text: "telah termaktub dalam perlembagaan."
   *   topicKeywords: ["perlembagaan", "hak", "undang-undang"]
   *   → Matches: "perlembagaan" (in topicKeywords)
   *   → Also finds: "termaktub" (frequent, meaningful noun)
   *   → Filters out: "telah" (verb), "dalam" (STOPWORD)
   *   → Returns: ["perlembagaan", "termaktub"] (top 2–3)
   */
  _extractKeywords(text, topicKeywords = []) {
    if (!text || text.length < 30) return [];

    // Noise patterns: common verb prefixes, name fragments, etc.
    const NOISE_PATTERNS = [
      /^(meng|meny|mem|men|me|diper|di|ter|ber|ke|se|pe|pen|peng|peny)/i, // verb prefixes
      /^(tuan|puan|yang|berhormat|dato|datuk|dr|dato|dato|tan|sri|tun)$/i, // name/honorific fragments
      /^\d+$/, // pure numbers
      /^[a-z]$/, // single letter
    ];

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => {
        if (w.length < 4) return false;
        if (STOPWORDS.has(w)) return false;
        if (NOISE_PATTERNS.some(p => p.test(w))) return false;
        return true;
      });

    if (words.length === 0) return [];

    const topicLower = topicKeywords.map(k => k.toLowerCase());
    const matched    = words.filter(w =>
      topicLower.some(tk => tk.includes(w) || w.includes(tk))
    );

    // Prefer topic-matched keywords; fall back to most-frequent words
    const pool = matched.length >= 2 ? matched : words;
    const freq = {};
    pool.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

    const sorted = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5); // get top 5, then filter again

    // Final filter: exclude if it's still noise (e.g., very common but meaningless)
    const MEANINGLESS = new Set(['yang', 'dalam', 'untuk', 'dengan', 'adalah', 'ini', 'itu', 'ada', 'telah']);
    return sorted
      .filter(([w]) => !MEANINGLESS.has(w))
      .slice(0, 3)
      .map(([w]) => w);
  }

  /**
   * Build a per-session TF-IDF word frequency map for all sessions of a cluster.
   *
   * "Documents" = individual session buckets.
   * TF  = count of term in this session's turn keywords.
   * IDF = log(totalSessions / sessionsContainingTerm + 1)
   *
   * Words that appear in every session (e.g. "Berhormat") get IDF ≈ 0.
   * Words that appear in only one session (e.g. "PTPTN") get the highest IDF.
   *
   * @param {Map} sessionBuckets  - the full map of session_key → bucket
   * @returns {Map<string, Map<string, number>>}  session_key → { term → tfidf_score }
   */
  _buildSessionTfIdf(sessionBuckets) {
    const STOPWORDS = new Set([
      // Basic Malay function words
      'yang', 'dan', 'ini', 'itu', 'untuk', 'dengan', 'tidak', 'ada', 'dalam',
      'pada', 'dari', 'akan', 'telah', 'boleh', 'juga', 'adalah', 'oleh', 'atau',
      'kepada', 'saya', 'kita', 'kami', 'mereka', 'beliau', 'dia', 'tuan', 'puan',
      'bahawa', 'kerana', 'jika', 'maka', 'tetapi', 'namun', 'sudah', 'sedang',
      'lebih', 'setiap', 'bagi', 'masa', 'semua', 'lain', 'sama', 'hanya',
      // Basic English function words
      'the', 'and', 'for', 'this', 'that', 'with', 'have', 'will', 'been',
      'said', 'has', 'were', 'from', 'also', 'more', 'when', 'than', 'are',
      'not', 'but', 'they', 'their', 'which', 'into', 'about', 'here', 'there',
      // Month names
      'januari', 'februari', 'april', 'julai', 'ogos', 'oktober', 'november', 'disember',
      'january', 'february', 'march', 'july', 'august', 'october', 'december',
      // Garbled "Yang Berhormat" OCR variants
      'berhormat', 'berbormat', 'serhormat', 'berhorman', 'berhonnat',
      // Parliamentary honorific titles (not policy topics)
      'dato', 'haji', 'datuk', 'datok', 'almarhum',
      // Parliamentary boilerplate
      'parliament', 'parlimen', 'minister', 'menteri', 'dewan', 'malaysia',
      'government', 'kerajaan', 'honourable', 'member', 'ahli',
      'affairs', 'hal', 'soal', 'perkara', 'matters', 'issue', 'issues',
      'policy', 'dasar', 'parliamentary', 'debates', 'debate', 'perbahasan',
      'okey', 'okay', 'baik', 'terima', 'kasih', 'setuju',
      'pertua', 'pengerusi', 'speaker', 'dipertua', 'menteri',
      'jawatankuasa', 'maksud', 'soalan', 'jawapan',
      'cadangan', 'pencadang', 'sokong', 'sembah', 'tinggi',
      // Discourse/filler connectives
      'berikut', 'sebanyak', 'sebagai', 'iaitu', 'termasuk', 'misalnya',
      'semasa', 'antara', 'seperti', 'seramai', 'sejumlah', 'setelah',
      'sebelum', 'selain', 'seiring', 'berjumlah', 'melalui', 'berkaitan',
      'berhubung', 'mengenai', 'berkenaan', 'sehingga', 'sekitar',
      'sementara', 'kemudian', 'selanjutnya', 'akhirnya',
      // Name/honorific fragments and OCR garbage (same as refreshTitles NOISE)
      'yangbe', 'yangb', 'yanbge', 'tuanp', 'enger', 'tuany', 'tuayna', 'idak',
      'juhar', 'hajijuhar', 'datukhaji', 'datupke', 'raja', 'hamid', 'amin',
      'berdir', 'koperas', 'nourambelmeb', 'keraj', 'rumahk', 'tidakj', 'tuapne', 'bagnun',
      'behrorm', 'saymai', 'timbalamnc', 'perdanmae', 'kepadanyoal', 'pertu', 'haij',
      // Single-word generic verbs/prepositions
      'sebut', 'tentang', 'cara',
      // Common English action verbs
      'make', 'made', 'take', 'took', 'give', 'gave', 'done', 'went',
      // Recurring noise words
      'clan', 'rang', 'tang',
      // OCR concatenations / garbled tokens
      'unclang', 'mempasti', 'yangdi', 'datukhajijuhar', 'datukhaji',
      // Person name fragments
      'ariff', 'tamby', 'rafizi', 'muhyiddin', 'khairy', 'najib', 'azmin',
      // Constituency names used as noise keywords
      'besut', 'indera', 'renggam', 'pandan', 'gombak',
    ]);

    const isNoise = w =>
      w.length < 4 || STOPWORDS.has(w) ||
      (this._mpNameTokens && this._mpNameTokens.has(w)) ||
      /^\d+$/.test(w) || /^(19|20)\d{2}$/.test(w);

    // Step 1: TF per session (raw count of each term across that session's turns)
    const sessionTf = new Map(); // session_key → Map<term, count>
    for (const [key, bucket] of sessionBuckets) {
      const tf = new Map();
      for (const turn of bucket.turns) {
        for (const kw of (turn.keywords || [])) {
          const w = kw.toLowerCase().trim();
          if (isNoise(w)) continue;
          tf.set(w, (tf.get(w) || 0) + 1);
        }
      }
      sessionTf.set(key, tf);
    }

    // Step 2: DF — number of sessions that contain each term
    const df = new Map();
    for (const tf of sessionTf.values()) {
      for (const term of tf.keys()) {
        df.set(term, (df.get(term) || 0) + 1);
      }
    }

    const N = sessionBuckets.size;

    // Step 3: TF-IDF per session
    const result = new Map();
    for (const [key, tf] of sessionTf) {
      const scores = new Map();
      for (const [term, count] of tf) {
        const idf = Math.log((N + 1) / ((df.get(term) || 0) + 1));
        scores.set(term, count * idf);
      }
      result.set(key, scores);
    }

    return result;
  }

  /**
   * Decide whether a word is linguistically valid enough to appear in an issue title.
   *
   * Filters out:
   *  - OCR garbage (garbled consonant clusters, impossible patterns)
   *  - Alphanumeric mixes from OCR (e.g. "Rrjp2", "28hb", "November1995")
   *  - OCR concatenations ("Datukhajijuhar", "Onourambelmeb")
   *  - Doubled-consonant OCR artifacts ("Berhonnat" nn, "Berhorrnat" rr)
   *  - Words with no vowel or extreme vowel ratio
   *
   * Allows:
   *  - Known 2–7 char all-caps acronyms (PTPTN, KWSP, FELDA, GST, etc.)
   *  - Normal Malay/English words with reasonable vowel structure
   *
   * @param {string} word
   * @returns {boolean}
   */
  _isValidWord(word) {
    if (!word || typeof word !== 'string') return false;
    const w = word.trim();
    if (!w) return false;

      // Multi-word phrase: every component word must be valid and no repeated words
      if (w.includes(' ')) {
        const parts = w.split(' ');
        if (new Set(parts).size !== parts.length) return false; // reject "Bohong Bohong"
        return parts.every(part => this._isValidWord(part));
      }

    if (w.length < 4) return false;

    // No digits: blocks "Rrjp2", "28hb", "November1995", "21oktober1996"
    if (/\d/.test(w)) return false;

    // Too long: OCR concatenations like "Datukhajijuhar", "Onourambelmeb"
    if (w.length > 18) return false;

    // All-caps 2–7 char: treat as acronym, almost always valid (PTPTN, KWSP, FELDA…)
    if (/^[A-Z]{2,7}$/.test(w)) return true;

    const lower = w.toLowerCase();

    // Hard blocklist: known OCR garbage / meaningless tokens (reject even if they pass rules below)
    const GARBAGE = new Set([
      'berdir', 'koperas', 'nourambelmeb', 'keraj', 'rumahk', 'tidakj', 'tuapne', 'bagnun',
      'saymai', 'timbalamnc', 'behrorm', 'ahinad', 'nubuh', 'maksupd', 'anggapreamnb', 'perdanmae',
      'kepadanyoal', 'begibtaun', 'penge', 'yanbge', 'apakaphi', 'pertu', 'haij', 'sekaran',
      'onourambelmeb', 'yangbe', 'yangber', 'tuanp', 'enger', 'enguesr', 'tuany', 'tuayna', 'idak',
      'datupke', 'rumahk', 'tuanp', 'peakesri', 'ustaphbai', 'perdanmae', 'yangbe', 'yangber',
      'begibtaun', 'anggapreamnb', 'maksupd', 'behrorm', 'yanbge', 'rumahk', 'tidakj', 'tuapne',
      'bagnun', 'timbalamnc', 'enguesr', 'apakaphi', 'pertu', 'haij', 'minisotfee', 'nourambelmeb',
      // OCR concatenations identified from cluster_topics
      'unclang', 'mempasti', 'yangdi', 'datukhajijuhar', 'datukhaji', 'hajijuhar',
      'hajijamaluddin', 'begibtaun', 'kepadanyoal', 'onourambelmeb',
    ]);
    if (GARBAGE.has(lower)) return false;

    // Must contain at least one vowel
    const vowelCount = (lower.match(/[aeiou]/g) || []).length;
    if (vowelCount === 0) return false;

    // Valid English consonant-cluster onsets
    const VALID_ONSETS = /^(bl|br|cl|cr|dr|fl|fr|gl|gr|pl|pr|sk|sl|sm|sn|sp|st|sw|tr|tw|wh|wr|sh|ch|th|ph|sc)/;

    // Vowel ratio bounds.
    // For short words (≤5 chars) WITHOUT a recognised English onset: require higher vowel density.
    // This catches OCR garbles like "Yangb" (ya-onset, ratio 0.20) while allowing
    // English proper nouns like "Trump" (tr-onset, ratio 0.20) or "Grant" (gr-onset).
    const ratio = vowelCount / lower.length;
    const minRatio = (lower.length <= 5 && !VALID_ONSETS.test(lower)) ? 0.35 : 0.20;
    if (ratio < minRatio || ratio > 0.72) return false;

    // No 4+ consecutive consonants: catches "Enchve" (nchv) etc.
    if (/[^aeiou]{4,}/i.test(lower)) return false;

    // Block words starting with a consonant pair that isn't a valid English/Malay onset
    if (/^[^aeiou][^aeiou]/i.test(lower) && !VALID_ONSETS.test(lower)) {
      return false; // catches "Ntukm", "Tlmbalan", "Mzah"
    }

    // Double-consonant OCR artifacts rare in Malay/English (not ff — valid in "tariff", "staff")
    if (/nn|rr|jj|kk/.test(lower)) return false; // catches "Berhonnat", "Berhorrnat"

    // Doubled vowels rare in Malay/English ("Saay" → aa, etc.)
    if (/aa|uu/.test(lower)) return false;

    // Suspicious trailing clusters typical of OCR merge tails
    if (/km$|tkm$|ndg$|ngd$/.test(lower)) return false; // catches "Untukm"

    // Block Malay verb prefix forms — these are verbs, not topic nouns
    // meny- prefix: menyokong, menyerang, menyambut
    if (/^meny/i.test(lower)) return false;
    // meng- prefix: mengurangkan, mengambil, menggunakan, mengundi
    if (/^meng/i.test(lower)) return false;
    // broader me- verb prefix (≥7 chars): memanggil, menetapkan, membuat, melakukan, memasang
    // safe: "member","mental","memory","merah" are < 7 chars; "mekanik"/"mekanisme" start "mek" not caught
    if (/^me[mnlrsgb]/i.test(lower) && lower.length >= 7) return false;
    // memper- / diper- prefix: mempersilakan, dipersilakan, dipertahankan
    if (/^memper/i.test(lower)) return false;
    if (/^diper/i.test(lower)) return false;
    // di- passive: di + consonant + vowel = passive verb
    // dibuat, dimatikan, disetujukan, dikurangkan, ditolak
    // safe: "dialog"=di+a (vowel not caught); "diskriminasi"=di+s+k (4th char consonant not vowel)
    if (lower.length >= 5 && /^di[^aeiou][aeiou]/i.test(lower)) return false;

    return true;
  }

  /**
   * Pick the highest-scoring valid TF-IDF terms for a session title.
   *
   * Uses 1 word if the second candidate isn't distinctive enough (< 25% of top score).
   * Returns null if no valid words found or all scores are too low (caller falls back).
   *
   * @param {Map<string, number>} tfidfScores  - term → score for this session
   * @returns {string|null}
   */
  _titleFromTfIdf(tfidfScores) {
    if (!tfidfScores || tfidfScores.size === 0) return null;

    const scored = [...tfidfScores.entries()]
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1]);

    // Filter to linguistically valid words only
    const valid = scored.filter(([w]) => this._isValidWord(w));
    if (valid.length === 0) return null;

    const [[topWord, topScore]] = valid;
    // Minimum score threshold — if even the best word is near-zero it's not distinctive
    if (topScore < 1.0) return null;

    const cap = w =>
      w.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

    let title;
    // Include 2nd word only if it is at least 25% as informative as the first
    if (valid.length >= 2) {
      const [secondWord, secondScore] = valid[1];
      if (secondScore >= topScore * 0.25) {
        title = `${cap(topWord)} ${cap(secondWord)}`;
      } else {
        title = cap(topWord);
      }
    } else {
      title = cap(topWord);
    }

    // Reject titles that are purely greetings/procedural (e.g. "Terima Kasih")
    const BAD_TITLE_PHRASES = new Set([
      'terima kasih', 'thank you', 'yang berhormat', 'tuan speaker', 'puan speaker',
      'sokong', 'setuju', 'baik tuan', 'ya tuan', 'dengar',
    ]);
    if (BAD_TITLE_PHRASES.has(title.toLowerCase().trim())) return null;
    if (/^(terima kasih|thank you|sokong|setuju|baik)[\s.,!?]*$/i.test(title)) return null;

    return title;
  }

  /**
   * Infer category (tech badge) from issue keywords. Rule-based: first regex match wins.
   * Categories can grow: add new patterns below; after precompute, distinct values in DB
   * are returned by GET /filters/:pipelineId and shown in the Category dropdown.
   */
  _inferCategory(keywords = []) {
    if (!keywords || keywords.length === 0) return 'Other';
    const str = keywords.join(' ').toLowerCase();

    // ─── Specific patterns first; use \b for short words to avoid substring false positives ───

    // Legal: \bact\b and \blaw\b so "action"/"allow" don't match; akta/undang/mahkamah are specific
    if (/\blegal\b|\blaw\b|\bact\b|akta|undang|mahkamah|hakim|justice|keadilan|court|tribunal|perundangan/.test(str)) return 'Legal';

    // Energy
    if (/energy|power|electric|tenaga|elektrik|nuklear|solar|petrol|gas|minyak|diesel/.test(str)) return 'Energy';

    // Water: \bair\b so "chairman"/"affair"/"Malaysia" don't match (Malay "air" = water)
    if (/water|bekalan\s+air|\bair\b|sungai|empangan|saliran|drainage/.test(str)) return 'Water';

    // Labor & Employment (before Economy so "gaji"/"pekerja" win over "trade")
    if (/labor|employment|pekerja|buruh|gaji|upah|tenaga kerja|pekerjaan|gaji minimum/.test(str)) return 'Labor';

    // Tourism
    if (/tourism|travel|pelancongan|pelancong|hotel|resort|visitor/.test(str)) return 'Tourism';

    // Culture: \bart\b so "parti" (party) doesn't match
    if (/culture|heritage|budaya|warisan|seni|\bart\b|museum|galeri/.test(str)) return 'Culture';

    // Sports
    if (/sport|sukan|olahraga|stadium|athlete|atlet/.test(str)) return 'Sports';

    // Youth: \byoung\b to avoid "younger" etc. matching too broadly
    if (/youth|belia|remaja|generasi muda|\byoung\b|teen/.test(str)) return 'Youth';

    // Gender & Women
    if (/women|gender|wanita|jantina|perempuan|female|equality/.test(str)) return 'Gender';

    // Religion
    if (/religion|islam|islamic|agama|masjid|halal|haji|zakat/.test(str)) return 'Religion';

    // Rural Development
    if (/rural|kampung|luar bandar|desa|village|countryside/.test(str)) return 'Rural Development';

    // Urban Development
    if (/urban|bandar|bandaraya|bandar raya|city|municipal/.test(str)) return 'Urban Development';

    // Foreign Affairs
    if (/foreign|diplomacy|luar negara|antarabangsa|duta|embassy|consulate/.test(str)) return 'Foreign Affairs';

    // State & Local Government — before Coalition so "negeri"/"menteri besar" get this, not Coalition
    if (/kerajaan negeri|menteri besar|\bmb\b|negeri\b|chief minister/.test(str)) return 'State & Local Government';

    // Coalition & Government Affairs — before Constitutional/Parliamentary so coalition topics don't get those
    if (/coalition|government affairs|pakatan|kerajaan|parti|gabungan|perikatan|pembangkang|barisan|memerintah|ahli parlimen/.test(str)) return 'Coalition & Government Affairs';

    // Constitutional (persekutuan/federal after Coalition so kerajaan persekutuan already matched above when kerajaan present)
    if (/constitution|perlembagaan|federal|persekutuan|constitutional/.test(str)) return 'Constitutional';

    // Parliamentary Affairs (narrow: procedural; "mesyuarat" appears everywhere so de-prioritised by putting after Coalition)
    if (/speaker|chairman|pengerusi|dewan negara|dewan rakyat|sitting|order of the house/.test(str)) return 'Parliamentary Affairs';

    // Housing — before Social so perumahan/rumah get Housing, not Social
    if (/perumahan|rumah mampu|affordable home|\brumah\b/.test(str)) return 'Housing';

    // Defence (military) before Security (police/civil) so tentera/angkatan get Defence
    if (/defence|defense|military|tentera|angkatan|veteran|armed forces|pertahanan/.test(str)) return 'Defence';

    // Security (police, civil security)
    if (/securit|police|polis|keselamatan awam|civil defence/.test(str)) return 'Security';

    // Telecommunications — before Technology; owns "internet" so tech policy vs infra clear
    if (/telecom|telekom|broadband|internet|5g|communication|komunikasi/.test(str)) return 'Telecommunications';

    // Primary categories
    if (/econom|budget|financ|tax|trade|business|kewangan|ekonomi|cukai|belanjawan|gdp|export|import/.test(str)) return 'Economy';
    if (/health|medic|hospital|clinic|covid|pandemic|kesihatan|ubat|penyakit|rawatan|doctor|nurse/.test(str)) return 'Health';
    if (/educat|school|universit|student|teacher|pendidikan|sekolah|pelajar|guru|learning|kurikulum/.test(str)) return 'Education';
    if (/environment|climat|green|sustain|pollution|alam|sekitar|hutan|iklim|recycle|waste/.test(str)) return 'Environment';
    if (/politic|election|democra|governan|politik|pilihan\s+raya|vote|ballot/.test(str)) return 'Politics';
    if (/technolog|digital|cyber|teknologi|komputer|software|ai\b|ict\b|inovasi/.test(str)) return 'Technology';
    if (/social|welfare|poverty|sosial|kebajikan|miskin|bantuan|elderly|disabled/.test(str)) return 'Social';
    if (/infrastructur|transport|road|railway|infrastruktur|pengangkutan|jalan|bas|train|highway|bridge/.test(str)) return 'Infrastructure';
    if (/agri|farm|food|pertanian|makanan|nelayan|ternakan|tanaman|crop|livestock|fishery/.test(str)) return 'Agriculture';

    // Parliamentary / legislative procedure
    if (/amend|pindaan|bill|rang undang|pindaan/.test(str)) return 'Legislative';
    if (/allocation|peruntukan|spending/.test(str)) return 'Budget';
    if (/soalan|jawapan|inquiry|question time/.test(str)) return 'Parliamentary Questions';
    if (/motion|usul|proposal|cadangan/.test(str)) return 'Motions';
    if (/committee|jawatankuasa|panel/.test(str)) return 'Committees';
    if (/audit|auditor|ketua audit/.test(str)) return 'Audit';
    if (/corruption|rasuah|integrity|integriti/.test(str)) return 'Anti-Corruption';
    if (/human rights|hak asasi|freedom\s+of/.test(str)) return 'Human Rights';
    if (/immigration|imigresen|passport|visa/.test(str)) return 'Immigration';
    if (/disaster|bencana|flood|banjir|earthquake|gempa/.test(str)) return 'Disaster Management';
    if (/cooperative|koperasi|coop/.test(str)) return 'Cooperatives';
    if (/insurance|insurans|takaful/.test(str)) return 'Insurance';
    if (/bank|banking|perbankan|loan|pinjaman|ptptn|kwsp|epf/.test(str)) return 'Banking & Finance';
    if (/science|sains|research|penyelidikan|innovation/.test(str)) return 'Science & Research';
    if (/media|berita|press|akhbar|journalism/.test(str)) return 'Media';
    if (/consumer|pengguna|consumerism|hak pengguna/.test(str)) return 'Consumer Affairs';
    if (/indigenous|orang asli|bumiputera|native/.test(str)) return 'Indigenous Affairs';
    if (/east malaysia|sabah|sarawak|borneo/.test(str)) return 'Sabah & Sarawak';

    return 'Other';
  }
}

module.exports = IssuePortalService;
