const ForumTopic = require('../models/ForumTopic');
const ForumPost = require('../models/ForumPost');
const User = require('../models/User');
const AdminUser = require('../models/AdminUser');
const AdminNotification = require('../models/AdminNotification');
const notificationService = require('../services/notificationService');
const { logAdminActivity } = require('../utils/adminActivityLogger');
const { broadcast, sendToUser } = require('../services/sseService');

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
      approved,
      sortBy = 'lastActivity',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    if (category) query.category = category;
    if (status) query.status = status;
    if (flagged === 'true') query['moderationFlags.isFlagged'] = true;
    if (flagged === 'false') query['moderationFlags.isFlagged'] = false;
    if (sensitive === 'true') query['moderationFlags.hasSensitiveContent'] = true;
    
    // Approved: topics that were flagged and then approved (have approve action in moderationNotes)
    if (approved === 'true') {
      query.status = 'active';
      query['moderationFlags.isFlagged'] = false; // Currently not flagged
      query['moderationFlags.flaggedBy.0'] = { $exists: true }; // Was flagged before
      // Has approve action in moderationNotes (using $elemMatch to check array)
      query['moderationFlags.moderationNotes'] = {
        $elemMatch: { action: 'approve' }
      };
    }

    // When no explicit sort is chosen, float flagged topics to the top first
    const sortOptions = {};
    if (!req.query.sortBy) {
      sortOptions['moderationFlags.isFlagged'] = -1; // flagged=true ranks first
    }
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

// Get flagged content (same criteria as stats: isFlagged or has any flaggedBy)
const flaggedContentTopicQuery = {
  $or: [
    { 'moderationFlags.isFlagged': true },
    { 'moderationFlags.flaggedBy.0': { $exists: true } }
  ]
};
const flaggedContentPostQuery = {
  $or: [
    { 'moderationFlags.isFlagged': true },
    { 'moderationFlags.flaggedBy.0': { $exists: true } }
  ]
};

// Get all posts with moderation info
exports.getAllPosts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      flagged,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    if (status) query.status = status;
    if (flagged === 'true') query['moderationFlags.isFlagged'] = true;
    if (flagged === 'false') query['moderationFlags.isFlagged'] = false;

    // Validate sortBy field and map to actual model field names
    const validSortFields = ['content', 'author', 'topic', 'status', 'createdAt'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    
    const sortOptions = {};
    sortOptions[sortField] = sortOrder === 'desc' ? -1 : 1;

    const posts = await ForumPost.find(query)
      .populate('author', 'username email firstName lastName')
      .populate('topic', 'title')
      .populate('moderationFlags.flaggedBy.user', 'username')
      .populate('moderationFlags.moderationNotes.moderator', 'username')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await ForumPost.countDocuments(query);

    res.json({
      success: true,
      data: {
        posts,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch posts',
      error: error.message
    });
  }
};

// Get pending posts (awaiting admin approval)
exports.getPendingContent = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const [pendingPosts, total] = await Promise.all([
      ForumPost.find({ status: 'pending' })
        .populate('author', 'username email firstName lastName')
        .populate('topic', 'title')
        .populate('moderationFlags.flaggedBy.user', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      ForumPost.countDocuments({ status: 'pending' })
    ]);

    res.json({
      success: true,
      data: {
        pendingPosts,
        totalPages: Math.ceil(total / limitNum),
        currentPage: parseInt(page, 10),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching pending content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending content',
      error: error.message
    });
  }
};

