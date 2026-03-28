const Survey = require('../models/Survey');
const asyncHandler = require('../middleware/asyncHandler');
const { createAdminNotification } = require('../utils/adminNotifyHelper');
const { logAdminActivity } = require('../utils/adminActivityLogger');

const getRangeStartDate = (range) => {
  const now = new Date();
  const date = new Date(now);
  switch (range) {
    case '24h':
      date.setHours(date.getHours() - 24);
      return date;
    case '7days':
      date.setDate(date.getDate() - 7);
      return date;
    case '30days':
      date.setDate(date.getDate() - 30);
      return date;
    case '90days':
      date.setDate(date.getDate() - 90);
      return date;
    default:
      return null;
  }
};

const normalizeSurveyAnswer = (question, rawAnswer) => {
  if (!question) return undefined;

  if (question.type === 'rating') {
    const num = typeof rawAnswer === 'number' ? rawAnswer : parseInt(rawAnswer, 10);
    if (Number.isNaN(num) || num < 1 || num > 5) return undefined;
    return num;
  }

  if (question.type === 'yes_no') {
    const value = String(rawAnswer || '').trim();
    if (!['Yes', 'No'].includes(value)) return undefined;
    return value;
  }

  if (question.type === 'multiple_choice') {
    const options = Array.isArray(question.options) ? question.options : [];
    const values = Array.isArray(rawAnswer) ? rawAnswer : [rawAnswer];
    const normalized = values
      .map((value) => String(value || '').trim())
      .filter((value) => value && options.includes(value));
    return Array.from(new Set(normalized));
  }

  return String(rawAnswer ?? '').trim();
};

// ── Admin: list all surveys ──────────────────────────────────────────────────
exports.getAllSurveys = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = status ? { status } : {};
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const [surveys, total] = await Promise.all([
    Survey.find(filter)
      .select('-responses')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Survey.countDocuments(filter)
  ]);

  // Attach response counts without loading all response data
  const ids = surveys.map((s) => s._id);
  const counts = await Survey.aggregate([
    { $match: { _id: { $in: ids } } },
    { $project: { count: { $size: '$responses' } } }
  ]);
  const countMap = {};
  counts.forEach((c) => { countMap[String(c._id)] = c.count; });
  const surveysWithCount = surveys.map((s) => ({
    ...s,
    responseCount: countMap[String(s._id)] || 0
  }));

  res.json({
    surveys: surveysWithCount,
    total,
    totalPages: Math.ceil(total / limitNum),
    page: parseInt(page, 10)
  });
});

// ── Admin: get one survey (with responses) ───────────────────────────────────
exports.getSurveyById = asyncHandler(async (req, res) => {
  const survey = await Survey.findById(req.params.id).lean();
  if (!survey) return res.status(404).json({ message: 'Survey not found' });
  res.json(survey);
});

// ── Admin: create survey ─────────────────────────────────────────────────────
exports.createSurvey = asyncHandler(async (req, res) => {
  const { title, description, questions = [] } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });

  const survey = await Survey.create({
    title,
    description,
    questions,
    status: 'Draft',
    createdBy: req.admin._id || req.admin.id,
    createdByName: req.admin.username || req.admin.name || 'Admin'
  });

  const adminId = req.admin?._id || req.admin?.id;
  if (adminId) {
    await logAdminActivity(
      adminId,
      'create_survey',
      `Created survey: ${survey.title}`,
      JSON.stringify({
        surveyId: survey._id,
        title: survey.title,
        questionCount: Array.isArray(survey.questions) ? survey.questions.length : 0
      })
    );
  }

  res.status(201).json(survey);
});

// ── Admin: update survey (title / description / questions) ───────────────────
exports.updateSurvey = asyncHandler(async (req, res) => {
  const survey = await Survey.findById(req.params.id);
  if (!survey) return res.status(404).json({ message: 'Survey not found' });

  if (survey.status === 'Closed') {
    return res.status(400).json({ message: 'Cannot edit a closed survey' });
  }

  const { title, description, questions } = req.body;
  const previousTitle = survey.title;
  const changedFields = [];

  if (title !== undefined && title !== survey.title) changedFields.push('title');
  if (description !== undefined && description !== survey.description) changedFields.push('description');
  if (Array.isArray(questions)) {
    const prevQuestions = JSON.stringify(survey.questions || []);
    const nextQuestions = JSON.stringify(questions || []);
    if (prevQuestions !== nextQuestions) changedFields.push('questions');
  }

  if (title !== undefined) survey.title = title;
  if (description !== undefined) survey.description = description;
  if (Array.isArray(questions)) survey.questions = questions;

  await survey.save();

  const adminId = req.admin?._id || req.admin?.id;
  if (adminId) {
    await logAdminActivity(
      adminId,
      'edit_survey',
      `Edited survey: ${survey.title}`,
      JSON.stringify({
        surveyId: survey._id,
        previousTitle,
        title: survey.title,
        fields: changedFields,
        questionCount: Array.isArray(survey.questions) ? survey.questions.length : 0
      })
    );
  }

  res.json(survey);
});

