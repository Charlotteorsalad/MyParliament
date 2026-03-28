const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (user.status === 'suspended') {
      return res.status(401).json({
        message: 'This account has been suspended. Contact support if you believe this is an error.',
        code: 'ACCOUNT_SUSPENDED'
      });
    }

    // Add user info to request
    req.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      registrationStatus: user.registrationStatus
    };
    
    next();
  } catch (error) {
    res.status(401).json({ message: 'Please authenticate', error: error.message });
  }
};

// Optional auth: attach req.user when token is valid, but do not require it (for public routes that benefit from knowing the user)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return next();

    req.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      registrationStatus: user.registrationStatus
    };
    next();
  } catch (error) {
    next(); // ignore invalid token for optional auth
  }
};

module.exports = auth;
module.exports.optionalAuth = optionalAuth;