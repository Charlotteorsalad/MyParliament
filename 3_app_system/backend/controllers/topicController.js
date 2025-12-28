const topicService = require('../services/topicService');

// Get all topics with optional filtering
exports.getAllTopics = async (req, res) => {
  try {
    console.log('API endpoint /api/topics called');
    
    const filters = {
      category: req.query.category,
      search: req.query.search,
      featured: req.query.featured === 'true'
    };
    
    const topics = await topicService.getAllTopics(filters);
    console.log('Successfully fetched topics:', topics.length, 'items');
    
    res.json(topics);
  } catch (error) {
    console.error('Error in getAllTopics controller:', error);
    res.status(500).json({ 
      message: "Failed to get topics", 
      error: error.message 
    });
  }
};

// Get topic by ID
exports.getTopicById = async (req, res) => {
  try {
    const topic = await topicService.getTopicById(req.params.id);
    
    // Increment view count
    await topicService.incrementViews(req.params.id);
    
    res.json(topic);
  } catch (error) {
    console.error('Error in getTopicById controller:', error);
    
    if (error.message === 'Topic not found') {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(500).json({ 
      message: "Failed to get topic", 
      error: error.message 
    });
  }
};

// Create new topic (Admin only)
exports.createTopic = async (req, res) => {
  try {
    const topicData = {
      ...req.body,
      createdBy: req.user.id,
      updatedBy: req.user.id
    };
    
    const topic = await topicService.createTopic(topicData);
    
    res.status(201).json({
      message: 'Topic created successfully',
      topic
    });
  } catch (error) {
    console.error('Error in createTopic controller:', error);
    res.status(500).json({ 
      message: "Failed to create topic", 
      error: error.message 
    });
  }
};

// Update topic (Admin only)
exports.updateTopic = async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      updatedBy: req.user.id
    };
    
    const topic = await topicService.updateTopic(req.params.id, updateData);
    
    res.json({
      message: 'Topic updated successfully',
      topic
    });
  } catch (error) {
    console.error('Error in updateTopic controller:', error);
    
    if (error.message === 'Topic not found') {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(500).json({ 
      message: "Failed to update topic", 
      error: error.message 
    });
  }
};

// Delete topic (Admin only)
exports.deleteTopic = async (req, res) => {
  try {
    await topicService.deleteTopic(req.params.id);
    
    res.json({
      message: 'Topic deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteTopic controller:', error);
    
    if (error.message === 'Topic not found') {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(500).json({ 
      message: "Failed to delete topic", 
      error: error.message 
    });
  }
};

// Toggle bookmark (User only)
exports.toggleBookmark = async (req, res) => {
  try {
    const bookmarkCount = await topicService.toggleBookmark(
      req.params.id, 
      req.user.id
    );
    
    res.json({
      message: 'Bookmark toggled successfully',
      bookmarkCount
    });
  } catch (error) {
    console.error('Error in toggleBookmark controller:', error);
    
    if (error.message === 'Topic not found') {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(500).json({ 
      message: "Failed to toggle bookmark", 
      error: error.message 
    });
  }
};

// Get topic statistics
exports.getTopicStats = async (req, res) => {
  try {
    const stats = await topicService.getTopicStats();
    res.json(stats);
  } catch (error) {
    console.error('Error in getTopicStats controller:', error);
    res.status(500).json({ 
      message: "Failed to get topic statistics", 
      error: error.message 
    });
  }
};

// Get categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await topicService.getCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error in getCategories controller:', error);
    res.status(500).json({ 
      message: "Failed to get categories", 
      error: error.message 
    });
  }
};
