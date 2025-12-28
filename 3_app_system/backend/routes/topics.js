const express = require('express');
const router = express.Router();
const topicController = require('../controllers/topicController');
const auth = require('../middleware/authMiddleware');
const { protectAdmin } = require('../middleware/adminAuthMiddleware');

// Public routes
router.get('/', topicController.getAllTopics);
router.get('/stats', topicController.getTopicStats);
router.get('/categories', topicController.getCategories);
router.get('/:id', topicController.getTopicById);

// Protected routes (require authentication)
router.post('/:id/bookmark', auth, topicController.toggleBookmark);

// Admin routes (require admin authentication)
router.post('/', protectAdmin, topicController.createTopic);
router.put('/:id', protectAdmin, topicController.updateTopic);
router.delete('/:id', protectAdmin, topicController.deleteTopic);

module.exports = router;
