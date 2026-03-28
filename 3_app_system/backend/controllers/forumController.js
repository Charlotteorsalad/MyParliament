const forumService = require('../services/forumService');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { broadcast } = require('../services/sseService');

// Check if user is restricted from forum create/reply (restriction = forum-only: no new topics, no new posts/replies)
const checkForumRestriction = async (req, res) => {
  const user = await User.findById(req.user.id).select('isRestricted restrictionEndDate restrictionReason');
  if (!user) return null;
  if (!user.isRestricted || !user.restrictionEndDate) return null;
  if (new Date(user.restrictionEndDate) <= new Date()) return null; // restriction expired
  const message = user.restrictionReason
    ? `You are restricted from creating or replying in the forum until ${new Date(user.restrictionEndDate).toLocaleDateString()}. Reason: ${user.restrictionReason}`
    : `You are restricted from creating or replying in the forum until ${new Date(user.restrictionEndDate).toLocaleDateString()}.`;
  res.status(403).json({ message });
  return true;
};

// Get all forum topics
exports.getAllTopics = async (req, res) => {
  try {
    const result = await forumService.getAllTopics(req.query, req.user?.id);
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
    const topic = await forumService.getTopicById(req.params.id, req.user?.id);
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
    console.log('[createTopic] Called, user:', req.user?.id, 'data:', req.body);
    const restricted = await checkForumRestriction(req, res);
    if (restricted) {
      console.log('[createTopic] User is restricted');
      return;
    }
    console.log('[createTopic] Creating topic...');
    const topic = await forumService.createTopic(req.body, req.user.id);
    console.log('[createTopic] Topic created successfully:', topic._id);
    // Log activity (fire-and-forget)
    ActivityLog.create({
      userId: req.user.id,
      action: 'forum_topic_create',
      description: `Created discussion "${topic.title}"`,
      metadata: { topicId: String(topic._id), topicTitle: topic.title },
    }).catch(() => {});
    broadcast('forum_activity', { type: 'new_topic', id: String(topic._id) });
    res.status(201).json({
      message: 'Topic created successfully',
      topic
    });
  } catch (error) {
    console.error('[createTopic] ERROR:', error);
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
    const restricted = await checkForumRestriction(req, res);
    if (restricted) return;
    const post = await forumService.createPost(req.params.topicId, req.body, req.user.id);
    // Log activity (fire-and-forget)
    ActivityLog.create({
      userId: req.user.id,
      action: 'forum_reply',
      description: `Replied to a forum discussion`,
      metadata: { topicId: String(req.params.topicId), postId: String(post._id) },
    }).catch(() => {});
    broadcast('forum_activity', { type: 'new_post', topicId: String(req.params.topicId), id: String(post._id) });
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
    const restricted = await checkForumRestriction(req, res);
    if (restricted) return;
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
    const result = await forumService.getTopicPosts(req.params.topicId, req.query, req.user?.id);
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

// Report a post/reply as offensive (user escalation)
exports.reportPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { reason } = req.body || {};

    const post = await forumService.reportPost(postId, req.user.id, reason);

    broadcast('forum_activity', { type: 'report_post', id: String(postId) });
    res.status(201).json({
      message: 'Post reported successfully',
      post
    });
  } catch (error) {
    console.error('Error in reportPost:', error);
    if (error.message === 'Post not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({
      message: 'Failed to report post',
      error: error.message
    });
  }
};

// Report a topic (original discussion) as offensive (user escalation)
exports.reportTopic = async (req, res) => {
  try {
    const { topicId } = req.params;
    const { reason } = req.body || {};

    const topic = await forumService.reportTopic(topicId, req.user.id, reason);

    broadcast('forum_activity', { type: 'report_topic', id: String(topicId) });
    res.status(201).json({
      message: 'Topic reported successfully',
      topic
    });
  } catch (error) {
    console.error('Error in reportTopic:', error);
    if (error.message === 'Topic not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({
      message: 'Failed to report topic',
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
