const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');
const { generateToken, generateOTP, sendEmail } = require('../config/auth');
const { loginLimiter, otpLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');
const auth = require('../middleware/auth');

// User types enum
const USER_TYPES = {
  BUILDER: 'builder',
  ARCHITECT: 'architect',
  DEALER: 'dealer',
  SALESPERSON: 'salesperson'
};

// Register new user
router.post('/register',
  [
    body('userType')
      .isIn(Object.values(USER_TYPES))
      .withMessage('Invalid user type'),
    body('firstName').notEmpty().trim(),
    body('lastName').notEmpty().trim(),
    body('email').isEmail(),
    body('mobileNumber')
      .matches(/^[0-9]{10}$/)
      .withMessage('Invalid mobile number'),
    body('password')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character'),
    body('acceptedTerms')
      .isBoolean()
      .equals('true')
      .withMessage('Terms and conditions must be accepted')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        userType,
        firstName,
        lastName,
        email,
        mobileNumber,
        password,
        acceptedTerms
      } = req.body;

      // Generate OTP
      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            user_type: userType,
            first_name: firstName,
            last_name: lastName,
            mobile_number: mobileNumber,
            is_approved: false,
            accepted_terms: acceptedTerms,
            otp,
            otp_expiry: otpExpiry.toISOString(),
            is_verified: false
          }
        }
      });

      if (authError) throw authError;

      // Create user profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .insert([
          {
            user_id: authData.user.id,
            user_type: userType,
            first_name: firstName,
            last_name: lastName,
            email,
            mobile_number: mobileNumber,
            is_approved: false,
            approval_status: 'pending',
            is_verified: false
          }
        ])
        .select();

      if (profileError) throw profileError;

      // Send OTP email
      const emailSent = await sendEmail(
        email,
        'Verify Your Email - Milagro Universe',
        `
          <h1>Welcome to Milagro Universe</h1>
          <p>Your verification code is: <strong>${otp}</strong></p>
          <p>This code will expire in 10 minutes.</p>
        `
      );

      if (!emailSent) {
        throw new Error('Failed to send verification email');
      }

      // Send notification to admin
      await supabase
        .from('admin_notifications')
        .insert([
          {
            type: 'new_user_registration',
            user_id: authData.user.id,
            content: `New ${userType} registration: ${firstName} ${lastName}`,
            status: 'unread'
          }
        ]);

      res.status(201).json({
        message: 'Registration successful. Please verify your email.',
        data: {
          user: {
            ...profileData[0],
            otp: undefined // Never send OTP in response
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        error: 'Error during registration',
        details: error.message
      });
    }
});

// Verify OTP
router.post('/verify-otp',
  otpLimiter,
  [
    body('email').isEmail(),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, otp } = req.body;

      // Get user data
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (userError || !userData) {
        return res.status(404).json({
          error: 'User not found',
          details: 'Invalid email address'
        });
      }

      // Verify OTP
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userData.user_id);
      
      if (authError || !authUser) {
        return res.status(400).json({
          error: 'Verification failed',
          details: 'Invalid user data'
        });
      }

      const storedOTP = authUser.user_metadata.otp;
      const otpExpiry = new Date(authUser.user_metadata.otp_expiry);

      if (otp !== storedOTP) {
        return res.status(400).json({
          error: 'Invalid OTP',
          details: 'The verification code is incorrect'
        });
      }

      if (Date.now() > otpExpiry) {
        return res.status(400).json({
          error: 'OTP expired',
          details: 'The verification code has expired'
        });
      }

      // Update user verification status
      await supabase.auth.admin.updateUserById(userData.user_id, {
        user_metadata: {
          ...authUser.user_metadata,
          is_verified: true,
          otp: null,
          otp_expiry: null
        }
      });

      await supabase
        .from('user_profiles')
        .update({ is_verified: true })
        .eq('user_id', userData.user_id);

      res.json({
        message: 'Email verified successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Verification failed',
        details: error.message
      });
    }
});

// Login
router.post('/login',
  loginLimiter,
  [
    body('email').isEmail(),
    body('password').exists()
  ],
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Authenticate user
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        return res.status(401).json({
          error: 'Authentication failed',
          details: 'Invalid credentials'
        });
      }

      // Check if user is verified and approved
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', authData.user.id)
        .single();

      if (profileError) throw profileError;

      if (!profileData.is_verified) {
        return res.status(403).json({
          error: 'Account not verified',
          message: 'Please verify your email address'
        });
      }

      if (!profileData.is_approved) {
        return res.status(403).json({
          error: 'Account pending approval',
          message: 'Your account is waiting for admin approval'
        });
      }

      // Generate JWT token
      const token = generateToken(profileData);

      res.json({
        message: 'Login successful',
        data: {
          session: {
            access_token: token,
            token_type: 'bearer',
            expires_in: 86400 // 24 hours
          },
          user: profileData
        }
      });
    } catch (error) {
      res.status(401).json({
        error: 'Authentication failed',
        details: error.message
      });
    }
});

// Request password reset
router.post('/forgot-password',
  passwordResetLimiter,
  [
    body('email').isEmail()
  ],
  async (req, res) => {
    try {
      const { email } = req.body;

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store reset token in user metadata
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('email', email)
        .single();

      if (userError || !userData) {
        // Always return success to prevent email enumeration
        return res.json({
          message: 'If your email is registered, you will receive a password reset link'
        });
      }

      await supabase.auth.admin.updateUserById(userData.user_id, {
        user_metadata: {
          reset_token: resetToken,
          reset_token_expiry: resetExpiry.toISOString()
        }
      });

      // Send reset email
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      await sendEmail(
        email,
        'Reset Your Password - Milagro Universe',
        `
          <h1>Password Reset Request</h1>
          <p>Click the link below to reset your password:</p>
          <a href="${resetLink}">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `
      );

      res.json({
        message: 'If your email is registered, you will receive a password reset link'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Password reset request failed',
        details: error.message
      });
    }
});

// Reset password
router.post('/reset-password',
  passwordResetLimiter,
  [
    body('token').notEmpty(),
    body('password')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  ],
  async (req, res) => {
    try {
      const { token, password } = req.body;

      // Find user by reset token
      const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
      
      if (usersError) throw usersError;

      const user = users.users.find(u => 
        u.user_metadata?.reset_token === token &&
        new Date(u.user_metadata.reset_token_expiry) > new Date()
      );

      if (!user) {
        return res.status(400).json({
          error: 'Invalid or expired reset token',
          details: 'Please request a new password reset link'
        });
      }

      // Update password
      await supabase.auth.admin.updateUserById(user.id, {
        password,
        user_metadata: {
          ...user.user_metadata,
          reset_token: null,
          reset_token_expiry: null
        }
      });

      res.json({
        message: 'Password reset successful'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Password reset failed',
        details: error.message
      });
    }
});

// Check registration status
router.get('/registration-status', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('approval_status, is_approved, is_verified')
      .eq('user_id', req.user.id)
      .single();

    if (error) throw error;

    res.json({
      status: data.approval_status,
      isApproved: data.is_approved,
      isVerified: data.is_verified
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error fetching registration status',
      details: error.message
    });
  }
});

module.exports = router;