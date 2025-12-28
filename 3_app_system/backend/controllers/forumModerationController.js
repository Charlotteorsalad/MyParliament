const ForumTopic = require('../models/ForumTopic');
const ForumPost = require('../models/ForumPost');
const UserRestriction = require('../models/UserRestriction');
const User = require('../models/User');
const AdminUser = require('../models/AdminUser');

// Get all forum topics with moderation info
exports.getAllTopics = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      status,
      flagged,
      sensitive,
      sortBy = 'lastActivity',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    if (category) query.category = category;
    if (status) query.status = status;
    if (flagged === 'true') query['moderationFlags.isFlagged'] = true;
    if (sensitive === 'true') query['moderationFlags.hasSensitiveContent'] = true;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const topics = await ForumTopic.find(query)
      .populate('author', 'username email firstName lastName')
      .populate('moderationFlags.flaggedBy.user', 'username')
      .populate('moderationFlags.moderationNotes.moderator', 'username')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await ForumTopic.countDocuments(query);

    res.json({
      success: true,
      data: {
        topics,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch topics',
      error: error.message
    });
  }
};

// Get flagged content
exports.getFlaggedContent = async (req, res) => {
  try {
    const { type = 'both' } = req.query;
    
    const flaggedTopics = type === 'posts' ? [] : await ForumTopic.find({
      'moderationFlags.isFlagged': true
    })
      .populate('author', 'username email firstName lastName')
      .populate('moderationFlags.flaggedBy.user', 'username')
      .sort({ 'moderationFlags.flaggedBy.flaggedAt': -1 });

    const flaggedPosts = type === 'topics' ? [] : await ForumPost.find({
      'moderationFlags.isFlagged': true
    })
      .populate('author', 'username email firstName lastName')
      .populate('topic', 'title')
      .populate('moderationFlags.flaggedBy.user', 'username')
      .sort({ 'moderationFlags.flaggedBy.flaggedAt': -1 });

    res.json({
      success: true,
      data: {
        flaggedTopics,
        flaggedPosts,
        totalFlagged: flaggedTopics.length + flaggedPosts.length
      }
    });
  } catch (error) {
    console.error('Error fetching flagged content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch flagged content',
      error: error.message
    });
  }
};

// Moderate topic (lock, archive, approve, etc.)
exports.moderateTopic = async (req, res) => {
  try {
    const { topicId } = req.params;
    const { action, note, sensitiveContentType } = req.body;
    const moderatorId = req.admin.id;

    const topic = await ForumTopic.findById(topicId);
    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    // Update topic status based on action
    switch (action) {
      case 'lock':
        topic.status = 'locked';
        break;
      case 'archive':
        topic.status = 'archived';
        break;
      case 'approve':
        topic.moderationFlags.isFlagged = false;
        topic.moderationFlags.hasSensitiveContent = false;
        topic.status = 'active';
        break;
      case 'mark_sensitive':
        topic.moderationFlags.hasSensitiveContent = true;
        topic.moderationFlags.sensitiveContentType = sensitiveContentType;
        break;
      case 'flag':
        topic.moderationFlags.isFlagged = true;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action'
        });
    }

    // Add moderation note
    topic.moderationFlags.moderationNotes.push({
      moderator: moderatorId,
      note: note || `Topic ${action}ed by moderator`,
      action: action,
      createdAt: new Date()
    });

    await topic.save();

    res.json({
      success: true,
      message: `Topic ${action}ed successfully`,
      data: topic
    });
  } catch (error) {
    console.error('Error moderating topic:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to moderate topic',
      error: error.message
    });
  }
};

// Moderate post
exports.moderatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { action, note, sensitiveContentType } = req.body;
    const moderatorId = req.admin.id;

    const post = await ForumPost.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Update post status based on action
    switch (action) {
      case 'hide':
        post.status = 'hidden';
        break;
      case 'delete':
        post.status = 'deleted';
        break;
      case 'approve':
        post.moderationFlags.isFlagged = false;
        post.moderationFlags.hasSensitiveContent = false;
        post.status = 'active';
        break;
      case 'mark_sensitive':
        post.moderationFlags.hasSensitiveContent = true;
        post.moderationFlags.sensitiveContentType = sensitiveContentType;
        break;
      case 'flag':
        post.moderationFlags.isFlagged = true;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action'
        });
    }

    // Add moderation note
    post.moderationFlags.moderationNotes.push({
      moderator: moderatorId,
      note: note || `Post ${action}ed by moderator`,
      action: action,
      createdAt: new Date()
    });

    await post.save();

    res.json({
      success: true,
      message: `Post ${action}ed successfully`,
      data: post
    });
  } catch (error) {
    console.error('Error moderating post:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to moderate post',
      error: error.message
    });
  }
};

