const mongoose = require('mongoose');
const QuizSubmission = require('../models/QuizSubmission');
const { EduResource } = require('../models/EduResource');
const ActivityLog = require('../models/ActivityLog');
const asyncHandler = require('../middleware/asyncHandler');
const { normalizeEmbeddedQuiz } = require('../utils/quizNormalize');

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

  // Validate resourceId is a valid MongoDB ObjectId (avoids 500 CastError)
  if (!mongoose.Types.ObjectId.isValid(resourceId)) {
    return res.status(400).json({ 
      message: 'Invalid resource ID' 
    });
  }

  // Get the education resource and its quiz
  const resource = await EduResource.findById(resourceId);
  if (!resource || !resource.quiz || !resource.quiz.questions) {
    return res.status(404).json({ 
      message: 'Quiz not found for this resource' 
    });
  }

  const rawQuiz =
    resource.quiz && typeof resource.quiz.toObject === 'function'
      ? resource.quiz.toObject()
      : resource.quiz;
  const quiz = normalizeEmbeddedQuiz(rawQuiz);
  const questions = quiz.questions;

  if (!questions.length) {
    return res.status(404).json({ 
      message: 'Quiz has no questions' 
    });
  }

  // Normalize answers to numbers (quiz may store correctAnswer as string); avoid NaN
  const toInt = (v) => {
    const n = typeof v === 'number' ? v : parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  };
  const normalizedAnswers = Array.isArray(answers) ? answers.map(toInt) : [];

  const trueFalseToIndex = (v) => {
    if (v === true || v === 'true') return 0;
    if (v === false || v === 'false') return 1;
    return -1;
  };

  // Calculate score
  let correctAnswers = 0;
  const results = questions.map((question, index) => {
    const qType = question.type || 'multiple_choice';
    const userRaw = normalizedAnswers[index];

    if (qType === 'true_false') {
      const userAnswer = toInt(userRaw); // 0 = True, 1 = False
      const correctIdx = trueFalseToIndex(question.correctAnswer);
      const isCorrect = correctIdx >= 0 && userAnswer === correctIdx;
      if (isCorrect) correctAnswers++;
      return {
        questionIndex: index,
        question: String(question.question || ''),
        userAnswer,
        correctAnswer: correctIdx,
        isCorrect,
        options: ['True', 'False']
      };
    }

    const userAnswer = toInt(userRaw);
    const correctNum = toInt(question.correctAnswer);
    const isCorrect = userAnswer === correctNum;
    if (isCorrect) correctAnswers++;
    return {
      questionIndex: index,
      question: String(question.question || ''),
      userAnswer,
      correctAnswer: correctNum,
      isCorrect,
      options: Array.isArray(question.options) ? question.options : []
    };
  });

  let score = Math.round((correctAnswers / questions.length) * 100);
  score = Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0;
  const passed = score >= (quiz.passingScore || 70);

  // Ensure userId is valid ObjectId for DB operations
  const userIdStr = userId && (typeof userId === 'string' ? userId : userId.toString && userId.toString());
  if (!userIdStr || !mongoose.Types.ObjectId.isValid(userIdStr)) {
    return res.status(401).json({ message: 'Invalid user' });
  }

  // Check if user already submitted this quiz
  let submission;
  try {
    const existingSubmission = await QuizSubmission.findOne({ 
      userId, 
      resourceId 
    });

    if (existingSubmission) {
      existingSubmission.answers = normalizedAnswers;
      existingSubmission.score = score;
      existingSubmission.passed = passed;
      existingSubmission.timeSpent = timeSpent || 0;
      existingSubmission.results = results;
      existingSubmission.attempts += 1;
      await existingSubmission.save();
      submission = existingSubmission;
    } else {
      submission = new QuizSubmission({
        userId,
        resourceId,
        answers: normalizedAnswers,
        score,
        passed,
        timeSpent: timeSpent || 0,
        results,
        attempts: 1
      });
      await submission.save();
    }
  } catch (saveErr) {
    console.error('[quiz/submit] Save error:', saveErr.message || saveErr);
    return res.status(500).json({
      message: saveErr.message || 'Failed to save quiz submission',
    });
  }

  // Log quiz submission activity (fire-and-forget)
  ActivityLog.create({
    userId,
    action: 'quiz_submit',
    description: `Completed quiz for "${resource.title || resource.name}" — Score: ${score}% (${passed ? 'Passed' : 'Failed'})`,
    metadata: { resourceId: String(resourceId), score, passed, attempts: submission.attempts },
  }).catch(() => {});

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

// Get existing submission for a specific resource (for restoring quiz state on reload/login)
const getSubmissionByResource = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { resourceId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(resourceId)) {
    return res.status(400).json({ message: 'Invalid resource ID' });
  }

  const submission = await QuizSubmission.findOne({ userId, resourceId }).sort({ createdAt: -1 });
  if (!submission) {
    return res.json({ submission: null });
  }

  res.json({
    submission: {
      _id: submission._id,
      score: submission.score,
      passed: submission.passed,
      answers: submission.answers,
      results: submission.results,
      attempts: submission.attempts,
      submittedAt: submission.createdAt,
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
  getSubmissionByResource,
  getQuizHistory
};
