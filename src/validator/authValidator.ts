import { body, param, query } from "express-validator";
import rateLimit from "express-rate-limit";

// Rate limiting configuration
export const rateLimitConfig = {
  login: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per window
    message: 'Too many login attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  }),
  register: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 registration attempts per hour
    message: 'Too many registration attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  }),
  passwordReset: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // 3 password reset attempts per window
    message: 'Too many password reset attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  }),
  twoFactor: rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // 10 2FA attempts per window
    message: 'Too many two-factor attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  }),
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  }),
  sensitiveAction: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 sensitive actions per window
    message: 'Too many sensitive actions attempted, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  }),
};

// Validation rules
export const validationRules = {
  // Authentication
  login: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 1 }).withMessage('Password is required'),
    body('twoFactorCode').optional().isString().isLength({ min: 6, max: 6 }).withMessage('2FA code must be 6 digits'),
  ],
  
  registration: [
    body('username').isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/).withMessage('validation.username_invalid'),
    body('email').isEmail().normalizeEmail().withMessage('validation.email_invalid'),
    body('password').isLength({ min: 12 }).withMessage('validation.password_min_length'),
    body('firstName').optional().isLength({ min: 1, max: 50 }).withMessage('validation.first_name_max'),
    body('lastName').optional().isLength({ min: 1, max: 50 }).withMessage('validation.last_name_max'),
    body('userLanguage').optional().isString().isLength({ min: 2, max: 10 }).withMessage('validation.language_invalid'),
  ],
  
  // Password management
  forgotPassword: [
    body('email').isEmail().normalizeEmail().withMessage('validation.email_invalid'),
  ],
  
  resetPassword: [
    body('token').isLength({ min: 1 }).withMessage('validation.token_required'),
    body('newPassword').isLength({ min: 12 }).withMessage('validation.password_min_length'),
  ],
  
  passwordChange: [
    body('oldPassword').isLength({ min: 1 }).withMessage('validation.password_required'),
    body('newPassword').isLength({ min: 12 }).withMessage('validation.password_min_length'),
    param('userId').isMongoId().withMessage('validation.user_id_invalid'),
  ],
  
  // Email verification
  emailVerification: [
    body('token').isLength({ min: 1 }).withMessage('Verification token is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  ],
  
  resendVerification: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  ],
  
  // Two-factor authentication
  twoFactorSetup: [
    // No body validation needed for setup initiation
  ],
  
  twoFactorVerify: [
    body('code').isLength({ min: 6, max: 6 }).withMessage('Verification code must be 6 digits'),
  ],
  
  twoFactorDisable: [
    body('password').isLength({ min: 1 }).withMessage('Password is required to disable 2FA'),
  ],
  
  // Profile management
  profileUpdate: [
    body('firstName').optional().isLength({ min: 1, max: 50 }).withMessage('First name must be between 1 and 50 characters'),
    body('lastName').optional().isLength({ min: 1, max: 50 }).withMessage('Last name must be between 1 and 50 characters'),
    body('userLanguage').optional().isString().isLength({ min: 2, max: 10 }).withMessage('Language must be a valid code'),
    body('profilePicture').optional().isURL().withMessage('Profile picture must be a valid URL'),
  ],
  
  // Account management
  deleteAccount: [
    body('password').isLength({ min: 1 }).withMessage('Password is required to delete account'),
  ],
  
  deactivateAccount: [
    body('password').isLength({ min: 1 }).withMessage('Password is required to deactivate account'),
  ],
  
  reactivateAccount: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  ],
  
  // User management
  userList: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('search').optional().isString().trim().isLength({ max: 50 }).withMessage('Search cannot exceed 50 characters'),
  ],
  
  userLookup: [
    param('userId').isMongoId().withMessage('Valid user ID is required'),
  ],
  
  // Availability checks
  checkAvailability: [
    query('username').optional().isString().trim().isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters'),
    query('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  ],
  
  // Email management
  updateEmail: [
    body('newEmail').isEmail().normalizeEmail().withMessage('Valid new email is required'),
    body('password').isLength({ min: 1 }).withMessage('Password is required for verification'),
  ],
  
  // Preferences
  preferencesUpdate: [
    body('preferences').isObject().withMessage('Preferences must be an object'),
    body('preferences.theme').optional().isIn(['light', 'dark', 'auto']).withMessage('Theme must be light, dark, or auto'),
    body('preferences.language').optional().isString().isLength({ min: 2, max: 10 }).withMessage('Language must be a valid code'),
    body('preferences.timezone').optional().isString().withMessage('Timezone must be a valid timezone'),
    body('preferences.notifications').optional().isObject().withMessage('Notifications must be an object'),
    body('preferences.notifications.email').optional().isBoolean().withMessage('Email notifications must be boolean'),
    body('preferences.notifications.push').optional().isBoolean().withMessage('Push notifications must be boolean'),
    body('preferences.notifications.twoFactor').optional().isBoolean().withMessage('Two-factor notifications must be boolean'),
  ],
  
  // Security logs
  securityLogs: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  ],
  
  // ==================== ADMIN USER MANAGEMENT ====================
  
  // Update user role
  updateUserRole: [
    body('role')
      .isString()
      .isIn(['user', 'admin', 'moderator', 'super_admin'])
      .withMessage('Role must be one of: user, admin, moderator, super_admin'),
    param('userId').isMongoId().withMessage('Valid user ID is required'),
  ],
  
  // Send email to user
  sendUserEmail: [
    body('subject')
      .isString()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Subject must be between 1 and 200 characters'),
    body('message')
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage('Email message is required'),
    param('userId').isMongoId().withMessage('Valid user ID is required'),
  ],
  
  // Admin update user
  adminUpdateUser: [
    param('userId').isMongoId().withMessage('Valid user ID is required'),
    body('firstName')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('First name must be between 1 and 50 characters'),
    body('lastName')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Last name must be between 1 and 50 characters'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('username')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters'),
    body('role')
      .optional()
      .isString()
      .isIn(['user', 'admin', 'moderator', 'super_admin'])
      .withMessage('Role must be one of: user, admin, moderator, super_admin'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean value'),
    body('isBanned')
      .optional()
      .isBoolean()
      .withMessage('isBanned must be a boolean value'),
    body('status')
      .optional()
      .isString()
      .isIn(['active', 'inactive', 'suspended', 'banned', 'deleted'])
      .withMessage('Status must be one of: active, inactive, suspended, banned, deleted'),
    body('permissions')
      .optional()
      .isArray()
      .withMessage('Permissions must be an array of strings'),
    body('permissions.*')
      .optional()
      .isString()
      .withMessage('Each permission must be a string'),
  ],
  
  // Admin create user
  adminCreateUser: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('password')
      .isString()
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    body('firstName')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('First name must be between 1 and 50 characters'),
    body('lastName')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Last name must be between 1 and 50 characters'),
    body('username')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters'),
    body('role')
      .optional()
      .isString()
      .isIn(['user', 'admin', 'moderator', 'super_admin'])
      .default('user')
      .withMessage('Role must be one of: user, admin, moderator, super_admin'),
    body('permissions')
      .optional()
      .isArray()
      .withMessage('Permissions must be an array of strings'),
    body('permissions.*')
      .optional()
      .isString()
      .withMessage('Each permission must be a string'),
  ],
  
  // Delete user (no body validation needed, just param)
  deleteUser: [
    param('userId').isMongoId().withMessage('Valid user ID is required'),
  ],
};