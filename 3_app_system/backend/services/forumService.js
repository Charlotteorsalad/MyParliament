const ForumTopic = require('../models/ForumTopic');
const ForumPost = require('../models/ForumPost');
const User = require('../models/User');
const AdminNotification = require('../models/AdminNotification');
const contentModerationService = require('./contentModerationService');
const notificationService = require('./notificationService');

// Helper: check if the current user has already reported this item (topic or post)
function currentUserHasReported(flaggedBy, userId) {
  if (!userId) return false;
  return (flaggedBy || []).some(
    (e) => e.user && e.user.toString() === userId.toString()
  );
}

class ForumService {
  // Get all forum topics with pagination and filtering
  async getAllTopics(queryParams = {}, userId = null) {
    const {
      page = 1,
      limit = 10,
      category,
      search,
      status = 'active',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = queryParams;

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Build filter: show active and flagged topics to users (flagged stays visible until admin hides/archives)
    const filter = {};
    if (status === 'active') {
      filter.status = { $in: ['active', 'flagged'] }; // include flagged so users still see them
    } else {
      filter.status = status;
    }
    if (category && category !== 'all') {
      filter.category = category;
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const topics = await ForumTopic.find(filter)
      .populate('author', 'username email')
      .populate('posts')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ForumTopic.countDocuments(filter);

    const topicsWithFlag = topics.map((t) => {
      const obj = t.toObject ? t.toObject() : t;
      obj.currentUserHasReported = currentUserHasReported(
        t.moderationFlags?.flaggedBy,
        userId
      );
      return obj;
    });

    return {
      topics: topicsWithFlag,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    };
  }

  // Get single topic with posts - exclude flagged topics from public view
  async getTopicById(topicId, userId = null) {
    const topic = await ForumTopic.findById(topicId)
      .populate('author', 'username email');

    if (!topic) {
      throw new Error('Topic not found');
    }

    // Only hide from public when admin has archived (or explicitly hidden) the topic.
    // Flagged content remains visible to users until admin takes action.
    if (topic.status === 'archived') {
      throw new Error('Topic not found');
    }

    // Include all posts except deleted; hidden ones will show placeholder to user
    const posts = await ForumPost.find({
      topic: topicId,
      status: { $nin: ['deleted'] }
    })
      .populate('author', 'username email')
      .sort({ createdAt: 1 });

    // Increment view count first
    await ForumTopic.findByIdAndUpdate(topicId, { $inc: { viewCount: 1 } });

    // Get updated topic with incremented viewCount
    const updatedTopic = await ForumTopic.findById(topicId)
      .populate('author', 'username email');

    const topicObj = updatedTopic.toObject ? updatedTopic.toObject() : updatedTopic;
    topicObj.currentUserHasReported = currentUserHasReported(
      updatedTopic.moderationFlags?.flaggedBy,
      userId
    );
    topicObj.posts = posts.map((p) => {
      const po = p.toObject ? p.toObject() : p;
      po.currentUserHasReported = currentUserHasReported(
        p.moderationFlags?.flaggedBy,
        userId
      );
      if (p.status === 'hidden') {
        po.hiddenByAdmin = true;
        po.content = null;
      }
      return po;
    });

    return topicObj;
  }

  // Create new topic
  async createTopic(topicData, userId) {
    console.log('[ForumService.createTopic] Called for user:', userId);
    const topic = new ForumTopic({
      ...topicData,
      author: userId
    });

    await topic.save();
    console.log('[ForumService.createTopic] Topic saved with ID:', topic._id);

    // Zero-shot moderation (EN/Malay): check title and description for bad content
    const textToCheck = `${topicData.title || ''} ${topicData.description || ''}`.trim();
    console.log('[ForumService.createTopic] Text to moderate:', textToCheck);
    if (textToCheck) {
      setImmediate(() => {
        console.log('[ForumService.createTopic] Calling moderation service NOW for topic:', topic._id);
        contentModerationService.checkAndFlagTopic(topic._id.toString(), textToCheck)
          .then(() => {
            console.log('[ForumService.createTopic] Moderation check completed successfully');
          })
          .catch((err) => {
            console.error('[ForumService.createTopic] Moderation check FAILED:', err.message);
            console.error('[ForumService.createTopic] Full error:', err);
          });
      });
    } else {
      console.log('[ForumService.createTopic] No text to moderate');
    }

    return await ForumTopic.findById(topic._id).populate('author', 'username email');
  }

  // Update topic
  async updateTopic(topicId, updateData, userId) {
    const topic = await ForumTopic.findById(topicId);
    if (!topic) {
      throw new Error('Topic not found');
    }

    // Check if user is author or admin
    if (topic.author.toString() !== userId.toString()) {
      throw new Error('Unauthorized to update this topic');
    }

    const updatedTopic = await ForumTopic.findByIdAndUpdate(
      topicId,
      { ...updateData, lastActivity: new Date() },
      { new: true }
    ).populate('author', 'username email');

    return updatedTopic;
  }

  // Delete topic
  async deleteTopic(topicId, userId) {
    const topic = await ForumTopic.findById(topicId);
    if (!topic) {
      throw new Error('Topic not found');
    }

    // Check if user is author or admin
    if (topic.author.toString() !== userId.toString()) {
      throw new Error('Unauthorized to delete this topic');
    }

    // Get all post IDs under this topic (for cascading notification cleanup)
    const postsInTopic = await ForumPost.find({ topic: topicId }).select('_id').lean();
    const postIds = (postsInTopic || []).map((p) => p._id);

    // Remove user-escalate (reported content) and auto-flag notifications for this topic and its posts
    const userEscalateTypes = ['forum_user_report', 'forum_user_report_reply', 'forum_user_report_topic'];
    const flagTypes = ['forum_flagged', 'forum_flagged_reply'];
    await AdminNotification.deleteMany({
      type: { $in: [...userEscalateTypes, ...flagTypes] },
      $or: [
        { 'meta.topicId': topicId },
        ...(postIds.length ? [{ 'meta.postId': { $in: postIds } }] : [])
      ].filter(Boolean)
    });

    // Delete all posts (comments) in this topic
    await ForumPost.deleteMany({ topic: topicId });

    // Delete the topic
    await ForumTopic.findByIdAndDelete(topicId);

    return { message: 'Topic deleted successfully' };
  }

  // Create new post in topic
  async createPost(topicId, postData, userId) {
    const topic = await ForumTopic.findById(topicId);
    if (!topic) {
      throw new Error('Topic not found');
    }

    if (topic.status === 'archived' || (topic.status === 'flagged' && topic.moderationFlags?.isFlagged)) {
      throw new Error('Cannot post in archived or flagged topic');
    }

    // Posts go directly to active - no admin approval needed
    const post = new ForumPost({
      ...postData,
      author: userId,
      topic: topicId,
      status: 'active' // Posts are published immediately
    });

    await post.save();

    // Add post to topic and update last activity
    await ForumTopic.findByIdAndUpdate(topicId, {
      $push: { posts: post._id },
      lastActivity: new Date()
    });

    // Zero-shot moderation (EN/Malay): flag bad content if detected (async, non-blocking)
    const content = (postData && postData.content) || post.content || '';
    if (content) {
      setImmediate(() => {
        contentModerationService.checkAndFlagPost(post._id.toString(), content).catch((err) => {
          console.error('Forum post moderation check failed:', err);
        });
      });
    }

    // Notify topic author of new post in their discussion (if not their own post)
    const topicAuthorId = topic.author && topic.author.toString();
    if (topicAuthorId && topicAuthorId !== userId.toString()) {
      setImmediate(() => {
        notificationService.notifyUser(
          topic.author,
          {
            type: 'system',
            title: 'New post in your discussion',
            message: `Someone posted in "${topic.title || 'your discussion'}".`,
            link: `/forum/topic/${topicId}`
          },
          'discussionUpdates'
        ).catch((err) => console.error('[forum] discussion notification failed:', err.message));
      });
    }

    return await ForumPost.findById(post._id).populate('author', 'username email');
  }

  // Reply to a post
  async replyToPost(postId, replyData, userId) {
    const parentPost = await ForumPost.findById(postId);
    if (!parentPost) {
      throw new Error('Parent post not found');
    }

    // Replies go directly to active - no admin approval needed
    const reply = new ForumPost({
      ...replyData,
      author: userId,
      topic: parentPost.topic,
      parentPost: postId,
      status: 'active' // Replies are published immediately
    });

    await reply.save();

    // Add reply to parent post
    await ForumPost.findByIdAndUpdate(postId, {
      $push: { replies: reply._id }
    });

    // Update topic last activity
    await ForumTopic.findByIdAndUpdate(parentPost.topic, {
      lastActivity: new Date()
    });

    // Zero-shot moderation (EN/Malay): flag bad content if detected (async, non-blocking)
    const replyContent = (replyData && replyData.content) || reply.content || '';
    if (replyContent) {
      setImmediate(() => {
        contentModerationService.checkAndFlagPost(reply._id.toString(), replyContent).catch((err) => {
          console.error('Forum reply moderation check failed:', err);
        });
      });
    }

    // Notify parent post author of new reply (if not replying to self)
    const parentAuthorId = parentPost.author && parentPost.author.toString();
    if (parentAuthorId && parentAuthorId !== userId.toString()) {
      const topicId = parentPost.topic && parentPost.topic.toString();
      setImmediate(() => {
        notificationService.notifyUser(
          parentPost.author,
          {
            type: 'system',
            title: 'New reply to your post',
            message: 'Someone replied to your post in the forum.',
            link: topicId ? `/forum/topic/${topicId}` : '/forum'
          },
          'discussionUpdates'
        ).catch((err) => console.error('[forum] discussion notification failed:', err.message));
      });
    }

    return await ForumPost.findById(reply._id).populate('author', 'username email');
  }

  // Get posts for a topic
  async getTopicPosts(topicId, queryParams = {}, userId = null) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'asc'
    } = queryParams;

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Include hidden posts (show placeholder); exclude only deleted
    const posts = await ForumPost.find({ 
      topic: topicId,
      status: { $nin: ['deleted'] }
    })
      .populate('author', 'username email')
      .populate({
        path: 'replies',
        populate: {
          path: 'author',
          select: 'username email'
        }
      })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ForumPost.countDocuments({ 
      topic: topicId,
      status: { $nin: ['deleted'] }
    });

    const postsWithFlag = posts.map((p) => {
      const obj = p.toObject ? p.toObject() : p;
      obj.currentUserHasReported = currentUserHasReported(
        p.moderationFlags?.flaggedBy,
        userId
      );
      if (p.status === 'hidden') {
        obj.hiddenByAdmin = true;
        obj.content = null;
      }
      return obj;
    });

    return {
      posts: postsWithFlag,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    };
  }

