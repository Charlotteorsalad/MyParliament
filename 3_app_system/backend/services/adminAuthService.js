require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
const AdminUser = require('../models/AdminUser');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';
const APP_NAME = process.env.ADMIN_MFA_ISSUER || 'MyParliament';

// Real TOTP verification (Google Authenticator / Authy compatible)
const verifyTOTP = (secret, token) => {
  if (!secret || !token) return false;
  const normalizedToken = String(token).trim();
  if (normalizedToken.length !== 6) return false;
  try {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: normalizedToken,
      window: 1  // allow ±1 step (30s) clock drift
    });
  } catch (err) {
    console.error('TOTP verify error:', err.message);
    return false;
  }
};

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: JWT_EXPIRE,
  });
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

    const admin = await AdminUser.findOne({ email: new RegExp(`^${email}$`, 'i') });
    
    if (!admin) {
      throw new Error('Invalid credentials');
    }

    if (admin.status !== 'active') {
      throw new Error('Account is not active');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    if (admin.mfaEnabled && otp) {
      if (!admin.mfaSecret) {
        throw new Error('Invalid OTP');
      }
      const isValidOTP = verifyTOTP(admin.mfaSecret, otp);
      if (!isValidOTP) {
        throw new Error('Invalid OTP');
      }
    } else if (admin.mfaEnabled && !otp) {
      throw new Error('OTP required');
    }

    admin.lastLogin = new Date();
    await admin.save();

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
        isFirstLogin: admin.isFirstLogin,
        lastLogin: admin.lastLogin,
        mfaEnabled: !!admin.mfaEnabled
      }
    };
  } catch (error) {
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

// Send admin password reset email (same SMTP as user)
const sendAdminPasswordResetEmail = async (email, token) => {
  const emailUser = process.env.EMAIL_USER?.trim();
  const emailPass = (process.env.EMAIL_PASS || '').replace(/\s/g, '').trim();
  if (!emailUser || !emailPass) {
    throw new Error('Email service not configured');
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true' || false,
    auth: { user: emailUser, pass: emailPass },
    tls: { rejectUnauthorized: false }
  });
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/admin/reset-password?token=${token}`;
  const mailOptions = {
    from: `"My Parliament Admin" <${emailUser}>`,
    to: email,
    subject: 'Admin Password Reset - My Parliament',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #15803d;">Admin Password Reset</h2>
        <p>You requested a password reset for your My Parliament <strong>admin</strong> account.</p>
        <p>Click the button below to reset your password:</p>
        <a href="${resetUrl}" style="display: inline-block; background: #15803d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Reset Admin Password</a>
        <p><strong>This link is valid for 10 minutes only.</strong> After that you will need to request a new reset link.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br>The My Parliament Team</p>
      </div>
    `
  };
  try {
    await transporter.sendMail(mailOptions);
  } catch (firstErr) {
    console.error('Admin reset email first send failed, retrying once...', firstErr.message);
    try {
      await transporter.sendMail(mailOptions);
    } catch (retryErr) {
      console.error('Admin reset email send failed:', retryErr);
      throw new Error('Could not send reset email. Please try again later.');
    }
  }
};

// Forgot password: send reset link by email only if admin exists (same response either way - no info leak)
// Use findOneAndUpdate so we only set reset token fields (no load+save = no risk of overwriting/deleting admin)
const forgotPassword = async (email) => {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const resetToken = crypto.randomBytes(20).toString('hex');
  const resetTokenExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const admin = await AdminUser.findOneAndUpdate(
    { email: new RegExp(`^${normalizedEmail}$`, 'i') },
    { $set: { resetPasswordToken: resetToken, resetPasswordExpire: resetTokenExpire } },
    { new: true, runValidators: true }
  );

  if (admin) {
    try {
      await sendAdminPasswordResetEmail(admin.email, resetToken);
    } catch (err) {
      console.error('Admin forgot password: email send failed', err);
      throw new Error('Could not send reset email. Please try again later.');
    }
  }

  return {
    success: true,
    message: 'If an admin account exists for this email, a reset link has been sent. Please check your inbox and spam folder.'
  };
};

// Reset password: use findOneAndUpdate with $set only so we never overwrite the whole
// document (avoids risk of superadmin/doc loss if something goes wrong mid-flow).
const resetPassword = async (resetToken, newPassword) => {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  const admin = await AdminUser.findOneAndUpdate(
    {
      resetPasswordToken: resetToken,
      resetPasswordExpire: { $gt: Date.now() }
    },
    {
      $set: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpire: null
      }
    },
    { new: true, runValidators: true }
  );

  if (!admin) {
    throw new Error('Invalid or expired reset token');
  }

  return { success: true, message: 'Password reset successfully' };
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

// Delete admin (for superadmin). Never allow deleting the last superadmin.
const deleteAdmin = async (id) => {
  const admin = await AdminUser.findById(id);
  if (!admin) {
    throw new Error('Admin not found');
  }
  if (admin.role === 'superadmin') {
    const superadminCount = await AdminUser.countDocuments({ role: 'superadmin' });
    if (superadminCount <= 1) {
      throw new Error('Cannot delete the last superadmin. Ensure at least one superadmin exists.');
    }
  }
  await AdminUser.findByIdAndDelete(id);
  return { success: true, message: 'Admin deleted successfully' };
};

// Setup MFA: generate secret and QR for authenticator app (does not enable MFA yet)
const setupMfa = async (adminId) => {
  const admin = await AdminUser.findById(adminId);
  if (!admin) throw new Error('Admin not found');
  const secret = speakeasy.generateSecret({
    length: 20,
    name: `${APP_NAME} (${admin.email})`,
    issuer: APP_NAME
  });
  admin.mfaSecret = secret.base32;
  admin.mfaEnabled = false;
  await admin.save();
  const otpauthUrl = secret.otpauth_url;
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 2 });
  return { secret: secret.base32, otpauthUrl, qrDataUrl };
};

// Enable MFA: verify one-time code from app then turn on MFA
const enableMfa = async (adminId, token) => {
  const admin = await AdminUser.findById(adminId);
  if (!admin) throw new Error('Admin not found');
  if (!admin.mfaSecret) throw new Error('Setup MFA first');
  const isValid = verifyTOTP(admin.mfaSecret, token);
  if (!isValid) throw new Error('Invalid OTP');
  admin.mfaEnabled = true;
  await admin.save();
  return { success: true, message: 'MFA enabled' };
};

// Disable MFA
const disableMfa = async (adminId) => {
  const admin = await AdminUser.findById(adminId);
  if (!admin) throw new Error('Admin not found');
  admin.mfaSecret = null;
  admin.mfaEnabled = false;
  await admin.save();
  return { success: true, message: 'MFA disabled' };
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
  deleteAdmin,
  setupMfa,
  enableMfa,
  disableMfa
};
