const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const { 
  submitFeedback,
  getUserFeedback,
  getFeedbackById
} = require("../controllers/publicFeedbackController");

// All routes require user authentication
router.use(auth);

// Submit new feedback
router.post("/", submitFeedback);

// Get user's own feedback
router.get("/my", getUserFeedback);

// Get specific feedback by ID (only if user owns it)
router.get("/:id", getFeedbackById);

module.exports = router;
