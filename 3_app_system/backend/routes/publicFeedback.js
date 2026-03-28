const express = require("express");
const path = require("path");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const feedbackUpload = require("../middleware/feedbackUpload");
const { 
  submitFeedback,
  getUserFeedback,
  getFeedbackById
} = require("../controllers/publicFeedbackController");

// Serve uploaded feedback attachments (authenticated users only)
router.get("/uploads/:filename", auth, (req, res) => {
  const filePath = path.join(__dirname, '..', 'uploads', 'feedback', req.params.filename);
  res.sendFile(filePath, (err) => {
    if (err) res.status(404).json({ message: 'Attachment not found' });
  });
});

// All remaining routes require user authentication
router.use(auth);

// Submit new feedback (supports optional file attachments via multipart/form-data)
router.post("/", (req, res, next) => {
  feedbackUpload.array('attachments', 5)(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, submitFeedback);

// Get user's own feedback
router.get("/my", getUserFeedback);

// Get specific feedback by ID (only if user owns it)
router.get("/:id", getFeedbackById);

module.exports = router;
