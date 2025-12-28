require('dotenv').config();
const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
console.log('AdminAuthMiddleware: JWT_SECRET loaded:', JWT_SECRET ? 'Yes' : 'No');
console.log('AdminAuthMiddleware: JWT_SECRET value:', JWT_SECRET);

// Protect admin routes
const protectAdmin = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Make sure token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      console.log('AdminAuthMiddleware: Verifying token with secret:', JWT_SECRET);
      console.log('AdminAuthMiddleware: Token to verify:', token.substring(0, 20) + '...');
      
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('AdminAuthMiddleware: Token decoded successfully:', decoded);

      // Get admin from token
      console.log('AdminAuthMiddleware: Looking for admin with ID:', decoded.id);
      const admin = await AdminUser.findById(decoded.id).select('-password');
      console.log('AdminAuthMiddleware: Admin found:', !!admin);
      console.log('AdminAuthMiddleware: Admin object:', admin);

      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'No admin found with this token'
        });
      }

      // Check if admin is active
      if (admin.status !== 'active') {
        return res.status(401).json({
          success: false,
          message: 'Admin account is not active'
        });
      }

      req.admin = admin;
      next();
    } catch (error) {
      console.log('AdminAuthMiddleware: JWT verification error:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Please authenticate',
        error: error.message
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        message: `Admin role ${req.admin.role} is not authorized to access this route`
      });
    }

    next();
  };
};

// Grant access to specific permissions
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    // Superadmin has all permissions
    if (req.admin.role === 'superadmin') {
      return next();
    }

    // Check if admin has the required permission
    if (!req.admin.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: `Permission '${permission}' is required to access this route`
      });
    }

    next();
  };
};

// Grant access to multiple permissions (admin needs at least one)
const requireAnyPermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    // Superadmin has all permissions
    if (req.admin.role === 'superadmin') {
      return next();
    }

    // Check if admin has at least one of the required permissions
    const hasPermission = permissions.some(permission => 
      req.admin.permissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `At least one of these permissions is required: ${permissions.join(', ')}`
      });
    }

    next();
  };
};

// Grant access to all specified permissions (admin needs all)
const requireAllPermissions = (...permissions) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    // Superadmin has all permissions
    if (req.admin.role === 'superadmin') {
      return next();
    }

    // Check if admin has all required permissions
    const hasAllPermissions = permissions.every(permission => 
      req.admin.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({
        success: false,
        message: `All of these permissions are required: ${permissions.join(', ')}`
      });
    }

    next();
  };
};

module.exports = {
  protectAdmin,
  authorize,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions
};
