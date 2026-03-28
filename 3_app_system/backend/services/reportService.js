const mongoose = require('mongoose');
const Topic = require('../models/Topic');
const Mp = require('../models/Mp');
const ForumTopic = require('../models/ForumTopic');
const ForumPost = require('../models/ForumPost');
const { EduResource } = require('../models/EduResource');
const Feedback = require('../models/Feedback');
const User = require('../models/User');
const QuizSubmission = require('../models/QuizSubmission');
const ActivityLog = require('../models/ActivityLog');
const Bookmark = require('../models/Bookmark');
const mpService = require('./mpService');

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
        totalUsers,
        educationViewsResult,
        feedbackRatingResult
      ] = await Promise.all([
        Topic.countDocuments({ status: 'Active' }),
        Mp.countDocuments({ status: 'current' }),
        ForumTopic.countDocuments({ status: 'active' }),
        ForumPost.countDocuments({ status: 'active' }),
        EduResource.countDocuments({ status: 'published' }),
        Feedback.countDocuments(),
        User.countDocuments(),
        EduResource.aggregate([
          { $match: { status: 'published' } },
          { $group: { _id: null, totalViews: { $sum: { $ifNull: ['$views', 0] } } } }
        ]),
        Feedback.aggregate([
          { $group: { _id: null, avgRating: { $avg: '$rating' } } }
        ])
      ]);

      const totalViews = educationViewsResult[0]?.totalViews ?? 0;
      const avgSatisfaction = feedbackRatingResult[0]?.avgRating ?? null;

      return {
        topics: {
          total: totalTopics,
          active: totalTopics,
          resolved: 0
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
          totalViews
        },
        feedback: {
          total: totalFeedback,
          satisfaction: avgSatisfaction
        }
      };
    } catch (error) {
      console.error('Error getting platform stats:', error);
      throw error;
    }
  }

  // Get topic categories distribution
  // topViewedLimit: optional number of top viewed topics to return (default 5 for dashboard, use e.g. 20 for detail page)
  async getTopicCategoriesReport(period = '30d', topViewedLimit = 5) {
    try {
      const db = mongoose.connection.db;
      const config = await db.collection('IssuePortalConfig').findOne({ type: 'default_pipeline' });
      const pipelineId = config?.pipeline_id || 'pipeline5';
      const includeLowQuality = config?.include_low_quality === true;
      const qualityQuery = includeLowQuality ? {} : { label_quality: { $in: ['high', 'medium', 'unknown'] } };
      const matchQuery = { pipeline_id: pipelineId, ...qualityQuery };

      const [categories, activeTopicCount, sampleTopics, topViewedTopics] = await Promise.all([
        Topic.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            // Use Issue Portal viewCount (incremented by /issue-portal/issue/:id/view)
            views: { $sum: { $ifNull: ['$viewCount', 0] } },
            bookmarks: {
              $sum: {
                $cond: [
                  { $isArray: '$bookmarks' },
                  { $size: '$bookmarks' },
                  { $ifNull: ['$bookmarks', 0] }
                ]
              }
            }
          }
        },
        { $sort: { count: -1 } }
      ]),
        Topic.countDocuments(matchQuery),
        Topic.find(matchQuery).select('title category status views').limit(3).lean(),
        Topic.aggregate([
          { $match: matchQuery },
          // Sort by Issue Portal viewCount (not legacy "views" field)
          { $sort: { viewCount: -1 } },
          { $limit: Math.min(50, Math.max(1, parseInt(topViewedLimit, 10) || 5)) },
          {
            $project: {
              _id: 1,
              title: 1,
              category: 1,
              views: { $ifNull: ['$viewCount', 0] },
              status: 1
            }
          }
        ])
      ]);

      const totalTopics = categories.reduce((sum, cat) => sum + cat.count, 0);
      
      const categoriesWithPercentage = categories.map(category => ({
        name: category._id,
        count: category.count,
        percentage: totalTopics > 0 ? Math.round((category.count / totalTopics) * 100) : 0,
        views: category.views,
        bookmarks: category.bookmarks,
        color: this.getCategoryColor(category._id)
      }));

      return {
        totalTopics,
        categories: categoriesWithPercentage,
        pipelineId,
        period,
        topViewedTopics,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Error getting topic categories report:', error);
      throw error;
    }
  }

  // Get MP performance report (uses performance.attendanceRate, performance.responseRate, topicDiscussed)
  // mode: 'current' (default) => only current MPs
  //       'all'             => all-time MPs across terms
  async getMPPerformanceReport(limit = 10, mode = 'current') {
    try {
      const useAllTime = String(mode || 'current').toLowerCase() === 'all';
      const featuredMPs = useAllTime
        ? await mpService.getFeaturedMPsAllTime()
        : await mpService.getFeaturedMPs();
      const topMPs = featuredMPs.slice(0, limit).map((mp) => ({
        _id: mp._id,
        mp_id: mp.mp_id,
        name: mp.name,
        full_name_with_titles: mp.full_name_with_titles,
        party: mp.party,
        party_full_name: mp.party_full_name,
        state: mp.state,
        constituency: mp.constituency,
        constituency_code: mp.constituency_code,
        constituency_name: mp.constituency_name,
        profilePicture: mp.profilePicture,
        performanceScore: mp.performanceScore,
        attendance: mp.performance?.attendanceRate ?? null,
        responseRate: mp.performance?.responseRate ?? null,
      }));

      return {
        topPerformers: topMPs,
        totalMPs: featuredMPs.length,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Error getting MP performance report:', error);
      throw error;
    }
  }

  // Get user activity report (for authenticated users)
  // Star/bookmark sources: Issue Portal = User.followedTopics, MP = User.followedMPs, Edu/Forum = Bookmark collection
  async getUserActivityReport(userId) {
    try {
      const user = await User.findById(userId).select('name email createdAt followedMPs followedTopics bookmarks').lean();
      if (!user) {
        throw new Error('User not found');
      }

      const [userForumTopics, userForumPosts, bookmarkCounts, eduProgress, quizStats] = await Promise.all([
        ForumTopic.find({ author: userId }),
        ForumPost.find({ author: userId }),
        Bookmark.aggregate([
          { $match: { userId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId, isArchived: { $ne: true } } },
          { $group: { _id: '$type', count: { $sum: 1 } } }
        ]),
        EduResource.find({ _id: { $in: user.bookmarks || [] } }),
        QuizSubmission.aggregate([
          { $match: { userId: userId } },
          { $group: { _id: null, count: { $sum: 1 }, avgScore: { $avg: '$score' } } }
        ])
      ]);

      const topicStars = user.followedTopics?.length || 0;
      const mpStars = user.followedMPs?.length || 0;
      const bookmarkByType = (bookmarkCounts || []).reduce((acc, r) => { acc[r._id] = r.count; return acc; }, {});
      const eduFromBookmark = bookmarkByType.education || 0;
      const forumFromBookmark = bookmarkByType.forum || 0;
      const legacyEdu = (user.bookmarks || []).length;
      const eduTotal = eduFromBookmark + legacyEdu;
      const totalBookmarks = topicStars + mpStars + eduTotal + forumFromBookmark;

      const quizCount = quizStats[0]?.count ?? 0;
      const quizAvgScore = quizStats[0]?.avgScore != null ? Math.round(quizStats[0].avgScore) : null;

      return {
        user: {
          name: user.name,
          email: user.email,
          joinedAt: user.createdAt
        },
        activity: {
          bookmarks: {
            topics: topicStars,
            mps: mpStars,
            edu: eduTotal,
            forum: forumFromBookmark,
            total: totalBookmarks
          },
          discussions: {
            created: userForumTopics.length,
            replies: userForumPosts.length,
            total: userForumTopics.length + userForumPosts.length
          },
          learning: {
            resources: eduProgress.length,
            completed: quizCount,
            averageScore: quizAvgScore
          },
          engagement: {
            totalActivities: totalBookmarks + userForumTopics.length + userForumPosts.length,
            lastActivity: user.updatedAt,
            streak: 0
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
        totalDiscussions: totalTopics,
        totalReplies: totalPosts,
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
        completionRate: null,
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
        satisfaction: averageRating[0]?.avgRating ?? null,
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

  // Get user reports summary (full shape for Report tab)
  async getUserReportsSummary(userId) {
    const uid = typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    const userActivity = await this.getUserActivityReport(userId);
    const activity = userActivity.activity;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [activityLogsThisMonth, recentLogs, feedbackCount, lastQuizSubmission, user] = await Promise.all([
      ActivityLog.countDocuments({ userId: uid, timestamp: { $gte: startOfMonth } }),
      ActivityLog.find({ userId: uid }).sort({ timestamp: -1 }).limit(10).lean(),
      Feedback.countDocuments({ userId: uid }),
      QuizSubmission.findOne({ userId: uid }).sort({ submittedAt: -1 }).select('submittedAt').lean(),
      User.findById(userId).select('followedMPs').lean()
    ]);

    let followedMPs = [];
    if (user?.followedMPs?.length) {
      const idList = user.followedMPs.map((id) => String(id));
      const nativeCol = mongoose.connection.db?.collection('MP');
      if (nativeCol) {
        const mpDocs = await nativeCol.find({ _id: { $in: idList } }, { projection: { name: 1 } }).toArray();
        followedMPs = mpDocs.map((mp) => ({ name: mp.name || 'Unknown' }));
      } else {
        const mps = await Mp.find({ _id: { $in: idList } }).select('name').lean();
        followedMPs = mps.map((mp) => ({ name: mp.name || 'Unknown' }));
      }
    }

    const actionLabels = {
      login: 'Logged in',
      logout: 'Logged out',
      profile_update: 'Updated profile',
      mp_follow: 'Followed an MP',
      mp_unfollow: 'Unfollowed an MP',
      topic_follow: 'Followed a topic',
      topic_unfollow: 'Unfollowed a topic',
      bookmark_add: 'Added bookmark',
      bookmark_remove: 'Removed bookmark',
      feedback_submit: 'Submitted feedback',
      content_view: 'Viewed content',
      forum_view: 'Viewed forum',
      forum_topic_create: 'Created forum discussion',
      forum_reply: 'Replied to discussion',
      quiz_submit: 'Completed a quiz',
      edu_view: 'Viewed education resource',
      mp_view: 'Viewed MP profile',
      issue_view: 'Viewed issue'
    };

    const recentActivity = recentLogs.map((log) => ({
      action: actionLabels[log.action] || log.action,
      details: log.description || '',
      time: log.timestamp ? new Date(log.timestamp).toLocaleDateString() : '',
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
      bgColor: 'bg-gray-100',
      color: 'text-gray-600'
    }));

    const lastActivityTs = recentLogs[0]?.timestamp ? new Date(recentLogs[0].timestamp) : null;

    return {
      user: userActivity.user,
      quickStats: {
        bookmarks: activity.bookmarks.total,
        discussions: activity.discussions.total,
        learning: activity.learning.resources,
        learningResources: activity.learning.resources,
        activities: activity.engagement.totalActivities
      },
      lastUpdated: now,
      activitySummary: {
        topicsBookmarked: activity.bookmarks.topics,
        mpsFollowed: (user?.followedMPs || []).length,
        educationBookmarked: activity.bookmarks.edu,
        forumBookmarked: activity.bookmarks.forum,
        forumDiscussions: activity.discussions.total,
        forumReplies: activity.discussions.replies,
        educationalResources: activity.learning.resources,
        feedbackSubmitted: feedbackCount
      },
      activityStats: {
        thisMonth: activityLogsThisMonth,
        lastActivity: lastActivityTs ? lastActivityTs.toLocaleDateString() : null,
        mostActiveDay: null
      },
      recentActivity,
      mpInteractions: {
        followedMPs,
        questionsAsked: 0,
        responsesReceived: 0,
        parties: 0,
        lastUpdated: now
      },
      learning: {
        quizzesCompleted: activity.learning.completed,
        avgScore: activity.learning.averageScore,
        certificates: 0,
        lastUpdated: lastQuizSubmission?.submittedAt || null
      },
      discussions: {
        lastUpdated: activity.engagement.lastActivity || null,
        views: 0,
        topics: activity.discussions.created,
        replies: activity.discussions.replies,
        total: activity.discussions.total
      },
      bookmarks: { lastUpdated: activity.engagement.lastActivity || null },
      feedback: {
        lastUpdated: null,
        surveys: 0,
        suggestions: feedbackCount,
        rating: null
      },
      availableReports: [
        'activity-summary',
        'learning-progress',
        'mp-interactions',
        'discussion-history',
        'bookmark-collection',
        'feedback-surveys'
      ]
    };
  }

  // Get comprehensive dashboard data
  async getDashboardData(userId = null, period = '30d') {
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
        this.getTopicCategoriesReport(period),
        // Dashboard uses current-term MPs for the quick "Top MPs" card
        this.getMPPerformanceReport(5, 'current'),
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
        case 'bookmark-collection':
        case 'activity-summary':
          if (!userId) throw new Error('User ID required for user report');
          data = await this.getUserReportsSummary(userId);
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
