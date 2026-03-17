import { Router } from "express";
import {
    handleGetBillingInfo,
    handleGetSubscriptionPlans,
    handleGetCurrentSubscription,
    handleCreateSubscription,
    handleUpdateSubscription,
    handleCancelSubscription,
    handleGetPaymentMethods,
    handleAddPaymentMethod,
    handleSetDefaultPaymentMethod,
    handleRemovePaymentMethod,
    handleGetInvoices,
    handleDownloadInvoice,
    handleCreateCheckoutSession,
    handleGetUsageStats,
    handleStripeWebhook,
    handleAdminListSubscriptions,
    handleAdminListInvoices,
    handleAdminUpdateSubscription,
} from "../controllers/billingController";
import { isLoggedIn, isAdmin, hasPermission } from "../middleware/auth";
import { Permission } from "../models/interfaces/IUser";
import { runValidation } from "../validator";
import bodyParser from "body-parser";
import rateLimit from "express-rate-limit";
import { rateLimitConfig, validationRules } from "../validator/billingValidator";

const billingRouter = Router();

// Helper function to create rate limit middleware
const createRateLimiter = (config: any) =>
    rateLimit({
        windowMs: config.windowMs,
        max: config.max,
        message: config.message || 'Too many requests, please try again later',
        standardHeaders: config.standardHeaders !== undefined ? config.standardHeaders : true,
        legacyHeaders: config.legacyHeaders !== undefined ? config.legacyHeaders : false,
    });

// Create rate limit middleware instances
const generalLimiter = createRateLimiter(rateLimitConfig.general);
const sensitiveActionLimiter = createRateLimiter(rateLimitConfig.sensitiveAction);
const paymentMethodsLimiter = generalLimiter;
const subscriptionLimiter = sensitiveActionLimiter;
const invoicesLimiter = generalLimiter;

// ==================== STRIPE WEBHOOK (NO VALIDATION) ====================
// Stripe webhook needs raw body for signature verification
billingRouter.post(
    "/stripe-webhook",
    bodyParser.raw({ type: "application/json" }),
    handleStripeWebhook
);

// ==================== PUBLIC ROUTES ====================
// Public route to get subscription plans (no authentication required)
billingRouter.get(
    "/subscription-plans",
    generalLimiter,
    handleGetSubscriptionPlans
);

// ==================== PROTECTED USER ROUTES ====================

// Billing Information
billingRouter.get(
    "/info",
    isLoggedIn,
    generalLimiter,
    handleGetBillingInfo
);

// Subscription Management
billingRouter.get(
    "/subscription",
    isLoggedIn,
    generalLimiter,
    handleGetCurrentSubscription
);

billingRouter.post(
    "/subscription",
    isLoggedIn,
    subscriptionLimiter,
    validationRules.createSubscription,
    runValidation,
    handleCreateSubscription
);

billingRouter.put(
    "/subscription",
    isLoggedIn,
    subscriptionLimiter,
    validationRules.updateSubscription,
    runValidation,
    handleUpdateSubscription
);

billingRouter.delete(
    "/subscription",
    isLoggedIn,
    subscriptionLimiter,
    handleCancelSubscription
);

// Payment Methods
billingRouter.get(
    "/payment-methods",
    isLoggedIn,
    paymentMethodsLimiter,
    handleGetPaymentMethods
);

billingRouter.post(
    "/payment-methods",
    isLoggedIn,
    paymentMethodsLimiter,
    validationRules.addPaymentMethod,
    runValidation,
    handleAddPaymentMethod
);

billingRouter.put(
    "/payment-methods/:paymentMethodId/default",
    isLoggedIn,
    paymentMethodsLimiter,
    validationRules.setDefaultPaymentMethod,
    runValidation,
    handleSetDefaultPaymentMethod
);

billingRouter.delete(
    "/payment-methods/:paymentMethodId",
    isLoggedIn,
    paymentMethodsLimiter,
    validationRules.removePaymentMethod,
    runValidation,
    handleRemovePaymentMethod
);

// Invoices & Billing History
billingRouter.get(
    "/invoices",
    isLoggedIn,
    invoicesLimiter,
    validationRules.getInvoices,
    runValidation,
    handleGetInvoices
);

billingRouter.get(
    "/invoices/:invoiceId/download",
    isLoggedIn,
    invoicesLimiter,
    validationRules.downloadInvoice,
    runValidation,
    handleDownloadInvoice
);

// Checkout Sessions
billingRouter.post(
    "/create-checkout-session",
    isLoggedIn,
    sensitiveActionLimiter,
    validationRules.createCheckoutSession,
    runValidation,
    handleCreateCheckoutSession
);

// Usage Statistics
billingRouter.get(
    "/usage",
    isLoggedIn,
    generalLimiter,
    handleGetUsageStats
);

// ==================== ADMIN ROUTES ====================

// Admin: Get all subscriptions (for admin dashboard)
billingRouter.get(
    "/admin/subscriptions",
    isLoggedIn,
    hasPermission(Permission.BILLING_VIEW),
    generalLimiter,
    validationRules.adminList,
    runValidation,
    handleAdminListSubscriptions
);

// Admin: Get all invoices (for admin dashboard)
billingRouter.get(
    "/admin/invoices",
    isLoggedIn,
    hasPermission(Permission.BILLING_VIEW),
    generalLimiter,
    validationRules.adminList,
    runValidation,
    handleAdminListInvoices
);

// Admin: Update subscription (e.g., apply discount, extend trial)
billingRouter.put(
    "/admin/subscriptions/:subscriptionId",
    isLoggedIn,
    hasPermission(Permission.BILLING_EDIT),
    sensitiveActionLimiter,
    validationRules.adminUpdateSubscription,
    runValidation,
    handleAdminUpdateSubscription
);

// ==================== MISCELLANEOUS ====================

// Health check
billingRouter.get("/health", generalLimiter, (req, res) => {
    res.status(200).json({
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: "Billing Service",
        stripe: process.env.STRIPE_SECRET_KEY ? "configured" : "not configured",
    });
});

export default billingRouter;