const rateLimit = require('express-rate-limit');

// Login rate limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many login attempts. Please try again after 15 minutes.',
    details: 'Rate limit exceeded'
  }
});

// OTP verification rate limiter
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // 3 attempts per window
  message: {
    error: 'Too many OTP verification attempts. Please try again after 10 minutes.',
    details: 'Rate limit exceeded'
  }
});

// Password reset rate limiter
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: {
    error: 'Too many password reset attempts. Please try again after 1 hour.',
    details: 'Rate limit exceeded'
  }
});

module.exports = {
  loginLimiter,
  otpLimiter,
  passwordResetLimiter
};