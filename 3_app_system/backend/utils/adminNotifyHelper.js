const AdminNotification = require('../models/AdminNotification');

/**
 * Create an admin notification record.
 * @param {Object} opts
 * @param {string}  opts.type          - notification type enum value
 * @param {string}  opts.title         - short title
 * @param {string}  opts.message       - descriptive message
 * @param {string}  [opts.link]        - optional deep-link (frontend route)
 * @param {*}       [opts.targetAdminId] - ObjectId of specific admin; null = visible to all
 * @param {Object}  [opts.meta]        - extra metadata stored in the document
 */
async function createAdminNotification({ type, title, message, link, targetAdminId, meta } = {}) {
  try {
    await AdminNotification.create({
      type: type || 'other',
      title: title || 'Notification',
      message: message || '',
      link: link || null,
      targetAdminId: targetAdminId || null,
      meta: meta || {}
    });
  } catch (err) {
    console.error('[adminNotify] Failed to create notification:', err.message);
  }
}

module.exports = { createAdminNotification };
