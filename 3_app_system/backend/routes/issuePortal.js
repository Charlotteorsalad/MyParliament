const express = require('express');
const router = express.Router();
const IssuePortalService = require('../services/issuePortalService');

const MONGO_URI = process.env.MONGO_URI;
const issuePortalService = new IssuePortalService(MONGO_URI);

/**
 * GET /api/issue-portal/:pipelineId/:topicIdentifier
 * 
 * Get MP statements for a specific topic
 * 
 * @param {string} pipelineId - Pipeline ID (e.g., "pipeline5")
 * @param {string} topicIdentifier - Topic name (e.g., "Act 355") or cluster_id (e.g., "10")
 * @query {number} limit - Max statements to return (default: 100)
 * @query {string} dateFrom - Filter by date >= (ISO format: YYYY-MM-DD)
 * @query {string} dateTo - Filter by date <= (ISO format: YYYY-MM-DD)
 * @query {string} mpName - Filter by MP name (fuzzy search)
 * @query {string} party - Filter by party (fuzzy search)
 * 
 * @returns {object} { topic: {...}, statement_count: number, statements: [...] }
 */
router.get('/:pipelineId/:topicIdentifier', async (req, res) => {
  try {
    const { pipelineId, topicIdentifier } = req.params;
    
    const options = {
      limit: parseInt(req.query.limit) || 100,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      mpName: req.query.mpName,
      party: req.query.party,
    };

    console.log(`[Issue Portal] Request: pipeline=${pipelineId}, topic=${topicIdentifier}, options=`, options);

    const result = await issuePortalService.getIssueDetail(
      pipelineId,
      topicIdentifier,
      options
    );

    if (result.error) {
      return res.status(result.status || 500).json({ message: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error('[Issue Portal] Error:', error);
    res.status(500).json({
      message: 'Failed to fetch issue detail',
      error: error.message,
    });
  }
});

/**
 * GET /api/issue-portal/:pipelineId/:topicIdentifier/summary
 * 
 * Get summary statistics for a topic (count by MP, party, date range)
 */
router.get('/:pipelineId/:topicIdentifier/summary', async (req, res) => {
  try {
    const { pipelineId, topicIdentifier } = req.params;

    const result = await issuePortalService.getIssueDetail(
      pipelineId,
      topicIdentifier,
      { limit: 1000 } // Get more for stats
    );

    if (result.error) {
      return res.status(result.status || 500).json({ message: result.error });
    }

    // Compute summary statistics
    const mpCounts = {};
    const partyCounts = {};
    let earliestDate = null;
    let latestDate = null;

    result.statements.forEach(stmt => {
      // Count by MP
      mpCounts[stmt.mp_name] = (mpCounts[stmt.mp_name] || 0) + 1;
      
      // Count by party
      partyCounts[stmt.party] = (partyCounts[stmt.party] || 0) + 1;
      
      // Track date range
      if (stmt.date) {
        if (!earliestDate || stmt.date < earliestDate) earliestDate = stmt.date;
        if (!latestDate || stmt.date > latestDate) latestDate = stmt.date;
      }
    });

    // Sort and get top MPs
    const topMPs = Object.entries(mpCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ mp_name: name, statement_count: count }));

    // Sort and get party distribution
    const partyDistribution = Object.entries(partyCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([party, count]) => ({ party, statement_count: count }));

    res.json({
      topic: result.topic,
      total_statements: result.statement_count,
      date_range: {
        earliest: earliestDate,
        latest: latestDate,
      },
      top_mps: topMPs,
      party_distribution: partyDistribution,
    });
  } catch (error) {
    console.error('[Issue Portal Summary] Error:', error);
    res.status(500).json({
      message: 'Failed to fetch issue summary',
      error: error.message,
    });
  }
});

module.exports = router;
