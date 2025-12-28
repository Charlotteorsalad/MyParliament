const mongoose = require('mongoose');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/myparliament', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const seedActivities = async () => {
  try {
    // Get a few users to add activities for
    const users = await User.find().limit(3);
    
    if (users.length === 0) {
      console.log('No users found. Please create some users first.');
      return;
    }

    console.log(`Found ${users.length} users. Adding sample activities...`);

    for (const user of users) {
      // Clear existing activities for this user
      await ActivityLog.deleteMany({ userId: user._id });

      // Create sample activities
      const activities = [
        {
          userId: user._id,
          action: 'login',
          description: 'User logged into the system',
          details: 'Successful login from web browser',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago
        },
        {
          userId: user._id,
          action: 'content_view',
          description: 'User viewed educational content',
          details: 'Viewed parliamentary education materials',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
        },
        {
          userId: user._id,
          action: 'content_search',
          description: 'User performed a search',
          details: 'Searched for: parliamentary procedures',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          metadata: { searchQuery: 'parliamentary procedures' },
          timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago
        },
        {
          userId: user._id,
          action: 'mp_follow',
          description: 'User followed an MP',
          details: 'Started following Member of Parliament',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          metadata: { mpId: '507f1f77bcf86cd799439011' },
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
        },
        {
          userId: user._id,
          action: 'bookmark_add',
          description: 'User bookmarked content',
          details: 'Bookmarked educational resource',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          metadata: { contentId: '507f1f77bcf86cd799439012' },
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
        },
        {
          userId: user._id,
          action: 'profile_update',
          description: 'User updated their profile',
          details: 'Updated personal information',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
        },
        {
          userId: user._id,
          action: 'register',
          description: 'User registered on the platform',
          details: 'Created new account',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          timestamp: user.createdAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 1 week ago
        }
      ];

      await ActivityLog.insertMany(activities);
      console.log(`Added ${activities.length} activities for user ${user.username}`);
    }

    console.log('Sample activities seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding activities:', error);
    process.exit(1);
  }
};

seedActivities();
