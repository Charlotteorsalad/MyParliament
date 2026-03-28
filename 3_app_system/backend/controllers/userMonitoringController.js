const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const asyncHandler = require('../middleware/asyncHandler');
const { logAdminActivity } = require('../utils/adminActivityLogger');

// Search users: same logic as User list (getAllUsers) — case-insensitive, spaces ignored, first/last name order doesn't matter, email kept
const searchUsers = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({
      message: 'Search query must be at least 2 characters long'
    });
  }

  const search = q.trim();
  const normalized = search.replace(/\s+/g, '').toLowerCase();
  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escaped = escapeRegex(normalized);
  const pattern = normalized ? `.*${escaped}.*` : '';

  const orConditions = [
    { email: { $regex: escapeRegex(search), $options: 'i' } },
    { username: { $regex: pattern, $options: 'i' } },
  ];

  if (normalized.length > 0) {
    const nameExpr = {
      $or: [
        {
          $regexMatch: {
            input: {
              $replaceAll: {
                input: { $toLower: { $concat: [{ $ifNull: ['$profile.firstName', ''] }, { $ifNull: ['$profile.lastName', ''] }] } },
                find: ' ',
                replacement: '',
              },
            },
            regex: pattern,
          },
        },
        {
          $regexMatch: {
            input: {
              $replaceAll: {
                input: { $toLower: { $concat: [{ $ifNull: ['$profile.lastName', ''] }, { $ifNull: ['$profile.firstName', ''] }] } },
                find: ' ',
                replacement: '',
              },
            },
            regex: pattern,
          },
        },
      ],
    };
    orConditions.push({ $expr: nameExpr });
  }

  const filter = { $or: orConditions };

  const users = await User.find(filter)
    .select('-password -resetPasswordToken -resetPasswordExpires')
    .limit(10)
    .sort({ lastLogin: -1 });

  const usersWithName = users.map(user => ({
    ...user.toObject(),
    name: user.profile?.firstName && user.profile?.lastName
      ? `${user.profile.firstName} ${user.profile.lastName}`
      : user.username
  }));

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
      status: user.status || 'active',
      isRestricted: user.isRestricted || false,
      restrictedSince: user.restrictedSince || null,
      restrictionEndDate: user.restrictionEndDate || null,
      restrictionReason: user.restrictionReason || null,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    }
  });
});

// Suspend user (permanent ban: cannot login)
const suspendUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  user.status = 'suspended';
  await user.save();

  const adminId = req.admin && (req.admin._id || req.admin.id);
  if (adminId) {
    await logAdminActivity(
      adminId,
      'suspend_user',
      `Suspended user (permanent): ${user.username}`,
      JSON.stringify({ userId: user._id })
    );
  }

  res.json({
    message: `User ${user.username} has been suspended. They can no longer log in.`,
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      status: user.status
    }
  });
});

// Unsuspend user (restore login)
const unsuspendUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  user.status = 'active';
  await user.save();

  const adminId = req.admin && (req.admin._id || req.admin.id);
  if (adminId) {
    await logAdminActivity(
      adminId,
      'unsuspend_user',
      `Unsuspended user: ${user.username}`,
      JSON.stringify({ userId: user._id })
    );
  }

  res.json({
    message: `User ${user.username} has been unsuspended and can log in again.`,
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      status: user.status
    }
  });
});

// Restrict user (accepts endDate or days, and reason; reason is stored and shown to user)
const restrictUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { endDate: endDateParam, days, reason } = req.body;

  let restrictionEndDate;
  if (endDateParam) {
    restrictionEndDate = new Date(endDateParam);
    if (Number.isNaN(restrictionEndDate.getTime())) {
      return res.status(400).json({ message: 'Invalid restrict-until date' });
    }
    if (restrictionEndDate <= new Date()) {
      return res.status(400).json({ message: 'Restrict-until date must be in the future' });
    }
  } else {
    const numDays = days != null ? Number(days) : 30;
    if (numDays < 1 || numDays > 365) {
      return res.status(400).json({
        message: 'Restriction period must be between 1 and 365 days'
      });
    }
    restrictionEndDate = new Date();
    restrictionEndDate.setDate(restrictionEndDate.getDate() + numDays);
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  user.isRestricted = true;
  user.restrictedSince = new Date();
  user.restrictionEndDate = restrictionEndDate;
  user.restrictionReason = reason && String(reason).trim() ? String(reason).trim() : '';
  user.status = 'restricted';

  await user.save();

  const adminId = req.admin && (req.admin._id || req.admin.id);
  if (adminId) {
    await logAdminActivity(
      adminId,
      'restrict_user',
      `Restricted user: ${user.username} until ${restrictionEndDate.toLocaleDateString()}`,
      JSON.stringify({ userId: user._id, reason: user.restrictionReason })
    );
  }

  res.json({
    message: `User ${user.username} has been restricted until ${restrictionEndDate.toLocaleDateString()}.${user.restrictionReason ? ' They will see the reason you provided.' : ''}`,
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      isRestricted: user.isRestricted,
      restrictedSince: user.restrictedSince,
      restrictionEndDate: user.restrictionEndDate,
      restrictionReason: user.restrictionReason,
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
  user.restrictionReason = null;
  user.status = 'active';

  await user.save();

  const adminId = req.admin && (req.admin._id || req.admin.id);
  if (adminId) {
    await logAdminActivity(
      adminId,
      'unrestrict_user',
      `Unrestricted user: ${user.username}`,
      JSON.stringify({ userId: user._id })
    );
  }

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
      restrictionReason: user.restrictionReason || null,
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
  suspendUser,
  unsuspendUser,
  restrictUser,
  unrestrictUser,
  getUserDetails
};
