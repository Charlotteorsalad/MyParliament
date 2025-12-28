const Bookmark = require('../models/Bookmark');
const EduResource = require('../models/EduResource');
const Topic = require('../models/Topic');
const asyncHandler = require('../middleware/asyncHandler');

// Get user's bookmarks
const getBookmarks = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { type, page = 1, limit = 10 } = req.query;
  
  const skip = (page - 1) * limit;
  const filter = { userId };
  if (type) filter.type = type;

  const bookmarks = await Bookmark.find(filter)
    .populate('resourceId')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

  const total = await Bookmark.countDocuments(filter);

  res.json({
    bookmarks,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// Add bookmark
const addBookmark = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { resourceId, type, title, description } = req.body;

  // Validate required fields
  if (!resourceId || !type) {
    return res.status(400).json({ 
      message: 'Resource ID and type are required' 
    });
  }

  // Validate type
  const validTypes = ['education', 'topic', 'mp', 'forum'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ 
      message: 'Invalid type. Must be one of: ' + validTypes.join(', ') 
    });
  }

  // Check if resource exists
  let resource;
  if (type === 'education') {
    resource = await EduResource.findById(resourceId);
  } else if (type === 'topic') {
    resource = await Topic.findById(resourceId);
  }
  // Add other resource types as needed

  if (!resource) {
    return res.status(404).json({ 
      message: 'Resource not found' 
    });
  }

  // Check if bookmark already exists
  const existingBookmark = await Bookmark.findOne({ 
    userId, 
    resourceId, 
    type 
  });

  if (existingBookmark) {
    return res.status(400).json({ 
      message: 'Resource already bookmarked' 
    });
  }

  // Create bookmark
  const bookmark = new Bookmark({
    userId,
    resourceId,
    type,
    title: title || resource.title || resource.name,
    description: description || resource.description || '',
    resourceData: {
      title: resource.title || resource.name,
      description: resource.description || '',
      // Add other relevant fields based on type
    }
  });

  await bookmark.save();

  res.status(201).json({
    message: 'Bookmark added successfully',
    bookmark: {
      _id: bookmark._id,
      resourceId: bookmark.resourceId,
      type: bookmark.type,
      title: bookmark.title,
      description: bookmark.description,
      createdAt: bookmark.createdAt
    }
  });
});

// Remove bookmark
const removeBookmark = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const bookmark = await Bookmark.findOne({ _id: id, userId });
  if (!bookmark) {
    return res.status(404).json({ 
      message: 'Bookmark not found' 
    });
  }

  await Bookmark.findByIdAndDelete(id);

  res.json({
    message: 'Bookmark removed successfully'
  });
});

// Toggle bookmark (add if not exists, remove if exists)
const toggleBookmark = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { resourceId, type, title, description } = req.body;

  // Validate required fields
  if (!resourceId || !type) {
    return res.status(400).json({ 
      message: 'Resource ID and type are required' 
    });
  }

  // Check if bookmark exists
  const existingBookmark = await Bookmark.findOne({ 
    userId, 
    resourceId, 
    type 
  });

  if (existingBookmark) {
    // Remove bookmark
    await Bookmark.findByIdAndDelete(existingBookmark._id);
    res.json({
      message: 'Bookmark removed successfully',
      action: 'removed',
      bookmark: null
    });
  } else {
    // Add bookmark
    const bookmark = new Bookmark({
      userId,
      resourceId,
      type,
      title: title || 'Bookmarked Item',
      description: description || '',
      resourceData: {
        title: title || 'Bookmarked Item',
        description: description || '',
      }
    });

    await bookmark.save();

    res.json({
      message: 'Bookmark added successfully',
      action: 'added',
      bookmark: {
        _id: bookmark._id,
        resourceId: bookmark.resourceId,
        type: bookmark.type,
        title: bookmark.title,
        description: bookmark.description,
        createdAt: bookmark.createdAt
      }
    });
  }
});

module.exports = {
  getBookmarks,
  addBookmark,
  removeBookmark,
  toggleBookmark
};
