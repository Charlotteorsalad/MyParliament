const express = require("express");
const router = express.Router();

const { protectAdmin, requirePermission } = require("../middleware/adminAuthMiddleware");
const { 
  searchUsers,
  getUserActivities,
  suspendUser,
  unsuspendUser,
  restrictUser,
  unrestrictUser,
  getUserDetails
} = require("../controllers/userMonitoringController");

// All user monitoring routes require admin authentication
router.use(protectAdmin);
router.use(requirePermission('manage_users'));

// Search users
router.get("/users/search", searchUsers);

// Get user details
router.get("/users/:userId", getUserDetails);

// Get user activities
router.get("/users/:userId/activities", getUserActivities);

// Suspend user (permanent ban)
router.post("/users/:userId/suspend", suspendUser);

// Unsuspend user
router.post("/users/:userId/unsuspend", unsuspendUser);

// Restrict user
router.post("/users/:userId/restrict", restrictUser);

// Unrestrict user
router.post("/users/:userId/unrestrict", unrestrictUser);

module.exports = router;
