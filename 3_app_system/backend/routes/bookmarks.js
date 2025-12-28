const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const { 
  getBookmarks,
  addBookmark,
  removeBookmark,
  toggleBookmark
} = require("../controllers/bookmarkController");

// All bookmark routes require authentication
router.use(auth);

// Get user's bookmarks
router.get("/", getBookmarks);

// Add bookmark
router.post("/", addBookmark);

// Remove bookmark
router.delete("/:id", removeBookmark);

// Toggle bookmark (add if not exists, remove if exists)
router.patch("/toggle", toggleBookmark);

module.exports = router;
