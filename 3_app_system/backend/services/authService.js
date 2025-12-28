const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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
      process.env.JWT_SECRET, 
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
        process.env.JWT_SECRET, 
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
    const { email, password } = credentials;
    console.log('🔍 Login attempt for email:', email);

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ User not found for email:', email);
      throw new Error('Email not found');
    }

    console.log('✅ User found:', user.email, 'Status:', user.registrationStatus);

    // Check if user has completed registration
    if (user.registrationStatus === 'pending') {
      console.log('❌ User registration not completed');
      throw new Error('Please complete your profile before logging in');
    }

    // Verify password
    console.log('🔐 Verifying password...');
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('🔐 Password match:', isMatch);
    
    if (!isMatch) {
      console.log('❌ Password verification failed for:', email);
      throw new Error('Incorrect password');
    }

    // Update lastLogin timestamp
    user.lastLogin = new Date();
    await user.save();
    console.log('✅ Updated lastLogin for user:', email);

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role, registrationStatus: user.registrationStatus }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1d' }
    );

    return {
      token,
      user: { 
        id: user._id, 
        username: user.username, 
        role: user.role,
        registrationStatus: user.registrationStatus
      },
    };
  }

  async validateToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
      console.log('Error message:', emailError.message);
      console.log('NODE_ENV:', process.env.NODE_ENV);
      
      // Return the reset token when email service is not configured or in development
      if (emailError.message === 'Email service not configured' || process.env.NODE_ENV === 'development') {
        console.log('Returning fallback reset URL');
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
    console.log('🔍 Reset password attempt with token:', token.substring(0, 10) + '...');
    
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      console.log('❌ No user found with valid reset token');
      throw new Error('Invalid or expired reset token');
    }

    console.log('✅ User found for password reset:', user.email);

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('🔐 New password hashed successfully');
    
    // Update user password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    console.log('✅ Password reset completed for user:', user.email);
    return { message: 'Password reset successful' };
  }

  async sendPasswordResetEmail(email, token) {
    // Check if email configuration is available
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error('Email service not configured');
    }

    // Create transporter with flexible configuration
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true' || false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      }
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
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
    } catch (error) {
      console.error('Email sending failed:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  // Migration function to update existing users with missing fields
  async migrateExistingUsers() {
    try {
      console.log('🔄 Starting migration for existing users...');
      
      // Update users that don't have lastLogin field
      const usersWithoutLastLogin = await User.updateMany(
        { lastLogin: { $exists: false } },
        { $set: { lastLogin: null } }
      );
      console.log(`✅ Updated ${usersWithoutLastLogin.modifiedCount} users with lastLogin field`);

      // Update users that don't have isRestricted field
      const usersWithoutIsRestricted = await User.updateMany(
        { isRestricted: { $exists: false } },
        { $set: { isRestricted: false } }
      );
      console.log(`✅ Updated ${usersWithoutIsRestricted.modifiedCount} users with isRestricted field`);

      return {
        success: true,
        lastLoginUpdated: usersWithoutLastLogin.modifiedCount,
        isRestrictedUpdated: usersWithoutIsRestricted.modifiedCount
      };
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }
}

module.exports = new AuthService();
