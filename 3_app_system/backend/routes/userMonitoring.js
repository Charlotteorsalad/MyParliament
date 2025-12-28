const express = require("express");
const router = express.Router();

const { protectAdmin } = require("../middleware/adminAuthMiddleware");
const { 
  searchUsers,
  getUserActivities,
  restrictUser,
  unrestrictUser,
  getUserDetails
} = require("../controllers/userMonitoringController");

// All user monitoring routes require admin authentication
router.use(protectAdmin);

// Search users
router.get("/users/search", searchUsers);

// Get user details
router.get("/users/:userId", getUserDetails);

// Get user activities
router.get("/users/:userId/activities", getUserActivities);

// Restrict user
router.post("/users/:userId/restrict", restrictUser);

// Unrestrict user
router.post("/users/:userId/unrestrict", unrestrictUser);

module.exports = router;
