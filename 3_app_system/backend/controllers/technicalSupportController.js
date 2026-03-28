const asyncHandler = require('../middleware/asyncHandler');
const Incident = require('../models/Incident');
const ChangeRequest = require('../models/ChangeRequest');
const MaintenanceTask = require('../models/MaintenanceTask');
const AdminUser = require('../models/AdminUser');
const { logAdminActivity } = require('../utils/adminActivityLogger');
const { createAdminNotification } = require('../utils/adminNotifyHelper');

// ==================== INCIDENT MANAGEMENT ====================

const RESOLVED_AUTO_CLOSE_MS = 24 * 60 * 60 * 1000;

const getAdminDisplayName = (admin) => admin?.username || admin?.name || 'Admin';

const getAssignedAdminId = (incident) => {
  if (!incident?.assignedTo) return null;
  return String(incident.assignedTo._id || incident.assignedTo);
};

const normalizeIncidentWorkNotes = (incident) => {
  if (!Array.isArray(incident?.workNotes)) return;

  incident.workNotes.forEach((note) => {
    if (!note.content && note.note) {
      note.content = note.note;
    }
  });
};

const normalizeRefId = (value) => {
  if (!value) return null;
  if (typeof value === 'object') {
    return String(value._id || value.id || '');
  }
  return String(value);
};

const normalizeDateLikeValue = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
};

const toComparableValue = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') {
    if (value._id) return String(value._id);
    return JSON.stringify(value);
  }
  return String(value);
};

const buildEditHistoryEntry = (editorId, editorName, changedFields) => {
  if (!changedFields.length) return null;

  return {
    editorId,
    editorName,
    fields: changedFields.map((field) => field.key),
    summary: `Updated ${changedFields.map((field) => field.label).join(', ')}.`,
    editedAt: new Date()
  };
};

// Preferred: build history from frontend-computed before/after diff
const buildEditHistoryFromChanges = (editorId, editorName, editChanges) => {
  if (!Array.isArray(editChanges) || !editChanges.length) return null;

  return {
    editorId,
    editorName,
    fields: editChanges.map((c) => c.field),
    summary: `Updated ${editChanges.map((c) => c.label).join(', ')}.`,
    changes: editChanges.map((c) => ({
      field: String(c.field || ''),
      label: String(c.label || ''),
      from: String(c.from ?? ''),
      to: String(c.to ?? '')
    })),
    editedAt: new Date()
  };
};

const getChangedFields = (document, updates, fieldConfigs) => {
  const changedFields = [];

  fieldConfigs.forEach(({ key, label, getCurrentValue, getNextValue, normalizeValue }) => {
    if (!Object.prototype.hasOwnProperty.call(updates, key)) {
      return;
    }

    const currentValue = typeof getCurrentValue === 'function'
      ? getCurrentValue(document)
      : document[key];
    const nextValue = typeof getNextValue === 'function'
      ? getNextValue(updates[key], updates)
      : updates[key];

    const normalizedCurrentValue = typeof normalizeValue === 'function'
      ? normalizeValue(currentValue)
      : currentValue;
    const normalizedNextValue = typeof normalizeValue === 'function'
      ? normalizeValue(nextValue)
      : nextValue;

    if (toComparableValue(normalizedCurrentValue) !== toComparableValue(normalizedNextValue)) {
      changedFields.push({ key, label });
    }
  });

  return changedFields;
};

const INCIDENT_EDITABLE_FIELD_CONFIGS = [
  { key: 'shortDescription', label: 'short description' },
  { key: 'description', label: 'description' },
  { key: 'priority', label: 'priority' },
  { key: 'urgency', label: 'urgency' },
  { key: 'impact', label: 'impact' },
  { key: 'category', label: 'category' },
  { key: 'subcategory', label: 'subcategory' },
  { key: 'caller', label: 'caller name' },
  { key: 'callerEmail', label: 'caller email' },
  { key: 'assignmentGroup', label: 'assignment group' },
  {
    key: 'assignedTo',
    label: 'assignee',
    getCurrentValue: (incident) => getAssignedAdminId(incident),
    getNextValue: (value) => (!value || value === 'unassigned' ? null : String(value)),
    normalizeValue: normalizeRefId
  }
];

const CHANGE_EDITABLE_FIELD_CONFIGS = [
  { key: 'shortDescription', label: 'short description' },
  { key: 'description', label: 'description' },
  { key: 'priority', label: 'priority' },
  { key: 'category', label: 'category' },
  { key: 'subcategory', label: 'subcategory' },
  { key: 'assignmentGroup', label: 'assignment group' },
  { key: 'scheduledStart', label: 'scheduled start', normalizeValue: normalizeDateLikeValue },
  { key: 'scheduledEnd', label: 'scheduled end', normalizeValue: normalizeDateLikeValue },
  { key: 'estimatedDuration', label: 'estimated duration' },
  { key: 'businessJustification', label: 'business justification' },
  { key: 'riskAssessment', label: 'risk assessment' },
  { key: 'implementationPlan', label: 'implementation plan' },
  { key: 'rollbackPlan', label: 'rollback plan' },
  { key: 'businessService', label: 'business service' },
  { key: 'configurationItems', label: 'configuration items' },
  { key: 'dependencies', label: 'dependencies' },
  { key: 'testingNotes', label: 'testing notes' },
  { key: 'implementationNotes', label: 'implementation notes' },
  { key: 'completionNotes', label: 'completion notes' },
  {
    key: 'assignedTo',
    label: 'assignee',
    getCurrentValue: (changeRequest) => normalizeRefId(changeRequest.assignedTo),
    getNextValue: (value) => (!value || value === 'unassigned' ? null : String(value)),
    normalizeValue: normalizeRefId
  }
];

const MAINTENANCE_EDITABLE_FIELD_CONFIGS = [
  { key: 'title', label: 'title' },
  { key: 'description', label: 'description' },
  { key: 'type', label: 'type' },
  { key: 'priority', label: 'priority' },
  { key: 'category', label: 'category' },
  { key: 'assignmentGroup', label: 'assignment group' },
  { key: 'scheduledDate', label: 'scheduled date', normalizeValue: normalizeDateLikeValue },
  { key: 'scheduledStartTime', label: 'scheduled start time' },
  { key: 'scheduledEndTime', label: 'scheduled end time' },
  { key: 'estimatedDuration', label: 'estimated duration' },
  { key: 'isRecurring', label: 'recurring setting' },
  { key: 'recurrencePattern', label: 'recurrence pattern' },
  { key: 'recurrenceInterval', label: 'recurrence interval' },
  { key: 'businessService', label: 'business service' },
  { key: 'configurationItems', label: 'configuration items' },
  { key: 'dependencies', label: 'dependencies' },
  { key: 'prerequisites', label: 'prerequisites' },
  { key: 'rollbackPlan', label: 'rollback plan' },
  { key: 'impactLevel', label: 'impact level' },
  { key: 'riskLevel', label: 'risk level' },
  { key: 'affectedSystems', label: 'affected systems' },
  { key: 'communicationPlan', label: 'communication plan' },
  { key: 'stakeholders', label: 'stakeholders' },
  { key: 'tags', label: 'tags' },
  {
    key: 'assignedTo',
    label: 'assignee',
    getCurrentValue: (maintenanceTask) => normalizeRefId(maintenanceTask.assignedTo),
    getNextValue: (value) => (!value || value === 'unassigned' ? null : String(value)),
    normalizeValue: normalizeRefId
  }
];

