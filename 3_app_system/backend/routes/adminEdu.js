const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/adminAuthMiddleware');
const {
  getAllEduContent,
  getEduContentById,
  createEduContent,
  updateEduContent,
  publishEduContent,
  archiveEduContent,
  deleteEduContent,
  uploadAttachment,
  uploadImage,
  removeAttachment,
  createQuiz,
  getAllQuizzes,
  updateQuiz,
  deleteQuiz,
  assignQuiz,
  getEduContentStats,
  upload,
  migrateImages
} = require('../controllers/adminEduController');

// All admin education routes require admin authentication
router.use(protectAdmin);

// Educational Content Management
router.get('/content', getAllEduContent);
router.get('/content/stats', getEduContentStats);
router.get('/content/:id', getEduContentById);
router.post('/content', createEduContent);
router.put('/content/:id', updateEduContent);
router.patch('/content/:id/publish', publishEduContent);
router.patch('/content/:id/archive', archiveEduContent);
router.delete('/content/:id', deleteEduContent);

// File Management
router.post('/content/:id/upload', upload.single('file'), uploadAttachment);
router.post('/content/:id/upload-image', upload.single('file'), uploadImage);
router.delete('/content/:id/attachments/:attachmentId', removeAttachment);

// Quiz Management
router.get('/quizzes', getAllQuizzes);
router.post('/quizzes', createQuiz);
router.put('/quizzes/:id', updateQuiz);
router.delete('/quizzes/:id', deleteQuiz);
router.post('/content/:id/assign-quiz', assignQuiz);

// Migration route
router.post('/migrate-images', migrateImages);

module.exports = router;
