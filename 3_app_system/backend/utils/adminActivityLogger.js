const mongoose = require('mongoose');
const ActivityLog = require('../models/ActivityLog');

/**
 * Log an admin action for later display in admin view modal.
 * @param {string|ObjectId} adminId - AdminUser _id (the admin who performed the action)
 * @param {string} action - Short key e.g. 'restrict_user', 'create_admin', 'delete_admin'
 * @param {string} description - Human-readable description
 * @param {string} [details=''] - Optional extra details (e.g. JSON or plain text)
 */
const logAdminActivity = async (adminId, action, description, details = '') => {
  if (!adminId || !mongoose.Types.ObjectId.isValid(adminId)) return;
  try {
    const activityLog = new ActivityLog({
      userId: new mongoose.Types.ObjectId(adminId),
      action: 'admin_action',
      description: description,
      details: details,
      metadata: {
        adminAction: action,
        timestamp: new Date().toISOString(),
      },
    });
    await activityLog.save();
  } catch (error) {
    console.error('Error logging admin activity:', error);
  }
};

module.exports = { logAdminActivity };
