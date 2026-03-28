const express = require('express');
const router = express.Router();
const survey = require('../controllers/surveyController');
const { protectAdmin, requirePermission } = require('../middleware/adminAuthMiddleware');
const auth = require('../middleware/authMiddleware');
const { optionalAuth } = require('../middleware/authMiddleware');

// ── Public / user routes (no admin auth needed) ──────────────────────────────
router.get('/active', optionalAuth, survey.getActiveSurveys);
router.post('/:id/respond', auth, survey.submitSurveyResponse);

// ── Admin-only routes ─────────────────────────────────────────────────────────
router.use(protectAdmin);
router.get('/', requirePermission('manage_users'), survey.getAllSurveys);
router.get('/summary', requirePermission('manage_users'), survey.getSurveyReportSummary);
router.post('/', requirePermission('manage_users'), survey.createSurvey);
router.get('/:id', requirePermission('manage_users'), survey.getSurveyById);
router.put('/:id', requirePermission('manage_users'), survey.updateSurvey);
router.patch('/:id/status', requirePermission('manage_users'), survey.updateSurveyStatus);
router.delete('/:id', requirePermission('manage_users'), survey.deleteSurvey);
router.get('/:id/stats', requirePermission('manage_users'), survey.getSurveyStats);

module.exports = router;
