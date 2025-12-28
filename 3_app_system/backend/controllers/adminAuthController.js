const adminAuthService = require('../services/adminAuthService');

// Register new admin
exports.registerAdmin = async (req, res) => {
  try {
    const result = await adminAuthService.registerAdmin(req.body);
    res.status(201).json(result);
  } catch (err) {
    if (err.message === 'Admin with this email, username, or IC number already exists') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Admin registration failed", error: err.message });
  }
};

// Login admin
exports.loginAdmin = async (req, res) => {
  try {
    const result = await adminAuthService.loginAdmin(req.body);
    res.json(result);
  } catch (err) {
    if (err.message === 'Invalid credentials' || err.message === 'Account is not active') {
      return res.status(401).json({ message: err.message });
    }
    res.status(500).json({ message: "Admin login failed", error: err.message });
  }
};

// Get admin profile
exports.getAdminProfile = async (req, res) => {
  try {
    const admin = await adminAuthService.getAdminById(req.admin.id);
    res.json({
      success: true,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        status: admin.status,
        isFirstLogin: admin.isFirstLogin,
        lastLogin: admin.lastLogin,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt
      }
    });
  } catch (err) {
    if (err.message === 'Admin not found') {
      return res.status(404).json({ message: err.message });
    }
    res.status(500).json({ message: "Failed to get admin profile", error: err.message });
  }
};

// Update admin profile
exports.updateAdminProfile = async (req, res) => {
  try {
    const admin = await adminAuthService.updateAdminProfile(req.admin.id, req.body);
    res.json({
      success: true,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        status: admin.status,
        updatedAt: admin.updatedAt
      }
    });
  } catch (err) {
    if (err.message === 'Admin not found') {
      return res.status(404).json({ message: err.message });
    }
    res.status(500).json({ message: "Failed to update admin profile", error: err.message });
  }
};

// Change admin password
exports.changeAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await adminAuthService.changeAdminPassword(req.admin.id, currentPassword, newPassword);
    res.json(result);
  } catch (err) {
    if (err.message === 'Admin not found' || err.message === 'Current password is incorrect') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Failed to change password", error: err.message });
  }
};

// Forgot password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const result = await adminAuthService.forgotPassword(email);
    res.json(result);
  } catch (err) {
    if (err.message === 'Admin not found') {
      return res.status(404).json({ message: err.message });
    }
    res.status(500).json({ message: "Password reset failed", error: err.message });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    const result = await adminAuthService.resetPassword(resetToken, newPassword);
    res.json(result);
  } catch (err) {
    if (err.message === 'Invalid or expired reset token') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Password reset failed", error: err.message });
  }
};

// Get all admins (superadmin only)
exports.getAllAdminUsers = async (req, res) => {
  try {
    // Check if current admin is superadmin
    if (req.admin.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied. Superadmin privileges required.' });
    }

    const admins = await adminAuthService.getAllAdminUsers();
    res.json({
      success: true,
      admins
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to get admins", error: err.message });
  }
};

// Delete admin (superadmin only)
exports.deleteAdmin = async (req, res) => {
  try {
    // Check if current admin is superadmin
    if (req.admin.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied. Superadmin privileges required.' });
    }

    const { id } = req.params;
    
    // Prevent self-deletion
    if (id === req.admin.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const result = await adminAuthService.deleteAdmin(id);
    res.json(result);
  } catch (err) {
    if (err.message === 'Admin not found') {
      return res.status(404).json({ message: err.message });
    }
    res.status(500).json({ message: "Failed to delete admin", error: err.message });
  }
};

// Update another admin (superadmin only)
exports.updateAdmin = async (req, res) => {
  try {
    // Check if current admin is superadmin
    if (req.admin.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied. Superadmin privileges required.' });
    }

    const { id } = req.params;
    const admin = await adminAuthService.updateAdminProfile(id, req.body);
    res.json({
      success: true,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        status: admin.status,
        updatedAt: admin.updatedAt
      }
    });
  } catch (err) {
    if (err.message === 'Admin not found') {
      return res.status(404).json({ message: err.message });
    }
    res.status(500).json({ message: "Failed to update admin", error: err.message });
  }
};
