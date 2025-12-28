const userService = require("../services/userService");

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
  