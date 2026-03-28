import { api } from './index';
import adminApiInstance from './adminConfig';

const topicApi = {
  // Get all topics with optional filtering
  getAll: async (params = {}) => {
    const queryParams = new URLSearchParams();
    
    if (params.category && params.category !== 'All') {
      queryParams.append('category', params.category);
    }
    
    if (params.search) {
      queryParams.append('search', params.search);
    }
    
    if (params.featured !== undefined) {
      queryParams.append('featured', params.featured);
    }
    
    const queryString = queryParams.toString();
    const url = queryString ? `/topics?${queryString}` : '/topics';
    
    return api.get(url);
  },

  // Get topic by ID
  getById: async (id) => {
    return api.get(`/topics/${id}`);
  },

  // Get topic statistics
  getStats: async () => {
    return api.get('/topics/stats');
  },

  // Get categories
  getCategories: async () => {
    return api.get('/topics/categories');
  },

  // Toggle bookmark (requires authentication)
  toggleBookmark: async (id) => {
    return api.post(`/topics/${id}/bookmark`);
  },

  // Admin functions (require admin authentication)
  create: async (topicData) => {
    return api.post('/topics', topicData);
  },

  update: async (id, topicData) => {
    return api.put(`/topics/${id}`, topicData);
  },

  delete: async (id) => {
    return api.delete(`/topics/${id}`);
  },

  // ─── Issue Portal (precomputed cache) ──────────────────────────────────

  /**
   * List view – all issues for a pipeline, timeline excluded.
   * Supports filtering by parlimen, penggal, mesyuarat, category, quality.
   */
  getIssuePortalTopics: async (pipelineId = 'pipeline5', filters = {}) => {
    const queryParams = new URLSearchParams();
    if (filters.parlimen) queryParams.append('parlimen', filters.parlimen);
    if (filters.penggal) queryParams.append('penggal', filters.penggal);
    if (filters.mesyuarat) queryParams.append('mesyuarat', filters.mesyuarat);
    if (filters.category) queryParams.append('category', filters.category);
    if (filters.cluster_label) queryParams.append('cluster_label', filters.cluster_label);
    if (filters.quality) queryParams.append('quality', filters.quality);
    if (filters.includeLowQuality) queryParams.append('includeLowQuality', 'true');
    if (filters.session) queryParams.append('session', filters.session);
    const queryString = queryParams.toString();
    const url = queryString 
      ? `/issue-portal/topics/${pipelineId}?${queryString}`
      : `/issue-portal/topics/${pipelineId}`;
    return api.get(url);
  },

  /**
   * Get distinct filter values (parlimen, penggal, mesyuarat) for a pipeline.
   */
  getFilters: async (pipelineId = 'pipeline5') => {
    return api.get(`/issue-portal/filters/${pipelineId}`);
  },

  /**
   * Detail view – single issue by MongoDB ObjectId, timeline included.
   * This is the primary endpoint used by TopicDetailPage.
   */
  getIssueById: async (issueId) => {
    return api.get(`/issue-portal/issue/${issueId}`);
  },

  /**
   * Record a view for an issue (no auth). Backend increments Topic.viewCount for trending "By views".
   */
  recordIssueView: async (issueId) => {
    try {
      await api.post(`/issue-portal/issue/${issueId}/view`);
    } catch {
      // silent — never break UX
    }
  },

  /**
   * Precompute status – which pipelines have cached data.
   */
  getPrecomputeStatus: async () => {
    return api.get('/issue-portal/precompute/status');
  },

  /**
   * Detailed precompute report – for admin ML performance dashboard.
   * Uses adminApiInstance because this endpoint requires admin authentication.
   */
  getPrecomputeReport: async () => {
    return adminApiInstance.get('/issue-portal/precompute/report', { timeout: 30000 });
  },

  /**
   * Top issues for the trending chart (supports sort by statements, views, MPs, or trending score).
   * @param {string} pipelineId  – e.g. "pipeline5"
   * @param {number} [limit=12]
   * @param {string} [sort='trending']  – 'trending' | 'statements' | 'views' | 'mp_count'
   */
  getTopIssues: async (pipelineId = 'pipeline5', limit = 12, sort = 'trending') => {
    return adminApiInstance.get(
      `/issue-portal/top-issues/${pipelineId}?limit=${limit}&sort=${encodeURIComponent(sort)}`,
      { timeout: 30000 }
    );
  },

  /**
   * Get default pipeline for Issue Portal (user-facing).
   */
  getDefaultPipeline: async () => {
    return api.get('/issue-portal/default-pipeline');
  },

  /**
   * Get recent parliamentary statements and performance metrics for an MP.
   * Passes name(s) and parliament term directly to avoid unreliable MP DB lookup.
   * @param {string} name              – MP name (e.g. "Sim Chee Keong")
   * @param {string} [fullName]        – full_name_with_titles if different
   * @param {number} [limit=8]
   * @param {string} [parliamentTerm]  – e.g. "15", used to scope attendance calc
   */
  getStatementsByMp: async (name, fullName, limit = 8, parliamentTerm, axiosOptions = {}) => {
    const params = { name };
    if (fullName && fullName !== name) params.fullName = fullName;
    if (limit) params.limit = limit;
    if (parliamentTerm) params.parliamentTerm = parliamentTerm;
    return api.get('/issue-portal/mp/statements', { params, ...axiosOptions });
  },

  /**
   * Set default pipeline and options for Issue Portal (admin only).
   * @param {string} pipelineId
   * @param {boolean} [includeLowQuality] - include low-quality topics on Issue Portal
   */
  setDefaultPipeline: async (pipelineId, includeLowQuality) => {
    return adminApiInstance.post('/issue-portal/default-pipeline', {
      pipeline_id: pipelineId,
      include_low_quality: includeLowQuality === true,
    });
  },

  // ─── Legacy (pipeline + cluster_id) – kept for backward compat ──────────

  getIssueDetail: async (pipelineId, topicIdentifier, options = {}) => {
    const queryParams = new URLSearchParams();
    if (options.limit)    queryParams.append('limit',    options.limit);
    if (options.dateFrom) queryParams.append('dateFrom', options.dateFrom);
    if (options.dateTo)   queryParams.append('dateTo',   options.dateTo);
    if (options.mpName)   queryParams.append('mpName',   options.mpName);
    if (options.party)    queryParams.append('party',    options.party);
    const qs  = queryParams.toString();
    const url = qs
      ? `/issue-portal/${pipelineId}/${topicIdentifier}?${qs}`
      : `/issue-portal/${pipelineId}/${topicIdentifier}`;
    return api.get(url);
  },

  getIssueSummary: async (pipelineId, topicIdentifier) => {
    return api.get(`/issue-portal/${pipelineId}/${topicIdentifier}/summary`);
  }
};

export default topicApi;
