const Feedback = require('../models/Feedback');
const User = require('../models/User');
const AdminUser = require('../models/AdminUser');
const asyncHandler = require('../middleware/asyncHandler');
const { createAdminNotification } = require('../utils/adminNotifyHelper');
const { sendToUser } = require('../services/sseService');

const getRangeStartDate = (range) => {
  const now = new Date();
  const date = new Date(now);
  switch (range) {
    case '24h':
      date.setHours(date.getHours() - 24);
      return date;
    case '7days':
      date.setDate(date.getDate() - 7);
      return date;
    case '30days':
      date.setDate(date.getDate() - 30);
      return date;
    case '90days':
      date.setDate(date.getDate() - 90);
      return date;
    default:
      return null;
  }
};

// Get all feedback with pagination and filtering
const getAllFeedback = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { status, category, priority, sortBy = 'createdDate', sortOrder = 'desc' } = req.query;

  // Build filter object
  const filter = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (priority) filter.priority = priority;

  // Build sort object
  let sortObj = {};
  if (sortBy === 'title') {
    sortObj = { title: sortOrder === 'asc' ? 1 : -1 };
  } else if (sortBy === 'priority') {
    sortObj = { priority: sortOrder === 'asc' ? 1 : -1 };
  } else if (sortBy === 'status') {
    sortObj = { status: sortOrder === 'asc' ? 1 : -1 };
  } else {
    sortObj = { createdDate: sortOrder === 'asc' ? 1 : -1 };
  }

  const feedback = await Feedback.find(filter)
    .populate('userId', 'username email')
    .populate('adminResponse.respondedBy', 'username')
    .populate('responses.respondedBy', 'username')
    .populate('assignedTo', 'username')
    .skip(skip)
    .limit(limit)
    .sort(sortObj);

  const total = await Feedback.countDocuments(filter);

  const pages = Math.ceil(total / limit) || 1;
  res.json({
    feedback,
    pagination: {
      page,
      limit,
      total,
      pages,
      totalPages: pages
    }
  });
});

// Get feedback by ID
const getFeedbackById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const feedback = await Feedback.findById(id)
    .populate('userId', 'username email profile')
    .populate('adminResponse.respondedBy', 'username email')
    .populate('responses.respondedBy', 'username email')
    .populate('assignedTo', 'username email');

  if (!feedback) {
    return res.status(404).json({ message: 'Feedback not found' });
  }

  res.json({ feedback });
});

// Update feedback status
const updateFeedbackStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['Pending', 'In-Progress', 'Resolved', 'Archived'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }

  const feedback = await Feedback.findById(id);
  if (!feedback) {
    return res.status(404).json({ message: 'Feedback not found' });
  }

  feedback.status = status;
  await feedback.save();

  res.json({
    message: 'Feedback status updated successfully',
    feedback: {
      _id: feedback._id,
      status: feedback.status,
      updatedAt: feedback.updatedAt
    }
  });
});

// Update feedback priority
const updateFeedbackPriority = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { priority } = req.body;

  if (!['Low', 'Medium', 'High', 'Critical'].includes(priority)) {
    return res.status(400).json({ message: 'Invalid priority value' });
  }

  const feedback = await Feedback.findById(id);
  if (!feedback) {
    return res.status(404).json({ message: 'Feedback not found' });
  }

  feedback.priority = priority;
  await feedback.save();

  res.json({
    message: 'Feedback priority updated successfully',
    feedback: {
      _id: feedback._id,
      priority: feedback.priority,
      updatedAt: feedback.updatedAt
    }
  });
});

// Update feedback assignment (assigned to admin)
const updateFeedbackAssignment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { assignedTo } = req.body;
  const adminId = req.admin?._id || req.admin?.id;
  const adminName = req.admin?.username || req.admin?.name || 'An admin';

  const feedback = await Feedback.findById(id);
  if (!feedback) {
    return res.status(404).json({ message: 'Feedback not found' });
  }

  const previousAssignedToId = feedback.assignedTo ? String(feedback.assignedTo) : null;
  const nextAssignedToId = assignedTo ? String(assignedTo) : null;
  const assignmentChanged = previousAssignedToId !== nextAssignedToId;

  feedback.assignedTo = assignedTo || null;
  await feedback.save();
  await feedback.populate('assignedTo', 'username');

  if (
    assignmentChanged &&
    assignedTo &&
    String(assignedTo) !== String(adminId)
  ) {
    createAdminNotification({
      type: 'feedback_assigned',
      title: 'Feedback Assigned to You',
      message: `${adminName} assigned feedback to you: "${feedback.title}"`,
      link: '/admin/dashboard?tab=users&sub=user-feedback',
      targetAdminId: assignedTo,
      meta: { refId: String(feedback._id), refTitle: String(feedback.title || '') }
    });
  }

  res.json({
    message: 'Assignment updated successfully',
    feedback: {
      _id: feedback._id,
      assignedTo: feedback.assignedTo,
      updatedAt: feedback.updatedAt
    }
  });
});

