const forumService = require('../services/forumService');

// Get all forum topics
exports.getAllTopics = async (req, res) => {
  try {
    const result = await forumService.getAllTopics(req.query);
    res.json(result);
  } catch (error) {
    console.error('Error in getAllTopics:', error);
    res.status(500).json({ 
      message: "Failed to get forum topics", 
      error: error.message 
    });
  }
};

// Get single topic with posts
exports.getTopicById = async (req, res) => {
  try {
    const topic = await forumService.getTopicById(req.params.id);
    res.json(topic);
  } catch (error) {
    console.error('Error in getTopicById:', error);
    if (error.message === 'Topic not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ 
      message: "Failed to get topic", 
      error: error.message 
    });
  }
};

// Create new topic
exports.createTopic = async (req, res) => {
  try {
    const topic = await forumService.createTopic(req.body, req.user.id);
    res.status(201).json({
      message: 'Topic created successfully',
      topic
    });
  } catch (error) {
    console.error('Error in createTopic:', error);
    res.status(500).json({ 
      message: "Failed to create topic", 
      error: error.message 
    });
  }
};

// Update topic
exports.updateTopic = async (req, res) => {
  try {
    const topic = await forumService.updateTopic(req.params.id, req.body, req.user.id);
    res.json({
      message: 'Topic updated successfully',
      topic
    });
  } catch (error) {
    console.error('Error in updateTopic:', error);
    if (error.message === 'Topic not found') {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === 'Unauthorized to update this topic') {
      return res.status(403).json({ message: error.message });
    }
    res.status(500).json({ 
      message: "Failed to update topic", 
      error: error.message 
    });
  }
};

// Delete topic
exports.deleteTopic = async (req, res) => {
  try {
    const result = await forumService.deleteTopic(req.params.id, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Error in deleteTopic:', error);
    if (error.message === 'Topic not found') {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === 'Unauthorized to delete this topic') {
      return res.status(403).json({ message: error.message });
    }
    res.status(500).json({ 
      message: "Failed to delete topic", 
      error: error.message 
    });
  }
};

// Create new post in topic
exports.createPost = async (req, res) => {
  try {
    const post = await forumService.createPost(req.params.topicId, req.body, req.user.id);
    res.status(201).json({
      message: 'Post created successfully',
      post
    });
  } catch (error) {
    console.error('Error in createPost:', error);
    if (error.message === 'Topic not found') {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === 'Cannot post in locked or archived topic') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ 
      message: "Failed to create post", 
      error: error.message 
    });
  }
};

// Reply to a post
exports.replyToPost = async (req, res) => {
  try {
    const reply = await forumService.replyToPost(req.params.postId, req.body, req.user.id);
    res.status(201).json({
      message: 'Reply created successfully',
      reply
    });
  } catch (error) {
    console.error('Error in replyToPost:', error);
    if (error.message === 'Parent post not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ 
      message: "Failed to create reply", 
      error: error.message 
    });
  }
};

// Get posts for a topic
exports.getTopicPosts = async (req, res) => {
  try {
    const result = await forumService.getTopicPosts(req.params.topicId, req.query);
    res.json(result);
  } catch (error) {
    console.error('Error in getTopicPosts:', error);
    res.status(500).json({ 
      message: "Failed to get topic posts", 
      error: error.message 
    });
  }
};

// Like/unlike a post
exports.togglePostLike = async (req, res) => {
  try {
    const post = await forumService.togglePostLike(req.params.postId, req.user.id);
    res.json({
      message: 'Post like toggled successfully',
      post
    });
  } catch (error) {
    console.error('Error in togglePostLike:', error);
    if (error.message === 'Post not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ 
      message: "Failed to toggle post like", 
      error: error.message 
    });
  }
};

// Get user's created topics
exports.getUserTopics = async (req, res) => {
  try {
    const result = await forumService.getUserTopics(req.user.id, req.query);
    res.json(result);
  } catch (error) {
    console.error('Error in getUserTopics:', error);
    res.status(500).json({ 
      message: "Failed to get user topics", 
      error: error.message 
    });
  }
};

// Get forum statistics
exports.getForumStats = async (req, res) => {
  try {
    const stats = await forumService.getForumStats();
    res.json(stats);
  } catch (error) {
    console.error('Error in getForumStats:', error);
    res.status(500).json({ 
      message: "Failed to get forum statistics", 
      error: error.message 
    });
  }
};

// Search forum
exports.searchForum = async (req, res) => {
  try {
    const { q, ...queryParams } = req.query;
    if (!q) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    const results = await forumService.searchForum(q, queryParams);
    res.json(results);
  } catch (error) {
    console.error('Error in searchForum:', error);
    res.status(500).json({ 
      message: "Failed to search forum", 
      error: error.message 
    });
  }
};
