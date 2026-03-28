const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const {
  updateProfile,
  getMe,
  updateNotificationPreferences,
  markNotificationRead,
  markAllNotificationsRead,
  savePushSubscription,
  removePushSubscription,
  getVapidPublicKey,
  toggleBookmark,
  followMP,
  unfollowMP,
  followTopic,
  unfollowTopic,
  logView,
  getMyActivities,
  getEduActivity,
} = require("../controllers/userController");

router.patch("/profile", auth, updateProfile);
router.get("/me", auth, getMe);
router.get("/push-vapid-public", auth, getVapidPublicKey);
router.patch("/notification-preferences", auth, updateNotificationPreferences);
router.patch("/notifications/read-all", auth, markAllNotificationsRead);
router.patch("/notifications/:notificationId/read", auth, markNotificationRead);
router.post("/push-subscription", auth, savePushSubscription);
router.delete("/push-subscription", auth, removePushSubscription);
router.patch("/edubookmark", auth, toggleBookmark);
router.patch("/followmp", auth, followMP);
router.patch("/unfollowmp", auth, unfollowMP);
router.patch("/followtopic", auth, followTopic);
router.patch("/unfollowtopic", auth, unfollowTopic);
router.post("/log-view", auth, logView);
router.get("/activities", auth, getMyActivities);
router.get("/edu-activity", auth, getEduActivity);

module.exports = router;
