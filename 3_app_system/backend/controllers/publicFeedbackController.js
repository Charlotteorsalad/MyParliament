const Feedback = require('../models/Feedback');
const asyncHandler = require('../middleware/asyncHandler');

// Submit new feedback
const submitFeedback = asyncHandler(async (req, res) => {
  const { title, content, category, rating } = req.body;
  const userId = req.user.id;

  // Validate required fields
  if (!title || !content || !category) {
    return res.status(400).json({ 
      message: 'Title, content, and category are required' 
    });
  }

  // Validate rating if provided
  if (rating && (rating < 1 || rating > 5 || !Number.isInteger(rating))) {
    return res.status(400).json({ 
      message: 'Rating must be an integer between 1 and 5' 
    });
  }

  // Validate category
  const validCategories = ['Bug', 'Feature Request', 'General', 'Complaint', 'Suggestion', 'Other'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ 
      message: 'Invalid category. Must be one of: ' + validCategories.join(', ') 
    });
  }

  // Create feedback
  const feedback = new Feedback({
    userId,
    title: title.trim(),
    content: content.trim(),
    category,
    rating: rating || null,
    status: 'Pending',
    priority: 'Medium'
  });

  await feedback.save();

  // Populate user info for response
  await feedback.populate('userId', 'username email');

  res.status(201).json({
    message: 'Feedback submitted successfully',
    feedback: {
      _id: feedback._id,
      title: feedback.title,
      content: feedback.content,
      category: feedback.category,
      status: feedback.status,
      priority: feedback.priority,
      createdDate: feedback.createdDate,
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
    .populate('adminResponse.respondedBy', 'username email');

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
