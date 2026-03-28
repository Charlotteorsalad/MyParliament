/**
 * Quiz helpers: MCQ options must be string[] for the user app and scoring.
 * Normalizes legacy/alternate shapes (choices[], { text }, double-encoded JSON payloads).
 */

function coerceOptionText(entry) {
  if (entry == null) return '';
  if (typeof entry === 'string') return entry;
  if (typeof entry === 'number' && Number.isFinite(entry)) return String(entry);
  if (typeof entry === 'object') {
    if (entry.text != null) return String(entry.text);
    if (entry.label != null) return String(entry.label);
    if (entry.value != null && typeof entry.value === 'string') return entry.value;
  }
  return '';
}

function normalizeQuizQuestion(q) {
  if (!q || typeof q !== 'object') return q;
  let opts = q.options;
  if (!Array.isArray(opts) && Array.isArray(q.choices)) opts = q.choices;
  if (!Array.isArray(opts)) opts = [];
  const options = opts.map(coerceOptionText);
  return { ...q, options };
}

function normalizeEmbeddedQuiz(quiz) {
  if (!quiz || typeof quiz !== 'object') return quiz;
  const questions = Array.isArray(quiz.questions)
    ? quiz.questions.map(normalizeQuizQuestion)
    : [];
  return { ...quiz, questions };
}

/**
 * Admin create payload: quizQuestions may be a JSON string, or an array (some clients).
 * Handles double-encoded JSON string edge case.
 */
function parseQuizQuestionsPayload(raw) {
  if (raw == null || raw === '') return [];
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return [];
      }
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map(normalizeQuizQuestion);
}

module.exports = {
  coerceOptionText,
  normalizeQuizQuestion,
  normalizeEmbeddedQuiz,
  parseQuizQuestionsPayload
};
