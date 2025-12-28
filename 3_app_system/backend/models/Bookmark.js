const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  type: {
    type: String,
    enum: ['education', 'topic', 'mp', 'forum'],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  resourceData: {
    title: String,
    description: String,
    // Add other relevant fields that might be useful for display
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  tags: [String],
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient queries
bookmarkSchema.index({ userId: 1, type: 1, createdAt: -1 });
bookmarkSchema.index({ userId: 1, resourceId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Bookmark', bookmarkSchema);
