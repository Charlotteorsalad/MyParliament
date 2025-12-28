// Role-based authorization middleware

const requireAdminRole = (allowedRoles = ['admin', 'superadmin']) => {
  return (req, res, next) => {
    // Check if admin is authenticated
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if admin has required role
    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions. Required roles: ' + allowedRoles.join(', ')
      });
    }

    next();
  };
};

const requireSuperAdminRole = () => {
  return requireAdminRole(['superadmin']);
};

module.exports = {
  requireAdminRole,
  requireSuperAdminRole
};
