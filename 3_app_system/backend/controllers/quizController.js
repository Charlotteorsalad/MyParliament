const mongoose = require('mongoose');
const QuizSubmission = require('../models/QuizSubmission');
const EduResource = require('../models/EduResource');
const asyncHandler = require('../middleware/asyncHandler');

// Submit quiz answers
const submitQuiz = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { resourceId, answers, timeSpent } = req.body;

  // Validate required fields
  if (!resourceId || !answers) {
    return res.status(400).json({ 
      message: 'Resource ID and answers are required' 
    });
  }

  // Get the education resource and its quiz
  const resource = await EduResource.findById(resourceId);
  if (!resource || !resource.quiz || !resource.quiz.questions) {
    return res.status(404).json({ 
      message: 'Quiz not found for this resource' 
    });
  }

  const quiz = resource.quiz;
  const questions = quiz.questions;

  // Calculate score
  let correctAnswers = 0;
  const results = questions.map((question, index) => {
    const userAnswer = answers[index];
    const isCorrect = userAnswer === question.correctAnswer;
    if (isCorrect) correctAnswers++;
    
    return {
      questionIndex: index,
      question: question.question,
      userAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
      options: question.options
    };
  });

  const score = Math.round((correctAnswers / questions.length) * 100);
  const passed = score >= (quiz.passingScore || 70);

  // Check if user already submitted this quiz
  const existingSubmission = await QuizSubmission.findOne({ 
    userId, 
    resourceId 
  });

  let submission;
  if (existingSubmission) {
    // Update existing submission
    existingSubmission.answers = answers;
    existingSubmission.score = score;
    existingSubmission.passed = passed;
    existingSubmission.timeSpent = timeSpent || 0;
    existingSubmission.results = results;
    existingSubmission.attempts += 1;
    await existingSubmission.save();
    submission = existingSubmission;
  } else {
    // Create new submission
    submission = new QuizSubmission({
      userId,
      resourceId,
      answers,
      score,
      passed,
      timeSpent: timeSpent || 0,
      results,
      attempts: 1
    });
    await submission.save();
  }

  res.json({
    message: 'Quiz submitted successfully',
    submission: {
      _id: submission._id,
      score,
      passed,
      correctAnswers,
      totalQuestions: questions.length,
      timeSpent: submission.timeSpent,
      attempts: submission.attempts,
      submittedAt: submission.createdAt,
      results
    }
  });
});

// Get user's quiz progress
const getQuizProgress = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10 } = req.query;
  
  const skip = (page - 1) * limit;

  const submissions = await QuizSubmission.find({ userId })
    .populate('resourceId', 'name title description')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

  const total = await QuizSubmission.countDocuments({ userId });

  // Calculate overall stats
  const stats = await QuizSubmission.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalQuizzes: { $sum: 1 },
        averageScore: { $avg: '$score' },
        passedQuizzes: { $sum: { $cond: ['$passed', 1, 0] } },
        totalTimeSpent: { $sum: '$timeSpent' }
      }
    }
  ]);

  res.json({
    submissions,
    stats: stats[0] || {
      totalQuizzes: 0,
      averageScore: 0,
      passedQuizzes: 0,
      totalTimeSpent: 0
    },
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// Get specific quiz results
const getQuizResults = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { quizId } = req.params;

  const submission = await QuizSubmission.findOne({ 
    _id: quizId, 
    userId 
  }).populate('resourceId', 'name title description');

  if (!submission) {
    return res.status(404).json({ 
      message: 'Quiz submission not found' 
    });
  }

  res.json({
    submission: {
      _id: submission._id,
      resourceId: submission.resourceId,
      score: submission.score,
      passed: submission.passed,
      timeSpent: submission.timeSpent,
      attempts: submission.attempts,
      submittedAt: submission.createdAt,
      results: submission.results
    }
  });
});

// Get quiz history
const getQuizHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { type = 'all', page = 1, limit = 10 } = req.query;
  
  const skip = (page - 1) * limit;
  const filter = { userId };
  
  if (type === 'passed') filter.passed = true;
  else if (type === 'failed') filter.passed = false;

  const submissions = await QuizSubmission.find(filter)
    .populate('resourceId', 'name title description')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

  const total = await QuizSubmission.countDocuments(filter);

  res.json({
    submissions,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

module.exports = {
  submitQuiz,
  getQuizProgress,
  getQuizResults,
  getQuizHistory
};
