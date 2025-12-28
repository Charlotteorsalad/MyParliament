const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  category: {
    type: String,
    enum: ['Bug', 'Feature Request', 'General', 'Complaint', 'Suggestion', 'Other'],
    required: true,
    default: 'General'
  },
  status: {
    type: String,
    enum: ['Pending', 'In-Progress', 'Archived'],
    required: true,
    default: 'Pending'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    required: true,
    default: 'Medium'
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  adminResponse: {
    response: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    respondedAt: {
      type: Date
    }
  },
  createdDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
feedbackSchema.index({ status: 1, priority: 1, createdDate: -1 });
feedbackSchema.index({ userId: 1, createdDate: -1 });
feedbackSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('Feedback', feedbackSchema, 'Feedback');
