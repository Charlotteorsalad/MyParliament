const Topic = require('../models/Topic');

// Get all active topics with optional filtering
const getAllTopics = async (filters = {}) => {
  try {
    const query = { status: 'Active' };
    
    // Apply category filter
    if (filters.category && filters.category !== 'All') {
      query.category = filters.category;
    }
    
    // Apply search filter
    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
        { content: { $regex: filters.search, $options: 'i' } }
      ];
    }
    
    // Apply featured filter
    if (filters.featured !== undefined) {
      query.featured = filters.featured;
    }
    
    const topics = await Topic.find(query)
      .populate('createdBy', 'username email')
      .populate('updatedBy', 'username email')
      .sort({ priority: -1, featured: -1, lastUpdated: -1 })
      .lean();
    
    return topics;
  } catch (error) {
    console.error('Error in getAllTopics service:', error);
    throw error;
  }
};

// Get topic by ID
const getTopicById = async (topicId) => {
  try {
    const topic = await Topic.findById(topicId)
      .populate('createdBy', 'username email')
      .populate('updatedBy', 'username email')
      .populate('bookmarks', 'username email');
    
    if (!topic) {
      throw new Error('Topic not found');
    }
    
    return topic;
  } catch (error) {
    console.error('Error in getTopicById service:', error);
    throw error;
  }
};

// Create new topic
const createTopic = async (topicData) => {
  try {
    const topic = new Topic(topicData);
    await topic.save();
    
    return await Topic.findById(topic._id)
      .populate('createdBy', 'username email')
      .populate('updatedBy', 'username email');
  } catch (error) {
    console.error('Error in createTopic service:', error);
    throw error;
  }
};

// Update topic
const updateTopic = async (topicId, updateData) => {
  try {
    const topic = await Topic.findByIdAndUpdate(
      topicId,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'username email')
      .populate('updatedBy', 'username email');
    
    if (!topic) {
      throw new Error('Topic not found');
    }
    
    return topic;
  } catch (error) {
    console.error('Error in updateTopic service:', error);
    throw error;
  }
};

// Delete topic
const deleteTopic = async (topicId) => {
  try {
    const topic = await Topic.findByIdAndDelete(topicId);
    
    if (!topic) {
      throw new Error('Topic not found');
    }
    
    return topic;
  } catch (error) {
    console.error('Error in deleteTopic service:', error);
    throw error;
  }
};

// Increment view count
const incrementViews = async (topicId) => {
  try {
    await Topic.findByIdAndUpdate(topicId, { $inc: { views: 1 } });
  } catch (error) {
    console.error('Error in incrementViews service:', error);
    throw error;
  }
};

// Toggle bookmark
const toggleBookmark = async (topicId, userId) => {
  try {
    const topic = await Topic.findById(topicId);
    
    if (!topic) {
      throw new Error('Topic not found');
    }
    
    const bookmarkIndex = topic.bookmarks.indexOf(userId);
    
    if (bookmarkIndex > -1) {
      // Remove bookmark
      topic.bookmarks.splice(bookmarkIndex, 1);
    } else {
      // Add bookmark
      topic.bookmarks.push(userId);
    }
    
    await topic.save();
    
    return topic.bookmarks.length;
  } catch (error) {
    console.error('Error in toggleBookmark service:', error);
    throw error;
  }
};

// Get topic statistics
const getTopicStats = async () => {
  try {
    const stats = await Topic.aggregate([
      { $match: { status: 'Active' } },
      {
        $group: {
          _id: null,
          totalTopics: { $sum: 1 },
          totalViews: { $sum: '$views' },
          totalBookmarks: { $sum: { $size: '$bookmarks' } },
          totalLikes: { $sum: '$likes' },
          categories: { $addToSet: '$category' }
        }
      }
    ]);
    
    return stats[0] || {
      totalTopics: 0,
      totalViews: 0,
      totalBookmarks: 0,
      totalLikes: 0,
      categories: []
    };
  } catch (error) {
    console.error('Error in getTopicStats service:', error);
    throw error;
  }
};

// Get categories
const getCategories = async () => {
  try {
    const categories = await Topic.distinct('category', { status: 'Active' });
    return ['All', ...categories.sort()];
  } catch (error) {
    console.error('Error in getCategories service:', error);
    throw error;
  }
};

module.exports = {
  getAllTopics,
  getTopicById,
  createTopic,
  updateTopic,
  deleteTopic,
  incrementViews,
  toggleBookmark,
  getTopicStats,
  getCategories
};
