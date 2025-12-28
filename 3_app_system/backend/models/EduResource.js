const mongoose = require('mongoose');

const quizQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  type: { type: String, enum: ['multiple_choice', 'true_false', 'short_answer'], default: 'multiple_choice' },
  options: [String], // For multiple choice questions
  correctAnswer: { type: mongoose.Schema.Types.Mixed, required: true }, // Can be String or Number
  explanation: String,
  points: { type: Number, default: 1 }
});

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  questions: [quizQuestionSchema],
  timeLimit: Number, // in minutes
  passingScore: { type: Number, default: 70 }, // percentage
  maxAttempts: { type: Number, default: 3 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const attachmentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  url: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

const eduResourceSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Changed from title to name to match existing data
  title: { type: String }, // Keep title for backward compatibility
  description: { type: String }, // Made optional to match existing data
  content: { type: String }, // Made optional since existing data might not have this field
  category: { 
    type: String, 
    required: true,
    enum: ['parliamentary_process', 'democracy', 'civic_education', 'government_structure', 'elections', 'constitution', 'other', 'articles'] // Added 'articles' to match existing data
  },
  tags: [String],
  themes: [String], // For theme badges displayed on user side
  image: {
    data: String,        // Base64 encoded image data
    contentType: String, // MIME type (e.g., 'image/jpeg', 'image/png')
    size: Number,        // File size in bytes
    originalName: String // Original filename
  },
  contentAttachments: [attachmentSchema],
  quizAttachments: [attachmentSchema],
  // Keep old attachments field for backward compatibility
  attachments: [attachmentSchema],
  topics: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }],
  timeToRead: { type: Number, default: 5 }, // in minutes
  difficulty: { 
    type: String, 
    enum: ['beginner', 'intermediate', 'advanced'], 
    default: 'beginner' 
  },
  quiz: {
    title: String,
    description: String,
    questions: [quizQuestionSchema],
    timeLimit: Number,
    passingScore: { type: Number, default: 70 },
    maxAttempts: { type: Number, default: 3 },
    isActive: { type: Boolean, default: true }
  },
  views: { type: Number, default: 0 },
  bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  likes: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['draft', 'published', 'archived'], 
    default: 'draft' 
  },
  publishedAt: Date,
  featured: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' }, // Made optional to match existing data
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for better performance
eduResourceSchema.index({ status: 1, publishedAt: -1 });
eduResourceSchema.index({ category: 1 });
eduResourceSchema.index({ createdBy: 1 });
eduResourceSchema.index({ title: 'text', description: 'text', content: 'text' });

// Pre-save middleware to update updatedAt and sync name/title
eduResourceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  if (this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  // Sync name field with title for consistency
  if (this.title && !this.name) {
    this.name = this.title;
  } else if (this.name && !this.title) {
    this.title = this.name;
  }
  
  next();
});

const Quiz = mongoose.model('Quiz', quizSchema);
const EduResource = mongoose.model('EduResource', eduResourceSchema, 'EduResource');

module.exports = { EduResource, Quiz };
