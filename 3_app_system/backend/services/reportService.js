const Topic = require('../models/Topic');
const Mp = require('../models/Mp');
const ForumTopic = require('../models/ForumTopic');
const ForumPost = require('../models/ForumPost');
const { EduResource } = require('../models/EduResource');
const Feedback = require('../models/Feedback');
const User = require('../models/User');

class ReportService {
  // Get overall platform statistics
  async getPlatformStats() {
    try {
      const [
        totalTopics,
        totalMPs,
        totalForumTopics,
        totalForumPosts,
        totalEduResources,
        totalFeedback,
        totalUsers
      ] = await Promise.all([
        Topic.countDocuments({ status: 'Active' }),
        Mp.countDocuments({ status: 'current' }),
        ForumTopic.countDocuments({ status: 'active' }),
        ForumPost.countDocuments({ status: 'active' }),
        EduResource.countDocuments({ status: 'published' }),
        Feedback.countDocuments(),
        User.countDocuments()
      ]);

      return {
        topics: {
          total: totalTopics,
          active: totalTopics,
          resolved: 0 // This would need to be calculated based on your business logic
        },
        mps: {
          total: totalMPs,
          active: totalMPs
        },
        forum: {
          totalDiscussions: totalForumTopics,
          totalReplies: totalForumPosts,
          activeUsers: totalUsers
        },
        education: {
          totalResources: totalEduResources,
          totalViews: 0 // This would need to be calculated from views field
        },
        feedback: {
          total: totalFeedback,
          satisfaction: 4.2 // This would need to be calculated from ratings
        }
      };
    } catch (error) {
      console.error('Error getting platform stats:', error);
      throw error;
    }
  }

  // Get topic categories distribution
  async getTopicCategoriesReport(period = '30d') {
    try {
      const dateFilter = this.getDateFilter(period);
      
      const categories = await Topic.aggregate([
        { $match: { status: 'Active', ...dateFilter } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            views: { $sum: '$views' },
            bookmarks: { $sum: { $size: '$bookmarks' } }
          }
        },
        { $sort: { count: -1 } }
      ]);

      const totalTopics = categories.reduce((sum, cat) => sum + cat.count, 0);
      
      const categoriesWithPercentage = categories.map(category => ({
        name: category._id,
        count: category.count,
        percentage: totalTopics > 0 ? Math.round((category.count / totalTopics) * 100) : 0,
        views: category.views,
        bookmarks: category.bookmarks,
        color: this.getCategoryColor(category._id),
        trend: '+0%', // This would need historical data to calculate
        trendDirection: 'up'
      }));

      return {
        totalTopics,
        categories: categoriesWithPercentage,
        period,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Error getting topic categories report:', error);
      throw error;
    }
  }