const autoCloseResolvedIncidents = async () => {
  const closeBefore = new Date(Date.now() - RESOLVED_AUTO_CLOSE_MS);
  await Incident.updateMany(
    {
      state: 'Resolved',
      resolvedAt: { $lte: closeBefore },
      $or: [
        { closedAt: null },
        { closedAt: { $exists: false } }
      ]
    },
    {
      $set: {
        state: 'Closed',
        closedAt: new Date()
      }
    }
  );
};

// Get all incidents with filtering and pagination
const getAllIncidents = asyncHandler(async (req, res) => {
  await autoCloseResolvedIncidents();

  const {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    searchTerm = '',
    filterState = 'all',
    filterPriority = 'all',
    filterAssignee = 'all',
    filterCategory = 'all'
  } = req.query;

  // Build query
  let query = {};

  // Search filter
  if (searchTerm) {
    query.$or = [
      { shortDescription: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } },
      { number: { $regex: searchTerm, $options: 'i' } },
      { caller: { $regex: searchTerm, $options: 'i' } }
    ];
  }

  // State filter
  if (filterState && filterState !== 'all') {
    query.state = filterState;
  }

  // Priority filter
  if (filterPriority && filterPriority !== 'all') {
    query.priority = filterPriority;
  }

  // Assignee filter
  if (filterAssignee && filterAssignee !== 'all') {
    if (filterAssignee === 'unassigned') {
      query.assignedTo = null;
    } else {
      query.assignedTo = filterAssignee;
    }
  }

  // Category filter
  if (filterCategory && filterCategory !== 'all') {
    query.category = filterCategory;
  }

  // Sort options
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Execute query with pagination
  const incidents = await Incident.find(query)
    .populate('assignedTo', 'username name email role')
    .populate('openedBy', 'name email role')
    .sort(sortOptions)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

  const total = await Incident.countDocuments(query);

  res.json({
    incidents,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit)
    }
  });
});

// Get incident by ID
const getIncidentById = asyncHandler(async (req, res) => {
  await autoCloseResolvedIncidents();

  const incident = await Incident.findById(req.params.id)
    .populate('assignedTo', 'username name email role')
    .populate('openedBy', 'name email role');

  if (!incident) {
    return res.status(404).json({ message: 'Incident not found' });
  }

  res.json(incident);
});

// Create new incident
const createIncident = asyncHandler(async (req, res) => {
  const {
    shortDescription,
    description,
    priority,
    urgency,
    impact,
    category,
    subcategory,
    caller,
    callerEmail,
    assignedTo,
    assignmentGroup,
    businessService,
    configurationItem
  } = req.body;

  let assignedAdmin = null;
  if (assignedTo) {
    assignedAdmin = await AdminUser.findById(assignedTo);
  }

  const inferredAssignmentGroup = assignmentGroup || (() => {
    switch (category) {
      case 'Software':
      case 'Application':
        return 'Application Development';
      case 'Database':
      case 'Infrastructure':
      case 'Performance':
        return 'Infrastructure';
      case 'Security':
        return 'Security';
      case 'Network':
        return 'Network';
      case 'Hardware':
      case 'User Access':
      case 'System':
        return 'IT Support';
      case 'Process':
      case 'Configuration':
      default:
        return 'Other';
    }
  })();

  const incident = new Incident({
    shortDescription,
    description,
    priority: priority || '3 - Medium',
    urgency: urgency || '3 - Medium',
    impact: impact || '3 - Medium',
    category,
    subcategory,
    caller,
    callerEmail,
    assignedTo: assignedAdmin ? assignedAdmin._id : null,
    assignedToName: assignedAdmin ? (assignedAdmin.username || assignedAdmin.name || 'Unassigned') : 'Unassigned',
    assignmentGroup: inferredAssignmentGroup,
    businessService: businessService || category || 'General Support',
    configurationItem: configurationItem || subcategory || shortDescription,
    openedBy: req.admin.id,
    openedByName: req.admin.username || req.admin.name || 'Admin'
  });

  const savedIncident = await incident.save();
  await savedIncident.populate('assignedTo', 'username name email role');
  await savedIncident.populate('openedBy', 'name email role');

  const adminId = req.admin && (req.admin._id || req.admin.id);
  if (adminId) {
    await logAdminActivity(
      adminId,
      'create_incident',
      `Created incident: ${savedIncident.shortDescription}`,
      JSON.stringify({ incidentId: savedIncident._id, priority: savedIncident.priority })
    );
  }

  // Notify the assigned admin (if different from creator)
  if (assignedAdmin && String(assignedAdmin._id) !== String(adminId)) {
    createAdminNotification({
      type: 'incident_assigned',
      title: 'Incident Assigned to You',
      message: `${req.admin.username || 'Admin'} assigned incident ${savedIncident.number} to you: "${savedIncident.shortDescription}"`,
      link: '/admin/dashboard?tab=technical-support',
      targetAdminId: assignedAdmin._id,
      meta: { refId: String(savedIncident._id), refNumber: String(savedIncident.number) }
    });
  }

  res.status(201).json(savedIncident);
});

