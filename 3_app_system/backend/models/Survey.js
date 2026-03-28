const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  type: {
    type: String,
    enum: ['text', 'rating', 'multiple_choice', 'yes_no'],
    required: true
  },
  options: [{ type: String }],
  required: { type: Boolean, default: true }
}, { _id: false });

const answerSchema = new mongoose.Schema({
  questionId: { type: String, required: true },
  answer: { type: mongoose.Schema.Types.Mixed }
}, { _id: false });

const responseSchema = new mongoose.Schema({
  respondentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  respondentName: { type: String, default: 'Anonymous' },
  answers: [answerSchema],
  submittedAt: { type: Date, default: Date.now }
}, { _id: true });

const surveySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  status: {
    type: String,
    enum: ['Draft', 'Active', 'Closed'],
    default: 'Draft'
  },
  questions: [questionSchema],
  responses: [responseSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', required: true },
  createdByName: { type: String },
  publishedAt: { type: Date },
  closedAt: { type: Date }
}, { timestamps: true });

surveySchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Survey', surveySchema);
