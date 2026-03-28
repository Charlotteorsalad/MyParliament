/**
 * SSE (Server-Sent Events) Service
 *
 * Manages all open SSE connections and provides broadcast helpers.
 * Each client is stored by a unique clientId. Authenticated users also
 * register their userId so user-specific events can be sent.
 *
 * Usage (in controllers):
 *   const { broadcast, sendToUser } = require('./sseService');
 *   broadcast('edu_updated', { action: 'create', id: resource._id });
 *   sendToUser(userId, 'notification', { title: '...' });
 */

// Map<clientId, { res, userId|null }>
const clients = new Map();

let _nextId = 1;
function nextClientId() {
  return String(_nextId++);
}

/**
 * Register a new SSE client. Returns the assigned clientId.
 * @param {import('express').Response} res
 * @param {string|null} userId  - MongoDB user _id (string), or null for guests
 */
function addClient(res, userId = null) {
  const clientId = nextClientId();
  clients.set(clientId, { res, userId });
  return clientId;
}

/**
 * Remove a disconnected client.
 */
function removeClient(clientId) {
  clients.delete(clientId);
}

/**
 * Send an SSE event to a single response stream.
 */
function _send(res, event, data) {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // Client already disconnected; caller will clean up via 'close' handler
  }
}

/**
 * Broadcast an event to ALL connected clients (authenticated + guests).
 * Use for public data changes: edu_updated, mp_updated, forum_updated,
 * topic_updated, announcement.
 */
function broadcast(event, data = {}) {
  const payload = { ...data, _ts: Date.now() };
  for (const [, client] of clients) {
    _send(client.res, event, payload);
  }
}

/**
 * Send an event only to clients belonging to a specific user.
 * Use for personalised events: notification, feedback_reply.
 */
function sendToUser(userId, event, data = {}) {
  if (!userId) return;
  const userIdStr = String(userId);
  const payload = { ...data, _ts: Date.now() };
  for (const [, client] of clients) {
    if (client.userId && String(client.userId) === userIdStr) {
      _send(client.res, event, payload);
    }
  }
}

/**
 * Current number of connected SSE clients (useful for health checks).
 */
function clientCount() {
  return clients.size;
}

module.exports = { addClient, removeClient, broadcast, sendToUser, clientCount };