// Update incident
const updateIncident = asyncHandler(async (req, res) => {
  const incident = await Incident.findById(req.params.id);

  if (!incident) {
    return res.status(404).json({ message: 'Incident not found' });
  }

  const {
    shortDescription,
    description,
    state,
    priority,
    urgency,
    impact,
    category,
    subcategory,
    caller,
    callerEmail,
    assignedTo,
    assignmentGroup,
    resolutionNotes,
    comment
  } = req.body;

  const adminId = req.admin && (req.admin._id || req.admin.id);
  const adminName = getAdminDisplayName(req.admin);
  const previousState = incident.state;
  const previousAssignedToId = getAssignedAdminId(incident);
  const previousAssignedToName = incident.assignedToName || 'Unassigned';
  const hasAssignedToUpdate = Object.prototype.hasOwnProperty.call(req.body, 'assignedTo');
  const hasResolutionNotesUpdate = Object.prototype.hasOwnProperty.call(req.body, 'resolutionNotes');
  const trimmedComment = typeof comment === 'string' ? comment.trim() : '';
  const isStartWorkAction = state === 'In Progress' && previousState !== 'In Progress';
  const isResolveAction = state === 'Resolved' && previousState !== 'Resolved';
  const isOpenedByCurrentAdmin = String(incident.openedBy) === String(adminId);
  const incidentEditFields = getChangedFields(incident, req.body, INCIDENT_EDITABLE_FIELD_CONFIGS);
  const isEditRequest = incidentEditFields.length > 0;

  normalizeIncidentWorkNotes(incident);

  if (isEditRequest && previousState !== 'New') {
    return res.status(403).json({ message: 'Incidents can only be edited before they move to In Progress.' });
  }

  if (isEditRequest && !isOpenedByCurrentAdmin) {
    return res.status(403).json({ message: 'Only the admin who created this incident can edit it.' });
  }

  if ((isStartWorkAction || isResolveAction || hasAssignedToUpdate) && previousAssignedToId !== String(adminId)) {
    if (!(isEditRequest && isOpenedByCurrentAdmin && previousState === 'New')) {
      return res.status(403).json({ message: 'Only the assigned admin can perform this action.' });
    }
  }

  if (hasAssignedToUpdate && !isEditRequest && assignedTo !== previousAssignedToId && !trimmedComment) {
    return res.status(400).json({ message: 'A comment is required when reassigning an incident.' });
  }

  if (isResolveAction && !trimmedComment) {
    return res.status(400).json({ message: 'A comment is required when resolving an incident.' });
  }

  // Update fields
  if (shortDescription) incident.shortDescription = shortDescription;
  if (description) incident.description = description;
  if (state) incident.state = state;
  if (priority) incident.priority = priority;
  if (urgency) incident.urgency = urgency;
  if (impact) incident.impact = impact;
  if (category) incident.category = category;
  if (subcategory) incident.subcategory = subcategory;
  if (caller) incident.caller = caller;
  if (callerEmail) incident.callerEmail = callerEmail;
  if (assignmentGroup) incident.assignmentGroup = assignmentGroup;
  if (hasResolutionNotesUpdate) incident.resolutionNotes = resolutionNotes;

  // Handle assignment
  let newAssignedToName = previousAssignedToName;
  if (hasAssignedToUpdate) {
    if (!assignedTo || assignedTo === 'unassigned') {
      incident.assignedTo = null;
      incident.assignedToName = 'Unassigned';
      newAssignedToName = 'Unassigned';
    } else {
      const assignee = await AdminUser.findById(assignedTo);
      if (assignee) {
        incident.assignedTo = assignedTo;
        incident.assignedToName = assignee.username || assignee.name || 'Unassigned';
        newAssignedToName = incident.assignedToName;
      }
    }
  }

  const assignmentChanged = hasAssignedToUpdate && String(assignedTo || '') !== String(previousAssignedToId || '');

  if (assignmentChanged && !isEditRequest) {
    incident.workNotes.push({
      author: adminName,
      authorId: adminId,
      content: `Reassigned incident from ${previousAssignedToName} to ${newAssignedToName}. ${trimmedComment}`.trim(),
      isPublic: false
    });
  }

  if (isStartWorkAction) {
    incident.workNotes.push({
      author: adminName,
      authorId: adminId,
      content: trimmedComment || 'Started work on this incident.',
      isPublic: false
    });
  }

  // Handle state changes
  if (isResolveAction) {
    incident.resolvedAt = new Date();
    incident.closedAt = null;
    incident.resolutionNotes = trimmedComment;
    incident.workNotes.push({
      author: adminName,
      authorId: adminId,
      content: `Resolved incident. ${trimmedComment}`.trim(),
      isPublic: false
    });
  }
  if (state === 'Closed' && !incident.closedAt) {
    incident.closedAt = new Date();
  }

  const frontendEditChanges = Array.isArray(req.body.editChanges) ? req.body.editChanges : [];
  const incidentEditHistoryEntry = frontendEditChanges.length > 0
    ? buildEditHistoryFromChanges(adminId, adminName, frontendEditChanges)
    : buildEditHistoryEntry(adminId, adminName, incidentEditFields);
  if (incidentEditHistoryEntry) {
    incident.editHistory.push(incidentEditHistoryEntry);
  }

  const updatedIncident = await incident.save();
  await updatedIncident.populate('assignedTo', 'username name email role');
  await updatedIncident.populate('openedBy', 'name email role');

  if (adminId) {
    if (assignmentChanged) {
      await logAdminActivity(
        adminId,
        'reassign_incident',
        `Reassigned incident ${updatedIncident.number} to ${newAssignedToName}`,
        JSON.stringify({ incidentId: updatedIncident._id, from: previousAssignedToName, to: newAssignedToName, comment: trimmedComment })
      );
    }

    if (isStartWorkAction) {
      await logAdminActivity(
        adminId,
        'start_incident_work',
        `Started work on incident ${updatedIncident.number}`,
        JSON.stringify({ incidentId: updatedIncident._id, comment: trimmedComment })
      );
    }

    if (isResolveAction) {
      await logAdminActivity(
        adminId,
        'resolve_incident',
        `Resolved incident ${updatedIncident.number}`,
        JSON.stringify({ incidentId: updatedIncident._id, comment: trimmedComment })
      );
    }

    if (incidentEditHistoryEntry) {
      await logAdminActivity(
        adminId,
        'edit_incident',
        `Edited incident ${updatedIncident.number}`,
        JSON.stringify({ incidentId: updatedIncident._id, fields: incidentEditHistoryEntry.fields })
      );
    }
  }

  // Notify newly assigned admin (if different from the editor)
  if (assignmentChanged && assignedTo && assignedTo !== 'unassigned' && String(assignedTo) !== String(adminId)) {
    createAdminNotification({
      type: 'incident_assigned',
      title: 'Incident Assigned to You',
      message: `${adminName} assigned incident ${updatedIncident.number} to you: "${updatedIncident.shortDescription}"`,
      link: '/admin/dashboard?tab=technical-support',
      targetAdminId: assignedTo,
      meta: { refId: String(updatedIncident._id), refNumber: String(updatedIncident.number) }
    });
  }

  // Notify assigned admin about edits (before In Progress)
  const assignedToId = updatedIncident.assignedTo?._id || updatedIncident.assignedTo;
  if (
    incidentEditHistoryEntry &&
    assignedToId &&
    String(assignedToId) !== String(adminId) &&
    !['In Progress', 'Resolved', 'Closed'].includes(updatedIncident.state)
  ) {
    createAdminNotification({
      type: 'incident_edited',
      title: 'Incident Updated',
      message: `${adminName} edited incident ${updatedIncident.number}: ${incidentEditHistoryEntry.summary || 'fields updated'}`,
      link: '/admin/dashboard?tab=technical-support',
      targetAdminId: assignedToId,
      meta: { refId: String(updatedIncident._id), refNumber: String(updatedIncident.number) }
    });
  }

  res.json(updatedIncident);
});

// Add work note to incident
const addWorkNote = asyncHandler(async (req, res) => {
  const { content, isPublic = true } = req.body;

  const incident = await Incident.findById(req.params.id);

  if (!incident) {
    return res.status(404).json({ message: 'Incident not found' });
  }

  normalizeIncidentWorkNotes(incident);

  const workNote = {
    author: req.admin.username || req.admin.name || 'Admin',
    authorId: req.admin.id,
    content,
    isPublic
  };

  incident.workNotes.push(workNote);
  const updatedIncident = await incident.save();

  res.json(updatedIncident);
});

