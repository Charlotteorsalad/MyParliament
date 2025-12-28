const mongoose = require('mongoose');

const quizSubmissionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EduResource',
    required: true
  },
  answers: [{
    type: Number,
    required: true
  }],
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  passed: {
    type: Boolean,
    required: true
  },
  timeSpent: {
    type: Number,
    default: 0 // in seconds
  },
  results: [{
    questionIndex: Number,
    question: String,
    userAnswer: Number,
    correctAnswer: Number,
    isCorrect: Boolean,
    options: [String]
  }],
  attempts: {
    type: Number,
    default: 1
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
quizSubmissionSchema.index({ userId: 1, resourceId: 1 });
quizSubmissionSchema.index({ userId: 1, submittedAt: -1 });
quizSubmissionSchema.index({ userId: 1, passed: 1 });

module.exports = mongoose.model('QuizSubmission', quizSubmissionSchema);
