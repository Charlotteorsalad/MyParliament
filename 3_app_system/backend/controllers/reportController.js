const reportService = require('../services/reportService');

// Get platform statistics
exports.getPlatformStats = async (req, res) => {
  try {
    const stats = await reportService.getPlatformStats();
    res.json(stats);
  } catch (error) {
    console.error('Error in getPlatformStats:', error);
    res.status(500).json({ 
      message: "Failed to get platform statistics", 
      error: error.message 
    });
  }
};

// Get topic categories report
exports.getTopicCategoriesReport = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const report = await reportService.getTopicCategoriesReport(period);
    res.json(report);
  } catch (error) {
    console.error('Error in getTopicCategoriesReport:', error);
    res.status(500).json({ 
      message: "Failed to get topic categories report", 
      error: error.message 
    });
  }
};

// Get MP performance report
exports.getMPPerformanceReport = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const report = await reportService.getMPPerformanceReport(parseInt(limit));
    res.json(report);
  } catch (error) {
    console.error('Error in getMPPerformanceReport:', error);
    res.status(500).json({ 
      message: "Failed to get MP performance report", 
      error: error.message 
    });
  }
};

// Get user activity report (authenticated)
exports.getUserActivityReport = async (req, res) => {
  try {
    const report = await reportService.getUserActivityReport(req.user.id);
    res.json(report);
  } catch (error) {
    console.error('Error in getUserActivityReport:', error);
    if (error.message === 'User not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ 
      message: "Failed to get user activity report", 
      error: error.message 
    });
  }
};

// Get forum statistics
exports.getForumStats = async (req, res) => {
  try {
    const stats = await reportService.getForumStats();
    res.json(stats);
  } catch (error) {
    console.error('Error in getForumStats:', error);
    res.status(500).json({ 
      message: "Failed to get forum statistics", 
      error: error.message 
    });
  }
};

// Get education statistics
exports.getEducationStats = async (req, res) => {
  try {
    const stats = await reportService.getEducationStats();
    res.json(stats);
  } catch (error) {
    console.error('Error in getEducationStats:', error);
    res.status(500).json({ 
      message: "Failed to get education statistics", 
      error: error.message 
    });
  }
};

// Get feedback statistics
exports.getFeedbackStats = async (req, res) => {
  try {
    const stats = await reportService.getFeedbackStats();
    res.json(stats);
  } catch (error) {
    console.error('Error in getFeedbackStats:', error);
    res.status(500).json({ 
      message: "Failed to get feedback statistics", 
      error: error.message 
    });
  }
};

// Get comprehensive dashboard data
exports.getDashboardData = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const data = await reportService.getDashboardData(userId);
    res.json(data);
  } catch (error) {
    console.error('Error in getDashboardData:', error);
    res.status(500).json({ 
      message: "Failed to get dashboard data", 
      error: error.message 
    });
  }
};

// Export report
exports.exportReport = async (req, res) => {
  try {
    const { reportType, format = 'json' } = req.query;
    const userId = req.user ? req.user.id : null;
    
    if (!reportType) {
      return res.status(400).json({ message: 'Report type is required' });
    }

    const report = await reportService.exportReport(reportType, format, userId);
    
    // Set appropriate headers based on format
    const headers = {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${reportType}_report_${new Date().toISOString().split('T')[0]}.json"`
    };

    if (format === 'csv') {
      headers['Content-Type'] = 'text/csv';
      headers['Content-Disposition'] = `attachment; filename="${reportType}_report_${new Date().toISOString().split('T')[0]}.csv"`;
    } else if (format === 'excel') {
      headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      headers['Content-Disposition'] = `attachment; filename="${reportType}_report_${new Date().toISOString().split('T')[0]}.xlsx"`;
    }

    res.set(headers);
    res.json(report);
  } catch (error) {
    console.error('Error in exportReport:', error);
    if (error.message === 'User ID required for user report') {
      return res.status(400).json({ message: error.message });
    }
    if (error.message === 'Invalid report type') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ 
      message: "Failed to export report", 
      error: error.message 
    });
  }
};

// Get user's personal reports summary
exports.getUserReportsSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get various user-specific data
    const [
      userActivity,
      bookmarkedTopics,
      userForumTopics,
      userEduProgress
    ] = await Promise.all([
      reportService.getUserActivityReport(userId),
      // Add more specific queries as needed
      Promise.resolve([]),
      Promise.resolve([]),
      Promise.resolve([])
    ]);

    const summary = {
      user: userActivity.user,
      quickStats: {
        bookmarks: userActivity.activity.bookmarks.total,
        discussions: userActivity.activity.discussions.total,
        learning: userActivity.activity.learning.resources,
        activities: userActivity.activity.engagement.totalActivities
      },
      lastUpdated: new Date(),
      availableReports: [
        'activity-summary',
        'learning-progress',
        'mp-interactions',
        'discussion-history',
        'bookmark-collection',
        'feedback-surveys',
        'voting-history',
        'topic-interests',
        'engagement-timeline',
        'community-impact',
        'learning-achievements',
        'notification-history',
        'platform-usage-stats'
      ]
    };

    res.json(summary);
  } catch (error) {
    console.error('Error in getUserReportsSummary:', error);
    res.status(500).json({ 
      message: "Failed to get user reports summary", 
      error: error.message 
    });
  }
};
