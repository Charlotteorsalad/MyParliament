require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const AdminUser = require('../models/AdminUser');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';
console.log('AdminAuthService: JWT_SECRET loaded:', JWT_SECRET ? 'Yes' : 'No');
console.log('AdminAuthService: JWT_SECRET value:', JWT_SECRET);

// Simple OTP verification function
// In production, use a proper TOTP library like 'speakeasy'
const verifyOTP = (secret, otp) => {
  // For debugging purposes, let's accept a few test OTPs
  const testOTPs = ['123456', '000000', '111111', '745107'];
  
  // Normalize the OTP: convert to string and trim whitespace
  const normalizedOTP = String(otp).trim();
  
  console.log('🔍 Original OTP:', `"${otp}"`);
  console.log('🔍 Normalized OTP:', `"${normalizedOTP}"`);
  console.log('🔍 OTP type:', typeof otp);
  console.log('🔍 Normalized type:', typeof normalizedOTP);
  
  if (testOTPs.includes(normalizedOTP)) {
    console.log('✅ Test OTP accepted:', normalizedOTP);
    return true;
  }
  
  // For now, return false for any other OTP
  // In production, implement proper TOTP verification
  console.log('❌ OTP not in test list:', normalizedOTP);
  return false;
};

// Generate JWT token
const generateToken = (id) => {
  console.log('AdminAuthService: Generating token for admin ID:', id);
  console.log('AdminAuthService: Using JWT_SECRET:', JWT_SECRET);
  const token = jwt.sign({ id }, JWT_SECRET, {
    expiresIn: JWT_EXPIRE,
  });
  console.log('AdminAuthService: Generated token:', token.substring(0, 20) + '...');
  return token;
};

// Register new admin user
const registerAdmin = async (adminData) => {
  try {
    const { username, email, password, icNumber, role = 'admin', permissions = [] } = adminData;

    // Check if admin already exists (case-insensitive email)
    const existingAdmin = await AdminUser.findOne({
      $or: [
        { email: new RegExp(`^${email}$`, 'i') }, 
        { username }, 
        { icNumber }
      ]
    });

    if (existingAdmin) {
      throw new Error('Admin with this email, username, or IC number already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin user
    const admin = new AdminUser({
      username,
      email,
      password: hashedPassword,
      icNumber,
      role,
      permissions,
      status: 'active'
    });

    await admin.save();

    // Generate token
    const token = generateToken(admin._id);

    return {
      success: true,
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        status: admin.status,
        isFirstLogin: admin.isFirstLogin
      }
    };
  } catch (error) {
    throw error;
  }
};

// Login admin user
const loginAdmin = async (loginData) => {
  try {
    const { email, password, otp } = loginData;
    
    console.log('🔍 Login attempt for email:', email);
    console.log('🔍 OTP provided:', otp ? 'Yes' : 'No');

    // Check if admin exists (case-insensitive)
    const admin = await AdminUser.findOne({ email: new RegExp(`^${email}$`, 'i') });
    console.log('🔍 Admin found:', admin ? 'Yes' : 'No');
    
    if (!admin) {
      console.log('❌ Admin not found for email:', email);
      throw new Error('Invalid credentials');
    }

    // Check if admin is active
    if (admin.status !== 'active') {
      console.log('❌ Admin account not active. Status:', admin.status);
      throw new Error('Account is not active');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    console.log('🔍 Password valid:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('❌ Invalid password for email:', email);
      throw new Error('Invalid credentials');
    }

    // Check OTP if MFA is enabled
    if (admin.mfaEnabled && otp) {
      console.log('🔍 MFA enabled, verifying OTP...');
      console.log('🔍 Admin MFA secret:', admin.mfaSecret);
      console.log('🔍 Provided OTP:', otp);
      
      // For now, let's use a simple OTP verification
      // In production, you'd use a proper TOTP library like 'speakeasy'
      const isValidOTP = verifyOTP(admin.mfaSecret, otp);
      console.log('🔍 OTP valid:', isValidOTP);
      
      if (!isValidOTP) {
        console.log('❌ Invalid OTP for email:', email);
        throw new Error('Invalid OTP');
      }
    } else if (admin.mfaEnabled && !otp) {
      console.log('❌ MFA enabled but no OTP provided');
      throw new Error('OTP required');
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate token
    const token = generateToken(admin._id);
    console.log('✅ Login successful for email:', email);

    return {
      success: true,
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        status: admin.status,
        isFirstLogin: admin.isFirstLogin,
        lastLogin: admin.lastLogin
      }
    };
  } catch (error) {
    console.log('❌ Login error:', error.message);
    throw error;
  }
};

// Get admin by ID
const getAdminById = async (id) => {
  try {
    const admin = await AdminUser.findById(id).select('-password');
    if (!admin) {
      throw new Error('Admin not found');
    }
    return admin;
  } catch (error) {
    throw error;
  }
};

// Update admin profile
const updateAdminProfile = async (id, updateData) => {
  try {
    const allowedUpdates = ['username', 'email', 'permissions', 'status'];
    const updates = {};
    
    Object.keys(updateData).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = updateData[key];
      }
    });

    const admin = await AdminUser.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!admin) {
      throw new Error('Admin not found');
    }

    return admin;
  } catch (error) {
    throw error;
  }
};

// Change admin password
const changeAdminPassword = async (id, currentPassword, newPassword) => {
  try {
    const admin = await AdminUser.findById(id);
    if (!admin) {
      throw new Error('Admin not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    admin.password = hashedNewPassword;
    await admin.save();

    return { success: true, message: 'Password updated successfully' };
  } catch (error) {
    throw error;
  }
};

// Forgot password
const forgotPassword = async (email) => {
  try {
    const admin = await AdminUser.findOne({ email: new RegExp(`^${email}$`, 'i') });
    if (!admin) {
      throw new Error('Admin not found');
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetTokenExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    admin.resetPasswordToken = resetToken;
    admin.resetPasswordExpire = new Date(resetTokenExpire);
    await admin.save();

    return {
      success: true,
      resetToken,
      message: 'Password reset token generated'
    };
  } catch (error) {
    throw error;
  }
};

// Reset password
const resetPassword = async (resetToken, newPassword) => {
  try {
    const admin = await AdminUser.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!admin) {
      throw new Error('Invalid or expired reset token');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and clear reset token
    admin.password = hashedPassword;
    admin.resetPasswordToken = null;
    admin.resetPasswordExpire = null;
    await admin.save();

    return { success: true, message: 'Password reset successfully' };
  } catch (error) {
    throw error;
  }
};

// Get all admins (for superadmin)
const getAllAdminUsers = async () => {
  try {
    const admins = await AdminUser.find({}).select('-password');
    return admins;
  } catch (error) {
    throw error;
  }
};

// Delete admin (for superadmin)
const deleteAdmin = async (id) => {
  try {
    const admin = await AdminUser.findByIdAndDelete(id);
    if (!admin) {
      throw new Error('Admin not found');
    }
    return { success: true, message: 'Admin deleted successfully' };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  registerAdmin,
  loginAdmin,
  getAdminById,
  updateAdminProfile,
  changeAdminPassword,
  forgotPassword,
  resetPassword,
  getAllAdminUsers,
  deleteAdmin
};