// Respond to feedback
const respondToFeedback = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { response } = req.body;
  const adminId = req.admin._id;

  if (!response || response.trim().length === 0) {
    return res.status(400).json({ message: 'Response content is required' });
  }

  const feedback = await Feedback.findById(id);
  if (!feedback) {
    return res.status(404).json({ message: 'Feedback not found' });
  }

  const newEntry = {
    response: response.trim(),
    respondedBy: adminId,
    respondedAt: new Date()
  };

  // Append to responses log
  feedback.responses.push(newEntry);

  // Keep adminResponse in sync with latest entry (for backward compat)
  feedback.adminResponse = newEntry;

  // Auto-update status to In-Progress if it was Pending
  if (feedback.status === 'Pending') {
    feedback.status = 'In-Progress';
  }

  await feedback.save();

  // Populate respondedBy for all response entries and latest
  await feedback.populate('adminResponse.respondedBy', 'username email');
  await feedback.populate('responses.respondedBy', 'username email');

  // Persist a notification in the user's notifications array + fire both SSE events
  if (feedback.userId) {
    const notifTitle = 'Admin replied to your feedback';
    const notifMessage = `Your feedback "${feedback.title}" has received an admin response.`;
    const notifLink = '/feedback';
    await User.findByIdAndUpdate(feedback.userId, {
      $push: {
        notifications: {
          type: 'system',
          title: notifTitle,
          message: notifMessage,
          link: notifLink,
          read: false,
          createdAt: new Date()
        }
      }
    });
    // Real-time: bell update + feedback page refresh
    sendToUser(feedback.userId, 'notification', { type: 'system', title: notifTitle, message: notifMessage, link: notifLink });
    sendToUser(feedback.userId, 'feedback_reply', { feedbackId: String(feedback._id) });
  }

  res.json({
    message: 'Response added successfully',
    feedback: {
      _id: feedback._id,
      adminResponse: feedback.adminResponse,
      responses: feedback.responses,
      status: feedback.status,
      updatedAt: feedback.updatedAt
    }
  });
});

// Delete feedback
const deleteFeedback = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const feedback = await Feedback.findById(id);
  if (!feedback) {
    return res.status(404).json({ message: 'Feedback not found' });
  }

  await Feedback.findByIdAndDelete(id);

  res.json({
    message: 'Feedback deleted successfully'
  });
});

// Get feedback statistics
const getFeedbackStats = asyncHandler(async (req, res) => {
  const range = req.query.range || '30days';
  const startDate = getRangeStartDate(range);
  const baseFilter = startDate ? { createdDate: { $gte: startDate } } : {};
  const openStatusFilter = { status: { $in: ['Pending', 'In-Progress'] } };

  const totalFeedback = await Feedback.countDocuments(baseFilter);
  const pendingFeedback = await Feedback.countDocuments({ ...baseFilter, status: 'Pending' });
  const inProgressFeedback = await Feedback.countDocuments({ ...baseFilter, status: 'In-Progress' });
  const resolvedFeedback = await Feedback.countDocuments({ ...baseFilter, status: 'Resolved' });
  const archivedFeedback = await Feedback.countDocuments({ ...baseFilter, status: 'Archived' });
  const openFeedback = await Feedback.countDocuments({ ...baseFilter, ...openStatusFilter });
  const unassignedOpenFeedback = await Feedback.countDocuments({
    ...baseFilter,
    ...openStatusFilter,
    assignedTo: null
  });
  const respondedFeedback = await Feedback.countDocuments({
    ...baseFilter,
    'adminResponse.response': { $exists: true, $nin: [null, ''] }
  });
  const unrespondedFeedback = Math.max(0, totalFeedback - respondedFeedback);

  // Category breakdown
  const categoryStats = await Feedback.aggregate([
    { $match: baseFilter },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  // Priority breakdown
  const priorityStats = await Feedback.aggregate([
    { $match: baseFilter },
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  const oldestOpenItem = await Feedback.findOne({ ...baseFilter, ...openStatusFilter })
    .sort({ createdDate: 1 })
    .select('createdDate title status')
    .lean();

  const openAgeStats = await Feedback.aggregate([
    { $match: { ...baseFilter, ...openStatusFilter } },
    {
      $project: {
        ageMs: { $subtract: [new Date(), '$createdDate'] }
      }
    },
    {
      $group: {
        _id: null,
        averageAgeMs: { $avg: '$ageMs' }
      }
    }
  ]);

  const averageOpenAgeDays = openAgeStats[0]?.averageAgeMs
    ? Number((openAgeStats[0].averageAgeMs / (1000 * 60 * 60 * 24)).toFixed(1))
    : 0;
  const oldestOpenAgeDays = oldestOpenItem?.createdDate
    ? Number((((new Date()) - new Date(oldestOpenItem.createdDate)) / (1000 * 60 * 60 * 24)).toFixed(1))
    : 0;

  res.json({
    range,
    totalFeedback,
    pendingFeedback,
    inProgressFeedback,
    resolvedFeedback,
    archivedFeedback,
    openFeedback,
    unassignedOpenFeedback,
    respondedFeedback,
    unrespondedFeedback,
    responseCoveragePct: totalFeedback ? Math.round((respondedFeedback / totalFeedback) * 100) : 0,
    averageOpenAgeDays,
    oldestOpenAgeDays,
    oldestOpenItem: oldestOpenItem ? {
      title: oldestOpenItem.title,
      status: oldestOpenItem.status,
      createdDate: oldestOpenItem.createdDate
    } : null,
    recentFeedback: totalFeedback,
    categoryStats,
    priorityStats
  });
});

// Bulk update feedback status
const bulkUpdateFeedbackStatus = asyncHandler(async (req, res) => {
  const { feedbackIds, status } = req.body;

  if (!Array.isArray(feedbackIds) || feedbackIds.length === 0) {
    return res.status(400).json({ message: 'Feedback IDs array is required' });
  }

  if (!['Pending', 'In-Progress', 'Resolved', 'Archived'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }

  const result = await Feedback.updateMany(
    { _id: { $in: feedbackIds } },
    { $set: { status } }
  );

  res.json({
    message: 'Feedback status updated successfully',
    modifiedCount: result.modifiedCount
  });
});

module.exports = {
  getAllFeedback,
  getFeedbackById,
  updateFeedbackStatus,
  updateFeedbackPriority,
  updateFeedbackAssignment,
  respondToFeedback,
  deleteFeedback,
  getFeedbackStats,
  bulkUpdateFeedbackStatus
};
