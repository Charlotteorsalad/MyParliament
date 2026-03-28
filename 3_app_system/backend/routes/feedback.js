const express = require("express");
const router = express.Router();

const { protectAdmin, requirePermission } = require("../middleware/adminAuthMiddleware");
const { 
  getAllFeedback,
  getFeedbackById,
  updateFeedbackStatus,
  updateFeedbackPriority,
  updateFeedbackAssignment,
  respondToFeedback,
  deleteFeedback,
  getFeedbackStats,
  bulkUpdateFeedbackStatus
} = require("../controllers/feedbackController");

// All feedback routes require admin authentication
router.use(protectAdmin);
router.use(requirePermission('manage_users'));

// Get all feedback with pagination and filtering
router.get("/", getAllFeedback);

// Get feedback statistics
router.get("/stats", getFeedbackStats);

// Get feedback by ID
router.get("/:id", getFeedbackById);

// Update feedback status
router.patch("/:id/status", updateFeedbackStatus);

// Update feedback priority
router.patch("/:id/priority", updateFeedbackPriority);

// Update feedback assignment (assigned to)
router.patch("/:id/assign", updateFeedbackAssignment);

// Respond to feedback
router.post("/:id/respond", respondToFeedback);

// Delete feedback
router.delete("/:id", deleteFeedback);

// Bulk update feedback status
router.patch("/bulk/status", bulkUpdateFeedbackStatus);

module.exports = router;

