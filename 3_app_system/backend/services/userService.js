const User = require("../models/User");
const { EduResource } = require("../models/EduResource");
const Bookmark = require("../models/Bookmark");
const mongoose = require('mongoose');

class UserService {
  async updateProfile(userId, profileData) {
    const update = {};
    if (profileData.firstName !== undefined) update['profile.firstName'] = profileData.firstName;
    if (profileData.lastName !== undefined) update['profile.lastName'] = profileData.lastName;
    if (profileData.BOD !== undefined) update['profile.BOD'] = profileData.BOD ? new Date(profileData.BOD) : null;
    if (profileData.state !== undefined) update['profile.state'] = profileData.state;
    if (profileData.constituency !== undefined) update['profile.constituency'] = profileData.constituency;
    if (profileData.picture !== undefined) update['profile.picture'] = profileData.picture;

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: update },
      { new: true }
    );

    if (!updated) {
      throw new Error("User not found");
    }

    return updated.profile;
  }

  async updateNotificationPreferences(userId, prefs) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    if (!user.preferences) user.preferences = {};
    if (!user.preferences.notificationPreferences) {
      user.preferences.notificationPreferences = {};
    }
    const np = user.preferences.notificationPreferences;
    if (typeof prefs.emailNotifications === 'boolean') np.emailNotifications = prefs.emailNotifications;
    if (typeof prefs.pushNotifications === 'boolean') np.pushNotifications = prefs.pushNotifications;
    if (typeof prefs.mpActivities === 'boolean') np.mpActivities = prefs.mpActivities;
    if (typeof prefs.discussionUpdates === 'boolean') np.discussionUpdates = prefs.discussionUpdates;
    if (typeof prefs.educationalContent === 'boolean') np.educationalContent = prefs.educationalContent;
    if (typeof prefs.moderationNotices === 'boolean') np.moderationNotices = prefs.moderationNotices;
    await user.save();
    return user.preferences.notificationPreferences;
  }

  async savePushSubscription(userId, subscription) {
    if (!subscription || !subscription.endpoint || !subscription.keys) return;
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    if (!user.pushSubscriptions) user.pushSubscriptions = [];
    const { endpoint, keys } = subscription;
    const existing = user.pushSubscriptions.findIndex((s) => s.endpoint === endpoint);
    const doc = { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, createdAt: new Date() };
    if (existing >= 0) user.pushSubscriptions[existing] = doc;
    else user.pushSubscriptions.push(doc);
    await user.save();
    return user.pushSubscriptions;
  }

  async removePushSubscription(userId, endpoint) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    if (user.pushSubscriptions && user.pushSubscriptions.length) {
      user.pushSubscriptions = user.pushSubscriptions.filter((s) => s.endpoint !== endpoint);
      await user.save();
    }
    return user.pushSubscriptions || [];
  }

  async markNotificationRead(userId, notificationId) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    const notifications = user.notifications || [];
    const idx = notifications.findIndex(
      (n) => String(n._id) === String(notificationId)
    );
    if (idx === -1) return false;
    if (!notifications[idx].read) {
      notifications[idx].read = true;
      await user.save();
    }
    return true;
  }

  async markAllNotificationsRead(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    let changed = false;
    for (const n of user.notifications || []) {
      if (!n.read) { n.read = true; changed = true; }
    }
    if (changed) await user.save();
    return true;
  }

  async getUserProfile(userId) {
    const user = await User.findById(userId).select("-password");
    
    if (!user) {
      throw new Error("User not found");
    }

    // Get bookmarked educational resources
    // Legacy: User.bookmarks (EduResource ids)
    const legacyEduIds = (user.bookmarks || []).map((id) => String(id));
    const legacyEduDocs = legacyEduIds.length
      ? await EduResource.find({ _id: { $in: legacyEduIds } }).lean()
      : [];

    // New: Bookmark collection with type 'education'
    const eduBookmarks = await Bookmark.find({
      userId,
      type: 'education',
      isArchived: { $ne: true },
    })
      .populate('resourceId')
      .lean();

    // Merge legacy + new into a unified list keyed by EduResource _id
    const eduMap = new Map();
    for (const doc of legacyEduDocs) {
      const key = String(doc._id);
      eduMap.set(key, {
        _id: doc._id,
        id: doc._id,
        title: doc.title || doc.name,
        category: doc.category || '',
        description: doc.description || '',
      });
    }
    for (const b of eduBookmarks) {
      const res = b.resourceId || {};
      const key = String(res._id || b.resourceId);
      if (!key) continue;
      if (!eduMap.has(key)) {
        eduMap.set(key, {
          _id: res._id || b.resourceId,
          id: res._id || b.resourceId,
          title: res.title || res.name || b.title,
          category: res.category || '',
          description: res.description || b.description || '',
        });
      }
    }
    const bookmarkedEduContent = Array.from(eduMap.values());
    const bookmarkedEdu = legacyEduDocs; // keep legacy field for backward-compat

    // Get bookmarked forum discussions (from Bookmark collection, type 'forum')
    const forumBookmarks = await Bookmark.find({
      userId,
      type: 'forum',
      isArchived: { $ne: true },
    })
      .populate('resourceId')
      .lean();

    // Normalise forum bookmarks to a unique list by discussion id
    const discussionMap = new Map();
    for (const b of forumBookmarks || []) {
      const res = b.resourceId || {};
      const rawId = res._id || b.resourceId;
      if (!rawId) continue;
      const key = String(rawId);
      if (discussionMap.has(key)) continue;

      discussionMap.set(key, {
        _id: rawId,
        id: rawId,
        title: res.title || b.title || 'Discussion',
        category: res.category || 'general',
        description: res.description || b.description || '',
        createdAt: res.createdAt || b.createdAt,
      });
    }
    const bookmarkedDiscussions = Array.from(discussionMap.values());

    // Get followed MPs — MP _ids are stored as strings in MongoDB, so use native collection query
    const rawFollowedIds = (user.followedMPs || []).map(id => String(id));
    let followedMPs = [];
    if (rawFollowedIds.length > 0) {
      const nativeCol = mongoose.connection.db.collection('MP');
      const mpDocs = await nativeCol.find(
        { _id: { $in: rawFollowedIds } },
        { projection: { _id: 1, mp_id: 1, name: 1, party: 1, party_full_name: 1, constituency: 1, constituency_code: 1, constituency_name: 1, state: 1, profilePicture: 1 } }
      ).toArray();
      followedMPs = mpDocs;
    }

    // Get followed topics (Issue Portal stars + any other followed): resolve from Topic model where exists, else placeholder
    const Topic = mongoose.model('Topic');
    const followedTopicIds = user.followedTopics || [];
    const topicDocs = await Topic.find({ _id: { $in: followedTopicIds } }).select("title category description content createdAt updatedAt").lean();
    const topicMap = new Map(topicDocs.map((t) => [String(t._id), t]));
    const followedTopics = followedTopicIds.map((id) => {
      const doc = topicMap.get(String(id));
      return doc ? { _id: doc._id, id: doc._id, title: doc.title, category: doc.category, description: doc.description, content: doc.content, createdAt: doc.createdAt, updatedAt: doc.updatedAt } : { _id: id, id, title: 'Topic', description: '' };
    });

    // User's forum discussions (topics created)
    const ForumTopic = mongoose.model('ForumTopic');
    const userTopicDocs = await ForumTopic.find({
      author: userId,
      status: { $ne: 'deleted' }
    })
      .sort({ createdAt: -1 })
      .select('title category createdAt')
      .lean();
    const discussionCount = userTopicDocs.length;

    const userDiscussions = userTopicDocs.map((t) => ({
      _id: t._id,
      id: t._id,
      title: t.title,
      category: t.category,
      createdAt: t.createdAt,
    }));

    // User's forum posts (replies)
    const ForumPost = mongoose.model('ForumPost');
    const userPostDocs = await ForumPost.find({
      author: userId,
      status: { $ne: 'deleted' }
    })
      .sort({ createdAt: -1 })
      .populate('topic', 'title')
      .lean();
    const postCount = userPostDocs.length;

    const userReplies = userPostDocs.map((p) => ({
      _id: p._id,
      id: p._id,
      topicId: p.topic?._id || p.topic,
      topicTitle: p.topic?.title,
      content: p.content,
      contentPreview: p.content?.slice(0, 160),
      createdAt: p.createdAt,
    }));

    // Sort notifications newest-first
    const userObj = user.toObject();
    if (Array.isArray(userObj.notifications)) {
      userObj.notifications = userObj.notifications.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    }

    return {
      ...userObj,
      bookmarkedEdu,
      bookmarkedEduContent,
      bookmarkedDiscussions,
      followedMPs,
      followedTopics,
      discussions: userDiscussions,
      replies: userReplies,
      activities: [],
      stats: {
        followedMPs: followedMPs.length,
        followedTopics: followedTopics.length,
        bookmarkedEdu: bookmarkedEduContent.length,
        bookmarkedEduContent: bookmarkedEduContent.length,
        bookmarkedDiscussions: bookmarkedDiscussions.length,
        discussions: discussionCount + postCount, // Total forum activity
        topicsCreated: discussionCount,
        postsCreated: postCount
      }
    };
  }

  async followMP(userId, mpId) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    if (!user.followedMPs) user.followedMPs = [];

    // MP _ids in the DB are strings — resolve the canonical string _id via native query
    const nativeCol = mongoose.connection.db.collection('MP');
    const idStr = String(mpId);
    let mpDoc = await nativeCol.findOne({ _id: idStr }, { projection: { _id: 1 } });
    if (!mpDoc) {
      // Fallback: treat mpId as an mp_id field (e.g. "P092")
      mpDoc = await nativeCol.findOne({ mp_id: idStr }, { projection: { _id: 1 } });
    }
    if (!mpDoc) throw new Error("MP not found");

    const targetStr = String(mpDoc._id);
    // Normalise existing followedMPs to unique string ids (clean up legacy ObjectId + duplicates)
    user.followedMPs = Array.from(
      new Set((user.followedMPs || []).map((id) => String(id)))
    );
    if (user.followedMPs.includes(targetStr)) return false;
    user.followedMPs.push(targetStr);
    await user.save();
    return true;
  }

  async unfollowMP(userId, mpId) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    if (!user.followedMPs || user.followedMPs.length === 0) return false;

    const nativeCol = mongoose.connection.db.collection('MP');
    const idStr = String(mpId);
    let mpDoc = await nativeCol.findOne({ _id: idStr }, { projection: { _id: 1 } });
    if (!mpDoc) {
      mpDoc = await nativeCol.findOne({ mp_id: idStr }, { projection: { _id: 1 } });
    }
    if (!mpDoc) return false;

    const targetStr = String(mpDoc._id);
    const before = user.followedMPs.length;
    // Normalise to strings and filter out this mp id
    user.followedMPs = (user.followedMPs || [])
      .map((id) => String(id))
      .filter((id) => id !== targetStr);
    if (user.followedMPs.length === before) return false;
    await user.save();
    return true;
  }

  async followTopic(userId, topicId) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    if (!user.followedTopics) user.followedTopics = [];
    const idStr = String(topicId);
    if (user.followedTopics.some((id) => String(id) === idStr)) return false; // already following
    user.followedTopics.push(topicId);
    await user.save();
    return true;
  }

  async unfollowTopic(userId, topicId) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    if (!user.followedTopics) return false;
    const idStr = String(topicId);
    const before = user.followedTopics.length;
    user.followedTopics = user.followedTopics.filter((id) => String(id) !== idStr);
    if (user.followedTopics.length === before) return false;
    await user.save();
    return true;
  }

  async toggleBookmark(userId, eduId) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error("User not found");
    }

    // Initialize bookmarks array if it doesn't exist
    if (!user.bookmarks) {
      user.bookmarks = [];
    }

    const alreadyBookmarked = user.bookmarks.includes(eduId);
    
    if (alreadyBookmarked) {
      user.bookmarks = user.bookmarks.filter((id) => id !== eduId);
    } else {
      user.bookmarks.push(eduId);
    }

    await user.save();
    return !alreadyBookmarked;
  }

  async getUserById(userId) {
    const user = await User.findById(userId).select("-password");
    
    if (!user) {
      throw new Error("User not found");
    }
    
    return user;
  }
}

module.exports = new UserService();
