/**
 * Issue Portal routes
 *
 * Base path (registered in server.js): /api/issue-portal
 *
 * Public routes:
 *   GET  /topics/:pipelineId            – list view (timeline excluded)
 *   GET  /issue/:issueId                – detail view by MongoDB _id (timeline included)
 *   GET  /precompute/status             – precompute status for all pipelines
 *
 * Admin-only routes:
 *   POST /precompute/:pipelineId        – trigger precompute for one pipeline
 *   POST /precompute/:pipelineId/force  – force-recompute (overwrites existing)
 *
 * Legacy (kept for backward-compat):
 *   GET  /:pipelineId/:topicIdentifier  – get issue by cluster_id (or ObjectId string)
 */

'use strict';

const express  = require('express');
const router   = express.Router();
const { protectAdmin } = require('../middleware/adminAuthMiddleware');

const IssuePortalService = require('../services/issuePortalService');
const Mp = require('../models/Mp');
const ActivityLog = require('../models/ActivityLog');

const MONGO_URI = process.env.MONGO_URI;
const service   = new IssuePortalService(MONGO_URI);

// ─── Precompute status (public – useful for health checks) ────────────────────
router.get('/precompute/status', async (req, res) => {
  try {
    const status = await service.getPrecomputeStatus();
    res.json({ success: true, status });
  } catch (err) {
    console.error('[Issue Portal] /precompute/status error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Top issues (trending: statement_count + views from ActivityLog) ──────────
router.get('/top-issues/:pipelineId', protectAdmin, async (req, res) => {
  try {
    const { pipelineId } = req.params;
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const sortBy = (req.query.sort || 'trending').toLowerCase(); // 'trending' | 'statements' | 'views' | 'mp_count'

    const db = await service._getDb();
    // Fetch more candidates so we can re-sort by views/trending
    const candidateLimit = Math.max(limit * 3, 50);
    const topics = await db
      .collection('Topic')
      .find(
        { pipeline_id: pipelineId, label_quality: { $in: ['high', 'medium'] } },
        {
          projection: {
            _id: 1, title: 1, category: 1, statement_count: 1,
            mp_count: 1, label_quality: 1, keywords: 1,
            cluster_label: 1, session_label: 1, viewCount: 1,
          },
        }
      )
      .sort({ statement_count: -1 })
      .limit(candidateLimit)
      .toArray();

    // Aggregate view counts from ActivityLog (issue_view by metadata.resourceId = Topic _id)
    const viewCounts = await ActivityLog.aggregate([
      { $match: { action: 'issue_view' } },
      { $group: { _id: '$metadata.resourceId', views: { $sum: 1 } } },
    ]).exec();
    const viewsByIssueId = {};
    (viewCounts || []).forEach((row) => {
      const id = row._id != null ? String(row._id) : '';
      if (id) viewsByIssueId[id] = row.views || 0;
    });

    // Attach views: prefer Topic.viewCount (recorded on every detail view), else ActivityLog count
    const topicsWithViews = topics.map((t) => {
      const idStr = t._id ? t._id.toString() : '';
      const views = t.viewCount != null ? t.viewCount : (viewsByIssueId[idStr] || 0);
      const stmts = t.statement_count || 0;
      return {
        ...t,
        views,
        trendingScore: views + stmts,
      };
    });

    // Sort by requested field
    if (sortBy === 'views') {
      topicsWithViews.sort((a, b) => b.views - a.views);
    } else if (sortBy === 'mp_count') {
      topicsWithViews.sort((a, b) => (b.mp_count || 0) - (a.mp_count || 0));
    } else if (sortBy === 'statements') {
      topicsWithViews.sort((a, b) => (b.statement_count || 0) - (a.statement_count || 0));
    } else {
      // default: trending (trendingScore)
      topicsWithViews.sort((a, b) => b.trendingScore - a.trendingScore);
    }

    const result = topicsWithViews.slice(0, limit);
    res.json({ success: true, pipelineId, topics: result });
  } catch (err) {
    console.error('[Issue Portal] /top-issues error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Detailed precompute report (for admin ML performance dashboard) ────────
router.get('/precompute/report', protectAdmin, async (req, res) => {
  try {
    const report = await service.getPrecomputeReport();
    res.json({ success: true, report });
  } catch (err) {
    console.error('[Issue Portal] /precompute/report error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Default pipeline configuration (for user-facing Issue Portal) ────────
router.get('/default-pipeline', async (req, res) => {
  try {
    const config = await service.getDefaultPipeline();
    res.json({ success: true, pipeline_id: config.pipeline_id, include_low_quality: config.include_low_quality });
  } catch (err) {
    console.error('[Issue Portal] /default-pipeline error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/default-pipeline', protectAdmin, async (req, res) => {
  try {
    const { pipeline_id, include_low_quality } = req.body;
    if (!pipeline_id) {
      return res.status(400).json({ success: false, message: 'pipeline_id is required' });
    }
    const result = await service.setDefaultPipeline(pipeline_id, include_low_quality);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Issue Portal] POST /default-pipeline error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Recent statements by MP (for MP detail "Recent Parliamentary Activity") ─

/**
 * GET /api/issue-portal/mp/statements
 *
 * Returns recent issue-portal statements and computed performance for an MP.
 * Accepts name(s) directly — no MP DB lookup needed.
 *
 * Query params:
 *   name  (required) — MP name or full name with titles
 *   fullName (optional) — full_name_with_titles if different from name
 *   limit (optional, default 8, max 20)
 */
router.get('/mp/statements', async (req, res) => {
  try {
    const { name, fullName, parliamentTerm, limit: limitQ } = req.query;
    const limit = Math.min(20, Math.max(1, parseInt(limitQ, 10) || 8));

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: '"name" query param is required' });
    }

    const nameTrim = name.trim();
    const fullNameTrim = fullName ? fullName.trim() : '';

    const orClause = [
      { name: nameTrim },
      { full_name_with_titles: nameTrim },
    ];
    if (fullNameTrim && fullNameTrim !== nameTrim) {
      orClause.push({ name: fullNameTrim }, { full_name_with_titles: fullNameTrim });
    }
    const mpDoc = await Mp.findOne({ $or: orClause })
      .select('performance.attendanceRate performance.attendanceByTerm performance.responseRate performance.askRate performance.escalateRate performance.interjectionRate performance.sentimentScore performance.recentStatements original_name_variations')
      .lean();

    const precomputedAttendance =
      mpDoc?.performance?.attendanceByTerm?.length > 0 && typeof mpDoc.performance.attendanceRate === 'number'
        ? { rate: mpDoc.performance.attendanceRate, byTerm: mpDoc.performance.attendanceByTerm }
        : null;

    const extraVariations = Array.isArray(mpDoc?.original_name_variations)
      ? mpDoc.original_name_variations.map(n => (n || '').trim()).filter(n => n.length >= 2)
      : [];
    const nameVariants = [
      normalizeMpNameForLookup(name),
      fullName ? normalizeMpNameForLookup(fullName) : null,
      name.trim(),
      fullName ? fullName.trim() : null,
      ...extraVariations,
      ...extraVariations.map(normalizeMpNameForLookup),
    ].filter((n, i, arr) => n && n.length >= 2 && arr.indexOf(n) === i);

    const [statements, performance] = await Promise.all([
      service.getRecentStatementsForMp(nameVariants, limit, parliamentTerm || null),
      service.getPerformanceForMp(nameVariants, parliamentTerm || null, precomputedAttendance, null),
    ]);
    console.log(`[MP Statements] name="${name}" live aggregation statements=${statements.length}`);
    console.log(`[MP Statements] result: ${statements.length} statements, performance.attendanceRate=${performance?.attendanceRate}`);
    res.json({ success: true, statements, performance });
  } catch (err) {
    console.error('[Issue Portal] GET /mp/statements error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Refresh titles only (admin only) ────────────────────────────────────────

/**
 * POST /api/issue-portal/refresh-titles/:pipelineId
 *
 * Re-runs pipeline-level TF-IDF title generation on already-stored Topic docs.
 * Much faster than a full precompute — no source data re-fetch needed.
 */
router.post('/refresh-titles/:pipelineId', protectAdmin, async (req, res) => {
  const { pipelineId } = req.params;
  try {
    const result = await service.refreshTitles(pipelineId);
    res.json({ success: true, pipelineId, ...result });
  } catch (err) {
    console.error('[Issue Portal] /refresh-titles error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Trigger precompute (admin only) ─────────────────────────────────────────

/**
 * POST /api/issue-portal/precompute/:pipelineId
 * POST /api/issue-portal/precompute/:pipelineId/force
 *
 * Runs synchronously – may take a few minutes for large pipelines.
 * Protected: requires admin JWT.
 */
router.post('/precompute/:pipelineId/force', protectAdmin, async (req, res) => {
  const { pipelineId } = req.params;
  console.log(`[Issue Portal] Force-precompute requested: ${pipelineId}`);
  try {
    const result = await service.precompute(pipelineId, true);
    res.json({ success: true, pipelineId, ...result });
  } catch (err) {
    console.error('[Issue Portal] Precompute error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/precompute/:pipelineId', protectAdmin, async (req, res) => {
  const { pipelineId } = req.params;
  const force = req.query.force === 'true';
  console.log(`[Issue Portal] Precompute requested: ${pipelineId}, force=${force}`);
  try {
    const result = await service.precompute(pipelineId, force);
    res.json({ success: true, pipelineId, ...result });
  } catch (err) {
    console.error('[Issue Portal] Precompute error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Incremental update (admin only) ─────────────────────────────────────────

/**
 * POST /api/issue-portal/incremental-update/:pipelineId
 * 
 * Incrementally updates topics by adding new documents from recent mesyuarat.
 * Only processes mesyuarat that haven't been included yet (based on date threshold).
 * Protected: requires admin JWT.
 */
router.post('/incremental-update/:pipelineId', protectAdmin, async (req, res) => {
  const { pipelineId } = req.params;
  const sinceDate = req.body.since_date ? new Date(req.body.since_date) : null;
  console.log(`[Issue Portal] Incremental update requested: ${pipelineId}${sinceDate ? `, since: ${sinceDate.toISOString()}` : ''}`);
  try {
    const result = await service.incrementalUpdate(pipelineId, sinceDate);
    res.json({ success: true, pipelineId, ...result });
  } catch (err) {
    console.error('[Issue Portal] Incremental update error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Distinct sessions for a pipeline (for dropdown) ─────────────────────────

/**
 * GET /api/issue-portal/sessions/:pipelineId
 * Returns sorted list of distinct session labels across all issues for the pipeline.
 */
router.get('/sessions/:pipelineId', async (req, res) => {
  try {
    const { pipelineId } = req.params;
    const db = await service._getDb();
    const sessions = await db
      .collection('Topic')
      .distinct('session_label', { pipeline_id: pipelineId });
    sessions.sort();
    res.json({ success: true, sessions });
  } catch (err) {
    console.error('[Issue Portal] /sessions error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Distinct parlimen/penggal/mesyuarat for a pipeline (for filters) ─────────

/**
 * GET /api/issue-portal/filters/:pipelineId
 * Returns distinct parlimen, penggal, and mesyuarat values for filtering.
 */
router.get('/filters/:pipelineId', async (req, res) => {
  try {
    const { pipelineId } = req.params;
    const db = await service._getDb();
    const col = db.collection('Topic');

    // Distinct values for all filter dropdowns
    const [parlimenRaw, penggalRaw, mesyuaratRaw, categoryRaw, clusterLabelRaw] = await Promise.all([
      col.distinct('parlimen',      { pipeline_id: pipelineId }),
      col.distinct('penggal',       { pipeline_id: pipelineId }),
      col.distinct('mesyuarat',     { pipeline_id: pipelineId }),
      col.distinct('category',      { pipeline_id: pipelineId }),
      col.distinct('cluster_label', { pipeline_id: pipelineId }),
    ]);

    const nums = arr => [...new Set(arr)].filter(v => v != null).sort((a, b) => a - b);
    const strs = arr => [...new Set(arr)].filter(Boolean).sort((a, b) => String(a).localeCompare(b));

    res.json({
      success: true,
      filters: {
        parlimen:      nums(parlimenRaw),
        penggal:       nums(penggalRaw),
        mesyuarat:     nums(mesyuaratRaw),
        categories:    strs(categoryRaw),
        cluster_labels: strs(clusterLabelRaw),
      },
    });
  } catch (err) {
    console.error('[Issue Portal] /filters error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── List view ────────────────────────────────────────────────────────────────

/**
 * GET /api/issue-portal/topics/:pipelineId
 *
 * Returns all issues for the given pipeline.
 * The timeline field is excluded for performance.
 */
router.get('/topics/:pipelineId', async (req, res) => {
  try {
    const { pipelineId } = req.params;

    const opts = {
      session:            req.query.session            || null,
      category:           req.query.category          || null,
      cluster_label:      req.query.cluster_label     || null,
      quality:            req.query.quality           || null,
      includeLowQuality: req.query.includeLowQuality === 'true' || req.query.includeLowQuality === '1',
      parlimen:           req.query.parlimen ? parseInt(req.query.parlimen, 10) : null,
      penggal:            req.query.penggal ? parseInt(req.query.penggal, 10) : null,
      mesyuarat:          req.query.mesyuarat ? parseInt(req.query.mesyuarat, 10) : null,
    };
    console.log(`[Issue Portal] GET /topics/${pipelineId}`, opts);

    const topics = await service.getAllTopics(pipelineId, opts);

    console.log(`[Issue Portal] Returning ${topics.length} issues`);
    res.json({ success: true, count: topics.length, topics });
  } catch (err) {
    console.error('[Issue Portal] /topics error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Detail view by MongoDB _id ───────────────────────────────────────────────

/**
 * Normalize hansard speaker name for MP lookup (strip titles like Tuan, Puan, YB, etc.).
 */
function normalizeMpNameForLookup(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .replace(/\b(Yang\s+Berhormat|YB|Tuan|Puan|Dato'?|Datuk|Dr\.?|Tan\s+Sri)\s+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Enrich timeline turns with MP profilePicture and mp_id from MP collection.
 * Uses a single batched query instead of one per MP to avoid N round-trips.
 */
async function enrichTimelineWithMpProfiles(timeline) {
  if (!Array.isArray(timeline) || timeline.length === 0) return;
  const uniqueNames = [...new Set(timeline.map(t => t.mp_name).filter(Boolean))];
  if (uniqueNames.length === 0) return;

  const nameToRegex = new Map(); // rawName -> RegExp
  const orConditions = [];
  for (const rawName of uniqueNames) {
    const normalized = normalizeMpNameForLookup(rawName);
    if (normalized.length < 2) continue;
    const regex = new RegExp(escapeRegex(normalized), 'i');
    nameToRegex.set(rawName, regex);
    orConditions.push({ name: regex }, { full_name_with_titles: regex });
  }
  if (orConditions.length === 0) return;

  const mps = await Mp.find({ $or: orConditions })
    .select('name full_name_with_titles profilePicture mp_id')
    .lean();

  const nameToMp = new Map();
  for (const rawName of nameToRegex.keys()) {
    const regex = nameToRegex.get(rawName);
    const mp = mps.find(m =>
      (m.name && regex.test(m.name)) ||
      (m.full_name_with_titles && regex.test(m.full_name_with_titles))
    );
    if (mp) {
      nameToMp.set(rawName, {
        profilePicture: (mp.profilePicture && String(mp.profilePicture).trim()) ? mp.profilePicture : null,
        mp_id: mp.mp_id || null,
      });
    }
  }

  for (const turn of timeline) {
    if (turn.mp_name && nameToMp.has(turn.mp_name)) {
      const { profilePicture, mp_id } = nameToMp.get(turn.mp_name);
      if (profilePicture) turn.profilePicture = profilePicture;
      if (mp_id) turn.mp_id = mp_id;
    }
  }
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * POST /api/issue-portal/issue/:issueId/view
 *
 * Record a view (no auth). Increments Topic.viewCount so "By views" captures all visitors.
 */
router.post('/issue/:issueId/view', async (req, res) => {
  try {
    const { issueId } = req.params;
    await service.incrementIssueViewCount(issueId);
    res.json({ success: true });
  } catch (err) {
    console.error('[Issue Portal] POST /issue/:id/view error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/issue-portal/issue/:issueId
 *
 * Returns the full issue document including the timeline[] array.
 * issueId must be the MongoDB ObjectId string from issue_portal_issues.
 */
router.get('/issue/:issueId', async (req, res) => {
  try {
    const { issueId } = req.params;
    const issue = await service.getIssueById(issueId);

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: `Issue not found: ${issueId}`,
      });
    }

    if (issue.timeline && issue.timeline.length > 0) {
      await enrichTimelineWithMpProfiles(issue.timeline);
    }

    res.json({ success: true, issue });
  } catch (err) {
    console.error('[Issue Portal] /issue/:id error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Legacy: detail by pipelineId + cluster_id / ObjectId ────────────────────

/**
 * GET /api/issue-portal/:pipelineId/:topicIdentifier
 *
 * Kept for backward compatibility.
 * topicIdentifier can be:
 *   - a MongoDB ObjectId string  →  uses getIssueById
 *   - an integer string          →  looks up by topic_cluster_id
 */
router.get('/:pipelineId/:topicIdentifier', async (req, res) => {
  try {
    const { pipelineId, topicIdentifier } = req.params;

    let issue = null;

    // Try as ObjectId first
    if (/^[0-9a-fA-F]{24}$/.test(topicIdentifier)) {
      issue = await service.getIssueById(topicIdentifier);
    }

    // Fall back to cluster_id lookup
    if (!issue && /^\d+$/.test(topicIdentifier)) {
      issue = await service.getIssueByClusterId(pipelineId, topicIdentifier);
    }

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: `Issue not found for pipeline=${pipelineId} id=${topicIdentifier}`,
      });
    }

    if (issue.timeline && issue.timeline.length > 0) {
      await enrichTimelineWithMpProfiles(issue.timeline);
    }

    // Shape the response to match what TopicDetailPage historically expected
    res.json({
      success:         true,
      topic:           issue,
      statements:      issue.timeline || [],
      statement_count: issue.statement_count || 0,
    });
  } catch (err) {
    console.error('[Issue Portal] /:pipelineId/:id error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