// Restrict user
exports.restrictUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      restrictionType,
      reason,
      durationDays,
      violations = []
    } = req.body;
    const moderatorId = req.admin.id;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate end date
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + parseInt(durationDays));

    // Create restriction
    const restriction = new UserRestriction({
      user: userId,
      restrictedBy: moderatorId,
      restrictionType,
      reason,
      endDate,
      violations: violations.map(v => ({
        type: v.type,
        description: v.description,
        evidence: v.evidence
      }))
    });

    await restriction.save();

    // Update user status if needed
    if (restrictionType === 'full_restriction') {
      user.isActive = false;
      await user.save();
    }

    res.json({
      success: true,
      message: 'User restricted successfully',
      data: restriction
    });
  } catch (error) {
    console.error('Error restricting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restrict user',
      error: error.message
    });
  }
};

// Get user restrictions
exports.getUserRestrictions = async (req, res) => {
  try {
    const { page = 1, limit = 10, active = 'true' } = req.query;
    
    const query = {};
    if (active === 'true') {
      query.isActive = true;
      query.endDate = { $gt: new Date() };
    }

    const restrictions = await UserRestriction.find(query)
      .populate('user', 'username email firstName lastName')
      .populate('restrictedBy', 'username')
      .populate('appealStatus.reviewedBy', 'username')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await UserRestriction.countDocuments(query);

    res.json({
      success: true,
      data: {
        restrictions,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });
  } catch (error) {
    console.error('Error fetching restrictions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch restrictions',
      error: error.message
    });
  }
};

// Lift user restriction
exports.liftRestriction = async (req, res) => {
  try {
    const { restrictionId } = req.params;
    const { reason } = req.body;
    const moderatorId = req.admin.id;

    const restriction = await UserRestriction.findById(restrictionId);
    if (!restriction) {
      return res.status(404).json({
        success: false,
        message: 'Restriction not found'
      });
    }

    restriction.isActive = false;
    restriction.endDate = new Date();
    restriction.notes.push({
      moderator: moderatorId,
      note: reason || 'Restriction lifted by moderator',
      createdAt: new Date()
    });

    await restriction.save();

    // If it was a full restriction, reactivate user
    if (restriction.restrictionType === 'full_restriction') {
      await User.findByIdAndUpdate(restriction.user, { isActive: true });
    }

    res.json({
      success: true,
      message: 'Restriction lifted successfully',
      data: restriction
    });
  } catch (error) {
    console.error('Error lifting restriction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to lift restriction',
      error: error.message
    });
  }
};

// Get moderation statistics
exports.getModerationStats = async (req, res) => {
  try {
    const [
      totalTopics,
      flaggedTopics,
      totalPosts,
      flaggedPosts,
      activeRestrictions,
      totalRestrictions,
      sensitiveTopics,
      sensitivePosts
    ] = await Promise.all([
      ForumTopic.countDocuments(),
      ForumTopic.countDocuments({ 'moderationFlags.isFlagged': true }),
      ForumPost.countDocuments(),
      ForumPost.countDocuments({ 'moderationFlags.isFlagged': true }),
      UserRestriction.countDocuments({ 
        isActive: true, 
        endDate: { $gt: new Date() } 
      }),
      UserRestriction.countDocuments(),
      ForumTopic.countDocuments({ 'moderationFlags.hasSensitiveContent': true }),
      ForumPost.countDocuments({ 'moderationFlags.hasSensitiveContent': true })
    ]);

    const sensitiveContent = sensitiveTopics + sensitivePosts;

    res.json({
      success: true,
      data: {
        totalTopics,
        flaggedTopics,
        totalPosts,
        flaggedPosts,
        activeRestrictions,
        totalRestrictions,
        sensitiveContent,
        flaggedPercentage: totalTopics > 0 ? ((flaggedTopics + flaggedPosts) / (totalTopics + totalPosts) * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching moderation stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch moderation statistics',
      error: error.message
    });
  }
};