// ── Admin: change status (Draft → Active → Closed) ───────────────────────────
exports.updateSurveyStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validTransitions = { Draft: ['Active'], Active: ['Closed'], Closed: [] };

  const survey = await Survey.findById(req.params.id);
  if (!survey) return res.status(404).json({ message: 'Survey not found' });
  const previousStatus = survey.status;

  if (!validTransitions[survey.status]?.includes(status)) {
    return res.status(400).json({
      message: `Cannot transition from ${survey.status} to ${status}`
    });
  }

  survey.status = status;
  if (status === 'Active') survey.publishedAt = new Date();
  if (status === 'Closed') survey.closedAt = new Date();
  await survey.save();

  const adminId = req.admin?._id || req.admin?.id;
  if (adminId) {
    await logAdminActivity(
      adminId,
      status === 'Active' ? 'publish_survey' : 'close_survey',
      `${status === 'Active' ? 'Published' : 'Closed'} survey: ${survey.title}`,
      JSON.stringify({
        surveyId: survey._id,
        title: survey.title,
        fromStatus: previousStatus,
        toStatus: status
      })
    );
  }

  res.json(survey);
});

// ── Admin: delete survey ─────────────────────────────────────────────────────
exports.deleteSurvey = asyncHandler(async (req, res) => {
  const survey = await Survey.findByIdAndDelete(req.params.id);
  if (!survey) return res.status(404).json({ message: 'Survey not found' });

  const adminId = req.admin?._id || req.admin?.id;
  if (adminId) {
    await logAdminActivity(
      adminId,
      'delete_survey',
      `Deleted survey: ${survey.title}`,
      JSON.stringify({
        surveyId: survey._id,
        title: survey.title,
        status: survey.status,
        responseCount: Array.isArray(survey.responses) ? survey.responses.length : 0
      })
    );
  }

  res.json({ message: 'Survey deleted' });
});

