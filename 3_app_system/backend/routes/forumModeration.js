const express = require('express');
const router = express.Router();
const forumModerationController = require('../controllers/forumModerationController');
const { protectAdmin } = require('../middleware/adminAuthMiddleware');
const { requireAdminRole } = require('../middleware/roleAuth');

// Apply authentication middleware to all routes
router.use(protectAdmin);

// Forum Topics Management
router.get('/topics', forumModerationController.getAllTopics);
router.put('/topics/:topicId/moderate', forumModerationController.moderateTopic);

// Forum Posts Management  
router.put('/posts/:postId/moderate', forumModerationController.moderatePost);

// Flagged Content Management
router.get('/flagged-content', forumModerationController.getFlaggedContent);

// User Restrictions Management
router.post('/users/:userId/restrict', forumModerationController.restrictUser);
router.get('/restrictions', forumModerationController.getUserRestrictions);
router.put('/restrictions/:restrictionId/lift', forumModerationController.liftRestriction);

// Moderation Statistics
router.get('/stats', forumModerationController.getModerationStats);

module.exports = router;
