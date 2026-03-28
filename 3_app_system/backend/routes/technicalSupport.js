const express = require('express');
const router = express.Router();
const { protectAdmin, requirePermission } = require('../middleware/adminAuthMiddleware');
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

  // Public – active maintenance period (no auth; registered separately in server.js)
  getActiveMaintenancePeriod,
  
  // Admin users
  getAdminUsers
} = require('../controllers/technicalSupportController');

// ==================== PUBLIC ROUTE (no auth needed) ====================
// Polled by the frontend MaintenanceBanner every 60 s
router.get('/active-maintenance', getActiveMaintenancePeriod);

// All routes below require admin authentication + manage_support permission
router.use(protectAdmin);
router.use(requirePermission('manage_support'));

// ==================== INCIDENT ROUTES ====================

router.get('/incidents', getAllIncidents);
router.get('/incidents/stats', getIncidentStats);
router.get('/incidents/:id', getIncidentById);
router.post('/incidents', createIncident);
router.put('/incidents/:id', updateIncident);
router.post('/incidents/:id/notes', addWorkNote);

// ==================== CHANGE REQUEST ROUTES ====================

router.get('/change-requests', getAllChangeRequests);
router.get('/change-requests/stats', getChangeRequestStats);
router.get('/change-requests/:id', getChangeRequestById);
router.post('/change-requests', createChangeRequest);
router.put('/change-requests/:id', updateChangeRequest);
router.patch('/change-requests/:id/approval', updateChangeRequestApproval);

// ==================== MAINTENANCE SCHEDULER ROUTES ====================

router.get('/maintenance-tasks', getAllMaintenanceTasks);
router.get('/maintenance-tasks/stats', getMaintenanceTaskStats);
router.get('/maintenance-tasks/calendar', getMaintenanceTasksCalendar);
router.get('/maintenance-tasks/:id', getMaintenanceTaskById);
router.post('/maintenance-tasks', createMaintenanceTask);
router.put('/maintenance-tasks/:id', updateMaintenanceTask);
router.patch('/maintenance-tasks/:id/approval', updateMaintenanceTaskApproval);
router.post('/maintenance-tasks/:id/notes', addMaintenanceWorkNote);

// ==================== ADMIN USERS ROUTES ====================

router.get('/admin-users', getAdminUsers);

module.exports = router;