  // Like/unlike a post
  async togglePostLike(postId, userId) {
    const post = await ForumPost.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    const existingLike = post.likes.find(like => like.user.toString() === userId.toString());
    
    if (existingLike) {
      // Unlike
      post.likes = post.likes.filter(like => like.user.toString() !== userId.toString());
    } else {
      // Like
      post.likes.push({ user: userId });
    }

    await post.save();
    return post;
  }

  // Report a post/reply as offensive (user escalation)
  async reportPost(postId, userId, reason) {
    const post = await ForumPost.findById(postId)
      .populate('topic', 'title')
      .populate('author', 'username');

    if (!post) {
      throw new Error('Post not found');
    }

    // Avoid duplicate reports from the same user
    const alreadyReported = (post.moderationFlags?.flaggedBy || []).some(
      (entry) => entry.user && entry.user.toString() === userId.toString()
    );
    const normalizedReason = reason && String(reason).trim()
      ? String(reason).trim()
      : 'Reported by user as offensive';

    if (!alreadyReported) {
      post.moderationFlags.flaggedBy.push({
        user: userId,
        reason: normalizedReason,
        flaggedAt: new Date()
      });
    }

    // Mark post as flagged for admin review (but keep it visible; status stays active)
    post.moderationFlags.isFlagged = true;
    await post.save();

    // Create an admin notification so moderators can see the escalation
    const isReply = !!post.parentPost;
    const title = isReply ? 'Forum reply reported by user' : 'Forum post reported by user';
    const type = isReply ? 'forum_user_report_reply' : 'forum_user_report';
    const topicTitle = (post.topic && post.topic.title) || 'Unknown';

    if (!alreadyReported) {
      const reportEntry = {
        reporterId: userId,
        reason: normalizedReason,
        createdAt: new Date()
      };
      const existingNotification = await AdminNotification.findOne({
        type,
        'meta.postId': post._id
      });

      if (existingNotification) {
        // Recover old reason from meta.reason if reports array is empty (pre-fix data)
        let existingReports = Array.isArray(existingNotification.meta?.reports) && existingNotification.meta.reports.length
          ? existingNotification.meta.reports
          : existingNotification.meta?.reason
            ? [{
                reporterId: existingNotification.meta.reporterId,
                reason: existingNotification.meta.reason,
                createdAt: existingNotification.createdAt
              }]
            : [];

        const currentCount = Math.max(
          existingNotification.meta?.reportCount || 0,
          existingReports.length,
          1
        );

        existingNotification.meta.reporterId = userId;
        existingNotification.meta.reason = normalizedReason;
        existingNotification.meta.reportCount = currentCount + 1;
        existingNotification.meta.reports = [...existingReports, reportEntry];
        existingNotification.message = isReply
          ? `A reply has been reported by ${existingNotification.meta.reportCount} users. Topic: "${topicTitle}".`
          : `A post has been reported by ${existingNotification.meta.reportCount} users. Topic: "${topicTitle}".`;
        existingNotification.read = false;
        existingNotification.readAt = undefined;
        existingNotification.readBy = undefined;
        await existingNotification.save();
      } else {
        await AdminNotification.create({
          type,
          title,
          message: isReply
            ? `A reply has been reported by 1 user. Topic: "${topicTitle}".`
            : `A post has been reported by 1 user. Topic: "${topicTitle}".`,
          link: `/admin/forum-moderation#userEscalate`,
          meta: {
            postId: post._id,
            topicId: post.topic && post.topic._id,
            authorId: post.author && post.author._id,
            reporterId: userId,
            reason: normalizedReason,
            reportCount: 1,
            reports: [reportEntry]
          }
        });
      }
    }

    return post;
  }

