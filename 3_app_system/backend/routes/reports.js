const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middleware/authMiddleware');

// Public routes (no authentication required)
router.get('/platform-stats', reportController.getPlatformStats);
router.get('/topic-categories', reportController.getTopicCategoriesReport);
router.get('/mp-performance', reportController.getMPPerformanceReport);
router.get('/forum-stats', reportController.getForumStats);
router.get('/education-stats', reportController.getEducationStats);
router.get('/feedback-stats', reportController.getFeedbackStats);
router.get('/dashboard', reportController.getDashboardData);

// Protected routes (authentication required)
router.get('/user/activity', auth, reportController.getUserActivityReport);
router.get('/user/summary', auth, reportController.getUserReportsSummary);
router.get('/export', auth, reportController.exportReport);

module.exports = router;
