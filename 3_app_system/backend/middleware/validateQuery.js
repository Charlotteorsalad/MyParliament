// Lightweight verification, whitelist filtering and default value setting (avoid illegal parameters)
const ALLOWED_SORT = new Set(['latest-term', 'az', 'cabinet', 'default']);
module.exports = (req, res, next) => {
  const q = req.query;

  // Number parameters
  q.limit = Math.min(Math.max(parseInt(q.limit || 24, 10), 1), 100);
  q.page  = Math.max(parseInt(q.page || 1, 10), 1);

  // Only allowed sorts
  q.sort = q.sort && ALLOWED_SORT.has(q.sort) ? q.sort : 'latest-term';

  // Allowed filter fields
  if (q.status && !['current', 'historical'].includes(q.status)) delete q.status;

  // Comma-separated field normalization
  if (q.party) q.party = q.party.split(',').map(s => s.trim()).filter(Boolean).join(',');
  if (q.state) q.state = q.state.split(',').map(s => s.trim()).filter(Boolean).join(',');
  if (q.term)  q.term  = q.term.split(',').map(s => s.trim()).filter(Boolean).join(',');

  next();
};