  // Report a topic (original discussion) as offensive (user escalation)
  async reportTopic(topicId, userId, reason) {
    const topic = await ForumTopic.findById(topicId).populate('author', 'username');
    if (!topic) {
      throw new Error('Topic not found');
    }

    // Avoid duplicate reports from the same user
    const alreadyReported = (topic.moderationFlags?.flaggedBy || []).some(
      (entry) => entry.user && entry.user.toString() === userId.toString()
    );
    const normalizedReason = reason && String(reason).trim()
      ? String(reason).trim()
      : 'Reported by user as offensive';

    if (!alreadyReported) {
      topic.moderationFlags.flaggedBy.push({
        user: userId,
        reason: normalizedReason,
        flaggedAt: new Date()
      });
    }

    // Mark topic as flagged for admin review (but keep it visible in internal tools)
    topic.moderationFlags.isFlagged = true;
    await topic.save();

    if (!alreadyReported) {
      const reportEntry = {
        reporterId: userId,
        reason: normalizedReason,
        createdAt: new Date()
      };
      const existingNotification = await AdminNotification.findOne({
        type: 'forum_user_report_topic',
        'meta.topicId': topic._id
      });

      if (existingNotification) {
        // Recover old reason from meta.reason if reports array is empty (pre-fix data)
        let existingReports = Array.isArray(existingNotification.meta?.reports) && existingNotification.meta.reports.length
          ? existingNotification.meta.reports
          : existingNotification.meta?.reason
            ? [{
                reporterId: existingNotification.meta.reporterId,
                reason: existingNotification.meta.reason,
                createdAt: existingNotification.createdAt
              }]
            : [];

        const currentCount = Math.max(
          existingNotification.meta?.reportCount || 0,
          existingReports.length,
          1
        );

        existingNotification.meta.reporterId = userId;
        existingNotification.meta.reason = normalizedReason;
        existingNotification.meta.reportCount = currentCount + 1;
        existingNotification.meta.reports = [...existingReports, reportEntry];
        existingNotification.message = `A topic has been reported by ${existingNotification.meta.reportCount} users. Topic: "${topic.title}".`;
        existingNotification.read = false;
        existingNotification.readAt = undefined;
        existingNotification.readBy = undefined;
        await existingNotification.save();
      } else {
        await AdminNotification.create({
          type: 'forum_user_report_topic',
          title: 'Forum topic reported by user',
          message: `A topic has been reported by 1 user. Topic: "${topic.title}".`,
          link: `/admin/forum-moderation#userEscalate`,
          meta: {
            topicId: topic._id,
            authorId: topic.author && topic.author._id,
            reporterId: userId,
            reason: normalizedReason,
            reportCount: 1,
            reports: [reportEntry]
          }
        });
      }
    }

    return topic;
  }

