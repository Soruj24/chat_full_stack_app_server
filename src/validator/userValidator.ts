import { body, param, query, validationResult } from 'express-validator';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

// Security headers middleware
export const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false
});

// Enhanced validation patterns
const validationPatterns = {
    username: /^[a-zA-Z0-9_-]{3,30}$/,
    name: /^[a-zA-ZÀ-ÿ\s'-]{1,50}$/,
    phone: /^(\+?[1-9]\d{1,14}|[0-9]{10,11})$/,
    zipCode: /^[0-9A-Za-z\s-]{3,10}$/,
    hexColor: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
    url: /^https?:\/\/[^\s/$.?#].[^\s]*$/,
    objectId: /^[0-9a-fA-F]{24}$/,
    timezone: /^[A-Za-z]+\/[A-Za-z_]+$/,
    language: /^[a-z]{2}(-[A-Z]{2})?$/,
    currency: /^[A-Z]{3}$/,
    date: /^\d{4}-\d{2}-\d{2}$/,
    datetime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
    ipAddress: /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/,
    macAddress: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/
};

// Sanitization helpers
const sanitizers = {
    trim: (value: string) => value?.trim(),
    toLowerCase: (value: string) => value?.toLowerCase(),
    toUpperCase: (value: string) => value?.toUpperCase(),
    escape: (value: string) => value?.replace(/[<>&"']/g, char => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[char] || char)),
    removeExtraSpaces: (value: string) => value?.replace(/\s+/g, ' ').trim(),
    normalizeEmail: (value: string) => {
        if (!value) return value;
        const [local, domain] = value.split('@');
        return `${local}@${domain?.toLowerCase()}`;
    }
};

// Password strength checker with enhanced security
export const getPasswordStrength = (password: string): {
    score: number;
    strength: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
    feedback: string[];
} => {
    const checks = {
        length: password.length >= 12,
        lowercase: /[a-z]/.test(password),
        uppercase: /[A-Z]/.test(password),
        number: /\d/.test(password),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
        noRepeating: !/(.)\1{2,}/.test(password),
        noSequential: !/(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password),
        noCommon: true,
        noPersonal: true
    };

    const commonPasswords = [
        'password', '123456', '12345678', 'qwerty', 'abc123', 'password123',
        'admin', 'letmein', 'welcome', '123456789', 'password1', 'iloveyou'
    ];

    checks.noCommon = !commonPasswords.includes(password.toLowerCase());

    const score = Object.values(checks).filter(Boolean).length;
    const feedback: string[] = [];

    if (!checks.length) feedback.push('Use at least 12 characters');
    if (!checks.lowercase) feedback.push('Add lowercase letters');
    if (!checks.uppercase) feedback.push('Add uppercase letters');
    if (!checks.number) feedback.push('Add numbers');
    if (!checks.special) feedback.push('Add special characters');
    if (!checks.noRepeating) feedback.push('Avoid repeating characters');
    if (!checks.noSequential) feedback.push('Avoid sequential patterns');
    if (!checks.noCommon) feedback.push('Avoid common passwords');

    let strength: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
    if (score <= 2) strength = 'very-weak';
    else if (score <= 4) strength = 'weak';
    else if (score <= 6) strength = 'fair';
    else if (score <= 8) strength = 'good';
    else if (score <= 10) strength = 'strong';
    else strength = 'very-strong';

    return { score, strength, feedback };
};

// Enhanced user validator with comprehensive validations
const userValidator = {
    // Enhanced username validation
    username: [
        body("username")
            .trim()
            .escape()
            .notEmpty().withMessage("Username is required")
            .isLength({ min: 3, max: 30 }).withMessage("Username must be between 3 and 30 characters")
            .matches(validationPatterns.username).withMessage("Username can only contain letters, numbers, underscores, and hyphens")
            .custom((value) => {
                const reservedNames = [
                    'administrator', 'root', 'system', 'api', 'www',
                    'mail', 'ftp', 'support', 'help', 'info', 'contact',
                    'test', 'guest', 'anonymous', 'null', 'undefined', 'moderator',
                    'owner', 'staff', 'supportteam', 'helpdesk'
                ];
                if (reservedNames.includes(value.toLowerCase())) {
                    throw new Error('This username is reserved');
                }

                // Check for offensive words
                const offensiveWords = ['fuck', 'shit', 'asshole', 'bastard', 'bitch', 'nigger', 'retard'];
                if (offensiveWords.some(word => value.toLowerCase().includes(word))) {
                    throw new Error('Username contains inappropriate language');
                }

                return true;
            })
            .customSanitizer(sanitizers.toLowerCase)
    ],

    // Enhanced email validation
    email: [
        body("email")
            .trim()
            .toLowerCase()
            .notEmpty().withMessage("Email is required")
            .isLength({ max: 254 }).withMessage("Email address is too long")
            .isEmail().withMessage("Please provide a valid email address")
            .normalizeEmail({
                gmail_remove_dots: false,
                gmail_remove_subaddress: false,
                outlookdotcom_remove_subaddress: false,
                yahoo_remove_subaddress: false,
                icloud_remove_subaddress: false
            })
            .custom((value) => {
                const disposableDomains = [
                    '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
                    'mailinator.com', 'throwaway.email', 'temp-mail.org',
                    'getairmail.com', 'yopmail.com', 'trashmail.com'
                ];
                const domain = value.split('@')[1];
                if (disposableDomains.includes(domain.toLowerCase())) {
                    throw new Error('Disposable email addresses are not allowed');
                }
                return true;
            })
    ],

    // Enhanced password validation
    password: [
        body("password")
            .notEmpty().withMessage("Password is required")
            .isLength({ min: 12, max: 128 }).withMessage("Password must be between 12 and 128 characters")
            .custom((value, { req }) => {
                const strength = getPasswordStrength(value);
                if (strength.score < 6) {
                    throw new Error(`Password too weak: ${strength.feedback.join(', ')}`);
                }

                // Check against personal information
                const personalInfo = [
                    req.body.username,
                    req.body.email?.split('@')[0],
                    req.body.firstName,
                    req.body.lastName
                ].filter(Boolean);

                for (const info of personalInfo) {
                    if (info && info.length > 2 && value.toLowerCase().includes(info.toLowerCase())) {
                        throw new Error('Password should not contain your personal information');
                    }
                }

                return true;
            })
    ],

    // Profile validation
    profile: [
        body("firstName")
            .optional()
            .trim()
            .isLength({ min: 1, max: 50 }).withMessage("First name must be between 1 and 50 characters")
            .matches(validationPatterns.name).withMessage("First name can only contain letters, spaces, hyphens, and apostrophes")
            .customSanitizer(sanitizers.removeExtraSpaces),

        body("lastName")
            .optional()
            .trim()
            .isLength({ min: 1, max: 50 }).withMessage("Last name must be between 1 and 50 characters")
            .matches(validationPatterns.name).withMessage("Last name can only contain letters, spaces, hyphens, and apostrophes")
            .customSanitizer(sanitizers.removeExtraSpaces),

        body("phone")
            .optional()
            .trim()
            .matches(validationPatterns.phone).withMessage("Please provide a valid phone number"),

        body("bio")
            .optional()
            .trim()
            .isLength({ max: 500 }).withMessage("Bio cannot exceed 500 characters")
            .escape(),

        body("website")
            .optional()
            .trim()
            .isURL().withMessage("Please provide a valid website URL")
            .isLength({ max: 200 }).withMessage("Website URL is too long")
    ],

    // Address validation
    address: [
        body("addresses.*.type")
            .optional()
            .isIn(['home', 'work', 'billing', 'shipping', 'other']).withMessage("Invalid address type"),

        body("addresses.*.street")
            .optional()
            .trim()
            .isLength({ min: 1, max: 100 }).withMessage("Street address must be between 1 and 100 characters")
            .customSanitizer(sanitizers.escape),

        body("addresses.*.city")
            .optional()
            .trim()
            .matches(/^[a-zA-Z\s'-]+$/).withMessage("City name can only contain letters, spaces, hyphens, and apostrophes")
            .isLength({ min: 1, max: 50 }).withMessage("City name must be between 1 and 50 characters"),

        body("addresses.*.state")
            .optional()
            .trim()
            .matches(/^[a-zA-Z\s'-]+$/).withMessage("State name can only contain letters, spaces, hyphens, and apostrophes")
            .isLength({ min: 1, max: 50 }).withMessage("State name must be between 1 and 50 characters"),

        body("addresses.*.zipCode")
            .optional()
            .trim()
            .matches(validationPatterns.zipCode).withMessage("Please provide a valid postal/ZIP code"),

        body("addresses.*.country")
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 }).withMessage("Country name must be between 2 and 50 characters")
            .isAlpha('en-US', { ignore: ' ' }).withMessage("Country name can only contain letters and spaces")
    ],

    // Preferences validation
    preferences: [
        body("preferences.language")
            .optional()
            .isIn(['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi', 'bn']).withMessage("Invalid language preference"),

        body("preferences.currency")
            .optional()
            .isIn(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CNY', 'INR', 'BDT']).withMessage("Invalid currency preference"),

        body("preferences.timezone")
            .optional()
            .matches(validationPatterns.timezone).withMessage("Invalid timezone format"),

        body("preferences.theme")
            .optional()
            .isIn(['light', 'dark', 'auto']).withMessage("Theme must be light, dark, or auto"),

        body("preferences.notifications.email")
            .optional()
            .isBoolean().withMessage("Email notification preference must be true or false"),

        body("preferences.notifications.sms")
            .optional()
            .isBoolean().withMessage("SMS notification preference must be true or false"),

        body("preferences.notifications.push")
            .optional()
            .isBoolean().withMessage("Push notification preference must be true or false"),

        body("preferences.privacy.profileVisibility")
            .optional()
            .isIn(['public', 'friends', 'private']).withMessage("Profile visibility must be public, friends, or private"),

        body("preferences.privacy.showEmail")
            .optional()
            .isBoolean().withMessage("Show email preference must be true or false"),

        body("preferences.privacy.showPhone")
            .optional()
            .isBoolean().withMessage("Show phone preference must be true or false")
    ],

    // User ID validation
    userId: [
        param("id")
            .trim()
            .notEmpty().withMessage("User ID is required")
            .matches(validationPatterns.objectId).withMessage("Invalid user ID format")
    ],

    // Pagination and query validation
    pagination: [
        query("page")
            .optional()
            .isInt({ min: 1 }).withMessage("Page must be a positive integer")
            .toInt(),

        query("limit")
            .optional()
            .isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100")
            .toInt(),

        query("sort")
            .optional()
            .isIn(['asc', 'desc', 'ASC', 'DESC']).withMessage("Sort must be asc or desc")
            .customSanitizer(value => value?.toLowerCase()),

        query("search")
            .optional()
            .trim()
            .isLength({ max: 50 }).withMessage("Search term cannot exceed 50 characters")
            .escape()
    ],

    // Date range validation
    dateRange: [
        query("startDate")
            .optional()
            .isISO8601().withMessage("Start date must be a valid ISO 8601 date")
            .custom((value) => {
                const date = new Date(value);
                const minDate = new Date('2000-01-01');
                if (date < minDate) {
                    throw new Error('Start date cannot be before 2000-01-01');
                }
                return true;
            }),

        query("endDate")
            .optional()
            .isISO8601().withMessage("End date must be a valid ISO 8601 date (YYYY-MM-DD)")
            .custom((value, { req }) => {
                const endDate = new Date(value);
                const today = new Date();
                today.setHours(23, 59, 59, 999); // End of today

                // Safe access with optional chaining
                const startDateValue = req?.query?.startDate as string;
                const startDate = startDateValue ? new Date(startDateValue) : new Date('2000-01-01');

                if (endDate > today) {
                    throw new Error('End date cannot be in the future');
                }

                if (endDate < startDate) {
                    throw new Error('End date cannot be before start date');
                }

                // Check if date range is too large (e.g., more than 1 year)
                const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays > 365) {
                    throw new Error('Date range cannot exceed 1 year');
                }

                return true;
            })
    ],

    // Status validation
    status: [
        body("status")
            .optional()
            .isIn(['active', 'inactive', 'suspended', 'banned', 'pending']).withMessage("Invalid status")
    ],

    // Role validation
    role: [
        body("role")
            .optional()
            .isIn(['user', 'admin', 'moderator', 'editor', 'viewer']).withMessage("Invalid role")
    ],

    // Terms acceptance
    acceptTerms: [
        body("acceptTerms")
            .custom((value) => {
                if (value !== true) {
                    throw new Error('You must accept the terms and conditions');
                }
                return true;
            })
    ],

    // File upload validation
    avatar: [
        body("avatar")
            .optional()
            .custom((value, { req }) => {
                if (!req.file) return true;

                const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                const maxSize = 5 * 1024 * 1024; // 5MB

                if (!allowedMimeTypes.includes(req.file.mimetype)) {
                    throw new Error('Avatar must be a JPEG, PNG, GIF, or WebP image');
                }

                if (req.file.size > maxSize) {
                    throw new Error('Avatar image must be less than 5MB');
                }

                // Check image dimensions
                // This would require additional processing with a library like sharp
                return true;
            })
    ],

    // Bulk operations validation
    bulkOperations: [
        body("userIds")
            .isArray({ min: 1, max: 100 }).withMessage("User IDs must be an array with 1-100 items")
            .custom((value: string[]) => {
                const invalidIds = value.filter(id => !validationPatterns.objectId.test(id));
                if (invalidIds.length > 0) {
                    throw new Error(`Invalid user IDs: ${invalidIds.join(', ')}`);
                }
                return true;
            }),

        body("action")
            .isIn(['delete', 'activate', 'deactivate', 'suspend', 'unsuspend']).withMessage("Invalid bulk action")
    ]
};


// Validation rule sets for different operations
export const validationRules = {
    // User registration
    registration: [
        ...userValidator.username,
        ...userValidator.email,
        ...userValidator.password,
        ...userValidator.acceptTerms,
        ...userValidator.profile
    ],

    // Profile update
    profileUpdate: [
        ...userValidator.profile,
        ...userValidator.address,
        ...userValidator.preferences
    ],

    // Password change
    passwordChange: [
        body("currentPassword")
            .notEmpty().withMessage("Current password is required"),

        body("newPassword")
            .notEmpty().withMessage("New password is required")
            .isLength({ min: 12, max: 128 }).withMessage("New password must be between 12 and 128 characters")
            .custom((value, { req }) => {
                if (value === req.body.currentPassword) {
                    throw new Error("New password must be different from current password");
                }
                return true;
            }),

        body("confirmPassword")
            .notEmpty().withMessage("Password confirmation is required")
            .custom((value, { req }) => {
                if (value !== req.body.newPassword) {
                    throw new Error("Password confirmation does not match");
                }
                return true;
            })
    ],

    // Admin user management
    adminUpdateUser: [
        ...userValidator.userId,
        ...userValidator.profile,
        ...userValidator.status,
        ...userValidator.role,
        ...userValidator.preferences
    ],

    // Bulk operations
    bulkOperations: [
        ...userValidator.bulkOperations
    ],

    // User search and listing
    userSearch: [
        ...userValidator.pagination,
        query("role")
            .optional()
            .isIn(['user', 'admin', 'moderator', 'editor', 'viewer']).withMessage("Invalid role filter"),

        query("status")
            .optional()
            .isIn(['active', 'inactive', 'suspended', 'banned', 'pending']).withMessage("Invalid status filter"),

        query("dateRange")
            .optional()
            .isIn(['today', 'week', 'month', 'year', 'custom']).withMessage("Invalid date range filter")
    ],

    // Password reset (admin)
    adminResetPassword: [
        ...userValidator.userId,
        body("newPassword")
            .optional()
            .isLength({ min: 12, max: 128 }).withMessage("New password must be between 12 and 128 characters")
            .custom((value) => {
                const strength = getPasswordStrength(value);
                if (strength.score < 6) {
                    throw new Error(`Password too weak: ${strength.feedback.join(', ')}`);
                }
                return true;
            }),

        body("notifyUser")
            .optional()
            .isBoolean().withMessage("Notify user must be true or false")
    ],

    // User status update
    userStatus: [
        ...userValidator.userId,
        ...userValidator.status,
        body("reason")
            .optional()
            .trim()
            .isLength({ max: 500 }).withMessage("Reason cannot exceed 500 characters")
            .escape()
    ],

    // Email verification
    emailVerification: [
        ...userValidator.userId,
        body("verified")
            .isBoolean().withMessage("Verified must be true or false")
    ],

    // Two-factor authentication
    twoFactor: [
        ...userValidator.userId,
        body("enabled")
            .isBoolean().withMessage("Enabled must be true or false")
    ],

    // Avatar upload
    avatarUpload: [
        ...userValidator.avatar
    ],

    // Export users
    exportUsers: [
        query("format")
            .optional()
            .isIn(['json', 'csv', 'xml']).withMessage("Export format must be json, csv, or xml"),

        query("fields")
            .optional()
            .isArray().withMessage("Fields must be an array")
            .custom((value: string[]) => {
                const allowedFields = ['id', 'username', 'email', 'firstName', 'lastName', 'role', 'status', 'createdAt'];
                const invalidFields = value.filter(field => !allowedFields.includes(field));
                if (invalidFields.length > 0) {
                    throw new Error(`Invalid export fields: ${invalidFields.join(', ')}`);
                }
                return true;
            })
    ]
};

// Additional security middleware for user operations
export const userSecurityMiddleware = [
    securityHeaders,
    (req: Request, res: Response, next: NextFunction) => {
        console.log(`[${new Date().toISOString()}] User operation: ${req.method} ${req.path} from IP: ${req.ip}`);
        next();
    }
];

export default userValidator;