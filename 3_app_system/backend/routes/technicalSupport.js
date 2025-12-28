const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/adminAuthMiddleware');
const {
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
} = require('../controllers/technicalSupportController');

// All routes require admin authentication
router.use(protectAdmin);

// ==================== INCIDENT ROUTES ====================

// Get all incidents with filtering and pagination
router.get('/incidents', getAllIncidents);

// Get incident statistics
router.get('/incidents/stats', getIncidentStats);

// Get incident by ID
router.get('/incidents/:id', getIncidentById);

// Create new incident
router.post('/incidents', createIncident);

// Update incident
router.put('/incidents/:id', updateIncident);

// Add work note to incident
router.post('/incidents/:id/notes', addWorkNote);

// ==================== CHANGE REQUEST ROUTES ====================

// Get all change requests with filtering and pagination
router.get('/change-requests', getAllChangeRequests);

// Get change request statistics
router.get('/change-requests/stats', getChangeRequestStats);

// Get change request by ID
router.get('/change-requests/:id', getChangeRequestById);

// Create new change request
router.post('/change-requests', createChangeRequest);

// Update change request
router.put('/change-requests/:id', updateChangeRequest);

// Approve/Reject change request
router.patch('/change-requests/:id/approval', updateChangeRequestApproval);

// ==================== MAINTENANCE SCHEDULER ROUTES ====================

// Get all maintenance tasks with filtering and pagination
router.get('/maintenance-tasks', getAllMaintenanceTasks);

// Get maintenance task statistics
router.get('/maintenance-tasks/stats', getMaintenanceTaskStats);

// Get maintenance tasks for calendar view
router.get('/maintenance-tasks/calendar', getMaintenanceTasksCalendar);

// Get maintenance task by ID
router.get('/maintenance-tasks/:id', getMaintenanceTaskById);

// Create new maintenance task
router.post('/maintenance-tasks', createMaintenanceTask);

// Update maintenance task
router.put('/maintenance-tasks/:id', updateMaintenanceTask);

// Approve/Reject maintenance task
router.patch('/maintenance-tasks/:id/approval', updateMaintenanceTaskApproval);

// Add work note to maintenance task
router.post('/maintenance-tasks/:id/notes', addMaintenanceWorkNote);

// ==================== ADMIN USERS ROUTES ====================

// Get all admin users for assignment
router.get('/admin-users', getAdminUsers);

module.exports = router;