  // Get user's created topics
  async getUserTopics(userId, queryParams = {}) {
    const {
      page = 1,
      limit = 10,
    } = queryParams;

    const skip = (page - 1) * limit;

    // Show both active and flagged topics to the author (archived are hidden)
    const filter = { author: userId, status: { $in: ['active', 'flagged'] } };

    const topics = await ForumTopic.find(filter)
      .populate('author', 'username email')
      .populate('posts')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ForumTopic.countDocuments(filter);

    return {
      topics,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    };
  }

  // Get forum statistics (user-facing: only active, non-flagged content)
  async getForumStats() {
    const publicTopicFilter = { status: 'active', 'moderationFlags.isFlagged': { $ne: true } };
    const totalTopics = await ForumTopic.countDocuments(publicTopicFilter);
    const totalPosts = await ForumPost.countDocuments({ status: 'active' });
    const totalUsers = await User.countDocuments({});
    
    // Get most active topics (exclude flagged)
    const mostActiveTopics = await ForumTopic.find(publicTopicFilter)
      .sort({ lastActivity: -1 })
      .limit(5)
      .populate('author', 'name')
      .select('title lastActivity viewCount posts');

    // Get recent activity (exclude hidden posts)
    const recentPosts = await ForumPost.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('author', 'name')
      .populate('topic', 'title')
      .select('content createdAt author topic');

    return {
      totalTopics,
      totalPosts,
      totalUsers,
      mostActiveTopics,
      recentPosts
    };
  }

