const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const { 
  submitQuiz,
  getQuizProgress,
  getQuizResults,
  getQuizHistory
} = require("../controllers/quizController");

// All quiz routes require authentication
router.use(auth);

// Submit quiz answers
router.post("/submit", submitQuiz);

// Get user's quiz progress
router.get("/progress", getQuizProgress);

// Get specific quiz results
router.get("/results/:quizId", getQuizResults);

// Get quiz history
router.get("/history", getQuizHistory);

module.exports = router;
