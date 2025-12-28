const express = require('express');
const router = express.Router();

const {
  registerAdmin,
  loginAdmin,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  forgotPassword,
  resetPassword,
  getAllAdminUsers: getAllAdminsFromAuth,
  deleteAdmin,
  updateAdmin
} = require('../controllers/adminAuthController');

const {
  getAllAdminUsers,
  getAllUsers,
  createUser,
  updateUser,
  updateUserRole,
  updateUserStatus,
  bulkUpdateUsers,
  deleteUser,
  getUserStats,
  getSystemStats,
  getMpStats,
  getEduStats
} = require('../controllers/adminController');

const {
  protectAdmin,
  authorize,
  requirePermission,
  requireAnyPermission
} = require('../middleware/adminAuthMiddleware');

// Public routes (no authentication required)
router.post('/register', registerAdmin);
router.post('/login', loginAdmin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes (authentication required)
router.use(protectAdmin); // All routes below this line require authentication

// Admin profile routes
router.get('/profile', getAdminProfile);
router.put('/profile', updateAdminProfile);
router.put('/change-password', changeAdminPassword);

// Admin management routes (superadmin only) - Quick Actions
router.get('/users', authorize('superadmin'), getAllAdminUsers);
router.post('/users', authorize('superadmin'), createUser);
router.put('/users/:id', authorize('superadmin'), updateUser);
router.patch('/users/:id/role', authorize('superadmin'), updateUserRole);
router.patch('/users/:id/status', authorize('superadmin'), updateUserStatus);
router.patch('/users/bulk', authorize('superadmin'), bulkUpdateUsers);
router.delete('/users/:id', authorize('superadmin'), deleteUser);

// Admin management routes (superadmin only)
router.get('/admins', authorize('superadmin'), getAllAdminsFromAuth);
router.put('/admins/:id', authorize('superadmin'), updateAdmin);
router.delete('/admins/:id', authorize('superadmin'), deleteAdmin);

// User management routes (superadmin only) - Beside Overview tab
router.get('/regular-users', authorize('superadmin'), getAllUsers);

router.get('/content', requirePermission('manage_content'), (req, res) => {
  res.json({ message: 'Access granted to manage content' });
});

router.get('/analytics', requirePermission('view_analytics'), (req, res) => {
  res.json({ message: 'Access granted to view analytics' });
});

router.get('/settings', requirePermission('manage_settings'), (req, res) => {
  res.json({ message: 'Access granted to manage settings' });
});

router.get('/posts', requireAnyPermission('approve_posts', 'delete_posts'), (req, res) => {
  res.json({ message: 'Access granted to manage posts' });
});

router.get('/topics', requirePermission('manage_topics'), (req, res) => {
  res.json({ message: 'Access granted to manage topics' });
});

router.get('/mps', requirePermission('manage_mps'), (req, res) => {
  res.json({ message: 'Access granted to manage MPs' });
});

// Statistics endpoints
router.get('/stats/system', requirePermission('view_analytics'), getSystemStats);
router.get('/stats/users', requirePermission('view_analytics'), getUserStats);
router.get('/stats/mps', requirePermission('view_analytics'), getMpStats);
router.get('/stats/edu', requirePermission('view_analytics'), getEduStats);

module.exports = router;
