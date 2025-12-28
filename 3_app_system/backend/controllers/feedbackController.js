const Feedback = require('../models/Feedback');
const User = require('../models/User');
const AdminUser = require('../models/AdminUser');
const asyncHandler = require('../middleware/asyncHandler');

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
    .skip(skip)
    .limit(limit)
    .sort(sortObj);

  const total = await Feedback.countDocuments(filter);

  res.json({
    feedback,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// Get feedback by ID
const getFeedbackById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const feedback = await Feedback.findById(id)
    .populate('userId', 'username email profile')
    .populate('adminResponse.respondedBy', 'username email');

  if (!feedback) {
    return res.status(404).json({ message: 'Feedback not found' });
  }

  res.json({ feedback });
});

// Update feedback status
const updateFeedbackStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['Pending', 'In-Progress', 'Archived'].includes(status)) {
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

  feedback.adminResponse = {
    response: response.trim(),
    respondedBy: adminId,
    respondedAt: new Date()
  };

  // Auto-update status to In-Progress if it was Pending
  if (feedback.status === 'Pending') {
    feedback.status = 'In-Progress';
  }

  await feedback.save();

  // Populate the respondedBy field for response
  await feedback.populate('adminResponse.respondedBy', 'username email');

  res.json({
    message: 'Response added successfully',
    feedback: {
      _id: feedback._id,
      adminResponse: feedback.adminResponse,
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
  const totalFeedback = await Feedback.countDocuments();
  const pendingFeedback = await Feedback.countDocuments({ status: 'Pending' });
  const inProgressFeedback = await Feedback.countDocuments({ status: 'In-Progress' });
  const archivedFeedback = await Feedback.countDocuments({ status: 'Archived' });

  // Category breakdown
  const categoryStats = await Feedback.aggregate([
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

  // Recent feedback (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentFeedback = await Feedback.countDocuments({
    createdDate: { $gte: thirtyDaysAgo }
  });

  res.json({
    totalFeedback,
    pendingFeedback,
    inProgressFeedback,
    archivedFeedback,
    recentFeedback,
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

  if (!['Pending', 'In-Progress', 'Archived'].includes(status)) {
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
  respondToFeedback,
  deleteFeedback,
  getFeedbackStats,
  bulkUpdateFeedbackStatus
};