// Get incident statistics
const getIncidentStats = asyncHandler(async (req, res) => {
  await autoCloseResolvedIncidents();

  const { range } = req.query;
  const dateFilter = range && range !== 'all'
    ? { createdAt: { $gte: new Date(Date.now() - ({ '7d': 7, '30d': 30, '1y': 365 }[range] || 30) * 24 * 60 * 60 * 1000) } }
    : {};

  const stats = await Incident.aggregate([
    { $match: dateFilter },
    { $group: { _id: '$state', count: { $sum: 1 } } }
  ]);

  const priorityStats = await Incident.aggregate([
    { $match: dateFilter },
    { $group: { _id: '$priority', count: { $sum: 1 } } }
  ]);

  const escalatedCount = await Incident.countDocuments({ isEscalated: true, ...dateFilter });

  res.json({
    stateStats: stats,
    priorityStats,
    escalatedCount,
    totalIncidents: await Incident.countDocuments(dateFilter)
  });
});

// ==================== CHANGE REQUEST MANAGEMENT ====================

// Get all change requests with filtering and pagination
const getAllChangeRequests = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    searchTerm = '',
    filterState = 'all',
    filterPriority = 'all',
    filterAssignee = 'all',
    filterCategory = 'all'
  } = req.query;

  // Build query
  let query = {};

  // Search filter
  if (searchTerm) {
    query.$or = [
      { shortDescription: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } },
      { number: { $regex: searchTerm, $options: 'i' } }
    ];
  }

  // State filter
  if (filterState && filterState !== 'all') {
    query.state = filterState;
  }

  // Priority filter
  if (filterPriority && filterPriority !== 'all') {
    query.priority = filterPriority;
  }

  // Assignee filter
  if (filterAssignee && filterAssignee !== 'all') {
    if (filterAssignee === 'unassigned') {
      query.assignedTo = null;
    } else {
      query.assignedTo = filterAssignee;
    }
  }

  // Category filter
  if (filterCategory && filterCategory !== 'all') {
    query.category = filterCategory;
  }

  // Sort options
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Execute query with pagination
  const changeRequests = await ChangeRequest.find(query)
    .populate('assignedTo', 'username name email role')
    .populate('requestedBy', 'username name email role')
    .populate('approvedBy', 'username name email role')
    .sort(sortOptions)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

  const total = await ChangeRequest.countDocuments(query);

  res.json({
    changeRequests,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit)
    }
  });
});

// Get change request by ID
const getChangeRequestById = asyncHandler(async (req, res) => {
  const changeRequest = await ChangeRequest.findById(req.params.id)
    .populate('assignedTo', 'username name email role')
    .populate('requestedBy', 'username name email role')
    .populate('approvedBy', 'username name email role');

  if (!changeRequest) {
    return res.status(404).json({ message: 'Change request not found' });
  }

  res.json(changeRequest);
});

// Create new change request
const createChangeRequest = asyncHandler(async (req, res) => {
  const {
    shortDescription,
    description,
    priority,
    category,
    subcategory,
    assignmentGroup,
    scheduledStart,
    scheduledEnd,
    estimatedDuration,
    businessJustification,
    riskAssessment,
    implementationPlan,
    rollbackPlan,
    businessService,
    configurationItems,
    dependencies
  } = req.body;

  const changeRequest = new ChangeRequest({
    shortDescription,
    description,
    priority: priority || '3 - Medium',
    category,
    subcategory,
    assignmentGroup,
    scheduledStart: new Date(scheduledStart),
    scheduledEnd: new Date(scheduledEnd),
    estimatedDuration,
    businessJustification,
    riskAssessment,
    implementationPlan,
    rollbackPlan,
    businessService,
    configurationItems: configurationItems || [],
    dependencies: dependencies || [],
    requestedBy: req.admin.id,
    requestedByName: req.admin.username || req.admin.name || 'Admin'
  });

  const savedChangeRequest = await changeRequest.save();
  await savedChangeRequest.populate('requestedBy', 'username name email role');

  const adminId = req.admin && (req.admin._id || req.admin.id);
  if (adminId) {
    await logAdminActivity(
      adminId,
      'create_change_request',
      `Created change request: ${savedChangeRequest.shortDescription}`,
      JSON.stringify({ changeRequestId: savedChangeRequest._id })
    );
  }

  res.status(201).json(savedChangeRequest);
});

