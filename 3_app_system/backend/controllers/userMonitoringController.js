const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const asyncHandler = require('../middleware/asyncHandler');

// Search users by username or email
const searchUsers = asyncHandler(async (req, res) => {
  const { q } = req.query;
  
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ 
      message: 'Search query must be at least 2 characters long' 
    });
  }

  const searchTerm = q.trim();
  const users = await User.find({
    $or: [
      { username: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
      { 'profile.firstName': { $regex: searchTerm, $options: 'i' } },
      { 'profile.lastName': { $regex: searchTerm, $options: 'i' } }
    ]
  })
  .select('-password -resetPasswordToken -resetPasswordExpires')
  .limit(10)
  .sort({ lastLogin: -1 });

  // Add name field for frontend compatibility
  const usersWithName = users.map(user => ({
    ...user.toObject(),
    name: user.profile?.firstName && user.profile?.lastName 
      ? `${user.profile.firstName} ${user.profile.lastName}`
      : user.username
  }));

  console.log('User monitoring search:', { searchTerm, resultsCount: usersWithName.length });

  res.json(usersWithName);
});

// Get user activities with pagination
const getUserActivities = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Get real activities from ActivityLog
  const activities = await ActivityLog.find({ userId })
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // Get total count for pagination
  const total = await ActivityLog.countDocuments({ userId });
  const totalPages = Math.ceil(total / limit);

  // Format activities for frontend
  const formattedActivities = activities.map(activity => ({
    action: activity.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    description: activity.description,
    details: activity.details,
    timestamp: activity.timestamp.toLocaleString(),
    ipAddress: activity.ipAddress,
    type: activity.action
  }));

  console.log('User activities fetched:', { userId, total, page, limit });

  res.json({
    activities: formattedActivities,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      isRestricted: user.isRestricted || false,
      restrictedSince: user.restrictedSince || null,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    }
  });
});

// Restrict user
const restrictUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { days } = req.body;

  if (!days || days < 1 || days > 365) {
    return res.status(400).json({ 
      message: 'Restriction period must be between 1 and 365 days' 
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const restrictionEndDate = new Date();
  restrictionEndDate.setDate(restrictionEndDate.getDate() + days);

  user.isRestricted = true;
  user.restrictedSince = new Date();
  user.restrictionEndDate = restrictionEndDate;
  user.status = 'restricted';

  await user.save();

  res.json({
    message: `User ${user.username} has been restricted for ${days} days`,
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      isRestricted: user.isRestricted,
      restrictedSince: user.restrictedSince,
      restrictionEndDate: user.restrictionEndDate,
      status: user.status
    }
  });
});

// Unrestrict user
const unrestrictUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  user.isRestricted = false;
  user.restrictedSince = null;
  user.restrictionEndDate = null;
  user.status = 'active';

  await user.save();

  res.json({
    message: `User ${user.username} has been unrestricted`,
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      isRestricted: user.isRestricted,
      status: user.status
    }
  });
});

// Get user details
const getUserDetails = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId)
    .select('-password -resetPasswordToken -resetPasswordExpires');

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json({
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      isRestricted: user.isRestricted || false,
      restrictedSince: user.restrictedSince || null,
      restrictionEndDate: user.restrictionEndDate || null,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profile: user.profile,
      followedMPs: user.followedMPs || [],
      followedTopics: user.followedTopics || [],
      bookmarks: user.bookmarks || []
    }
  });
});

module.exports = {
  searchUsers,
  getUserActivities,
  restrictUser,
  unrestrictUser,
  getUserDetails
};
