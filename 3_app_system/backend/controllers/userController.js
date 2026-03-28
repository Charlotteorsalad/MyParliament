const userService = require("../services/userService");
const notificationService = require("../services/notificationService");
const ActivityLog = require("../models/ActivityLog");
const QuizSubmission = require("../models/QuizSubmission");
const Feedback = require("../models/Feedback");
const ForumPost = require("../models/ForumPost");

exports.updateProfile = async (req, res) => {
  const userId = req.user.id;
  const { profile } = req.body;

  try {
    const updatedProfile = await userService.updateProfile(userId, profile);
    res.json({ message: "Profile updated", profile: updatedProfile });
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: err.message });
  }
};

exports.updateNotificationPreferences = async (req, res) => {
  const userId = req.user.id;
  const prefs = req.body || {};

  try {
    const updated = await userService.updateNotificationPreferences(userId, prefs);
    res.json({ message: "Notification preferences saved", notificationPreferences: updated });
  } catch (err) {
    res.status(500).json({ message: "Failed to save notification preferences", error: err.message });
  }
};

exports.markNotificationRead = async (req, res) => {
  const userId = req.user.id;
  const { notificationId } = req.params;

  try {
    const updated = await userService.markNotificationRead(userId, notificationId);
    res.json({ success: updated });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark notification read", error: err.message });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  const userId = req.user.id;
  try {
    await userService.markAllNotificationsRead(userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark all notifications read", error: err.message });
  }
};

exports.savePushSubscription = async (req, res) => {
  const userId = req.user.id;
  const { subscription } = req.body || {};

  try {
    const list = await userService.savePushSubscription(userId, subscription);
    res.json({ success: true, pushSubscriptions: list });
  } catch (err) {
    res.status(500).json({ message: "Failed to save push subscription", error: err.message });
  }
};

exports.removePushSubscription = async (req, res) => {
  const userId = req.user.id;
  const { endpoint } = req.body || {};

  try {
    const list = await userService.removePushSubscription(userId, endpoint);
    res.json({ success: true, pushSubscriptions: list });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove push subscription", error: err.message });
  }
};

exports.getVapidPublicKey = (req, res) => {
  const key = notificationService.getVapidPublicKey();
  res.json({ publicKey: key });
};

exports.getMe = async (req, res) => {
  try {
    const userProfile = await userService.getUserProfile(req.user.id);
    res.json(userProfile);
  } catch (err) {
    res.status(500).json({ message: "Failed to get user profile", error: err.message });
  }
};

exports.toggleBookmark = async (req, res) => {
  const userId = req.user.id;
  const { eduId } = req.body;

  try {
    const bookmarked = await userService.toggleBookmark(userId, eduId);
    res.json({ bookmarked });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Bookmark error", error: err.message });
  }
};

exports.followMP = async (req, res) => {
  const userId = req.user.id;
  const { mpId } = req.body;
  if (!mpId) {
    return res.status(400).json({ message: "mpId is required" });
  }
  try {
    const added = await userService.followMP(userId, mpId);

    // Log activity only when a new follow is created
    if (added) {
      ActivityLog.create({
        userId,
        action: 'mp_follow',
        description: `Followed MP ${mpId}`,
        metadata: { mpId: String(mpId) },
      }).catch(() => {});
    }

    res.json({ followed: added });
  } catch (err) {
    console.error('[followMP] ERROR:', err.message);
    res.status(500).json({ message: "Follow MP error", error: err.message });
  }
};

exports.unfollowMP = async (req, res) => {
  const userId = req.user.id;
  const { mpId } = req.body;
  if (!mpId) {
    return res.status(400).json({ message: "mpId is required" });
  }
  try {
    const removed = await userService.unfollowMP(userId, mpId);

    if (removed) {
      ActivityLog.create({
        userId,
        action: 'mp_unfollow',
        description: `Unfollowed MP ${mpId}`,
        metadata: { mpId: String(mpId) },
      }).catch(() => {});
    }

    res.json({ unfollowed: removed });
  } catch (err) {
    console.error('[unfollowMP] ERROR:', err.message);
    res.status(500).json({ message: "Unfollow MP error", error: err.message });
  }
};

exports.followTopic = async (req, res) => {
  const userId = req.user.id;
  const { topicId } = req.body;
  if (!topicId) {
    return res.status(400).json({ message: "topicId is required" });
  }
  try {
    const added = await userService.followTopic(userId, topicId);

    if (added) {
      ActivityLog.create({
        userId,
        action: 'topic_follow',
        description: `Followed topic ${topicId}`,
        metadata: { topicId: String(topicId) },
      }).catch(() => {});
    }

    res.json({ followed: added });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Follow topic error", error: err.message });
  }
};

exports.unfollowTopic = async (req, res) => {
  const userId = req.user.id;
  const { topicId } = req.body;
  if (!topicId) {
    return res.status(400).json({ message: "topicId is required" });
  }
  try {
    const removed = await userService.unfollowTopic(userId, topicId);

    if (removed) {
      ActivityLog.create({
        userId,
        action: 'topic_unfollow',
        description: `Unfollowed topic ${topicId}`,
        metadata: { topicId: String(topicId) },
      }).catch(() => {});
    }

    res.json({ unfollowed: removed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Unfollow topic error", error: err.message });
  }
};

// Log a view activity (edu, mp, issue, forum)
exports.logView = async (req, res) => {
  const userId = req.user.id;
  const { type, resourceId, title } = req.body;

  const actionMap = {
    edu: 'edu_view',
    mp: 'mp_view',
    issue: 'issue_view',
    forum: 'forum_view',
  };
  const action = actionMap[type];
  if (!action) return res.status(400).json({ message: 'Invalid type' });

  try {
    // Avoid duplicate view entries within 1 hour for same resource
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await ActivityLog.findOne({
      userId,
      action,
      'metadata.resourceId': String(resourceId),
      timestamp: { $gte: oneHourAgo },
    });
    if (!recent) {
      await ActivityLog.create({
        userId,
        action,
        description: `Viewed ${type === 'edu' ? 'education content' : type === 'mp' ? 'MP profile' : type === 'issue' ? 'issue portal topic' : 'forum discussion'}: ${title || resourceId}`,
        metadata: { resourceId: String(resourceId), title: title || '' },
      });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Log view error', error: err.message });
  }
};

// Get viewed and quiz-completed edu resource IDs for badge display on Edu content cards
exports.getEduActivity = async (req, res) => {
  const userId = req.user.id;
  try {
    const [viewedLogs, submissions] = await Promise.all([
      ActivityLog.find({ userId, action: 'edu_view' }, 'metadata').lean(),
      QuizSubmission.find({ userId }, 'resourceId').lean(),
    ]);
    const viewedResourceIds = [...new Set(
      viewedLogs.map((e) => e.metadata?.resourceId).filter(Boolean)
    )];
    const quizCompletedResourceIds = [...new Set(
      submissions.map((s) => String(s.resourceId)).filter(Boolean)
    )];
    res.json({ viewedResourceIds, quizCompletedResourceIds });
  } catch (err) {
    console.error('[getEduActivity] error:', err);
    res.status(500).json({ message: 'Failed to get edu activity', error: err.message });
  }
};

// Get personal activity feed for the current user
exports.getMyActivities = async (req, res) => {
  const userId = req.user.id;
  const mongoose = require('mongoose');
  const userObjectId = new mongoose.Types.ObjectId(userId);

  try {
    // ── 1. Activity log events (follow/unfollow/bookmark/views) ──────────────
    const logEvents = await ActivityLog.find({
      userId,
      action: { $nin: ['login', 'logout', 'register', 'admin_action', 'system_event',
                        'mp_create', 'mp_update', 'mp_delete', 'mp_status_update',
                        'mp_bulk_update', 'mp_bulk_delete'] }
    })
      .sort({ timestamp: -1 })
      .limit(200)
      .lean();

    const actionLabels = {
      content_view: 'Viewed content',
      content_search: 'Searched',
      mp_follow: 'Followed an MP',
      mp_unfollow: 'Unfollowed an MP',
      topic_follow: 'Followed a topic',
      topic_unfollow: 'Unfollowed a topic',
      bookmark_add: 'Bookmarked content',
      bookmark_remove: 'Removed bookmark',
      feedback_submit: 'Submitted feedback',
      profile_update: 'Updated profile',
      password_change: 'Changed password',
      edu_view: 'Viewed education content',
      mp_view: 'Viewed MP profile',
      issue_view: 'Viewed issue portal topic',
      forum_view: 'Viewed forum discussion',
      quiz_submit: 'Completed a quiz',
      forum_reply: 'Replied to a discussion',
      forum_topic_create: 'Created a discussion',
    };

    const logActivities = logEvents.map((e) => {
      const meta = e.metadata || {};
      let description = e.description;
      // Prefer human-readable title from metadata for view actions
      if (['mp_view', 'issue_view', 'forum_view', 'edu_view'].includes(e.action) && meta.title) {
        if (e.action === 'mp_view') {
          description = `Viewed MP profile: ${meta.title}`;
        } else if (e.action === 'issue_view') {
          description = `Viewed issue portal topic: ${meta.title}`;
        } else if (e.action === 'forum_view') {
          description = `Viewed forum discussion: ${meta.title}`;
        } else if (e.action === 'edu_view') {
          description = `Viewed education content: ${meta.title}`;
        }
      }
      return {
        _id: String(e._id),
        type: e.action,
        label: actionLabels[e.action] || e.action,
        description,
        metadata: meta,
        createdAt: e.timestamp || e.createdAt,
      };
    });

    // ── 2. Quiz submissions ──────────────────────────────────────────────────
    const quizzes = await QuizSubmission.find({ userId: userObjectId })
      .populate('resourceId', 'name title')
      .sort({ submittedAt: -1 })
      .limit(100)
      .lean();

    const quizActivities = quizzes.map((q) => {
      const resourceTitle = q.resourceId?.title || q.resourceId?.name || 'Quiz';
      return {
        _id: String(q._id),
        type: 'quiz_submit',
        label: 'Completed a quiz',
        description: `Completed quiz "${resourceTitle}" — Score: ${q.score}% (${q.passed ? 'Passed' : 'Failed'})`,
        metadata: { resourceId: String(q.resourceId?._id || q.resourceId), score: q.score, passed: q.passed },
        createdAt: q.submittedAt || q.createdAt,
      };
    });

    // ── 3. Feedback submissions ──────────────────────────────────────────────
    const feedbacks = await Feedback.find({ userId: userObjectId })
      .sort({ createdDate: -1 })
      .limit(100)
      .lean();

    const feedbackActivities = feedbacks.map((f) => ({
      _id: String(f._id),
      type: 'feedback_submit',
      label: 'Submitted feedback',
      description: `Submitted feedback: "${f.title}" (${f.category})`,
      metadata: { feedbackId: String(f._id), category: f.category, status: f.status },
      createdAt: f.createdDate || f.createdAt,
    }));

    // ── 4. Forum replies ─────────────────────────────────────────────────────
    const ForumPost = require('../models/ForumPost');
    const posts = await ForumPost.find({ author: userObjectId, status: { $ne: 'deleted' } })
      .populate('topic', 'title')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const replyActivities = posts.map((p) => ({
      _id: String(p._id),
      type: 'forum_reply',
      label: 'Replied to a discussion',
      description: `Replied to "${p.topic?.title || 'a discussion'}"`,
      metadata: { topicId: String(p.topic?._id || p.topic), topicTitle: p.topic?.title },
      createdAt: p.createdAt,
    }));

    // ── 5. Forum topics created ──────────────────────────────────────────────
    const ForumTopic = require('../models/ForumTopic');
    const createdTopics = await ForumTopic.find({ author: userObjectId, status: { $ne: 'deleted' } })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const topicCreateActivities = createdTopics.map((t) => ({
      _id: 'tc_' + String(t._id),
      type: 'forum_topic_create',
      label: 'Created a discussion',
      description: `Created discussion "${t.title}"`,
      metadata: { topicId: String(t._id), topicTitle: t.title },
      createdAt: t.createdAt,
    }));

    // ── Merge, de-duplicate, sort ────────────────────────────────────────────
    // Remove log events that are already represented by the dedicated queries
    // (quiz_submit, forum_reply, forum_topic_create from ActivityLog might duplicate)
    const dedupeTypes = new Set(['quiz_submit', 'forum_reply', 'forum_topic_create',
                                  'feedback_submit']);
    const filteredLog = logActivities.filter((a) => !dedupeTypes.has(a.type));

    const all = [
      ...filteredLog,
      ...quizActivities,
      ...feedbackActivities,
      ...replyActivities,
      ...topicCreateActivities,
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ activities: all });
  } catch (err) {
    console.error('[getMyActivities] error:', err);
    res.status(500).json({ message: 'Failed to get activities', error: err.message });
  }
};
  