// Update change request
const updateChangeRequest = asyncHandler(async (req, res) => {
  const changeRequest = await ChangeRequest.findById(req.params.id);

  if (!changeRequest) {
    return res.status(404).json({ message: 'Change request not found' });
  }

  const {
    shortDescription,
    description,
    state,
    priority,
    category,
    subcategory,
    assignedTo,
    assignmentGroup,
    scheduledStart,
    scheduledEnd,
    actualStart,
    actualEnd,
    estimatedDuration,
    businessJustification,
    riskAssessment,
    implementationPlan,
    rollbackPlan,
    businessService,
    configurationItems,
    dependencies,
    testingNotes,
    implementationNotes,
    completionNotes
  } = req.body;

  const adminId = req.admin && (req.admin._id || req.admin.id);
  const adminName = getAdminDisplayName(req.admin);
  const isRequestedByCurrentAdmin = String(changeRequest.requestedBy) === String(adminId);
  const changeEditFields = getChangedFields(changeRequest, req.body, CHANGE_EDITABLE_FIELD_CONFIGS);
  const isChangeEditRequest = changeEditFields.length > 0;

  if (isChangeEditRequest && !['New', 'Scheduled'].includes(changeRequest.state)) {
    return res.status(403).json({ message: 'Change requests can only be edited before they move to In Progress.' });
  }

  if (isChangeEditRequest && !isRequestedByCurrentAdmin) {
    return res.status(403).json({ message: 'Only the admin who created this change request can edit it.' });
  }

  // Update fields
  if (shortDescription) changeRequest.shortDescription = shortDescription;
  if (description) changeRequest.description = description;
  if (state) changeRequest.state = state;
  if (priority) changeRequest.priority = priority;
  if (category) changeRequest.category = category;
  if (subcategory) changeRequest.subcategory = subcategory;
  if (assignmentGroup) changeRequest.assignmentGroup = assignmentGroup;
  if (scheduledStart) changeRequest.scheduledStart = new Date(scheduledStart);
  if (scheduledEnd) changeRequest.scheduledEnd = new Date(scheduledEnd);
  if (actualStart) changeRequest.actualStart = new Date(actualStart);
  if (actualEnd) changeRequest.actualEnd = new Date(actualEnd);
  if (Object.prototype.hasOwnProperty.call(req.body, 'estimatedDuration')) changeRequest.estimatedDuration = estimatedDuration;
  if (businessJustification) changeRequest.businessJustification = businessJustification;
  if (riskAssessment) changeRequest.riskAssessment = riskAssessment;
  if (implementationPlan) changeRequest.implementationPlan = implementationPlan;
  if (rollbackPlan) changeRequest.rollbackPlan = rollbackPlan;
  if (businessService) changeRequest.businessService = businessService;
  if (configurationItems) changeRequest.configurationItems = configurationItems;
  if (dependencies) changeRequest.dependencies = dependencies;
  if (testingNotes) changeRequest.testingNotes = testingNotes;
  if (implementationNotes) changeRequest.implementationNotes = implementationNotes;
  if (completionNotes) changeRequest.completionNotes = completionNotes;

  // Handle assignment
  if (assignedTo) {
    if (assignedTo === 'unassigned') {
      changeRequest.assignedTo = null;
      changeRequest.assignedToName = 'Unassigned';
    } else {
      const assignee = await AdminUser.findById(assignedTo);
      if (assignee) {
        changeRequest.assignedTo = assignedTo;
        changeRequest.assignedToName = assignee.username || assignee.name || 'Unassigned';
      }
    }
  }

  // Update actual duration if both start and end are provided
  if (actualStart && actualEnd) {
    changeRequest.updateActualDuration();
  }

  const frontendChangeEditChanges = Array.isArray(req.body.editChanges) ? req.body.editChanges : [];
  const changeEditHistoryEntry = frontendChangeEditChanges.length > 0
    ? buildEditHistoryFromChanges(adminId, adminName, frontendChangeEditChanges)
    : buildEditHistoryEntry(adminId, adminName, changeEditFields);
  if (changeEditHistoryEntry) {
    changeRequest.editHistory.push(changeEditHistoryEntry);
  }

  const updatedChangeRequest = await changeRequest.save();
  await updatedChangeRequest.populate('assignedTo', 'username name email role');
  await updatedChangeRequest.populate('requestedBy', 'username name email role');
  await updatedChangeRequest.populate('approvedBy', 'username name email role');

  if (adminId && changeEditHistoryEntry) {
    await logAdminActivity(
      adminId,
      'edit_change_request',
      `Edited change request ${updatedChangeRequest.number}`,
      JSON.stringify({ changeRequestId: updatedChangeRequest._id, fields: changeEditHistoryEntry.fields })
    );
  }

  // Notify newly assigned admin
  const prevCRAssignedId = changeRequest.assignedTo?._id || changeRequest.assignedTo;
  if (assignedTo && assignedTo !== 'unassigned' && String(assignedTo) !== String(prevCRAssignedId) && String(assignedTo) !== String(adminId)) {
    createAdminNotification({
      type: 'cr_assigned',
      title: 'Change Request Assigned to You',
      message: `${adminName} assigned change request ${updatedChangeRequest.number} to you: "${updatedChangeRequest.shortDescription}"`,
      link: '/admin/dashboard?tab=technical-support',
      targetAdminId: assignedTo,
      meta: { refId: String(updatedChangeRequest._id), refNumber: String(updatedChangeRequest.number) }
    });
  }

  // Notify assigned admin about edits (before In Progress)
  const crAssignedToId = updatedChangeRequest.assignedTo?._id || updatedChangeRequest.assignedTo;
  if (
    changeEditHistoryEntry &&
    crAssignedToId &&
    String(crAssignedToId) !== String(adminId) &&
    !['In Progress', 'Completed', 'Cancelled'].includes(updatedChangeRequest.state)
  ) {
    createAdminNotification({
      type: 'cr_edited',
      title: 'Change Request Updated',
      message: `${adminName} edited change request ${updatedChangeRequest.number}: ${changeEditHistoryEntry.summary || 'fields updated'}`,
      link: '/admin/dashboard?tab=technical-support',
      targetAdminId: crAssignedToId,
      meta: { refId: String(updatedChangeRequest._id), refNumber: String(updatedChangeRequest.number) }
    });
  }

  res.json(updatedChangeRequest);
});

// Approve/Reject change request
const updateChangeRequestApproval = asyncHandler(async (req, res) => {
  const { approvalStatus, rejectionReason } = req.body;

  const changeRequest = await ChangeRequest.findById(req.params.id);

  if (!changeRequest) {
    return res.status(404).json({ message: 'Change request not found' });
  }

  changeRequest.approvalStatus = approvalStatus;
  changeRequest.approvedBy = req.admin.id;
  changeRequest.approvedAt = new Date();

  if (approvalStatus === 'Rejected' && rejectionReason) {
    changeRequest.rejectionReason = rejectionReason;
  }

  const updatedChangeRequest = await changeRequest.save();
  await updatedChangeRequest.populate('approvedBy', 'name email role');

  res.json(updatedChangeRequest);
});

// Get change request statistics
const getChangeRequestStats = asyncHandler(async (req, res) => {
  const { range } = req.query;
  const dateFilter = range && range !== 'all'
    ? { createdAt: { $gte: new Date(Date.now() - ({ '7d': 7, '30d': 30, '1y': 365 }[range] || 30) * 24 * 60 * 60 * 1000) } }
    : {};

  const stats = await ChangeRequest.aggregate([
    { $match: dateFilter },
    { $group: { _id: '$state', count: { $sum: 1 } } }
  ]);

  const approvalStats = await ChangeRequest.aggregate([
    { $match: dateFilter },
    { $group: { _id: '$approvalStatus', count: { $sum: 1 } } }
  ]);

  res.json({
    stateStats: stats,
    approvalStats,
    totalChangeRequests: await ChangeRequest.countDocuments(dateFilter)
  });
});

// ==================== ADMIN USERS ====================

// Get all admin users for assignment
const getAdminUsers = asyncHandler(async (req, res) => {
  const adminUsers = await AdminUser.find({}, 'username email role')
    .sort({ username: 1 });

  res.json(adminUsers);
});

// ==================== MAINTENANCE SCHEDULER MANAGEMENT ====================

// Get all maintenance tasks with filtering and pagination
const getAllMaintenanceTasks = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sortBy = 'scheduledDate',
    sortOrder = 'asc',
    searchTerm = '',
    filterStatus = 'all',
    filterType = 'all',
    filterPriority = 'all',
    filterAssignee = 'all',
    filterCategory = 'all',
    filterDateFrom = '',
    filterDateTo = ''
  } = req.query;

  // Build query
  let query = {};

  // Search filter
  if (searchTerm) {
    query.$or = [
      { title: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } },
      { number: { $regex: searchTerm, $options: 'i' } }
    ];
  }

  // Status filter
  if (filterStatus && filterStatus !== 'all') {
    query.status = filterStatus;
  }

  // Type filter
  if (filterType && filterType !== 'all') {
    query.type = filterType;
  }

  // Priority filter
  if (filterPriority && filterPriority !== 'all') {
    query.priority = filterPriority;
  }

  // Assignee filter
  if (filterAssignee && filterAssignee !== 'all') {
    if (filterAssignee === 'unassigned') {
      query.assignedTo = null;
    } else {
      query.assignedTo = filterAssignee;
    }
  }

  // Category filter
  if (filterCategory && filterCategory !== 'all') {
    query.category = filterCategory;
  }

  // Date range filter
  if (filterDateFrom || filterDateTo) {
    query.scheduledDate = {};
    if (filterDateFrom) {
      query.scheduledDate.$gte = new Date(filterDateFrom);
    }
    if (filterDateTo) {
      query.scheduledDate.$lte = new Date(filterDateTo);
    }
  }

  // Sort options
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Execute query with pagination
  const maintenanceTasks = await MaintenanceTask.find(query)
    .populate('assignedTo', 'username name email role')
    .populate('createdBy', 'username name email role')
    .populate('approvedBy', 'username name email role')
    .sort(sortOptions)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

  const total = await MaintenanceTask.countDocuments(query);

  res.json({
    maintenanceTasks,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit)
    }
  });
});

