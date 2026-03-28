/**
 * GET /api/sse/events
 *
 * Establishes a persistent Server-Sent Events connection.
 * - No auth required: unauthenticated browsers receive public broadcasts
 *   (edu_updated, mp_updated, forum_updated, topic_updated).
 * - If a valid Bearer token (or ?token= query param) is provided the
 *   connection is tagged with the userId so user-specific events
 *   (notification, feedback_reply) are also delivered.
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { addClient, removeClient, broadcast } = require('../services/sseService');

const HEARTBEAT_INTERVAL_MS = 25000; // 25 s – keeps connection alive through proxies

function resolveUserId(req) {
  try {
    const authHeader = req.headers['authorization'] || '';
    const token =
      (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null) ||
      req.query.token;
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
    return decoded.id || decoded._id || decoded.userId || null;
  } catch {
    return null;
  }
}

router.get('/events', (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  const userId = resolveUserId(req);
  const clientId = addClient(res, userId);

  // Send initial connection confirmation
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, userId: userId || null })}\n\n`);

  // Heartbeat keeps the connection open through load balancers / proxies
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, HEARTBEAT_INTERVAL_MS);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(clientId);
  });
});

// Simple health endpoint – returns current connection count
router.get('/status', (req, res) => {
  const { clientCount } = require('../services/sseService');
  res.json({ sseClients: clientCount() });
});

module.exports = router;
