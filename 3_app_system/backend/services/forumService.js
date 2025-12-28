const ForumTopic = require('../models/ForumTopic');
const ForumPost = require('../models/ForumPost');
const User = require('../models/User');

class ForumService {
  // Get all forum topics with pagination and filtering
  async getAllTopics(queryParams = {}) {
    const {
      page = 1,
      limit = 10,
      category,
      search,
      status = 'active',
      sortBy = 'lastActivity',
      sortOrder = 'desc'
    } = queryParams;

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Build filter object
    const filter = { status };
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
      .populate('author', 'name email')
      .populate('posts')
      .sort(sort)
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

  // Get single topic with posts
  async getTopicById(topicId) {
    const topic = await ForumTopic.findById(topicId)
      .populate('author', 'name email')
      .populate({
        path: 'posts',
        populate: {
          path: 'author',
          select: 'name email'
        },
        options: { sort: { createdAt: 1 } }
      });

    if (!topic) {
      throw new Error('Topic not found');
    }

    // Increment view count
    await ForumTopic.findByIdAndUpdate(topicId, { $inc: { viewCount: 1 } });

    return topic;
  }

  // Create new topic
  async createTopic(topicData, userId) {
    const topic = new ForumTopic({
      ...topicData,
      author: userId
    });

    await topic.save();
    return await ForumTopic.findById(topic._id).populate('author', 'name email');
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
    ).populate('author', 'name email');

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

    // Delete all posts in this topic
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

    if (topic.status === 'locked' || topic.status === 'archived') {
      throw new Error('Cannot post in locked or archived topic');
    }

    const post = new ForumPost({
      ...postData,
      author: userId,
      topic: topicId
    });

    await post.save();

    // Add post to topic and update last activity
    await ForumTopic.findByIdAndUpdate(topicId, {
      $push: { posts: post._id },
      lastActivity: new Date()
    });

    return await ForumPost.findById(post._id).populate('author', 'name email');
  }

  // Reply to a post
  async replyToPost(postId, replyData, userId) {
    const parentPost = await ForumPost.findById(postId);
    if (!parentPost) {
      throw new Error('Parent post not found');
    }

    const reply = new ForumPost({
      ...replyData,
      author: userId,
      topic: parentPost.topic,
      parentPost: postId
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

    return await ForumPost.findById(reply._id).populate('author', 'name email');
  }

  // Get posts for a topic
  async getTopicPosts(topicId, queryParams = {}) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'asc'
    } = queryParams;

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const posts = await ForumPost.find({ topic: topicId })
      .populate('author', 'name email')
      .populate({
        path: 'replies',
        populate: {
          path: 'author',
          select: 'name email'
        }
      })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ForumPost.countDocuments({ topic: topicId });

    return {
      posts,
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

  // Get user's created topics
  async getUserTopics(userId, queryParams = {}) {
    const {
      page = 1,
      limit = 10,
      status = 'active'
    } = queryParams;

    const skip = (page - 1) * limit;

    const topics = await ForumTopic.find({ 
      author: userId,
      status 
    })
      .populate('author', 'name email')
      .populate('posts')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ForumTopic.countDocuments({ 
      author: userId,
      status 
    });

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

  // Get forum statistics
  async getForumStats() {
    const totalTopics = await ForumTopic.countDocuments({ status: 'active' });
    const totalPosts = await ForumPost.countDocuments({ status: 'active' });
    const totalUsers = await User.countDocuments({});
    
    // Get most active topics
    const mostActiveTopics = await ForumTopic.find({ status: 'active' })
      .sort({ lastActivity: -1 })
      .limit(5)
      .populate('author', 'name')
      .select('title lastActivity viewCount posts');

    // Get recent activity
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
      const topics = await ForumTopic.find({
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { tags: { $in: [searchRegex] } }
        ],
        status: 'active'
      })
        .populate('author', 'name email')
        .sort({ lastActivity: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const totalTopics = await ForumTopic.countDocuments({
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { tags: { $in: [searchRegex] } }
        ],
        status: 'active'
      });

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
        .populate('author', 'name email')
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