// Get maintenance task by ID
const getMaintenanceTaskById = asyncHandler(async (req, res) => {
  const maintenanceTask = await MaintenanceTask.findById(req.params.id)
    .populate('assignedTo', 'username name email role')
    .populate('createdBy', 'username name email role')
    .populate('approvedBy', 'username name email role');

  if (!maintenanceTask) {
    return res.status(404).json({ message: 'Maintenance task not found' });
  }

  res.json(maintenanceTask);
});

// Create new maintenance task
const createMaintenanceTask = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    type,
    priority,
    category,
    assignedTo,
    assignmentGroup,
    scheduledDate,
    scheduledStartTime,
    scheduledEndTime,
    estimatedDuration,
    isRecurring,
    recurrencePattern,
    recurrenceInterval,
    businessService,
    configurationItems,
    dependencies,
    prerequisites,
    rollbackPlan,
    impactLevel,
    riskLevel,
    affectedSystems,
    communicationPlan,
    stakeholders,
    tags
  } = req.body;

  const maintenanceTask = new MaintenanceTask({
    title,
    description,
    type,
    priority: priority || '3 - Medium',
    category,
    assignmentGroup,
    scheduledDate: new Date(scheduledDate),
    scheduledStartTime,
    scheduledEndTime,
    estimatedDuration,
    isRecurring: isRecurring || false,
    recurrencePattern,
    recurrenceInterval: recurrenceInterval || 1,
    businessService,
    configurationItems: configurationItems || [],
    dependencies: dependencies || [],
    prerequisites,
    rollbackPlan,
    impactLevel: impactLevel || 'Medium',
    riskLevel: riskLevel || 'Medium',
    affectedSystems: affectedSystems || [],
    communicationPlan,
    stakeholders: stakeholders || [],
    tags: tags || [],
    createdBy: req.admin.id,
    createdByName: req.admin.username || req.admin.name || 'Admin',
    approvalStatus: 'Approved',
    approvedBy: req.admin.id,
    approvedByName: req.admin.username || req.admin.name || 'Admin',
    approvedAt: new Date()
  });

  // Handle assignment
  if (assignedTo) {
    if (assignedTo === 'unassigned') {
      maintenanceTask.assignedTo = null;
      maintenanceTask.assignedToName = 'Unassigned';
    } else {
      const assignee = await AdminUser.findById(assignedTo);
      if (assignee) {
        maintenanceTask.assignedTo = assignedTo;
        maintenanceTask.assignedToName = assignee.username || assignee.name || 'Unassigned';
      }
    }
  }

  // Calculate next scheduled date for recurring tasks
  if (maintenanceTask.isRecurring) {
    maintenanceTask.calculateNextScheduledDate();
  }

  const savedMaintenanceTask = await maintenanceTask.save();
  await savedMaintenanceTask.populate('assignedTo', 'username name email role');
  await savedMaintenanceTask.populate('createdBy', 'username name email role');

  const adminId = req.admin && (req.admin._id || req.admin.id);
  if (adminId) {
    await logAdminActivity(
      adminId,
      'schedule_maintenance',
      `Scheduled maintenance: ${savedMaintenanceTask.title}`,
      JSON.stringify({ taskId: savedMaintenanceTask._id, scheduledDate: savedMaintenanceTask.scheduledDate })
    );
  }

  // Notify the assigned admin (if different from creator)
  if (assignedTo && assignedTo !== 'unassigned' && String(assignedTo) !== String(adminId)) {
    createAdminNotification({
      type: 'maintenance_assigned',
      title: 'Maintenance Task Assigned to You',
      message: `${req.admin.username || 'Admin'} assigned maintenance task "${savedMaintenanceTask.title}" to you`,
      link: '/admin/dashboard?tab=technical-support',
      targetAdminId: assignedTo,
      meta: { refId: String(savedMaintenanceTask._id) }
    });
  }

  // Global notification to all admins: new maintenance scheduled
  createAdminNotification({
    type: 'maintenance_created',
    title: 'New Maintenance Task Scheduled',
    message: `${req.admin.username || 'Admin'} scheduled maintenance: "${savedMaintenanceTask.title}" on ${new Date(savedMaintenanceTask.scheduledDate).toLocaleDateString()}`,
    link: '/admin/dashboard?tab=technical-support',
    targetAdminId: null,
    meta: { refId: String(savedMaintenanceTask._id) }
  });

  res.status(201).json(savedMaintenanceTask);
});

