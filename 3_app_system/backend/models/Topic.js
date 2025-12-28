const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  category: { 
    type: String, 
    required: true,
    enum: ['Economy', 'Health', 'Education', 'Environment', 'Technology', 'Social', 'Politics', 'Security', 'Infrastructure', 'Other'],
    index: true
  },
  description: { 
    type: String, 
    required: true,
    trim: true
  },
  content: {
    type: String,
    trim: true
  },
  image: {
    data: String,        // Base64 encoded image data
    contentType: String, // MIME type (e.g., 'image/jpeg', 'image/png')
    size: Number,        // File size in bytes
    originalName: String, // Original filename
    url: String          // URL for external images
  },
  views: { 
    type: Number, 
    default: 0 
  },
  bookmarks: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  likes: { 
    type: Number, 
    default: 0 
  },
  status: { 
    type: String, 
    enum: ['Active', 'Inactive', 'Archived', 'Draft'], 
    default: 'Active',
    index: true
  },
  featured: { 
    type: Boolean, 
    default: false,
    index: true
  },
  priority: {
    type: Number,
    default: 0,
    index: true
  },
  tags: [String],
  lastUpdated: { 
    type: Date, 
    default: Date.now 
  },
  publishedAt: Date,
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'AdminUser' 
  },
  updatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'AdminUser' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Indexes for better performance
topicSchema.index({ status: 1, featured: -1, priority: -1 });
topicSchema.index({ category: 1, status: 1 });
topicSchema.index({ title: 'text', description: 'text', content: 'text' });
topicSchema.index({ createdAt: -1 });
topicSchema.index({ lastUpdated: -1 });

// Pre-save middleware to update updatedAt
topicSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  this.lastUpdated = new Date();
  
  if (this.status === 'Active' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  next();
});

// Virtual for bookmark count
topicSchema.virtual('bookmarkCount').get(function() {
  return this.bookmarks ? this.bookmarks.length : 0;
});

// Ensure virtual fields are serialized
topicSchema.set('toJSON', { virtuals: true });

const Topic = mongoose.model('Topic', topicSchema, 'Topic');

module.exports = Topic;
