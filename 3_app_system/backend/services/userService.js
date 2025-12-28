const User = require("../models/User");
const { EduResource } = require("../models/EduResource");
const mongoose = require('mongoose');

class UserService {
  async updateProfile(userId, profileData) {
    const updated = await User.findByIdAndUpdate(
      userId,
      { profile: profileData },
      { new: true }
    );
    
    if (!updated) {
      throw new Error("User not found");
    }
    
    return updated.profile;
  }

  async getUserProfile(userId) {
    const user = await User.findById(userId).select("-password");
    
    if (!user) {
      throw new Error("User not found");
    }

    // Get bookmarked educational resources
    const bookmarkedEdu = await EduResource.find({
      _id: { $in: user.bookmarks || [] },
    });

    // Get followed MPs with basic info using mongoose.model to avoid overwrite error
    const MP = mongoose.model('MP');
    const followedMPs = await MP.find({
      _id: { $in: user.followedMPs || [] },
    }).select("name party constituency profilePicture");

    // Get followed topics with basic info
    const Topic = mongoose.model('Topic');
    const followedTopics = await Topic.find({
      _id: { $in: user.followedTopics || [] },
    }).select("title category description");

    // Count user's forum discussions (topics created)
    const ForumTopic = mongoose.model('ForumTopic');
    const discussionCount = await ForumTopic.countDocuments({
      author: userId,
      status: { $ne: 'deleted' }
    });

    // Count user's forum posts (replies)
    const ForumPost = mongoose.model('ForumPost');
    const postCount = await ForumPost.countDocuments({
      author: userId,
      status: { $ne: 'deleted' }
    });

    return {
      ...user.toObject(),
      bookmarkedEdu,
      followedMPs,
      followedTopics,
      stats: {
        followedMPs: followedMPs.length,
        followedTopics: followedTopics.length,
        bookmarkedEdu: bookmarkedEdu.length,
        discussions: discussionCount + postCount, // Total forum activity
        topicsCreated: discussionCount,
        postsCreated: postCount
      }
    };
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