// Get flagged content
exports.getFlaggedContent = async (req, res) => {
  try {
    const { type = 'both' } = req.query;
    
    const flaggedTopics = type === 'posts' ? [] : await ForumTopic.find(flaggedContentTopicQuery)
      .populate('author', 'username email firstName lastName')
      .populate('moderationFlags.flaggedBy.user', 'username')
      .sort({ 'moderationFlags.flaggedBy.flaggedAt': -1 });

    // Flagged posts are those with isFlagged=true (may be pending or active)
    const flaggedPosts = type === 'topics' ? [] : await ForumPost.find(flaggedContentPostQuery)
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
      case 'archive':
        topic.status = 'archived';
        break;
      case 'restrict':
        // Restrict: archive the topic (similar to archive but with different semantics)
        topic.status = 'archived';
        topic.moderationFlags.isFlagged = false; // Clear flag since it's restricted
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

    // Determine if note should be sent to user
    const notifyUser = action === 'restrict' || action === 'archive';
    
    // Add moderation note
    topic.moderationFlags.moderationNotes.push({
      moderator: moderatorId,
      note: note || `Topic ${action}ed by moderator`,
      action: action,
      notifyUser: notifyUser,
      createdAt: new Date()
    });

    // If action requires user notification, create notification
    if (notifyUser && note) {
      const title = `Your topic has been ${action === 'restrict' ? 'restricted' : 'archived'}`;
      const link = `/forum/topic/${topic._id}`;
      await User.findByIdAndUpdate(topic.author, {
        $push: {
          notifications: {
            type: 'moderation',
            title,
            message: note,
            link,
            read: false,
            createdAt: new Date()
          }
        }
      });
      // Real-time: push notification SSE immediately so the bell updates without polling delay
      sendToUser(topic.author, 'notification', { type: 'moderation', title, message: note, link });
      setImmediate(() => {
        notificationService.sendModerationNotificationEmailIfEnabled(topic.author, {
          title,
          message: note,
          link
        }).catch((err) => console.error('[moderation] notification email failed:', err.message));
      });
    }

    await topic.save();

    broadcast('forum_updated', { action, type: 'topic', id: String(topicId) });
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
        // Approve: review ok - clear flags, keep post active
        post.moderationFlags.isFlagged = false;
        post.moderationFlags.hasSensitiveContent = false;
        post.status = 'active'; // Keep post active (already visible)
        break;
      case 'restrict':
        // Restrict: hide the post (for flagged posts with bad content)
        post.status = 'hidden';
        post.moderationFlags.isFlagged = false; // Clear flag since it's restricted
        break;
      case 'archive':
        // Archive: permanently hide the post (similar to hide but with different semantics)
        post.status = 'hidden';
        post.moderationFlags.isFlagged = false; // Clear flag since it's archived
        break;
      case 'mark_sensitive':
        post.moderationFlags.hasSensitiveContent = true;
        post.moderationFlags.sensitiveContentType = sensitiveContentType;
        break;
      case 'flag':
        post.moderationFlags.isFlagged = true;
        // Post stays active but gets flagged marker
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action'
        });
    }

    // Determine if note should be sent to user
    // For approve: admin-only (notifyUser = false)
    // For restrict: send to user (notifyUser = true)
    const notifyUser = action === 'restrict' || action === 'hide' || action === 'delete' || action === 'archive';
    
    // Add moderation note
    post.moderationFlags.moderationNotes.push({
      moderator: moderatorId,
      note: note || `Post ${action}ed by moderator`,
      action: action,
      notifyUser: notifyUser,
      createdAt: new Date()
    });

    // If action requires user notification, create notification
    if (notifyUser && note) {
      const title = `Your post has been ${action === 'restrict' ? 'restricted' : action === 'hide' ? 'hidden' : action === 'delete' ? 'deleted' : 'archived'}`;
      const link = `/forum/topic/${post.topic}`;
      await User.findByIdAndUpdate(post.author, {
        $push: {
          notifications: {
            type: 'moderation',
            title,
            message: note,
            link,
            read: false,
            createdAt: new Date()
          }
        }
      });
      // Real-time: push notification SSE immediately so the bell updates without polling delay
      sendToUser(post.author, 'notification', { type: 'moderation', title, message: note, link });
      setImmediate(() => {
        notificationService.sendModerationNotificationEmailIfEnabled(post.author, {
          title,
          message: note,
          link
        }).catch((err) => console.error('[moderation] notification email failed:', err.message));
      });
    }

    await post.save();

    broadcast('forum_updated', { action, type: 'post', id: String(postId) });
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