  // Search topics and posts
  async searchForum(query, queryParams = {}) {
    const {
      page = 1,
      limit = 10,
      type = 'all' // 'topics', 'posts', or 'all'
    } = queryParams;

    const skip = (page - 1) * limit;
    const searchRegex = { $regex: query, $options: 'i' };

    let results = { topics: [], posts: [], pagination: {} };

    if (type === 'all' || type === 'topics') {
      const topicSearchFilter = {
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { tags: { $in: [searchRegex] } }
        ],
        status: 'active',
        'moderationFlags.isFlagged': { $ne: true }
      };
      const topics = await ForumTopic.find(topicSearchFilter)
        .populate('author', 'username email')
        .sort({ lastActivity: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const totalTopics = await ForumTopic.countDocuments(topicSearchFilter);

      results.topics = topics;
      results.pagination.topics = {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalTopics / limit),
        totalItems: totalTopics,
        itemsPerPage: parseInt(limit)
      };
    }

    if (type === 'all' || type === 'posts') {
      const posts = await ForumPost.find({
        content: searchRegex,
        status: 'active'
      })
        .populate('author', 'username email')
        .populate('topic', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const totalPosts = await ForumPost.countDocuments({
        content: searchRegex,
        status: 'active'
      });

      results.posts = posts;
      results.pagination.posts = {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalPosts / limit),
        totalItems: totalPosts,
        itemsPerPage: parseInt(limit)
      };
    }

    return results;
  }
}

module.exports = new ForumService();
