const express = require("express");
const router = express.Router();

const { protectAdmin } = require("../middleware/adminAuthMiddleware");
const { 
  getAllAdminUsers, 
  getAllUsers,
  createUser,
  updateUser,
  updateUserRole, 
  updateUserStatus,
  bulkUpdateUsers,
  deleteUser, 
  getUserStats,
  getSystemStats,
  getMpStats,
  getEduStats,
  getAllMPs,
  createMp,
  updateMp,
  updateMpStatus,
  deleteMp,
  bulkUpdateMPs,
  bulkDeleteMPs,
  getMpDetails,
  getSystemHealthAnalytics,
  getModelPerformanceAnalytics,
  getContentEngagementAnalytics,
  getUserBehaviourAnalytics,
  getCiCdAnalytics,
  getContinuousLearningAnalytics,
  getCronJobAnalytics,
  getComprehensiveAnalytics,
  trackResponseTime,
  createSampleDevOpsData,
  getUserReportsData
} = require("../controllers/adminController");

// All admin routes require admin authentication
router.use(protectAdmin);

// Add response time tracking to all admin routes
router.use(trackResponseTime);

// Admin management (admin users) - Quick Actions
router.get("/users", getAllAdminUsers);
router.post("/users", createUser);
router.put("/users/:id", updateUser);
router.patch("/users/:id/role", updateUserRole);
router.patch("/users/:id/status", updateUserStatus);
router.patch("/users/bulk", bulkUpdateUsers);
router.delete("/users/:id", deleteUser);
router.get("/stats/users", getUserStats);

// User management (regular users) - Beside Overview tab
router.get("/regular-users", getAllUsers);

// System statistics
router.get("/stats/system", getSystemStats);
router.get("/stats/mps", getMpStats);
router.get("/stats/education", getEduStats);

// MP management routes
router.get("/mps", getAllMPs);
router.post("/mps", createMp);
router.get("/mps/:id", getMpDetails);
router.put("/mps/:id", updateMp);
router.patch("/mps/:id/status", updateMpStatus);
router.delete("/mps/:id", deleteMp);
router.patch("/mps/bulk-update", bulkUpdateMPs);
router.delete("/mps/bulk-delete", bulkDeleteMPs);

// Analytics routes
router.get("/analytics/system-health", getSystemHealthAnalytics);
router.get("/analytics/model-performance", getModelPerformanceAnalytics);
router.get("/analytics/content-engagement", getContentEngagementAnalytics);
router.get("/analytics/user-behaviour", getUserBehaviourAnalytics);
router.get("/analytics/cicd", getCiCdAnalytics);
router.get("/analytics/continuous-learning", getContinuousLearningAnalytics);
router.get("/analytics/cron-jobs", getCronJobAnalytics);
router.get("/analytics/comprehensive", getComprehensiveAnalytics);

// DevOps data management
router.post("/devops/create-sample-data", createSampleDevOpsData);

// User Reports Mirror
router.get("/user-reports", getUserReportsData);

module.exports = router;
