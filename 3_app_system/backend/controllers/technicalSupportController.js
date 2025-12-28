const asyncHandler = require('../middleware/asyncHandler');
const Incident = require('../models/Incident');
const ChangeRequest = require('../models/ChangeRequest');
const MaintenanceTask = require('../models/MaintenanceTask');
const AdminUser = require('../models/AdminUser');

// ==================== INCIDENT MANAGEMENT ====================

// Get all incidents with filtering and pagination
const getAllIncidents = asyncHandler(async (req, res) => {
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
    .populate('assignedTo', 'name email role')
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
  const incident = await Incident.findById(req.params.id)
    .populate('assignedTo', 'name email role')
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
    assignmentGroup,
    businessService,
    configurationItem
  } = req.body;

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
    assignmentGroup,
    businessService,
    businessService,
    configurationItem,
    openedBy: req.admin.id,
    openedByName: req.admin.name
  });

  const savedIncident = await incident.save();
  await savedIncident.populate('openedBy', 'name email role');

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
    assignedTo,
    assignmentGroup,
    resolutionNotes
  } = req.body;

  // Update fields
  if (shortDescription) incident.shortDescription = shortDescription;
  if (description) incident.description = description;
  if (state) incident.state = state;
  if (priority) incident.priority = priority;
  if (urgency) incident.urgency = urgency;
  if (impact) incident.impact = impact;
  if (category) incident.category = category;
  if (subcategory) incident.subcategory = subcategory;
  if (assignmentGroup) incident.assignmentGroup = assignmentGroup;
  if (resolutionNotes) incident.resolutionNotes = resolutionNotes;

  // Handle assignment
  if (assignedTo) {
    if (assignedTo === 'unassigned') {
      incident.assignedTo = null;
      incident.assignedToName = 'Unassigned';
    } else {
      const assignee = await AdminUser.findById(assignedTo);
      if (assignee) {
        incident.assignedTo = assignedTo;
        incident.assignedToName = assignee.name;
      }
    }
  }

  // Handle state changes
  if (state === 'Resolved' && !incident.resolvedAt) {
    incident.resolvedAt = new Date();
  }
  if (state === 'Closed' && !incident.closedAt) {
    incident.closedAt = new Date();
  }

  const updatedIncident = await incident.save();
  await updatedIncident.populate('assignedTo', 'name email role');
  await updatedIncident.populate('openedBy', 'name email role');

  res.json(updatedIncident);
});

// Add work note to incident
const addWorkNote = asyncHandler(async (req, res) => {
  const { content, isPublic = true } = req.body;

  const incident = await Incident.findById(req.params.id);

  if (!incident) {
    return res.status(404).json({ message: 'Incident not found' });
  }

  const workNote = {
    author: req.admin.name,
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
  const stats = await Incident.aggregate([
    {
      $group: {
        _id: '$state',
        count: { $sum: 1 }
      }
    }
  ]);

  const priorityStats = await Incident.aggregate([
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 }
      }
    }
  ]);

  const escalatedCount = await Incident.countDocuments({ isEscalated: true });

  res.json({
    stateStats: stats,
    priorityStats,
    escalatedCount,
    totalIncidents: await Incident.countDocuments()
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
    .populate('assignedTo', 'name email role')
    .populate('requestedBy', 'name email role')
    .populate('approvedBy', 'name email role')
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
    .populate('assignedTo', 'name email role')
    .populate('requestedBy', 'name email role')
    .populate('approvedBy', 'name email role');

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
    requestedByName: req.admin.name
  });

  const savedChangeRequest = await changeRequest.save();
  await savedChangeRequest.populate('requestedBy', 'name email role');

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
    testingNotes,
    implementationNotes,
    completionNotes
  } = req.body;

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
        changeRequest.assignedToName = assignee.name;
      }
    }
  }

  // Update actual duration if both start and end are provided
  if (actualStart && actualEnd) {
    changeRequest.updateActualDuration();
  }

  const updatedChangeRequest = await changeRequest.save();
  await updatedChangeRequest.populate('assignedTo', 'name email role');
  await updatedChangeRequest.populate('requestedBy', 'name email role');
  await updatedChangeRequest.populate('approvedBy', 'name email role');

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
  const stats = await ChangeRequest.aggregate([
    {
      $group: {
        _id: '$state',
        count: { $sum: 1 }
      }
    }
  ]);

  const approvalStats = await ChangeRequest.aggregate([
    {
      $group: {
        _id: '$approvalStatus',
        count: { $sum: 1 }
      }
    }
  ]);

  res.json({
    stateStats: stats,
    approvalStats,
    totalChangeRequests: await ChangeRequest.countDocuments()
  });
});

// ==================== ADMIN USERS ====================

// Get all admin users for assignment
const getAdminUsers = asyncHandler(async (req, res) => {
  const adminUsers = await AdminUser.find({}, 'name email role')
    .sort({ name: 1 });

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
    .populate('assignedTo', 'name email role')
    .populate('createdBy', 'name email role')
    .populate('approvedBy', 'name email role')
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
    .populate('assignedTo', 'name email role')
    .populate('createdBy', 'name email role')
    .populate('approvedBy', 'name email role');

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
    createdByName: req.admin.name
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
        maintenanceTask.assignedToName = assignee.name;
      }
    }
  }

  // Calculate next scheduled date for recurring tasks
  if (maintenanceTask.isRecurring) {
    maintenanceTask.calculateNextScheduledDate();
  }

  const savedMaintenanceTask = await maintenanceTask.save();
  await savedMaintenanceTask.populate('assignedTo', 'name email role');
  await savedMaintenanceTask.populate('createdBy', 'name email role');

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
        maintenanceTask.assignedToName = assignee.name;
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

  const updatedMaintenanceTask = await maintenanceTask.save();
  await updatedMaintenanceTask.populate('assignedTo', 'name email role');
  await updatedMaintenanceTask.populate('createdBy', 'name email role');
  await updatedMaintenanceTask.populate('approvedBy', 'name email role');

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
  maintenanceTask.approvedByName = req.admin.name;
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
    author: req.admin.name,
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
  const stats = await MaintenanceTask.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
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
    totalMaintenanceTasks: await MaintenanceTask.countDocuments()
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
    .populate('assignedTo', 'name email role')
    .select('title description type priority status category scheduledDate scheduledStartTime scheduledEndTime assignedToName')
    .sort({ scheduledDate: 1 });

  res.json(maintenanceTasks);
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
  
  // Admin users
  getAdminUsers
};
