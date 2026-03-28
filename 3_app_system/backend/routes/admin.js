const express = require("express");
const router = express.Router();

const { protectAdmin, authorize, requirePermission, requireAnyPermission } = require("../middleware/adminAuthMiddleware");
const { 
  getAllAdminUsers, 
  getAllUsers,
  createUser,
  updateUser,
  updateUserRole, 
  updateUserStatus,
  bulkUpdateUsers,
  deleteUser,
  getAdminActivity, 
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
  getTopicNetworkData,
  getContentEngagementAnalytics,
  getUserBehaviourAnalytics,
  getCiCdAnalytics,
  getContinuousLearningAnalytics,
  getCronJobAnalytics,
  getComprehensiveAnalytics,
  getDebugActiveUsers,
  trackResponseTime,
  createSampleDevOpsData,
  getUserReportsData,
  getArimaForecastAnalytics
} = require("../controllers/adminController");

// All admin routes require admin authentication
router.use(protectAdmin);

// Add response time tracking to all admin routes
router.use(trackResponseTime);

// Admin management (admin users) - superadmin only
router.get("/users", authorize('superadmin'), getAllAdminUsers);
router.post("/users", authorize('superadmin'), createUser);
router.put("/users/:id", authorize('superadmin'), updateUser);
router.patch("/users/:id/role", authorize('superadmin'), updateUserRole);
router.patch("/users/:id/status", authorize('superadmin'), updateUserStatus);
router.patch("/users/bulk", authorize('superadmin'), bulkUpdateUsers);
router.delete("/users/:id", authorize('superadmin'), deleteUser);
router.get("/users/:id/activity", authorize('superadmin'), getAdminActivity);
router.get("/stats/users", requirePermission('view_analytics'), getUserStats);

// User management (regular users) - manage_users
router.get("/regular-users", requirePermission('manage_users'), getAllUsers);

// System statistics - view_analytics
router.get("/stats/system", requirePermission('view_analytics'), getSystemStats);
router.get("/stats/mps", requirePermission('view_analytics'), getMpStats);
router.get("/stats/education", requirePermission('view_analytics'), getEduStats);

// MP management - manage_mps
router.get("/mps", requirePermission('manage_mps'), getAllMPs);
router.post("/mps", requirePermission('manage_mps'), createMp);
router.patch("/mps/bulk-update", requirePermission('manage_mps'), bulkUpdateMPs);
router.delete("/mps/bulk-delete", requirePermission('manage_mps'), bulkDeleteMPs);
router.get("/mps/:id", requirePermission('manage_mps'), getMpDetails);
router.put("/mps/:id", requirePermission('manage_mps'), updateMp);
router.patch("/mps/:id/status", requirePermission('manage_mps'), updateMpStatus);
router.delete("/mps/:id", requirePermission('manage_mps'), deleteMp);

// Analytics - view_analytics
router.get("/analytics/system-health", requirePermission('view_analytics'), getSystemHealthAnalytics);
router.get("/analytics/model-performance", requirePermission('view_analytics'), getModelPerformanceAnalytics);
router.get("/analytics/topic-network", requirePermission('view_analytics'), getTopicNetworkData);
router.get("/analytics/content-engagement", requirePermission('view_analytics'), getContentEngagementAnalytics);
router.get("/analytics/user-behaviour", requirePermission('view_analytics'), getUserBehaviourAnalytics);
router.get("/analytics/cicd", requirePermission('view_analytics'), getCiCdAnalytics);
router.get("/analytics/continuous-learning", requirePermission('view_analytics'), getContinuousLearningAnalytics);
router.get("/analytics/cron-jobs", requirePermission('view_analytics'), getCronJobAnalytics);
router.get("/analytics/comprehensive", requirePermission('view_analytics'), getComprehensiveAnalytics);
router.get("/analytics/debug-active-users", requirePermission('view_analytics'), getDebugActiveUsers);
router.get("/analytics/arima-forecast", requirePermission('view_analytics'), getArimaForecastAnalytics);

// DevOps data management - view_analytics
router.post("/devops/create-sample-data", requirePermission('view_analytics'), createSampleDevOpsData);

// User Reports - manage_users or view_analytics
router.get("/user-reports", requireAnyPermission('manage_users', 'view_analytics'), getUserReportsData);

module.exports = router;
