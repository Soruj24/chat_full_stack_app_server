// validator/billingValidator.ts
import { body, param, query, ValidationChain } from "express-validator";
import { Types } from "mongoose";

export const rateLimitConfig = {
  general: {
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  },
  sensitiveAction: {
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many sensitive actions attempted, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  },
  paymentMethods: {
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many payment method requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  },
  subscription: {
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many subscription requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  },
  invoices: {
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: 'Too many invoice requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  },
};

export const validationRules = {
  // Subscription validation
  createSubscription: [
    body("planId")
      .notEmpty()
      .withMessage("Plan ID is required")
      .isString()
      .withMessage("Plan ID must be a string")
      .custom((value) => Types.ObjectId.isValid(value))
      .withMessage("Invalid Plan ID format"),
    body("paymentMethodId")
      .optional()
      .isString()
      .withMessage("Payment method ID must be a string")
      .isLength({ min: 5 })
      .withMessage("Invalid payment method ID"),
    body("couponCode")
      .optional()
      .isString()
      .withMessage("Coupon code must be a string")
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage("Coupon code must be between 3 and 50 characters"),
  ],

  updateSubscription: [
    body("planId")
      .notEmpty()
      .withMessage("Plan ID is required")
      .isString()
      .withMessage("Plan ID must be a string")
      .custom((value) => Types.ObjectId.isValid(value))
      .withMessage("Invalid Plan ID format"),
  ],

  // Payment method validation
  addPaymentMethod: [
    body("paymentMethodId")
      .notEmpty()
      .withMessage("Payment method ID is required")
      .isString()
      .withMessage("Payment method ID must be a string")
      .matches(/^(pm|ba)_[a-zA-Z0-9]+$/)
      .withMessage("Invalid payment method ID format"),
    body("type")
      .optional()
      .isString()
      .withMessage("Type must be a string")
      .isIn(["card", "bank_account", "paypal"])
      .withMessage("Invalid payment method type"),
    body("isDefault")
      .optional()
      .isBoolean()
      .withMessage("isDefault must be a boolean"),
  ],

  setDefaultPaymentMethod: [
    param("paymentMethodId")
      .notEmpty()
      .withMessage("Payment method ID is required")
      .isString()
      .withMessage("Payment method ID must be a string")
      .custom((value) => Types.ObjectId.isValid(value))
      .withMessage("Invalid payment method ID format"),
  ],

  removePaymentMethod: [
    param("paymentMethodId")
      .notEmpty()
      .withMessage("Payment method ID is required")
      .isString()
      .withMessage("Payment method ID must be a string")
      .custom((value) => Types.ObjectId.isValid(value))
      .withMessage("Invalid payment method ID format"),
  ],

  // Invoice validation
  getInvoices: [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("status")
      .optional()
      .isString()
      .withMessage("Status must be a string")
      .isIn(["paid", "pending", "failed", "refunded", "draft", "open", "void", "uncollectible"])
      .withMessage("Invalid invoice status"),
    query("startDate")
      .optional()
      .isISO8601()
      .withMessage("Start date must be a valid ISO date"),
    query("endDate")
      .optional()
      .isISO8601()
      .withMessage("End date must be a valid ISO date"),
    query("sortBy")
      .optional()
      .isString()
      .withMessage("Sort by must be a string")
      .isIn(["date", "amount", "status", "invoiceNumber"])
      .withMessage("Invalid sort field"),
    query("sortOrder")
      .optional()
      .isString()
      .withMessage("Sort order must be a string")
      .isIn(["asc", "desc"])
      .withMessage("Sort order must be 'asc' or 'desc'"),
  ],

  downloadInvoice: [
    param("invoiceId")
      .notEmpty()
      .withMessage("Invoice ID is required")
      .isString()
      .withMessage("Invoice ID must be a string")
      .custom((value) => Types.ObjectId.isValid(value))
      .withMessage("Invalid invoice ID format"),
  ],

  // Checkout session validation
  createCheckoutSession: [
    body("planId")
      .notEmpty()
      .withMessage("Plan ID is required")
      .isString()
      .withMessage("Plan ID must be a string")
      .custom((value) => Types.ObjectId.isValid(value))
      .withMessage("Invalid Plan ID format"),
    body("successUrl")
      .optional()
      .isURL()
      .withMessage("Success URL must be a valid URL"),
    body("cancelUrl")
      .optional()
      .isURL()
      .withMessage("Cancel URL must be a valid URL"),
  ],

  // Admin validation rules
  adminList: [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 200 })
      .withMessage("Limit must be between 1 and 200"),
    query("userId")
      .optional()
      .isString()
      .withMessage("User ID must be a string")
      .custom((value) => Types.ObjectId.isValid(value))
      .withMessage("Invalid user ID format"),
    query("status")
      .optional()
      .isString()
      .withMessage("Status must be a string")
      .isIn(["active", "canceled", "past_due", "trialing", "incomplete", "incomplete_expired", "unpaid", "paused"])
      .withMessage("Invalid subscription status"),
  ],

  adminUpdateSubscription: [
    param("subscriptionId")
      .notEmpty()
      .withMessage("Subscription ID is required")
      .isString()
      .withMessage("Subscription ID must be a string")
      .custom((value) => Types.ObjectId.isValid(value))
      .withMessage("Invalid subscription ID format"),
    body("action")
      .notEmpty()
      .withMessage("Action is required")
      .isString()
      .withMessage("Action must be a string")
      .isIn(["extend_trial", "apply_discount", "pause", "resume", "cancel", "reactivate"])
      .withMessage("Invalid admin action"),
    body("value")
      .optional()
      .custom((value, { req }) => {
        const action = req.body.action;
        
        if (action === "extend_trial") {
          return typeof value === "number" && value > 0 && value <= 365;
        }
        
        if (action === "apply_discount") {
          return typeof value === "number" && value >= 0 && value <= 100;
        }
        
        return true;
      })
      .withMessage("Invalid value for the specified action"),
    body("reason")
      .optional()
      .isString()
      .withMessage("Reason must be a string")
      .trim()
      .isLength({ min: 5, max: 500 })
      .withMessage("Reason must be between 5 and 500 characters"),
  ],

  // Keep existing admin user validation rules from authValidator
  adminUpdateUser: [
    param("userId")
      .isMongoId()
      .withMessage("Valid user ID is required"),
    body("firstName")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage("First name must be between 1 and 50 characters"),
    body("lastName")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage("Last name must be between 1 and 50 characters"),
    body("email")
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email address"),
    body("username")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage("Username must be between 3 and 30 characters"),
    body("role")
      .optional()
      .isString()
      .isIn(["user", "admin", "moderator", "super_admin"])
      .withMessage("Role must be one of: user, admin, moderator, super_admin"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean value"),
    body("isBanned")
      .optional()
      .isBoolean()
      .withMessage("isBanned must be a boolean value"),
    body("status")
      .optional()
      .isString()
      .isIn(["active", "inactive", "suspended", "banned", "deleted"])
      .withMessage("Status must be one of: active, inactive, suspended, banned, deleted"),
  ],

  deleteUser: [
    param("userId")
      .isMongoId()
      .withMessage("Valid user ID is required"),
  ],

  // Add any missing validation rules that were in your authValidator
  adminCreateUser: [
    body("username")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage("Username must be between 3 and 30 characters"),
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email address"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
    body("firstName")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage("First name must be between 1 and 50 characters"),
    body("lastName")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage("Last name must be between 1 and 50 characters"),
    body("role")
      .optional()
      .isString()
      .isIn(["user", "admin", "moderator", "super_admin"])
      .withMessage("Role must be one of: user, admin, moderator, super_admin"),
  ],

  updateUserRole: [
    param("userId")
      .isMongoId()
      .withMessage("Valid user ID is required"),
    body("role")
      .notEmpty()
      .withMessage("Role is required")
      .isString()
      .isIn(["user", "admin", "moderator", "super_admin"])
      .withMessage("Role must be one of: user, admin, moderator, super_admin"),
  ],

  sendUserEmail: [
    param("userId")
      .isMongoId()
      .withMessage("Valid user ID is required"),
    body("subject")
      .notEmpty()
      .withMessage("Email subject is required")
      .isString()
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage("Subject must be between 3 and 200 characters"),
    body("message")
      .notEmpty()
      .withMessage("Email message is required")
      .isString()
      .trim()
      .isLength({ min: 10, max: 5000 })
      .withMessage("Message must be between 10 and 5000 characters"),
  ],
};