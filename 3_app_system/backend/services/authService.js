const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const getJwtSecret = () => process.env.JWT_SECRET || 'supersecret';
const getUserSessionExpire = () => process.env.JWT_EXPIRE || '1d';
const getUserRememberExpire = () => process.env.JWT_REMEMBER_EXPIRE || '30d';

class AuthService {
  async checkUserExists(email) {
    const existing = await User.findOne({ email });
    return !!existing;
  }

  async registerUser(userData) {
    const { email, username, password } = userData;

    // Check if user already exists in database
    const existing = await User.findOne({ email });
    if (existing) {
      throw new Error("Email already exists");
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);
    
    // Create a temporary user object (not saved to database yet)
    const tempUser = {
      email,
      username,
      password: hashed,
      role: "user",
      registrationStatus: "pending",
      createdAt: new Date(),
      status: "active",
      lastLogin: null,
      isRestricted: false,
    };

    // Generate JWT token for profile completion (without saving to DB)
    const token = jwt.sign(
      { 
        tempUser: tempUser, // Include temp user data in token
        registrationStatus: "pending" 
      }, 
      getJwtSecret(), 
      { expiresIn: "1d" }
    );

    return {
      token,
      user: { 
        tempUser: tempUser, // Return temp user data
        registrationStatus: "pending"
      },
    };
  }

  async completeProfile(token, profileData) {
    try {
      // Decode the token to get temp user data
      const decoded = jwt.verify(token, getJwtSecret());
      const tempUser = decoded.tempUser;
      
      if (!tempUser) {
        throw new Error('Invalid registration token');
      }

      // Check if user already exists in database (final check)
      const existing = await User.findOne({ email: tempUser.email });
      if (existing) {
        throw new Error("Email already exists");
      }

      // Now create the actual user in the database
      const user = await User.create({
        ...tempUser,
        profile: {
          ...tempUser.profile,
          ...profileData
        },
        registrationStatus: "completed",
        lastLogin: null,
        isRestricted: false
      });

      // Generate new JWT token with completed status
      const newToken = jwt.sign(
        { id: user._id, role: user.role, registrationStatus: user.registrationStatus }, 
        getJwtSecret(), 
        { expiresIn: "1d" }
      );

      return {
        token: newToken,
        user: { 
          id: user._id, 
          username: user.username, 
          role: user.role,
          registrationStatus: user.registrationStatus
        },
      };
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid or expired registration token');
      }
      throw error;
    }
  }

  async loginUser(credentials) {
    const { email, password, remember = false } = credentials;

    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('Email not found');
    }

    if (user.status === 'suspended') {
      throw new Error('This account has been suspended. Contact support if you believe this is an error.');
    }

    if (user.registrationStatus === 'pending') {
      throw new Error('Please complete your profile before logging in');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      throw new Error('Incorrect password');
    }

    user.lastLogin = new Date();
    await user.save();

    // Keep short-lived session tokens by default and extend them only when
    // the client explicitly asks to be remembered across browser restarts.
    const tokenExpiry = remember ? getUserRememberExpire() : getUserSessionExpire();

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role, registrationStatus: user.registrationStatus }, 
      getJwtSecret(), 
      { expiresIn: tokenExpiry }
    );

    return {
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        registrationStatus: user.registrationStatus,
        isRestricted: user.isRestricted || false,
        restrictionEndDate: user.restrictionEndDate || null,
        restrictionReason: user.restrictionReason || null,
        status: user.status
      },
    };
  }

  async validateToken(token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret());
      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async forgotPassword(email) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('Email not found');
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    // Save reset token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    // Try to send email with reset link, but don't fail if email service is not configured
    try {
      await this.sendPasswordResetEmail(user.email, resetToken);
      return { message: 'Password reset email sent' };
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      
      if (emailError.message === 'Email service not configured' || process.env.NODE_ENV === 'development') {
        return { 
          message: 'Password reset token generated (email service not configured)', 
          resetToken: resetToken,
          resetUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`
        };
      }
      throw new Error('Password reset email could not be sent. Please contact support.');
    }
  }

  async resetPassword(token, newPassword) {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return { message: 'Password reset successful' };
  }

  async sendPasswordResetEmail(email, token) {
    // Check if email configuration is available
    const emailUser = process.env.EMAIL_USER?.trim();
    const emailPass = (process.env.EMAIL_PASS || '').replace(/\s/g, '').trim(); // Gmail app password: use without spaces
    if (!emailUser || !emailPass) {
      throw new Error('Email service not configured');
    }

    // Create transporter with flexible configuration
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true' || false, // true for 465, false for other ports
      auth: {
        user: emailUser,
        pass: emailPass
      },
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      }
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    
    const mailOptions = {
      from: emailUser,
      to: email,
      subject: 'Password Reset Request - My Parliament',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #C3C3E5;">Password Reset Request</h2>
          <p>You requested a password reset for your My Parliament account.</p>
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}" style="display: inline-block; background: #C3C3E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <p>Best regards,<br>The My Parliament Team</p>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (firstErr) {
      console.error('Password reset email first send failed, retrying once...', firstErr.message);
      try {
        await transporter.sendMail(mailOptions);
      } catch (retryErr) {
        console.error('Email sending failed:', retryErr);
        throw new Error('Failed to send password reset email');
      }
    }
  }

  // Migration function to update existing users with missing fields
  async migrateExistingUsers() {
    try {
      const usersWithoutLastLogin = await User.updateMany(
        { lastLogin: { $exists: false } },
        { $set: { lastLogin: null } }
      );

      const usersWithoutIsRestricted = await User.updateMany(
        { isRestricted: { $exists: false } },
        { $set: { isRestricted: false } }
      );

      return {
        success: true,
        lastLoginUpdated: usersWithoutLastLogin.modifiedCount,
        isRestrictedUpdated: usersWithoutIsRestricted.modifiedCount
      };
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }
}

module.exports = new AuthService();
