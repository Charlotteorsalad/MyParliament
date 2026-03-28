const express = require('express');
const router = express.Router();
const forumController = require('../controllers/forumController');
const auth = require('../middleware/authMiddleware');

// Public routes (optional auth so we can set currentUserHasReported when logged in)
router.get('/topics', auth.optionalAuth, forumController.getAllTopics);
router.get('/topics/:id', auth.optionalAuth, forumController.getTopicById);
router.get('/topics/:topicId/posts', auth.optionalAuth, forumController.getTopicPosts);
router.get('/stats', forumController.getForumStats);
router.get('/search', forumController.searchForum);

// Protected routes (authentication required)
router.post('/topics', auth, forumController.createTopic);
router.put('/topics/:id', auth, forumController.updateTopic);
router.delete('/topics/:id', auth, forumController.deleteTopic);

router.post('/topics/:topicId/posts', auth, forumController.createPost);
router.post('/posts/:postId/reply', auth, forumController.replyToPost);
router.post('/posts/:postId/like', auth, forumController.togglePostLike);
router.post('/posts/:postId/report', auth, forumController.reportPost);
router.post('/topics/:topicId/report', auth, forumController.reportTopic);

router.get('/user/topics', auth, forumController.getUserTopics);

module.exports = router;