// Restrict user (synced with user management: updates User document)
exports.restrictUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, durationDays } = req.body;
    const duration = Math.min(365, Math.max(1, parseInt(durationDays, 10) || 30));
    const restrictionEndDate = new Date();
    restrictionEndDate.setDate(restrictionEndDate.getDate() + duration);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isRestricted = true;
    user.restrictedSince = new Date();
    user.restrictionEndDate = restrictionEndDate;
    user.restrictionReason = (reason && String(reason).trim()) ? String(reason).trim() : '';
    user.status = 'restricted';
    await user.save();

    const adminId = req.admin && (req.admin._id || req.admin.id);
    if (adminId) {
      await logAdminActivity(
        adminId,
        'restrict_user_forum',
        `Restricted user (forum): ${user.username} until ${restrictionEndDate.toLocaleDateString()}`,
        JSON.stringify({ userId: user._id, reason: user.restrictionReason })
      );
    }

    res.json({
      success: true,
      message: 'User restricted successfully',
      data: {
        _id: user._id,
        user: { _id: user._id, username: user.username, email: user.email },
        reason: user.restrictionReason,
        endDate: user.restrictionEndDate,
        restrictedSince: user.restrictedSince
      }
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

// Get user restrictions: every user with post or comment (forum) restriction from User collection
exports.getUserRestrictions = async (req, res) => {
  try {
    const { page = 1, limit = 100, active = 'true' } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10)));

    // Users with forum restriction (cannot post or comment)
    const query = { isRestricted: true };
    if (active === 'true') {
      query.$or = [
        { restrictionEndDate: { $gt: new Date() } },
        { restrictionEndDate: null },
        { restrictionEndDate: { $exists: false } }
      ];
    }

    const users = await User.find(query)
      .select('username email restrictedSince restrictionEndDate restrictionReason')
      .sort({ restrictionEndDate: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await User.countDocuments(query);
    const restrictions = users.map((u) => ({
      _id: u._id,
      user: { _id: u._id, username: u.username, email: u.email },
      reason: u.restrictionReason || '',
      endDate: u.restrictionEndDate,
      restrictedSince: u.restrictedSince,
      restrictionType: 'forum',
      isActive: u.restrictionEndDate && new Date(u.restrictionEndDate) > new Date()
    }));

    res.json({
      success: true,
      data: {
        restrictions,
        totalPages: Math.ceil(total / limitNum),
        currentPage: parseInt(page, 10),
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

// Lift user restriction (synced with user management: clear User restriction fields)
exports.liftRestriction = async (req, res) => {
  try {
    const { restrictionId } = req.params;
    // restrictionId is the user id when using User-based restrictions
    const user = await User.findById(restrictionId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User or restriction not found'
      });
    }

    user.isRestricted = false;
    user.restrictedSince = null;
    user.restrictionEndDate = null;
    user.restrictionReason = null;
    user.status = 'active';
    await user.save();

    res.json({
      success: true,
      message: 'Restriction lifted successfully',
      data: { _id: user._id, user: { username: user.username, email: user.email } }
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

// Get moderation statistics (count flagged as isFlagged OR has any flaggedBy entry)
exports.getModerationStats = async (req, res) => {
  try {
    // NOTE:
    // - Auto-moderation (Python model) marks content as hasSensitiveContent=true.
    // - User reports go to "User Escalate" and should NOT inflate "Total Flagged".
    //   They only add entries to moderationFlags.flaggedBy and set isFlagged=true.
    // - Therefore, for statistics we only count items where the model has
    //   detected sensitive content (hasSensitiveContent=true), ignoring
    //   pure user reports.
    const flaggedTopicQuery = {
      'moderationFlags.hasSensitiveContent': true
    };
    const flaggedPostQuery = {
      'moderationFlags.hasSensitiveContent': true
    };
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
      ForumTopic.countDocuments(flaggedTopicQuery),
      ForumPost.countDocuments(),
      ForumPost.countDocuments(flaggedPostQuery),
      User.countDocuments({ isRestricted: true, restrictionEndDate: { $gt: new Date() } }),
      User.countDocuments({ isRestricted: true }),
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

// Get admin notifications (e.g. auto-flagged forum content)
exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = 'false' } = req.query;
    const adminId = req.admin?._id || req.admin?.id;

    // Show global notifications (no targetAdminId) + ones targeted to this admin
    const visibilityFilter = adminId
      ? { $or: [{ targetAdminId: null }, { targetAdminId: adminId }] }
      : { targetAdminId: null };

    const baseQuery = unreadOnly === 'true'
      ? { read: false, ...visibilityFilter }
      : { ...visibilityFilter };

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));

    const unreadQuery = { read: false, ...visibilityFilter };

    const [notifications, total, unreadCount] = await Promise.all([
      AdminNotification.find(baseQuery).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      AdminNotification.countDocuments(baseQuery),
      AdminNotification.countDocuments(unreadQuery)
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        totalPages: Math.ceil(total / limitNum),
        currentPage: parseInt(page, 10),
        total,
        unreadCount
      }
    });
  } catch (error) {
    console.error('Error fetching admin notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
};

// Get user escalation reports (topics/posts reported by users)
exports.getUserEscalations = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20
    } = req.query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));

    const typeFilter = {
      type: {
        $in: [
          'forum_user_report',
          'forum_user_report_reply',
          'forum_user_report_topic'
        ]
      }
    };

    const items = await AdminNotification.find(typeFilter)
      .sort({ createdAt: -1 })
      .populate({
        path: 'meta.postId',
        select: 'content author topic createdAt moderationFlags',
        populate: [
          { path: 'author', select: 'username email', model: 'User' },
          { path: 'moderationFlags.flaggedBy.user', select: 'username email', model: 'User' }
        ]
      })
      .populate({
        path: 'meta.topicId',
        select: 'title description author createdAt moderationFlags',
        populate: [
          { path: 'author', select: 'username email', model: 'User' },
          { path: 'moderationFlags.flaggedBy.user', select: 'username email', model: 'User' }
        ]
      })
      .populate('meta.authorId', 'username email')
      .populate('meta.reporterId', 'username email')
      .populate('meta.reports.reporterId', 'username email')
      .lean();

    const groupedMap = new Map();

    items.forEach((item) => {
      const postId = item.meta?.postId?._id?.toString?.() || item.meta?.postId?.toString?.();
      const topicId = item.meta?.topicId?._id?.toString?.() || item.meta?.topicId?.toString?.();
      const groupKey = postId
        ? `post:${postId}`
        : topicId
          ? `topic:${topicId}`
          : `notification:${item._id}`;
      const itemReports = Array.isArray(item.meta?.reports) && item.meta.reports.length
        ? item.meta.reports
        : item.meta?.reason
          ? [{
              reporterId: item.meta.reporterId,
              reason: item.meta.reason,
              createdAt: item.createdAt
            }]
          : [];

      if (!groupedMap.has(groupKey)) {
        // Recover old reason into reports if the reports array is empty (pre-fix data)
        const recoveredReports = itemReports.length ? itemReports
          : item.meta?.reason
            ? [{ reporterId: item.meta.reporterId, reason: item.meta.reason, createdAt: item.createdAt }]
            : [];
        groupedMap.set(groupKey, {
          ...item,
          meta: {
            ...item.meta,
            reportCount: Math.max(item.meta?.reportCount || 0, recoveredReports.length, item.meta?.reason ? 1 : 0),
            reports: [...recoveredReports]
          }
        });
        return;
      }

      const existing = groupedMap.get(groupKey);
      // Also recover old reason from existing entry if its reports are empty
      const existingReports = existing.meta?.reports?.length
        ? existing.meta.reports
        : existing.meta?.reason
          ? [{ reporterId: existing.meta.reporterId, reason: existing.meta.reason, createdAt: existing.createdAt }]
          : [];
      const mergedReports = [...existingReports, ...itemReports].sort(
        (a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)
      );
      const latestReport = mergedReports[0];

      groupedMap.set(groupKey, {
        ...existing,
        createdAt: new Date(item.createdAt) > new Date(existing.createdAt) ? item.createdAt : existing.createdAt,
        read: existing.read && item.read,
        meta: {
          ...existing.meta,
          reporterId: latestReport?.reporterId || existing.meta?.reporterId,
          reason: latestReport?.reason || existing.meta?.reason,
          reportCount: mergedReports.length,
          reports: mergedReports
        }
      });
    });

    // Use flaggedBy on the post/topic as the authoritative source to recover any missing reports
    const groupedItems = Array.from(groupedMap.values()).map(item => {
      const flaggedBy = item.meta?.postId?.moderationFlags?.flaggedBy
        || item.meta?.topicId?.moderationFlags?.flaggedBy
        || [];

      if (!flaggedBy.length) return item;

      const existingReporterIds = new Set(
        (item.meta?.reports || []).map(r =>
          r.reporterId?._id?.toString() || r.reporterId?.toString()
        ).filter(Boolean)
      );

      const recoveredFromFlaggedBy = flaggedBy
        .filter(fb => {
          const fbUserId = fb.user?._id?.toString() || fb.user?.toString();
          return fbUserId && !existingReporterIds.has(fbUserId);
        })
        .map(fb => ({
          reporterId: fb.user,
          reason: fb.reason || 'Reported by user',
          createdAt: fb.flaggedAt || item.createdAt
        }));

      if (!recoveredFromFlaggedBy.length) return item;

      const allReports = [...(item.meta?.reports || []), ...recoveredFromFlaggedBy].sort(
        (a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)
      );

      return {
        ...item,
        meta: {
          ...item.meta,
          reports: allReports,
          reportCount: Math.max(item.meta?.reportCount || 0, allReports.length)
        }
      };
    }).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const total = groupedItems.length;
    const paginatedItems = groupedItems.slice(skip, skip + limitNum);

    res.json({
      success: true,
      data: {
        escalations: paginatedItems,
        totalPages: Math.ceil(total / limitNum),
        currentPage: parseInt(page, 10),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching user escalations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user escalations',
      error: error.message
    });
  }
};

// Mark notification as read
exports.markNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const adminId = req.admin && req.admin.id;
    const updated = await AdminNotification.findByIdAndUpdate(
      notificationId,
      { read: true, readAt: new Date(), readBy: adminId },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification',
      error: error.message
    });
  }
};

// Mark all notifications as read for the current admin
exports.markAllNotificationsRead = async (req, res) => {
  try {
    const adminId = req.admin?._id || req.admin?.id;
    const visibilityFilter = adminId
      ? { $or: [{ targetAdminId: null }, { targetAdminId: adminId }] }
      : { targetAdminId: null };
    const result = await AdminNotification.updateMany(
      { read: { $ne: true }, ...visibilityFilter },
      { $set: { read: true, readAt: new Date(), readBy: adminId } }
    );
    res.json({
      success: true,
      data: { modifiedCount: result.modifiedCount }
    });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all as read',
      error: error.message
    });
  }
};




