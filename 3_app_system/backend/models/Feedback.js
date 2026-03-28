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
    maxlength: 10000
  },
  category: {
    type: String,
    enum: ['Bug Report', 'UI / Theme', 'Feature Request', 'Performance', 'Security', 'General', 'Complaint', 'Suggestion', 'Other'],
    required: true,
    default: 'General'
  },
  parliamentaryCategory: {
    type: String,
    trim: true,
    maxlength: 300,
    default: ''
  },
  linkedTopic: {
    type: String,
    trim: true,
    maxlength: 300,
    default: ''
  },
  status: {
    type: String,
    enum: ['Pending', 'In-Progress', 'Resolved', 'Archived'],
    required: true,
    default: 'Pending'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    required: true,
    default: 'Low'
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
  // Full chronological log of all admin responses
  responses: {
    type: [
      {
        response: { type: String, trim: true, maxlength: 1000, required: true },
        respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
        respondedAt: { type: Date, default: Date.now }
      }
    ],
    default: []
  },
  createdDate: {
    type: Date,
    default: Date.now
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    default: null
  },
  attachments: {
    type: [
      {
        filename: { type: String, required: true },
        originalName: { type: String, required: true },
        mimetype: { type: String },
        size: { type: Number },
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
    default: []
  }
}, {
  timestamps: true
});

// Index for efficient queries
feedbackSchema.index({ status: 1, priority: 1, createdDate: -1 });
feedbackSchema.index({ userId: 1, createdDate: -1 });
feedbackSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('Feedback', feedbackSchema, 'Feedback');