// ── Admin: get aggregated stats for one survey ───────────────────────────────
exports.getSurveyStats = asyncHandler(async (req, res) => {
  const survey = await Survey.findById(req.params.id).lean();
  if (!survey) return res.status(404).json({ message: 'Survey not found' });
  const range = req.query.range || '';
  const startDate = getRangeStartDate(range);
  const filteredResponses = startDate
    ? (survey.responses || []).filter((response) => response.submittedAt && new Date(response.submittedAt) >= startDate)
    : (survey.responses || []);

  const totalResponses = filteredResponses.length;
  const questionStats = survey.questions.map((q) => {
    const answers = filteredResponses
      .flatMap((r) => r.answers)
      .filter((a) => a.questionId === q.id)
      .map((a) => a.answer);

    if (q.type === 'rating') {
      const nums = answers.filter((a) => typeof a === 'number' || !isNaN(Number(a))).map(Number);
      const avg = nums.length ? (nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(2) : null;
      const dist = [1, 2, 3, 4, 5].map((v) => ({ value: v, count: nums.filter((n) => n === v).length }));
      return { questionId: q.id, text: q.text, type: q.type, totalAnswers: nums.length, average: avg ? parseFloat(avg) : null, distribution: dist };
    }

    if (q.type === 'multiple_choice' || q.type === 'yes_no') {
      const tally = {};
      answers.forEach((a) => {
        if (Array.isArray(a)) {
          a.forEach((item) => {
            const key = String(item || '').trim();
            if (!key) return;
            tally[key] = (tally[key] || 0) + 1;
          });
          return;
        }
        const key = String(a || '').trim();
        if (!key) return;
        tally[key] = (tally[key] || 0) + 1;
      });
      const breakdown = Object.entries(tally).map(([value, count]) => ({ value, count }));
      return {
        questionId: q.id,
        text: q.text,
        type: q.type,
        totalAnswers: answers.length,
        breakdown
      };
    }

    // text: just return count + sample
    return {
      questionId: q.id, text: q.text, type: q.type,
      totalAnswers: answers.length,
      sample: answers.slice(0, 5)
    };
  });

  const adminId = req.admin?._id || req.admin?.id;
  if (adminId) {
    await logAdminActivity(
      adminId,
      'view_survey_results',
      `Viewed survey results: ${survey.title}`,
      JSON.stringify({
        surveyId: survey._id,
        title: survey.title,
        totalResponses
      })
    );
  }

  res.json({ surveyId: survey._id, title: survey.title, totalResponses, questionStats });
});

// ── Admin: summary metrics for reports ────────────────────────────────────────
exports.getSurveyReportSummary = asyncHandler(async (req, res) => {
  const range = req.query.range || '30days';
  const startDate = getRangeStartDate(range);
  const surveys = await Survey.find({})
    .select('title description status questions publishedAt createdAt responses')
    .sort({ createdAt: -1 })
    .lean();

  const withCounts = surveys.map((survey) => {
    const responsesInRange = startDate
      ? (survey.responses || []).filter((response) => response.submittedAt && new Date(response.submittedAt) >= startDate)
      : (survey.responses || []);

    return {
      _id: survey._id,
      title: survey.title,
      description: survey.description || '',
      status: survey.status,
      questionsCount: Array.isArray(survey.questions) ? survey.questions.length : 0,
      publishedAt: survey.publishedAt || null,
      createdAt: survey.createdAt || null,
      responseCount: responsesInRange.length
    };
  });

  const activeSurveys = withCounts.filter((survey) => survey.status === 'Active').length;
  const surveysWithResponses = withCounts.filter((survey) => survey.responseCount > 0);
  const topSurveys = [...withCounts]
    .sort((a, b) => b.responseCount - a.responseCount || new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 3);

  const latestActiveSurvey = [...withCounts]
    .filter((survey) => survey.status === 'Active')
    .sort((a, b) => new Date(b.publishedAt || b.createdAt || 0) - new Date(a.publishedAt || a.createdAt || 0))[0];

  const latestSurveyWithResponses = [...surveysWithResponses]
    .sort((a, b) => new Date(b.publishedAt || b.createdAt || 0) - new Date(a.publishedAt || a.createdAt || 0))[0];

  res.json({
    range,
    totalSurveys: withCounts.length,
    activeSurveys,
    totalResponses: withCounts.reduce((sum, survey) => sum + survey.responseCount, 0),
    surveysWithResponses: surveysWithResponses.length,
    topSurveys,
    latestSnapshotSurveyId: String((latestActiveSurvey || latestSurveyWithResponses || withCounts[0] || {})._id || ''),
    latestSnapshotSurveyTitle: (latestActiveSurvey || latestSurveyWithResponses || withCounts[0] || {}).title || ''
  });
});

// ── Public: list active surveys ──────────────────────────────────────────────
exports.getActiveSurveys = asyncHandler(async (req, res) => {
  const userId = req.user?.id ? String(req.user.id) : null;
  const surveys = await Survey.find({ status: 'Active' })
    .select(userId ? '_id title description questions publishedAt responses.respondentId responses.answers responses.submittedAt' : '_id title description questions publishedAt')
    .sort({ publishedAt: -1 })
    .lean();

  const mapped = surveys.map((survey) => {
    if (!userId) {
      return survey;
    }

    const currentUserResponse = Array.isArray(survey.responses)
      ? survey.responses.find((response) => String(response.respondentId || '') === userId)
      : null;

    return {
      _id: survey._id,
      title: survey.title,
      description: survey.description,
      questions: survey.questions,
      publishedAt: survey.publishedAt,
      hasResponded: !!currentUserResponse,
      currentUserResponse: currentUserResponse
        ? {
            answers: currentUserResponse.answers || [],
            submittedAt: currentUserResponse.submittedAt || null
          }
        : null
    };
  });

  res.json(mapped);
});

// ── Public/User: submit a response ───────────────────────────────────────────
exports.submitSurveyResponse = asyncHandler(async (req, res) => {
  const survey = await Survey.findById(req.params.id);
  if (!survey) return res.status(404).json({ message: 'Survey not found' });
  if (survey.status !== 'Active') {
    return res.status(400).json({ message: 'This survey is not currently active' });
  }

  const { answers = [] } = req.body;
  const userId = req.user?.id || null;
  const userName = req.user?.username || 'Anonymous';

  const existingResponse = Array.isArray(survey.responses)
    ? survey.responses.find((response) => String(response.respondentId || '') === String(userId || ''))
    : null;
  if (existingResponse) {
    return res.status(409).json({ message: 'You have already responded to this survey. You can only view your submitted answers.' });
  }

  const questionMap = new Map((survey.questions || []).map((question) => [question.id, question]));
  const normalizedAnswers = [];

  for (const entry of Array.isArray(answers) ? answers : []) {
    const question = questionMap.get(entry?.questionId);
    if (!question) continue;
    const normalizedAnswer = normalizeSurveyAnswer(question, entry?.answer);
    normalizedAnswers.push({
      questionId: question.id,
      answer: normalizedAnswer
    });
  }

  // Basic required-field validation
  const missing = survey.questions
    .filter((q) => q.required)
    .filter((q) => {
      const answerEntry = normalizedAnswers.find((a) => a.questionId === q.id);
      if (!answerEntry) return true;
      if (answerEntry.answer === undefined || answerEntry.answer === null || answerEntry.answer === '') return true;
      if (Array.isArray(answerEntry.answer) && answerEntry.answer.length === 0) return true;
      return false;
    });
  if (missing.length) {
    return res.status(400).json({ message: `Please answer all required questions: ${missing.map((q) => q.text).join(', ')}` });
  }

  survey.responses.push({ respondentId: userId, respondentName: userName, answers: normalizedAnswers });
  await survey.save();

  // Global notification
  createAdminNotification({
    type: 'survey_submitted',
    title: 'New Survey Response',
    message: `${userName} submitted a response to survey: "${survey.title}"`,
    link: '/admin/dashboard?tab=users&sub=surveys',
    targetAdminId: null,
    meta: { refId: String(survey._id) }
  });

  res.status(201).json({ message: 'Response submitted successfully' });
});