// Update maintenance task
const updateMaintenanceTask = asyncHandler(async (req, res) => {
  const maintenanceTask = await MaintenanceTask.findById(req.params.id);

  if (!maintenanceTask) {
    return res.status(404).json({ message: 'Maintenance task not found' });
  }

  const {
    title,
    description,
    type,
    priority,
    status,
    category,
    assignedTo,
    assignmentGroup,
    scheduledDate,
    scheduledStartTime,
    scheduledEndTime,
    estimatedDuration,
    actualStartTime,
    actualEndTime,
    isRecurring,
    recurrencePattern,
    recurrenceInterval,
    testingNotes,
    implementationNotes,
    completionNotes,
    businessService,
    configurationItems,
    dependencies,
    prerequisites,
    rollbackPlan,
    impactLevel,
    riskLevel,
    affectedSystems,
    communicationPlan,
    stakeholders,
    tags
  } = req.body;

  const adminId = req.admin && (req.admin._id || req.admin.id);
  const adminName = getAdminDisplayName(req.admin);
  const isCreatedByCurrentAdmin = String(maintenanceTask.createdBy) === String(adminId);
  const maintenanceEditFields = getChangedFields(maintenanceTask, req.body, MAINTENANCE_EDITABLE_FIELD_CONFIGS);
  const isMaintenanceEditRequest = maintenanceEditFields.length > 0;

  if (isMaintenanceEditRequest && maintenanceTask.status !== 'Scheduled') {
    return res.status(403).json({ message: 'Maintenance tasks can only be edited before they move to In Progress.' });
  }

  if (isMaintenanceEditRequest && !isCreatedByCurrentAdmin) {
    return res.status(403).json({ message: 'Only the admin who created this maintenance task can edit it.' });
  }

  // Update fields
  if (title) maintenanceTask.title = title;
  if (description) maintenanceTask.description = description;
  if (type) maintenanceTask.type = type;
  if (priority) maintenanceTask.priority = priority;
  if (status) maintenanceTask.status = status;
  if (category) maintenanceTask.category = category;
  if (assignmentGroup) maintenanceTask.assignmentGroup = assignmentGroup;
  if (scheduledDate) maintenanceTask.scheduledDate = new Date(scheduledDate);
  if (scheduledStartTime) maintenanceTask.scheduledStartTime = scheduledStartTime;
  if (scheduledEndTime) maintenanceTask.scheduledEndTime = scheduledEndTime;
  if (estimatedDuration) maintenanceTask.estimatedDuration = estimatedDuration;
  if (actualStartTime) maintenanceTask.actualStartTime = new Date(actualStartTime);
  if (actualEndTime) maintenanceTask.actualEndTime = new Date(actualEndTime);
  if (isRecurring !== undefined) maintenanceTask.isRecurring = isRecurring;
  if (recurrencePattern) maintenanceTask.recurrencePattern = recurrencePattern;
  if (recurrenceInterval) maintenanceTask.recurrenceInterval = recurrenceInterval;
  if (testingNotes) maintenanceTask.testingNotes = testingNotes;
  if (implementationNotes) maintenanceTask.implementationNotes = implementationNotes;
  if (completionNotes) maintenanceTask.completionNotes = completionNotes;
  if (businessService) maintenanceTask.businessService = businessService;
  if (configurationItems) maintenanceTask.configurationItems = configurationItems;
  if (dependencies) maintenanceTask.dependencies = dependencies;
  if (prerequisites) maintenanceTask.prerequisites = prerequisites;
  if (rollbackPlan) maintenanceTask.rollbackPlan = rollbackPlan;
  if (impactLevel) maintenanceTask.impactLevel = impactLevel;
  if (riskLevel) maintenanceTask.riskLevel = riskLevel;
  if (affectedSystems) maintenanceTask.affectedSystems = affectedSystems;
  if (communicationPlan) maintenanceTask.communicationPlan = communicationPlan;
  if (stakeholders) maintenanceTask.stakeholders = stakeholders;
  if (tags) maintenanceTask.tags = tags;

  // Handle assignment
  if (assignedTo) {
    if (assignedTo === 'unassigned') {
      maintenanceTask.assignedTo = null;
      maintenanceTask.assignedToName = 'Unassigned';
    } else {
      const assignee = await AdminUser.findById(assignedTo);
      if (assignee) {
        maintenanceTask.assignedTo = assignedTo;
        maintenanceTask.assignedToName = assignee.username || assignee.name || 'Unassigned';
      }
    }
  }

  // Calculate actual duration if both start and end are provided
  if (actualStartTime && actualEndTime) {
    maintenanceTask.calculateActualDuration();
  }

  // Calculate next scheduled date for recurring tasks
  if (maintenanceTask.isRecurring) {
    maintenanceTask.calculateNextScheduledDate();
  }

  const frontendMaintenanceEditChanges = Array.isArray(req.body.editChanges) ? req.body.editChanges : [];
  const maintenanceEditHistoryEntry = frontendMaintenanceEditChanges.length > 0
    ? buildEditHistoryFromChanges(adminId, adminName, frontendMaintenanceEditChanges)
    : buildEditHistoryEntry(adminId, adminName, maintenanceEditFields);
  if (maintenanceEditHistoryEntry) {
    maintenanceTask.editHistory.push(maintenanceEditHistoryEntry);
  }

  const updatedMaintenanceTask = await maintenanceTask.save();
  await updatedMaintenanceTask.populate('assignedTo', 'username name email role');
  await updatedMaintenanceTask.populate('createdBy', 'username name email role');
  await updatedMaintenanceTask.populate('approvedBy', 'username name email role');

  if (adminId && maintenanceEditHistoryEntry) {
    await logAdminActivity(
      adminId,
      'edit_maintenance_task',
      `Edited maintenance task ${updatedMaintenanceTask.number}`,
      JSON.stringify({ maintenanceTaskId: updatedMaintenanceTask._id, fields: maintenanceEditHistoryEntry.fields })
    );
  }

  // Notify newly assigned admin
  const prevMTAssignedId = maintenanceTask.assignedTo?._id || maintenanceTask.assignedTo;
  if (assignedTo && assignedTo !== 'unassigned' && String(assignedTo) !== String(prevMTAssignedId) && String(assignedTo) !== String(adminId)) {
    createAdminNotification({
      type: 'maintenance_assigned',
      title: 'Maintenance Task Assigned to You',
      message: `${adminName} assigned maintenance task "${updatedMaintenanceTask.title}" to you`,
      link: '/admin/dashboard?tab=technical-support',
      targetAdminId: assignedTo,
      meta: { refId: String(updatedMaintenanceTask._id) }
    });
  }

  // Notify assigned admin about edits (before In Progress)
  const mtAssignedToId = updatedMaintenanceTask.assignedTo?._id || updatedMaintenanceTask.assignedTo;
  if (
    maintenanceEditHistoryEntry &&
    mtAssignedToId &&
    String(mtAssignedToId) !== String(adminId) &&
    !['In Progress', 'Completed', 'Cancelled'].includes(updatedMaintenanceTask.status)
  ) {
    createAdminNotification({
      type: 'maintenance_edited',
      title: 'Maintenance Task Updated',
      message: `${adminName} edited maintenance task "${updatedMaintenanceTask.title}": ${maintenanceEditHistoryEntry.summary || 'fields updated'}`,
      link: '/admin/dashboard?tab=technical-support',
      targetAdminId: mtAssignedToId,
      meta: { refId: String(updatedMaintenanceTask._id) }
    });
  }

  res.json(updatedMaintenanceTask);
});

// Approve/Reject maintenance task
const updateMaintenanceTaskApproval = asyncHandler(async (req, res) => {
  const { approvalStatus, rejectionReason } = req.body;

  const maintenanceTask = await MaintenanceTask.findById(req.params.id);

  if (!maintenanceTask) {
    return res.status(404).json({ message: 'Maintenance task not found' });
  }

  maintenanceTask.approvalStatus = approvalStatus;
  maintenanceTask.approvedBy = req.admin.id;
  maintenanceTask.approvedByName = req.admin.username || req.admin.name || 'Admin';
  maintenanceTask.approvedAt = new Date();

  if (approvalStatus === 'Rejected' && rejectionReason) {
    maintenanceTask.rejectionReason = rejectionReason;
  }

  const updatedMaintenanceTask = await maintenanceTask.save();
  await updatedMaintenanceTask.populate('approvedBy', 'name email role');

  res.json(updatedMaintenanceTask);
});

