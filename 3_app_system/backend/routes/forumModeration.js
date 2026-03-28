const express = require('express');
const router = express.Router();
const forumModerationController = require('../controllers/forumModerationController');
const { protectAdmin, requirePermission } = require('../middleware/adminAuthMiddleware');

router.use(protectAdmin);

// Admin notifications are accessible to ALL authenticated admins (not just forum moderators)
router.get('/notifications', forumModerationController.getNotifications);
router.patch('/notifications/read-all', forumModerationController.markAllNotificationsRead);
router.patch('/notifications/:notificationId/read', forumModerationController.markNotificationRead);

// Forum management routes require forum moderation permission
router.use(requirePermission('moderate_forum'));

// Forum Topics Management
router.get('/topics', forumModerationController.getAllTopics);
router.put('/topics/:topicId/moderate', forumModerationController.moderateTopic);

// Forum Posts Management
router.get('/posts', forumModerationController.getAllPosts);
router.put('/posts/:postId/moderate', forumModerationController.moderatePost);

// Pending Content Management (awaiting approval)
router.get('/pending-content', forumModerationController.getPendingContent);

// Flagged Content Management
router.get('/flagged-content', forumModerationController.getFlaggedContent);

// User Restrictions Management
router.post('/users/:userId/restrict', forumModerationController.restrictUser);
router.get('/restrictions', forumModerationController.getUserRestrictions);
router.put('/restrictions/:restrictionId/lift', forumModerationController.liftRestriction);

// Moderation Statistics
router.get('/stats', forumModerationController.getModerationStats);
router.get('/user-escalations', forumModerationController.getUserEscalations);

module.exports = router;
