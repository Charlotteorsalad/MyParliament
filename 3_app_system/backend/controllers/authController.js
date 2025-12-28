const authService = require('../services/authService');
const { logLogin } = require('../middleware/activityLogger');

exports.registerUser = async (req, res) => {
  try {
    const result = await authService.registerUser(req.body);
    console.log("User created with pending status:", result.user);
    res.json(result);
  } catch (err) {
    if (err.message === "Email already exists") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Registration failed", error: err.message });
  }
};

exports.checkUserExists = async (req, res) => {
  try {
    const { email } = req.body;
    const exists = await authService.checkUserExists(email);
    res.json({ exists });
  } catch (err) {
    res.status(500).json({ message: "Check failed", error: err.message });
  }
};

exports.completeProfile = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    const result = await authService.completeProfile(token, req.body);
    console.log("Profile completed:", result.user);
    res.json(result);
  } catch (err) {
    if (err.message === "Invalid registration token") {
      return res.status(401).json({ message: err.message });
    }
    if (err.message === "Email already exists") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Profile completion failed", error: err.message });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const result = await authService.loginUser(req.body);
    
    // Log the login activity
    if (result.user) {
      req.user = result.user; // Set user for activity logging
      await logLogin()(req, res, () => {});
    }
    
    res.json(result);
  } catch (err) {
    if (err.message === 'Email not found' || err.message === 'Incorrect password') {
      return res.status(401).json({ message: err.message });
    }
    res.status(500).json({ message: "Login failed", error: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    res.json(result);
  } catch (err) {
    if (err.message === 'Email not found') {
      return res.status(404).json({ message: err.message });
    }
    if (err.message === 'Password reset email could not be sent. Please contact support.') {
      return res.status(500).json({ message: err.message });
    }
    // For other errors, return a generic message
    res.status(500).json({ message: "Password reset failed", error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const result = await authService.resetPassword(token, newPassword);
    res.json(result);
  } catch (err) {
    if (err.message === 'Invalid or expired reset token') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Password reset failed", error: err.message });
  }
};

exports.migrateUsers = async (req, res) => {
  try {
    const result = await authService.migrateExistingUsers();
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Migration failed", error: err.message });
  }
};