// Add work note to maintenance task
const addMaintenanceWorkNote = asyncHandler(async (req, res) => {
  const { content, isPublic = true } = req.body;

  const maintenanceTask = await MaintenanceTask.findById(req.params.id);

  if (!maintenanceTask) {
    return res.status(404).json({ message: 'Maintenance task not found' });
  }

  const workNote = {
    author: req.admin.username || req.admin.name || 'Admin',
    authorId: req.admin.id,
    content,
    isPublic
  };

  maintenanceTask.workNotes.push(workNote);
  const updatedMaintenanceTask = await maintenanceTask.save();

  res.json(updatedMaintenanceTask);
});

// Get maintenance task statistics
const getMaintenanceTaskStats = asyncHandler(async (req, res) => {
  const { range } = req.query;
  const dateFilter = range && range !== 'all'
    ? { scheduledDate: { $gte: new Date(Date.now() - ({ '7d': 7, '30d': 30, '1y': 365 }[range] || 30) * 24 * 60 * 60 * 1000) } }
    : {};

  const stats = await MaintenanceTask.aggregate([
    { $match: dateFilter },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const statusCounts = {
    'Scheduled': 0,
    'In Progress': 0,
    'Completed': 0,
    'Cancelled': 0,
    'Failed': 0
  };

  stats.forEach(stat => {
    statusCounts[stat._id] = stat.count;
  });

  res.json({
    statusCounts,
    totalMaintenanceTasks: await MaintenanceTask.countDocuments(dateFilter)
  });
});

// Get maintenance tasks for calendar view
const getMaintenanceTasksCalendar = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  let query = {};
  if (startDate && endDate) {
    query.scheduledDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const maintenanceTasks = await MaintenanceTask.find(query)
    .populate('assignedTo', 'username name email role')
    .select('title description type priority status category scheduledDate scheduledStartTime scheduledEndTime assignedToName')
    .sort({ scheduledDate: 1 });

  res.json(maintenanceTasks);
});

// ==================== PUBLIC: ACTIVE MAINTENANCE CHECK ====================
// Reads directly from MaintenanceTask – no separate notice model needed.
// Returns the currently-active (or upcoming in 12 hours) approved task so the
// frontend can show the appropriate banner or full-screen maintenance page.

const PRE_NOTICE_MS = 12 * 60 * 60 * 1000; // 12 hours before start → amber banner

/**
 * Combines a Date (date part only) with a "HH:MM" string into a proper Date.
 * Times are treated as Malaysia time (UTC+8) so comparisons against UTC now() are correct.
 */
const buildWindow = (scheduledDate, startStr, endStr) => {
  const dateOnly = new Date(scheduledDate).toISOString().slice(0, 10); // "YYYY-MM-DD"
  const startDt = new Date(`${dateOnly}T${startStr || '00:00'}:00+08:00`);
  let endDt     = new Date(`${dateOnly}T${endStr   || '23:59'}:00+08:00`);
  if (endDt <= startDt) endDt = new Date(endDt.getTime() + 24 * 60 * 60 * 1000);
  return { startDt, endDt };
};

const getActiveMaintenancePeriod = asyncHandler(async (req, res) => {
  const now = new Date();
  const lookAhead = new Date(now.getTime() + PRE_NOTICE_MS);

  // Fetch all non-cancelled, approved tasks whose scheduledDate could be relevant
  // (scheduledDate might be yesterday for overnight tasks, so look ±1 day)
  const dayAgo  = new Date(now); dayAgo.setDate(dayAgo.getDate() - 1);
  const dayFwd  = new Date(now); dayFwd.setDate(dayFwd.getDate() + 1);

  const candidates = await MaintenanceTask.find({
    status: { $in: ['Scheduled', 'In Progress'] },
    approvalStatus: 'Approved',
    scheduledDate: { $gte: dayAgo, $lte: dayFwd }
  }).select('title description scheduledDate scheduledStartTime scheduledEndTime status');

  let maintenance = null;
  let preNotice   = null;

  for (const task of candidates) {
    const { startDt, endDt } = buildWindow(
      task.scheduledDate,
      task.scheduledStartTime,
      task.scheduledEndTime
    );

    if (now >= startDt && now <= endDt) {
      // Within the maintenance window – full block
      maintenance = { task, startDt, endDt };
      break;
    }
    if (lookAhead >= startDt && now < startDt) {
      // Approaching within 12 hours – amber pre-notice
      if (!preNotice || startDt < preNotice.startDt) {
        preNotice = { task, startDt, endDt };
      }
    }
  }

  if (maintenance) {
    const { task, startDt, endDt } = maintenance;
    // Broadcast to all SSE clients so banners can update instantly
    try {
      const { broadcast } = require('../services/sseService');
      broadcast('maintenance_notice', {
        type: 'maintenance',
        title: `System Maintenance – ${task.title}`,
        message: task.description || 'The system is currently undergoing scheduled maintenance. Please check back later.',
        startTime: startDt,
        endTime: endDt,
      });
    } catch (e) {
      // non-fatal – SSE is best-effort
      console.warn('[maintenance_notice] broadcast failed:', e.message);
    }
    return res.json({
      active: {
        type: 'maintenance',
        title: `System Maintenance – ${task.title}`,
        message: task.description || 'The system is currently undergoing scheduled maintenance. Please check back later.',
        startTime: startDt,
        endTime: endDt
      }
    });
  }

  if (preNotice) {
    const { task, startDt, endDt } = preNotice;
    try {
      const { broadcast } = require('../services/sseService');
      broadcast('maintenance_notice', {
        type: 'pre-notice',
        title: `Upcoming Maintenance – ${task.title}`,
        message: task.description || 'Scheduled maintenance will begin shortly. The system may be briefly unavailable.',
        startTime: startDt,
        endTime: endDt,
      });
    } catch (e) {
      console.warn('[maintenance_notice] broadcast failed:', e.message);
    }
    return res.json({
      active: {
        type: 'pre-notice',
        title: `Upcoming Maintenance – ${task.title}`,
        message: task.description || 'Scheduled maintenance will begin shortly. The system may be briefly unavailable.',
        startTime: startDt,
        endTime: endDt
      }
    });
  }

  res.json({ active: null });
});

module.exports = {
  // Incident management
  getAllIncidents,
  getIncidentById,
  createIncident,
  updateIncident,
  addWorkNote,
  getIncidentStats,
  
  // Change request management
  getAllChangeRequests,
  getChangeRequestById,
  createChangeRequest,
  updateChangeRequest,
  updateChangeRequestApproval,
  getChangeRequestStats,
  
  // Maintenance scheduler management
  getAllMaintenanceTasks,
  getMaintenanceTaskById,
  createMaintenanceTask,
  updateMaintenanceTask,
  updateMaintenanceTaskApproval,
  addMaintenanceWorkNote,
  getMaintenanceTaskStats,
  getMaintenanceTasksCalendar,
  
  // Public: active maintenance period check
  getActiveMaintenancePeriod,

  // Admin users
  getAdminUsers
};
