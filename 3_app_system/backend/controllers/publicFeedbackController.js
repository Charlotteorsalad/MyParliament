const Feedback = require('../models/Feedback');
const asyncHandler = require('../middleware/asyncHandler');
const { createAdminNotification } = require('../utils/adminNotifyHelper');
const { broadcast } = require('../services/sseService');

// Submit new feedback (from user Feedback page or Platform Survey; admin receives via GET /api/admin/feedback)
const submitFeedback = asyncHandler(async (req, res) => {
  const { title, content, category, rating, priority, parliamentaryCategory, linkedTopic } = req.body;
  // req.files is set by multer when attachments are included
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'Authentication required to submit feedback' });
  }

  // Validate required fields
  if (!title || !content || !category) {
    return res.status(400).json({
      message: 'Title, content, and category are required'
    });
  }

  const titleStr = String(title).trim();
  const contentStr = String(content).trim();
  if (!titleStr.length || !contentStr.length) {
    return res.status(400).json({
      message: 'Title and content cannot be empty'
    });
  }

  // Normalize and validate rating (frontend may send number or string)
  let ratingNum = null;
  if (rating != null && rating !== '') {
    ratingNum = typeof rating === 'number' ? rating : parseInt(rating, 10);
    if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({
        message: 'Rating must be an integer between 1 and 5'
      });
    }
  }

  // Validate category
  const validCategories = ['Bug Report', 'UI / Theme', 'Feature Request', 'Performance', 'Security', 'General', 'Complaint', 'Suggestion', 'Other'];
  const categoryStr = String(category).trim();
  if (!validCategories.includes(categoryStr)) {
    return res.status(400).json({
      message: 'Invalid category. Must be one of: ' + validCategories.join(', ')
    });
  }

  // Validate priority
  const validPriorities = ['Low', 'Medium', 'High', 'Critical'];
  const priorityStr = priority ? String(priority).trim() : 'Low';
  if (!validPriorities.includes(priorityStr)) {
    return res.status(400).json({
      message: 'Invalid priority. Must be one of: ' + validPriorities.join(', ')
    });
  }

  // Build attachments list from uploaded files (multer populates req.files)
  const attachments = Array.isArray(req.files)
    ? req.files.map((f) => ({
        filename: f.filename,
        originalName: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        uploadedAt: new Date()
      }))
    : [];

  // Create feedback (admin will see it in User Feedback Management)
  const feedback = new Feedback({
    userId,
    title: titleStr,
    content: contentStr,
    category: categoryStr,
    parliamentaryCategory: parliamentaryCategory ? String(parliamentaryCategory).trim() : '',
    linkedTopic: linkedTopic ? String(linkedTopic).trim() : '',
    rating: ratingNum,
    status: 'Pending',
    priority: priorityStr,
    attachments
  });

  await feedback.save();

  // Global notification to all admins
  createAdminNotification({
    type: 'feedback_received',
    title: 'New User Feedback',
    message: `New ${feedback.category} feedback received: "${feedback.title}"`,
    link: '/admin/dashboard?tab=users&sub=user-feedback',
    targetAdminId: null,
    meta: { refId: String(feedback._id) }
  });

  // Real-time: push to admin SSE connections so the feedback panel auto-refreshes
  broadcast('feedback_received', { id: String(feedback._id), category: feedback.category });

  // Populate user info for response
  await feedback.populate('userId', 'username email');

  res.status(201).json({
    message: 'Feedback submitted successfully',
    feedback: {
      _id: feedback._id,
      title: feedback.title,
      content: feedback.content,
      category: feedback.category,
      parliamentaryCategory: feedback.parliamentaryCategory,
      linkedTopic: feedback.linkedTopic,
      status: feedback.status,
      priority: feedback.priority,
      createdDate: feedback.createdDate,
      attachments: feedback.attachments,
      user: {
        username: feedback.userId.username,
        email: feedback.userId.email
      }
    }
  });
});

// Get user's own feedback
const getUserFeedback = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { status, category, sortBy = 'createdDate', sortOrder = 'desc' } = req.query;

  // Build filter object
  const filter = { userId };
  if (status) filter.status = status;
  if (category) filter.category = category;

  // Build sort object
  let sortObj = {};
  if (sortBy === 'title') {
    sortObj = { title: sortOrder === 'asc' ? 1 : -1 };
  } else if (sortBy === 'status') {
    sortObj = { status: sortOrder === 'asc' ? 1 : -1 };
  } else {
    sortObj = { createdDate: sortOrder === 'asc' ? 1 : -1 };
  }

  const feedback = await Feedback.find(filter)
    .populate('adminResponse.respondedBy', 'username')
    .populate('responses.respondedBy', 'username')
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

// Get specific feedback by ID (only if user owns it)
const getFeedbackById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const feedback = await Feedback.findOne({ _id: id, userId })
    .populate('userId', 'username email')
    .populate('adminResponse.respondedBy', 'username email')
    .populate('responses.respondedBy', 'username email');

  if (!feedback) {
    return res.status(404).json({ 
      message: 'Feedback not found or you do not have permission to view it' 
    });
  }

  res.json({ feedback });
});

module.exports = {
  submitFeedback,
  getUserFeedback,
  getFeedbackById
};