  // Get MP performance report
  async getMPPerformanceReport(limit = 10) {
    try {
      const topMPs = await Mp.aggregate([
        { $match: { status: 'current' } },
        {
          $project: {
            name: 1,
            party: 1,
            state: 1,
            constituency: 1,
            // These fields would need to be calculated based on your business logic
            responses: { $ifNull: ['$responses', 0] },
            attendance: { $ifNull: ['$attendance', 95] },
            score: { $ifNull: ['$score', 85] }
          }
        },
        { $sort: { score: -1 } },
        { $limit: limit }
      ]);

      return {
        topPerformers: topMPs,
        totalMPs: await Mp.countDocuments({ status: 'current' }),
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Error getting MP performance report:', error);
      throw error;
    }
  }

  // Get user activity report (for authenticated users)
  async getUserActivityReport(userId) {
    try {
      const user = await User.findById(userId).populate('followedMPs followedTopics bookmarks');
      
      if (!user) {
        throw new Error('User not found');
      }

      // Get user's forum activity
      const userForumTopics = await ForumTopic.find({ author: userId });
      const userForumPosts = await ForumPost.find({ author: userId });

      // Get user's bookmarked topics
      const bookmarkedTopics = await Topic.find({ bookmarks: userId });

      // Get user's educational progress
      const eduProgress = await EduResource.find({ 
        _id: { $in: user.bookmarks || [] } 
      });

      return {
        user: {
          name: user.name,
          email: user.email,
          joinedAt: user.createdAt
        },
        activity: {
          bookmarks: {
            topics: bookmarkedTopics.length,
            mps: user.followedMPs?.length || 0,
            edu: user.bookmarks?.length || 0,
            total: bookmarkedTopics.length + (user.followedMPs?.length || 0) + (user.bookmarks?.length || 0)
          },
          discussions: {
            created: userForumTopics.length,
            replies: userForumPosts.length,
            total: userForumTopics.length + userForumPosts.length
          },
          learning: {
            resources: eduProgress.length,
            completed: 0, // This would need to be calculated based on completion tracking
            averageScore: 85 // This would need to be calculated from quiz scores
          },
          engagement: {
            totalActivities: bookmarkedTopics.length + userForumTopics.length + userForumPosts.length,
            lastActivity: user.updatedAt,
            streak: 0 // This would need to be calculated based on daily activity
          }
        },
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Error getting user activity report:', error);
      throw error;
    }
  }

  // Get forum statistics
  async getForumStats() {
    try {
      const [
        totalTopics,
        totalPosts,
        activeUsers,
        mostActiveTopics
      ] = await Promise.all([
        ForumTopic.countDocuments({ status: 'active' }),
        ForumPost.countDocuments({ status: 'active' }),
        User.countDocuments(),
        ForumTopic.find({ status: 'active' })
          .populate('author', 'name')
          .sort({ lastActivity: -1 })
          .limit(5)
          .select('title lastActivity viewCount posts author')
      ]);

      return {
        totalTopics,
        totalPosts,
        activeUsers,
        mostActiveTopics,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Error getting forum stats:', error);
      throw error;
    }
  }

  // Get educational content statistics
  async getEducationStats() {
    try {
      const [
        totalResources,
        totalViews,
        categories
      ] = await Promise.all([
        EduResource.countDocuments({ status: 'published' }),
        EduResource.aggregate([
          { $match: { status: 'published' } },
          { $group: { _id: null, totalViews: { $sum: '$views' } } }
        ]),
        EduResource.aggregate([
          { $match: { status: 'published' } },
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ])
      ]);

      return {
        totalResources,
        totalViews: totalViews[0]?.totalViews || 0,
        categories,
        completionRate: 78, // This would need to be calculated based on user progress
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Error getting education stats:', error);
      throw error;
    }
  }

  // Get feedback statistics
  async getFeedbackStats() {
    try {
      const [
        totalFeedback,
        categories,
        averageRating
      ] = await Promise.all([
        Feedback.countDocuments(),
        Feedback.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        Feedback.aggregate([
          { $group: { _id: null, avgRating: { $avg: '$rating' } } }
        ])
      ]);

      return {
        total: totalFeedback,
        satisfaction: averageRating[0]?.avgRating || 4.2,
        categories: categories.reduce((acc, cat) => {
          acc[cat._id] = cat.count;
          return acc;
        }, {}),
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Error getting feedback stats:', error);
      throw error;
    }
  }

  // Get comprehensive dashboard data
  async getDashboardData(userId = null) {
    try {
      const [
        platformStats,
        topicCategories,
        mpPerformance,
        forumStats,
        educationStats,
        feedbackStats
      ] = await Promise.all([
        this.getPlatformStats(),
        this.getTopicCategoriesReport('30d'),
        this.getMPPerformanceReport(5),
        this.getForumStats(),
        this.getEducationStats(),
        this.getFeedbackStats()
      ]);

      const result = {
        platform: platformStats,
        topicCategories,
        mpPerformance,
        forum: forumStats,
        education: educationStats,
        feedback: feedbackStats,
        generatedAt: new Date()
      };

      // Add user-specific data if userId is provided
      if (userId) {
        result.userActivity = await this.getUserActivityReport(userId);
      }

      return result;
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      throw error;
    }
  }

  // Helper method to get date filter based on period
  getDateFilter(period) {
    const now = new Date();
    let startDate;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return {
      createdAt: { $gte: startDate }
    };
  }

  // Helper method to get category color
  getCategoryColor(category) {
    const colors = {
      'Healthcare': 'bg-blue-500',
      'Education': 'bg-green-500',
      'Environment': 'bg-emerald-500',
      'Economy': 'bg-yellow-500',
      'Security': 'bg-red-500',
      'Technology': 'bg-purple-500',
      'Social': 'bg-pink-500',
      'Politics': 'bg-indigo-500',
      'Infrastructure': 'bg-orange-500',
      'Other': 'bg-gray-500'
    };
    return colors[category] || 'bg-gray-500';
  }

  // Export report data in different formats
  async exportReport(reportType, format = 'json', userId = null) {
    try {
      let data;
      
      switch (reportType) {
        case 'dashboard':
          data = await this.getDashboardData(userId);
          break;
        case 'topics':
          data = await this.getTopicCategoriesReport('30d');
          break;
        case 'mps':
          data = await this.getMPPerformanceReport();
          break;
        case 'forum':
          data = await this.getForumStats();
          break;
        case 'education':
          data = await this.getEducationStats();
          break;
        case 'feedback':
          data = await this.getFeedbackStats();
          break;
        case 'user':
          if (!userId) throw new Error('User ID required for user report');
          data = await this.getUserActivityReport(userId);
          break;
        default:
          throw new Error('Invalid report type');
      }

      return {
        data,
        format,
        generatedAt: new Date(),
        reportType
      };
    } catch (error) {
      console.error('Error exporting report:', error);
      throw error;
    }
  }
}

module.exports = new ReportService();
