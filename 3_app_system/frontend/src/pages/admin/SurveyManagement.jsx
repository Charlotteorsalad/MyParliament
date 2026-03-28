import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { adminApi } from '../../api';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  Draft:  'bg-gray-100 text-gray-700',
  Active: 'bg-green-100 text-green-800',
  Closed: 'bg-red-100 text-red-800'
};

const QUESTION_TYPES = [
  { value: 'text',            label: 'Text Answer' },
  { value: 'rating',          label: 'Rating (1–5)' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'yes_no',          label: 'Yes / No' }
];

const emptyQuestion = () => ({
  id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  text: '',
  type: 'text',
  options: [],
  required: true
});

// ─── Question Builder ─────────────────────────────────────────────────────────
function QuestionBuilder({ questions, onChange, questionErrors = {}, optionErrors = {}, questionsError = '' }) {
  const addQuestion = () => onChange([...questions, emptyQuestion()]);
  const updateQuestion = (idx, field, value) =>
    onChange(questions.map((q, i) => (i === idx ? { ...q, [field]: value } : q)));
  const removeQuestion = (idx) => onChange(questions.filter((_, i) => i !== idx));
  const updateOption = (qIdx, oIdx, value) =>
    onChange(questions.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...(q.options || [])]; opts[oIdx] = value; return { ...q, options: opts };
    }));
  const addOption = (qIdx) =>
    onChange(questions.map((q, i) => (i === qIdx ? { ...q, options: [...(q.options || []), ''] } : q)));
  const removeOption = (qIdx, oIdx) =>
    onChange(questions.map((q, i) =>
      i === qIdx ? { ...q, options: q.options.filter((_, j) => j !== oIdx) } : q));

  return (
    <div className="space-y-4">
      {questions.map((q, idx) => (
        <div key={q.id} className={`border rounded-xl p-4 bg-gray-50 hover:border-green-300 transition-colors ${
          questionErrors[q.id] || optionErrors[q.id] ? 'border-red-300 bg-red-50/40' : 'border-gray-200'
        }`}>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 mt-2 w-7 h-7 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">
              {idx + 1}
            </span>
            <div className="flex-1 space-y-3">
              <input
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  questionErrors[q.id]
                    ? 'border-red-400 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-green-500'
                }`}
                placeholder="Question text"
                value={q.text}
                onChange={(e) => updateQuestion(idx, 'text', e.target.value)}
              />
              {questionErrors[q.id] && (
                <p className="text-sm text-red-600 -mt-1">{questionErrors[q.id]}</p>
              )}
              <div className="flex flex-wrap items-center gap-4">
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  value={q.type}
                  onChange={(e) => updateQuestion(idx, 'type', e.target.value)}
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) => updateQuestion(idx, 'required', e.target.checked)}
                    className="w-4 h-4 accent-green-600"
                  />
                  Required
                </label>
              </div>
              {q.type === 'multiple_choice' && (
                <div className="space-y-2 mt-2 pl-2 border-l-2 border-green-200">
                  {(q.options || []).map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <input
                        className={`flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ${
                          optionErrors[q.id]?.[oIdx]
                            ? 'border-red-400 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-green-500'
                        }`}
                        placeholder={`Option ${oIdx + 1}`}
                        value={opt}
                        onChange={(e) => updateOption(idx, oIdx, e.target.value)}
                      />
                      <button type="button" onClick={() => removeOption(idx, oIdx)}
                        className="text-red-400 hover:text-red-600 w-6 h-6 flex items-center justify-center rounded">×</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addOption(idx)}
                    className="text-xs text-green-600 hover:text-green-800 font-medium">+ Add option</button>
                  {optionErrors[q.id] && (
                    <p className="text-sm text-red-600">{optionErrors[q.id].message || 'Options cannot be empty.'}</p>
                  )}
                </div>
              )}
            </div>
            <button type="button" onClick={() => removeQuestion(idx)}
              className="flex-shrink-0 mt-1 text-red-400 hover:text-red-600 w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors text-lg">
              ×
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={addQuestion}
        className={`w-full py-3 border-2 border-dashed rounded-xl text-sm transition-colors font-medium ${
          questionsError
            ? 'border-red-400 text-red-600 hover:border-red-500'
            : 'border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-600'
        }`}>
        + Add Question
      </button>
      {questionsError && (
        <p className="text-sm text-red-600">{questionsError}</p>
      )}
    </div>
  );
}

// ─── Stats View Modal ─────────────────────────────────────────────────────────
function SurveyStatsModal({ surveyId, surveyTitle, onClose }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getSurveyStats(surveyId)
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [surveyId]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Survey Results</h2>
            <p className="text-sm text-gray-500 mt-0.5">{surveyTitle}</p>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-2xl">×</button>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !stats ? (
            <p className="text-center text-gray-500 py-8">Failed to load results.</p>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6 p-4 bg-green-50 rounded-xl">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalResponses}</p>
                  <p className="text-sm text-gray-600">Total responses</p>
                </div>
              </div>
              <div className="space-y-5">
                {stats.questionStats.map((qs, i) => (
                  <div key={qs.questionId} className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                    <p className="font-semibold text-gray-800 mb-3 text-sm">
                      Q{i + 1}. {qs.text}
                      <span className="ml-2 text-xs text-gray-400 font-normal">({qs.totalAnswers} answers)</span>
                    </p>
                    {qs.type === 'rating' && qs.average !== null && (
                      <div>
                        <div className="flex items-baseline gap-2 mb-3">
                          <span className="text-3xl font-bold text-green-600">{qs.average}</span>
                          <span className="text-sm text-gray-500">/ 5 average</span>
                        </div>
                        <div className="flex items-end gap-2">
                          {qs.distribution.map((d) => {
                            const h = qs.totalAnswers ? Math.round((d.count / qs.totalAnswers) * 64) : 0;
                            return (
                              <div key={d.value} className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-xs font-medium text-gray-600">{d.count}</span>
                                <div className="w-full bg-green-200 rounded-t-sm" style={{ height: `${Math.max(4, h)}px` }} />
                                <span className="text-xs text-gray-400">{d.value}★</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {(qs.type === 'multiple_choice' || qs.type === 'yes_no') && qs.breakdown && (
                      <div className="space-y-2">
                        {qs.breakdown.map((b) => {
                          const pct = qs.totalAnswers ? Math.round((b.count / qs.totalAnswers) * 100) : 0;
                          return (
                            <div key={b.value}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-700 font-medium">{b.value}</span>
                                <span className="text-gray-500">{b.count} ({pct}%)</span>
                              </div>
                              <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-2.5 bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {qs.type === 'text' && (
                      <div className="space-y-2">
                        {(qs.sample || []).map((s, si) => (
                          <p key={si} className="text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2">"{s}"</p>
                        ))}
                        {qs.totalAnswers > 5 && (
                          <p className="text-xs text-gray-400 pl-1">+ {qs.totalAnswers - 5} more responses</p>
                        )}
                        {qs.totalAnswers === 0 && <p className="text-sm text-gray-400 italic">No responses yet</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────
function SurveyFormModal({ survey, onClose, onSaved }) {
  const isEdit = !!survey?._id;
  const [form, setForm] = useState({
    title: survey?.title || '',
    description: survey?.description || '',
    questions: survey?.questions || []
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [shakeForm, setShakeForm] = useState(false);
  const [titleError, setTitleError] = useState('');
  const [questionsError, setQuestionsError] = useState('');
  const [questionErrors, setQuestionErrors] = useState({});
  const [optionErrors, setOptionErrors] = useState({});

  const triggerShake = () => {
    setShakeForm(true);
    window.setTimeout(() => setShakeForm(false), 450);
  };

  const validateForm = () => {
    const nextQuestionErrors = {};
    const nextOptionErrors = {};
    let hasError = false;

    const nextTitleError = form.title.trim() ? '' : 'Survey title is required.';
    if (nextTitleError) hasError = true;

    const nextQuestionsError = form.questions.length > 0 ? '' : 'Add at least one question.';
    if (nextQuestionsError) hasError = true;

    form.questions.forEach((q) => {
      if (!q.text.trim()) {
        nextQuestionErrors[q.id] = 'Question text is required.';
        hasError = true;
      }

      if (q.type === 'multiple_choice') {
        const optionIndexErrors = {};
        let hasOptionError = false;
        (q.options || []).forEach((opt, idx) => {
          if (!String(opt || '').trim()) {
            optionIndexErrors[idx] = true;
            hasOptionError = true;
            hasError = true;
          }
        });

        if ((q.options || []).length < 2) {
          hasOptionError = true;
          hasError = true;
        }

        if (hasOptionError) {
          nextOptionErrors[q.id] = {
            ...optionIndexErrors,
            message: (q.options || []).length < 2
              ? 'Multiple choice questions need at least 2 options.'
              : 'Options cannot be empty.'
          };
        }
      }
    });

    setTitleError(nextTitleError);
    setQuestionsError(nextQuestionsError);
    setQuestionErrors(nextQuestionErrors);
    setOptionErrors(nextOptionErrors);

    return !hasError;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      setError('Please fix the highlighted fields.');
      triggerShake();
      return;
    }
    setSaving(true); setError('');
    try {
      if (isEdit) { await adminApi.updateSurvey(survey._id, form); }
      else { await adminApi.createSurvey(form); }
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save survey');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <style>{`
        @keyframes surveyFormShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto"
        style={shakeForm ? { animation: 'surveyFormShake 0.45s ease-in-out' } : undefined}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Survey' : 'Create New Survey'}</h2>
          <button onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-2xl">×</button>
        </div>
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Survey Title <span className="text-red-500">*</span></label>
            <input
              className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ${
                titleError ? 'border-red-400 focus:ring-red-500' : 'border-gray-300 focus:ring-green-500'
              }`}
              value={form.title} onChange={(e) => {
                setForm({ ...form, title: e.target.value });
                if (titleError) setTitleError('');
                if (error) setError('');
              }}
              placeholder="e.g. Platform Satisfaction Survey Q2 2026"
            />
            {titleError && (
              <p className="mt-1.5 text-sm text-red-600">{titleError}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea rows={2}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Short description shown to respondents"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Questions</label>
            <QuestionBuilder
              questions={form.questions}
              onChange={(q) => {
                setForm({ ...form, questions: q });
                if (questionsError && q.length > 0) setQuestionsError('');
                if (questionErrors && Object.keys(questionErrors).length) setQuestionErrors({});
                if (optionErrors && Object.keys(optionErrors).length) setOptionErrors({});
                if (error) setError('');
              }}
              questionErrors={questionErrors}
              optionErrors={optionErrors}
              questionsError={questionsError}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2.5 text-sm font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2">
            {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Survey'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const SurveyManagement = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [surveys, setSurveys] = useState([]);
  const [stats, setStats] = useState({ total: 0, draft: 0, active: 0, closed: 0, totalResponses: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState(null);
  const [viewingStats, setViewingStats] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchSurveys = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const statusMap = { all: '', draft: 'Draft', active: 'Active', closed: 'Closed' };
      const res = await adminApi.getAllSurveys({ status: statusMap[activeTab] || '', limit: 100 });
      const list = res.data.surveys || [];
      setSurveys(list);

      // Compute stats from full list (fetch all for stat counts)
      if (activeTab === 'all') {
        const d = list.filter((s) => s.status === 'Draft').length;
        const a = list.filter((s) => s.status === 'Active').length;
        const c = list.filter((s) => s.status === 'Closed').length;
        const r = list.reduce((s, sv) => s + (sv.responseCount || 0), 0);
        setStats({ total: list.length, draft: d, active: a, closed: c, totalResponses: r });
      }
    } catch {
      setError('Failed to load surveys.');
    } finally { setLoading(false); }
  }, [activeTab]);

  useEffect(() => { fetchSurveys(); }, [fetchSurveys]);

  // Auto-clear success after 3 s
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 3000);
    return () => clearTimeout(t);
  }, [success]);

  const handleStatusChange = async (id, newStatus) => {
    try {
      await adminApi.updateSurveyStatus(id, newStatus);
      setSuccess(`Survey ${newStatus === 'Active' ? 'published' : 'closed'} successfully`);
      fetchSurveys();
    } catch (err) {
      setError(err?.response?.data?.message || 'Status update failed');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await adminApi.deleteSurvey(confirmDelete._id);
      setConfirmDelete(null);
      setSuccess('Survey deleted successfully');
      fetchSurveys();
    } catch { setError('Delete failed'); }
  };

  const TABS = [
    { id: 'all',    label: 'All Surveys',  count: stats.total,    color: 'gray' },
    { id: 'active', label: 'Active',        count: stats.active,   color: 'green' },
    { id: 'draft',  label: 'Draft',         count: stats.draft,    color: 'yellow' },
    { id: 'closed', label: 'Closed',        count: stats.closed,   color: 'red' }
  ];

  const statCards = [
    { label: 'Total Surveys',   value: stats.total,          icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', bg: 'bg-purple-100',  text: 'text-purple-600' },
    { label: 'Active',          value: stats.active,         icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',                                                                                         bg: 'bg-green-100',  text: 'text-green-600'  },
    { label: 'Draft',           value: stats.draft,          icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',              bg: 'bg-yellow-100', text: 'text-yellow-600' },
    { label: 'Closed',          value: stats.closed,         icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',                                                                bg: 'bg-red-100',    text: 'text-red-600'    },
    { label: 'Total Responses', value: stats.totalResponses, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', bg: 'bg-blue-100', text: 'text-blue-600' }
  ];

  return (
    <Fragment>
    <div className="min-h-screen min-w-0 max-w-full overflow-x-hidden bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto min-w-0">

        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Survey Management</h1>
              <p className="text-gray-600">Create and manage user surveys, track responses</p>
            </div>
            <button onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold text-sm shadow-sm transition-colors self-start sm:self-auto">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Survey
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6 sm:mb-8">
          {statCards.map((sc) => (
            <div key={sc.label}
              className="bg-white rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-gray-900">{sc.value}</div>
                  <div className="text-gray-600 text-sm font-medium mt-0.5">{sc.label}</div>
                </div>
                <div className={`w-12 h-12 ${sc.bg} rounded-lg flex items-center justify-center`}>
                  <svg className={`w-6 h-6 ${sc.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sc.icon} />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden min-w-0">
          {/* Tabs */}
          <div className="border-b border-gray-200 bg-gray-50">
            <nav className="flex gap-px overflow-x-auto">
              {TABS.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 min-w-fit px-6 py-4 text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    activeTab === tab.id
                      ? `bg-white text-${tab.color === 'gray' ? 'gray' : tab.color}-600 border-b-2 border-${tab.color}-500`
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}>
                  <div className="flex items-center justify-center gap-2">
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        activeTab === tab.id
                          ? `bg-${tab.color}-100 text-${tab.color}-700`
                          : 'bg-gray-200 text-gray-600'
                      }`}>{tab.count}</span>
                    )}
                  </div>
                </button>
              ))}
            </nav>
          </div>

          {/* Messages */}
          {error && (
            <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-600 text-sm font-medium">{error}</p>
            </div>
          )}
          {success && (
            <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-green-600 text-sm font-medium">{success}</p>
            </div>
          )}

          {/* Survey List */}
          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">Loading surveys...</p>
                </div>
              </div>
            ) : surveys.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-lg font-medium text-gray-500">No surveys found</p>
                <p className="text-sm mt-1">
                  {activeTab === 'all' ? 'Create your first survey to get started.' : `No ${activeTab} surveys at the moment.`}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {surveys.map((sv) => (
                  <div key={sv._id}
                    className="group bg-white border border-gray-200 rounded-xl px-5 pt-5 pb-4 hover:shadow-lg hover:border-gray-300 transition-all duration-300">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Title + badges */}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                            {sv.title}
                          </h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[sv.status] || 'bg-gray-100 text-gray-700'}`}>
                            {sv.status}
                          </span>
                        </div>
                        {sv.description && (
                          <p className="text-gray-500 text-sm leading-relaxed line-clamp-2 mb-3">{sv.description}</p>
                        )}
                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
                            </svg>
                            <span>{sv.questions?.length || 0} questions</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="font-medium text-gray-700">{sv.responseCount || 0} responses</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>{sv.createdByName}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>{new Date(sv.createdAt).toLocaleDateString()}</span>
                          </div>
                          {sv.status === 'Active' && sv.publishedAt && (
                            <span className="text-green-600 text-xs font-medium">
                              Published {new Date(sv.publishedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                        {sv.status !== 'Draft' && (
                          <button onClick={() => setViewingStats({ id: sv._id, title: sv.title })}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-50 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            Results
                          </button>
                        )}
                        {sv.status === 'Draft' && (
                          <>
                            <button onClick={() => setEditingSurvey(sv)}
                              className="px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                              Edit
                            </button>
                            <button onClick={() => handleStatusChange(sv._id, 'Active')}
                              className="px-3 py-2 text-xs font-semibold text-green-700 border border-green-300 rounded-xl hover:bg-green-50 transition-colors">
                              Publish
                            </button>
                          </>
                        )}
                        {sv.status === 'Active' && (
                          <button onClick={() => handleStatusChange(sv._id, 'Closed')}
                            className="px-3 py-2 text-xs font-semibold text-orange-700 border border-orange-300 rounded-xl hover:bg-orange-50 transition-colors">
                            Close Survey
                          </button>
                        )}
                        <button onClick={() => setConfirmDelete(sv)}
                          className="px-3 py-2 text-xs font-semibold text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Modals */}
    {showCreateModal && (
      <SurveyFormModal
        onClose={() => setShowCreateModal(false)}
        onSaved={() => { setShowCreateModal(false); setSuccess('Survey created successfully'); fetchSurveys(); }}
      />
    )}
    {editingSurvey && (
      <SurveyFormModal
        survey={editingSurvey}
        onClose={() => setEditingSurvey(null)}
        onSaved={() => { setEditingSurvey(null); setSuccess('Survey updated successfully'); fetchSurveys(); }}
      />
    )}
    {viewingStats && (
      <SurveyStatsModal
        surveyId={viewingStats.id}
        surveyTitle={viewingStats.title}
        onClose={() => setViewingStats(null)}
      />
    )}
    {confirmDelete && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
          <h3 className="font-bold text-gray-900 text-lg mb-2">Delete Survey</h3>
          <p className="text-sm text-gray-600 mb-5">
            Are you sure you want to delete <strong>"{confirmDelete.title}"</strong>? All responses will be lost.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfirmDelete(null)}
              className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-xl hover:bg-gray-50">Cancel</button>
            <button onClick={handleDelete}
              className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700">Delete</button>
          </div>
        </div>
      </div>
    )}
    </Fragment>
  );
};

export default SurveyManagement;
