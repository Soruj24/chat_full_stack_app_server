import { Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import createError from "http-errors";

// Config and utilities
import { successResponse } from "./responsControllers";
import { AuthRequest } from "../types";
import User from "../models/schemas/User";
import { asyncHandler } from "../middleware/asyncHandler";

import UserActivity from "../models/UserActivity";
import Subscription from "../models/Subscription"; // Your model with virtuals
import PaymentMethod from "../models/PaymentMethod";
import SubscriptionPlan from "../models/SubscriptionPlan";
import Invoice from "../models/Invoice";
import { STRIPE_SECRET_KEY } from "../secret";

// Import Stripe
const stripe = new Stripe(STRIPE_SECRET_KEY!);

// Helper function to get client IP
const getClientIP = (req: Request): string => {
    return (
        (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
        req.socket.remoteAddress ||
        "unknown"
    );
};

// Helper function to sanitize billing data
const sanitizeBillingData = (data: any) => {
    if (!data) return data;
    const sanitized = { ...data };
    delete sanitized.stripeCustomerId;
    delete sanitized.stripeSubscriptionId;
    delete sanitized.stripePaymentMethodId;
    delete sanitized.metadata?.stripe;
    return sanitized;
};

// Helper function to get or create price ID
const getOrCreatePriceId = async (plan: any): Promise<string> => {
    try {
        // If plan has a Stripe price ID, use it
        if (plan.stripePriceId) {
            return plan.stripePriceId;
        }

        // Check if price exists in Stripe
        const prices = await stripe.prices.list({
            product: (plan as any).stripeProductId,
            recurring: {
                interval: (plan as any).interval,
            },
            active: true,
        });

        if (prices.data.length > 0) {
            return prices.data[0].id;
        }

        // Create new price
        const price = await stripe.prices.create({
            unit_amount: Math.round(plan.price * 100),
            currency: plan.currency.toLowerCase(),
            recurring: {
                interval: plan.interval,
                interval_count: 1,
            },
            product: plan.stripeProductId,
        });

        return price.id;
    } catch (error) {
        console.error("Error getting/creating price ID:", error);
        throw error;
    }
};

// Get billing information
const handleGetBillingInfo = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!._id;

            // Get user with subscription
            const user = await User.findById(userId);
            if (!user) {
                return next(createError(404, "User not found"));
            }

            // Get active subscription with plan populated
            const subscription = await Subscription.findOne({
                userId,
                status: { $in: ["active", "trialing"] },
            }).populate("plan");

            // Get default payment method
            const paymentMethod = await PaymentMethod.findOne({
                userId,
                isDefault: true,
            });

            // Calculate storage usage
            const storageUsage = {
                used: 0, // Calculate based on your storage system
                total: (subscription as any)?.plan?.storageLimit || 0,
                percentage: 0,
            };
            storageUsage.percentage = storageUsage.total
                ? Math.round((storageUsage.used / storageUsage.total) * 100)
                : 0;

            // Get billing info
            const billingInfo = {
                currentPlan: (subscription as any)?.plan || {
                    id: "free",
                    name: "Free Plan",
                    description: "Basic features",
                    price: 0,
                    currency: "USD",
                    interval: "month",
                    features: ["Basic features", "Limited storage", "Community support"],
                    storageLimit: 1024, // 1GB
                },
                nextBillingDate: subscription?.currentPeriodEnd || new Date(),
                billingCycle: (subscription as any)?.plan?.interval === "month" ? "Monthly" : "Yearly",
                paymentMethod: paymentMethod
                    ? `${paymentMethod.brand} ****${paymentMethod.last4}`
                    : "No payment method",
                storageUsage,
                subscriptionStatus: subscription?.status || "inactive",
                daysRemaining: (subscription as any)?.daysRemaining || 0,
                isActive: (subscription as any)?.isActiveSubscription || false,
            };

            // Log activity
            await UserActivity.create({
                userId,
                activityType: "billing_info_viewed",
                description: "Viewed billing information",
                ipAddress: getClientIP(req),
                userAgent: req.get("User-Agent"),
                status: "success",
            });

            return successResponse(res, {
                statusCode: 200,
                message: "Billing information retrieved successfully",
                payload: sanitizeBillingData(billingInfo),
            });
        } catch (error) {
            console.error("Get billing info error:", error);
            return next(createError(500, "Failed to retrieve billing information"));
        }
    }
);

// Get subscription plans
const handleGetSubscriptionPlans = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const plans = await SubscriptionPlan.find({ isActive: true }).sort({
                price: 1,
            });

            if (!plans || plans.length === 0) {
                return next(createError(404, "No subscription plans found"));
            }

            return successResponse(res, {
                statusCode: 200,
                message: "Subscription plans retrieved successfully",
                payload: {
                    plans: plans.map((plan) => sanitizeBillingData(plan.toObject())),
                },
            });
        } catch (error) {
            console.error("Get subscription plans error:", error);
            return next(createError(500, "Failed to retrieve subscription plans"));
        }
    }
);

// Get current subscription
const handleGetCurrentSubscription = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!._id;

            const subscription = await Subscription.findOne({
                userId,
                status: { $in: ["active", "trialing", "past_due"] },
            }).populate("plan");

            if (!subscription) {
                return successResponse(res, {
                    statusCode: 200,
                    message: "No active subscription found",
                    payload: { plan: null },
                });
            }

            const subscriptionObj = subscription.toObject();

            return successResponse(res, {
                statusCode: 200,
                message: "Current subscription retrieved successfully",
                payload: {
                    plan: sanitizeBillingData((subscriptionObj as any).plan),
                    subscription: {
                        ...sanitizeBillingData(subscriptionObj),
                        daysRemaining: (subscription as any).daysRemaining,
                        isActive: (subscription as any).isActiveSubscription,
                        isTrialing: (subscription as any).isTrialing,
                        isPastDue: (subscription as any).isPastDue,
                        isCanceled: (subscription as any).isCanceled,
                    },
                },
            });
        } catch (error) {
            console.error("Get current subscription error:", error);
            return next(createError(500, "Failed to retrieve current subscription"));
        }
    }
);

// Create subscription
const handleCreateSubscription = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!._id;
            const { planId, paymentMethodId, couponCode } = req.body;

            if (!planId) {
                return next(createError(400, "Plan ID is required"));
            }

            // Get user
            const user = await User.findById(userId);
            if (!user) {
                return next(createError(404, "User not found"));
            }

            // Get plan
            const plan = await SubscriptionPlan.findById(planId);
            if (!plan || !plan.isActive) {
                return next(createError(404, "Subscription plan not found"));
            }

            // Check if user already has an active subscription
            const existingSubscription = await Subscription.findOne({
                userId,
                status: { $in: ["active", "trialing"] },
            });

            if (existingSubscription) {
                return next(
                    createError(
                        400,
                        "You already have an active subscription. Please cancel it first or update your current plan."
                    )
                );
            }

            let stripeCustomerId = (user as any).stripeCustomerId;

            // Create Stripe customer if not exists
            if (!stripeCustomerId) {
                const customer = await stripe.customers.create({
                    email: user.email,
                    name: `${user.firstName} ${user.lastName}`.trim(),
                    metadata: {
                        userId: user._id.toString(),
                    },
                });

                stripeCustomerId = customer.id;
                (user as any).stripeCustomerId = stripeCustomerId;
                await user.save();
            }

            // Get or create price ID
            const priceId = await getOrCreatePriceId(plan);

            // Create Stripe subscription
            const subscriptionData: Stripe.SubscriptionCreateParams = {
                customer: stripeCustomerId,
                items: [{ price: priceId }],
                payment_behavior: "default_incomplete",
                expand: ["latest_invoice.payment_intent"],
            };

            if (couponCode) {
                subscriptionData.discounts = [{ coupon: couponCode }];
            }

            if (paymentMethodId) {
                subscriptionData.default_payment_method = paymentMethodId;
            }

            const stripeSubscription = await stripe.subscriptions.create(subscriptionData);

            // Create subscription in database using your model
            const subscription = await Subscription.create({
                userId,
                planId: plan._id,
                stripeSubscriptionId: stripeSubscription.id,
                stripeCustomerId,
                status: stripeSubscription.status,
                currentPeriodStart: new Date(((stripeSubscription as any).current_period_start as number) * 1000),
                currentPeriodEnd: new Date(((stripeSubscription as any).current_period_end as number) * 1000),
                cancelAtPeriodEnd: (stripeSubscription as any).cancel_at_period_end,
                trialStart: (stripeSubscription as any).trial_start ? new Date((stripeSubscription as any).trial_start * 1000) : undefined,
                trialEnd: (stripeSubscription as any).trial_end ? new Date((stripeSubscription as any).trial_end * 1000) : undefined,
                quantity: 1,
                metadata: {
                    stripe: stripeSubscription,
                    createdAt: new Date(),
                },
            });

            // Log activity
            await UserActivity.create({
                userId,
                activityType: "subscription_created",
                description: `Created subscription to ${plan.name}`,
                ipAddress: getClientIP(req),
                userAgent: req.get("User-Agent"),
                metadata: {
                    planId: plan._id,
                    planName: plan.name,
                    stripeSubscriptionId: stripeSubscription.id,
                    amount: plan.price,
                    currency: plan.currency,
                },
                status: "success",
            });

            // Populate plan for response
            const populatedSubscription = await Subscription.findById(subscription._id).populate("plan");

            return successResponse(res, {
                statusCode: 201,
                message: "Subscription created successfully",
                payload: {
                    subscription: sanitizeBillingData(populatedSubscription?.toObject()),
                    clientSecret: (stripeSubscription.latest_invoice as Stripe.Invoice & {
                        payment_intent?: Stripe.PaymentIntent | null;
                    })?.payment_intent?.client_secret,
                    requiresPayment: stripeSubscription.status === "incomplete",
                },
            });
        } catch (error: any) {
            console.error("Create subscription error:", error);

            // Handle Stripe errors
            if (error.type === "StripeInvalidRequestError") {
                return next(createError(400, error.message));
            }

            return next(createError(500, "Failed to create subscription"));
        }
    }
);

// Update subscription (change plan)
const handleUpdateSubscription = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!._id;
            const { planId } = req.body;

            if (!planId) {
                return next(createError(400, "Plan ID is required"));
            }

            // Get current subscription
            const subscription = await Subscription.findOne({
                userId,
                status: "active",
            });

            if (!subscription || !(subscription as any).stripeSubscriptionId) {
                return next(createError(404, "No active subscription found"));
            }

            // Get new plan
            const newPlan = await SubscriptionPlan.findById(planId);
            if (!newPlan || !newPlan.isActive) {
                return next(createError(404, "Subscription plan not found"));
            }

            // Check if it's the same plan
            if (subscription.planId?.toString() === planId) {
                return next(createError(400, "You are already on this plan"));
            }

            // Update Stripe subscription
            const stripeSubscription = await stripe.subscriptions.retrieve(
                (subscription as any).stripeSubscriptionId
            );

            // Get current item ID
            const currentItemId = stripeSubscription.items.data[0].id;

            // Get or create new price ID
            const newPriceId = await getOrCreatePriceId(newPlan);

            // Update subscription in Stripe
            const updatedSubscription = await stripe.subscriptions.update(
                (subscription as any).stripeSubscriptionId,
                {
                    items: [
                        {
                            id: currentItemId,
                            price: newPriceId,
                        },
                    ],
                    proration_behavior: "create_prorations",
                }
            );

            // Update subscription in database
            subscription.planId = newPlan._id;
            subscription.status = updatedSubscription.status;
            subscription.currentPeriodStart = new Date(((updatedSubscription as any).current_period_start as number) * 1000);
            subscription.currentPeriodEnd = new Date(((updatedSubscription as any).current_period_end as number) * 1000);
            await subscription.save();

            // Create invoice for proration if needed
            if (updatedSubscription.latest_invoice) {
                const latestInvoice = updatedSubscription.latest_invoice as Stripe.Invoice;
                await Invoice.create({
                    userId,
                    subscriptionId: subscription._id,
                    stripeInvoiceId: latestInvoice.id,
                    amount: latestInvoice.amount_due ? latestInvoice.amount_due / 100 : 0,
                    currency: latestInvoice.currency,
                    status: latestInvoice.status,
                    invoiceNumber: latestInvoice.number,
                    date: new Date(latestInvoice.created * 1000),
                    periodStart: new Date((latestInvoice.period_start as number) * 1000),
                    periodEnd: new Date((latestInvoice.period_end as number) * 1000),
                });
            }

            // Log activity
            await UserActivity.create({
                userId,
                activityType: "subscription_updated",
                description: `Updated subscription to ${newPlan.name}`,
                ipAddress: getClientIP(req),
                userAgent: req.get("User-Agent"),
                metadata: {
                    oldPlanId: subscription.planId,
                    newPlanId: newPlan._id,
                    newPlanName: newPlan.name,
                    stripeSubscriptionId: (subscription as any).stripeSubscriptionId,
                },
                status: "success",
            });

            // Populate the updated subscription
            const updatedSub = await Subscription.findById(subscription._id).populate("plan");

            return successResponse(res, {
                statusCode: 200,
                message: "Subscription updated successfully",
                payload: {
                    subscription: sanitizeBillingData(updatedSub?.toObject()),
                    plan: sanitizeBillingData(newPlan.toObject()),
                },
            });
        } catch (error: any) {
            console.error("Update subscription error:", error);

            if (error.type === "StripeInvalidRequestError") {
                return next(createError(400, error.message));
            }

            return next(createError(500, "Failed to update subscription"));
        }
    }
);

// Cancel subscription
const handleCancelSubscription = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!._id;
            const { cancelAtPeriodEnd = true, reason } = req.body;

            // Get current subscription
            const subscription = await Subscription.findOne({
                userId,
                status: "active",
            });

            if (!subscription || !(subscription as any).stripeSubscriptionId) {
                return next(createError(404, "No active subscription found"));
            }

            if (cancelAtPeriodEnd) {
                // Cancel at period end
                const updatedSubscription = await stripe.subscriptions.update(
                    (subscription as any).stripeSubscriptionId,
                    {
                        cancel_at_period_end: true,
                    }
                );

                // Update subscription in database
                subscription.cancelAtPeriodEnd = true;
                await subscription.save();

                // Log activity
                await UserActivity.create({
                    userId,
                    activityType: "subscription_canceled_at_period_end",
                    description: "Subscription scheduled for cancellation at period end",
                    ipAddress: getClientIP(req),
                    userAgent: req.get("User-Agent"),
                    metadata: {
                        subscriptionId: subscription._id,
                        stripeSubscriptionId: (subscription as any).stripeSubscriptionId,
                        reason,
                    },
                    status: "success",
                });

                return successResponse(res, {
                    statusCode: 200,
                    message: "Subscription will be canceled at the end of the billing period",
                    payload: {
                        subscription: sanitizeBillingData(subscription.toObject()),
                        cancelAtPeriodEnd: true,
                    },
                });
            } else {
                // Cancel immediately using your model's cancel method
                await subscription.cancel(reason, userId.toString());

                // Cancel in Stripe
                await stripe.subscriptions.cancel((subscription as any).stripeSubscriptionId);

                // Log activity
                await UserActivity.create({
                    userId,
                    activityType: "subscription_canceled_immediately",
                    description: "Subscription canceled immediately",
                    ipAddress: getClientIP(req),
                    userAgent: req.get("User-Agent"),
                    metadata: {
                        subscriptionId: subscription._id,
                        stripeSubscriptionId: (subscription as any).stripeSubscriptionId,
                        reason,
                    },
                    status: "success",
                });

                return successResponse(res, {
                    statusCode: 200,
                    message: "Subscription canceled immediately",
                    payload: {
                        subscription: sanitizeBillingData(subscription.toObject()),
                        cancelAtPeriodEnd: false,
                    },
                });
            }
        } catch (error: any) {
            console.error("Cancel subscription error:", error);

            if (error.type === "StripeInvalidRequestError") {
                return next(createError(400, error.message));
            }

            return next(createError(500, "Failed to cancel subscription"));
        }
    }
);

// Get payment methods
const handleGetPaymentMethods = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!._id;

            const paymentMethods = await PaymentMethod.find({ userId }).sort({
                isDefault: -1,
                createdAt: -1,
            });

            return successResponse(res, {
                statusCode: 200,
                message: "Payment methods retrieved successfully",
                payload: {
                    paymentMethods: paymentMethods.map((method) =>
                        sanitizeBillingData(method.toObject())
                    ),
                },
            });
        } catch (error) {
            console.error("Get payment methods error:", error);
            return next(createError(500, "Failed to retrieve payment methods"));
        }
    }
);

// Add payment method
const handleAddPaymentMethod = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!._id;
            const { paymentMethodId, type = "card", isDefault = false } = req.body;

            if (!paymentMethodId) {
                return next(createError(400, "Payment method ID is required"));
            }

            // Get user
            const user = await User.findById(userId);
            if (!user) {
                return next(createError(404, "User not found"));
            }

            let stripeCustomerId = (user as any).stripeCustomerId;

            // Create Stripe customer if not exists
            if (!stripeCustomerId) {
                const customer = await stripe.customers.create({
                    email: user.email,
                    name: `${user.firstName} ${user.lastName}`.trim(),
                    metadata: {
                        userId: user._id.toString(),
                    },
                });

                stripeCustomerId = customer.id;
                (user as any).stripeCustomerId = stripeCustomerId;
                await user.save();
            }

            // Attach payment method to customer
            const attachedPaymentMethod = await stripe.paymentMethods.attach(
                paymentMethodId,
                { customer: stripeCustomerId }
            );

            // Set as default if requested
            if (isDefault) {
                await stripe.customers.update(stripeCustomerId, {
                    invoice_settings: {
                        default_payment_method: paymentMethodId,
                    },
                });

                // Update other payment methods to not default
                await PaymentMethod.updateMany(
                    { userId, isDefault: true },
                    { isDefault: false }
                );
            }

            // Create payment method in database
            const paymentMethod = await PaymentMethod.create({
                userId,
                stripePaymentMethodId: attachedPaymentMethod.id,
                type: attachedPaymentMethod.type,
                brand: (attachedPaymentMethod as any).card?.brand,
                last4: (attachedPaymentMethod as any).card?.last4,
                expiryMonth: (attachedPaymentMethod as any).card?.exp_month,
                expiryYear: (attachedPaymentMethod as any).card?.exp_year,
                isDefault,
                metadata: {
                    stripe: attachedPaymentMethod,
                    attachedAt: new Date(),
                },
            });

            // Log activity
            await UserActivity.create({
                userId,
                activityType: "payment_method_added",
                description: `Added ${(attachedPaymentMethod as any).card?.brand || type} payment method`,
                ipAddress: getClientIP(req),
                userAgent: req.get("User-Agent"),
                metadata: {
                    paymentMethodId: paymentMethod._id,
                    type: attachedPaymentMethod.type,
                    brand: (attachedPaymentMethod as any).card?.brand,
                    last4: (attachedPaymentMethod as any).card?.last4,
                    isDefault,
                },
                status: "success",
            });

            return successResponse(res, {
                statusCode: 201,
                message: "Payment method added successfully",
                payload: {
                    paymentMethod: sanitizeBillingData(paymentMethod.toObject()),
                },
            });
        } catch (error: any) {
            console.error("Add payment method error:", error);

            if (error.type === "StripeInvalidRequestError") {
                return next(createError(400, error.message));
            }

            return next(createError(500, "Failed to add payment method"));
        }
    }
);

// Set default payment method
const handleSetDefaultPaymentMethod = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!._id;
            const { paymentMethodId } = req.params;

            if (!paymentMethodId) {
                return next(createError(400, "Payment method ID is required"));
            }

            // Get payment method
            const paymentMethod = await PaymentMethod.findOne({
                _id: paymentMethodId,
                userId,
            });

            if (!paymentMethod) {
                return next(createError(404, "Payment method not found"));
            }

            // Get user
            const user = await User.findById(userId);
            if (!user || !(user as any).stripeCustomerId) {
                return next(createError(404, "Stripe customer not found"));
            }

            // Update in Stripe
            await stripe.customers.update((user as any).stripeCustomerId, {
                invoice_settings: {
                    default_payment_method: paymentMethod.stripePaymentMethodId,
                },
            });

            // Update in database
            await PaymentMethod.updateMany(
                { userId, isDefault: true },
                { isDefault: false }
            );

            paymentMethod.isDefault = true;
            paymentMethod.updatedAt = new Date();
            await paymentMethod.save();

            // Log activity
            await UserActivity.create({
                userId,
                activityType: "payment_method_default_changed",
                description: "Set default payment method",
                ipAddress: getClientIP(req),
                userAgent: req.get("User-Agent"),
                metadata: {
                    paymentMethodId: paymentMethod._id,
                    brand: paymentMethod.brand,
                    last4: paymentMethod.last4,
                },
                status: "success",
            });

            return successResponse(res, {
                statusCode: 200,
                message: "Default payment method updated successfully",
                payload: {
                    paymentMethod: sanitizeBillingData(paymentMethod.toObject()),
                },
            });
        } catch (error: any) {
            console.error("Set default payment method error:", error);

            if (error.type === "StripeInvalidRequestError") {
                return next(createError(400, error.message));
            }

            return next(createError(500, "Failed to update default payment method"));
        }
    }
);

// Remove payment method
const handleRemovePaymentMethod = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!._id;
            const { paymentMethodId } = req.params;

            if (!paymentMethodId) {
                return next(createError(400, "Payment method ID is required"));
            }

            // Get payment method
            const paymentMethod = await PaymentMethod.findOne({
                _id: paymentMethodId,
                userId,
            });

            if (!paymentMethod) {
                return next(createError(404, "Payment method not found"));
            }

            // Check if it's the default payment method
            if (paymentMethod.isDefault) {
                return next(
                    createError(400, "Cannot remove default payment method. Set another as default first.")
                );
            }

            // Get user
            const user = await User.findById(userId);
            if (!user || !(user as any).stripeCustomerId) {
                return next(createError(404, "Stripe customer not found"));
            }

            // Detach from Stripe
            try {
                await stripe.paymentMethods.detach(paymentMethod.stripePaymentMethodId);
            } catch (error: any) {
                // If already detached, continue
                if (error.code !== "resource_missing") {
                    throw error;
                }
            }

            // Remove from database
            await PaymentMethod.findByIdAndDelete(paymentMethodId);

            // Log activity
            await UserActivity.create({
                userId,
                activityType: "payment_method_removed",
                description: "Removed payment method",
                ipAddress: getClientIP(req),
                userAgent: req.get("User-Agent"),
                metadata: {
                    paymentMethodId: paymentMethod._id,
                    brand: paymentMethod.brand,
                    last4: paymentMethod.last4,
                },
                status: "success",
            });

            return successResponse(res, {
                statusCode: 200,
                message: "Payment method removed successfully",
            });
        } catch (error: any) {
            console.error("Remove payment method error:", error);

            if (error.type === "StripeInvalidRequestError") {
                return next(createError(400, error.message));
            }

            return next(createError(500, "Failed to remove payment method"));
        }
    }
);

// Get invoices
const handleGetInvoices = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!._id;
            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 10;

            const invoices = await Invoice.find({ userId })
                .sort({ date: -1 })
                .limit(limit)
                .skip((page - 1) * limit);

            const totalInvoices = await Invoice.countDocuments({ userId });

            return successResponse(res, {
                statusCode: 200,
                message: "Invoices retrieved successfully",
                payload: {
                    invoices: invoices.map((invoice) =>
                        sanitizeBillingData(invoice.toObject())
                    ),
                    pagination: {
                        totalInvoices,
                        totalPages: Math.ceil(totalInvoices / limit),
                        currentPage: page,
                        previousPage: page - 1 > 0 ? page - 1 : null,
                        nextPage:
                            page + 1 <= Math.ceil(totalInvoices / limit) ? page + 1 : null,
                    },
                },
            });
        } catch (error) {
            console.error("Get invoices error:", error);
            return next(createError(500, "Failed to retrieve invoices"));
        }
    }
);

// Download invoice
const handleDownloadInvoice = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!._id;
            const { invoiceId } = req.params;

            // Get invoice
            const invoice = await Invoice.findOne({ _id: invoiceId, userId });
            if (!invoice) {
                return next(createError(404, "Invoice not found"));
            }

            // Download from Stripe
            if ((invoice as any).stripeInvoiceId) {
                const stripeInvoice = await stripe.invoices.retrieve(
                    (invoice as any).stripeInvoiceId
                );

                if (stripeInvoice.invoice_pdf) {
                    // Redirect to Stripe's PDF
                    return res.redirect(stripeInvoice.invoice_pdf);
                }
            }

            // Generate PDF locally if not available from Stripe
            return next(createError(404, "Invoice PDF not available"));
        } catch (error: any) {
            console.error("Download invoice error:", error);

            if (error.type === "StripeInvalidRequestError") {
                return next(createError(400, error.message));
            }

            return next(createError(500, "Failed to download invoice"));
        }
    }
);

// Create checkout session (for Stripe)
const handleCreateCheckoutSession = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!._id;
            const { planId } = req.body;

            if (!planId) {
                return next(createError(400, "Plan ID is required"));
            }

            // Get plan
            const plan = await SubscriptionPlan.findById(planId);
            if (!plan || !plan.isActive) {
                return next(createError(404, "Subscription plan not found"));
            }

            // Get user
            const user = await User.findById(userId);
            if (!user) {
                return next(createError(404, "User not found"));
            }

            let stripeCustomerId = (user as any).stripeCustomerId;

            // Create Stripe customer if not exists
            if (!stripeCustomerId) {
                const customer = await stripe.customers.create({
                    email: user.email,
                    name: `${user.firstName} ${user.lastName}`.trim(),
                    metadata: {
                        userId: user._id.toString(),
                    },
                });

                stripeCustomerId = customer.id;
                (user as any).stripeCustomerId = stripeCustomerId;
                await user.save();
            }

            // Create checkout session
            const session = await stripe.checkout.sessions.create({
                customer: stripeCustomerId,
                payment_method_types: ["card"],
                line_items: [
                    {
                        price_data: {
                            currency: plan.currency.toLowerCase(),
                            unit_amount: Math.round(plan.price * 100),
                            recurring: {
                                interval: plan.interval,
                                interval_count: 1,
                            },
                            product_data: {
                                name: plan.name,
                                description: plan.description,
                            },
                        },
                        quantity: 1,
                    },
                ],
                mode: "subscription",
                success_url: `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.FRONTEND_URL}/billing/cancel`,
                metadata: {
                    userId: userId.toString(),
                    planId: planId,
                },
            });

            // Log activity
            await UserActivity.create({
                userId,
                activityType: "checkout_session_created",
                description: "Created checkout session for subscription",
                ipAddress: getClientIP(req),
                userAgent: req.get("User-Agent"),
                metadata: {
                    planId,
                    planName: plan.name,
                    sessionId: session.id,
                },
                status: "success",
            });

            return successResponse(res, {
                statusCode: 200,
                message: "Checkout session created successfully",
                payload: {
                    sessionId: session.id,
                    url: session.url,
                },
            });
        } catch (error: any) {
            console.error("Create checkout session error:", error);

            if (error.type === "StripeInvalidRequestError") {
                return next(createError(400, error.message));
            }

            return next(createError(500, "Failed to create checkout session"));
        }
    }
);

// Get usage statistics
const handleGetUsageStats = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!._id;

            // Get current subscription
            const subscription = await Subscription.findOne({
                userId,
                status: { $in: ["active", "trialing"] },
            }).populate("plan");

            if (!subscription) {
                return successResponse(res, {
                    statusCode: 200,
                    message: "No active subscription found",
                    payload: {
                        hasSubscription: false,
                    },
                });
            }

            const plan = (subscription as any).plan as any;

            // Calculate usage based on your business logic
            const usageStats = {
                subscription: {
                    planName: plan?.name,
                    startDate: subscription.currentPeriodStart,
                    endDate: (subscription as any).currentPeriodEnd,
                    daysRemaining: (subscription as any).daysRemaining,
                    isTrialing: (subscription as any).isTrialing,
                },
                storage: {
                    used: 0, // Implement storage calculation
                    limit: plan?.storageLimit || 0,
                    percentage: 0,
                },
                apiCalls: {
                    used: 0, // Implement API call tracking
                    limit: plan?.apiCallLimit || 0,
                    percentage: 0,
                },
                // Add more usage metrics as needed
            };

            // Calculate percentages
            if (usageStats.storage.limit > 0) {
                usageStats.storage.percentage = Math.round((usageStats.storage.used / usageStats.storage.limit) * 100);
            }

            if (usageStats.apiCalls.limit > 0) {
                usageStats.apiCalls.percentage = Math.round((usageStats.apiCalls.used / usageStats.apiCalls.limit) * 100);
            }

            return successResponse(res, {
                statusCode: 200,
                message: "Usage statistics retrieved successfully",
                payload: usageStats,
            });
        } catch (error) {
            console.error("Get usage stats error:", error);
            return next(createError(500, "Failed to retrieve usage statistics"));
        }
    }
);

// Stripe webhook handler
const handleStripeWebhook = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const sig = req.headers["stripe-signature"] as string;
            const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

            let event: Stripe.Event;

            try {
                event = stripe.webhooks.constructEvent(
                    req.body,
                    sig,
                    endpointSecret
                );
            } catch (err: any) {
                console.error("Webhook signature verification failed:", err.message);
                return next(createError(400, `Webhook Error: ${err.message}`));
            }

            // Handle the event
            switch (event.type) {
                case "customer.subscription.created":
                case "customer.subscription.updated":
                case "customer.subscription.deleted":
                    await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
                    break;

                case "invoice.paid":
                    await handleInvoicePaid(event.data.object as Stripe.Invoice);
                    break;

                case "invoice.payment_failed":
                    await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
                    break;

                case "payment_method.attached":
                    await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
                    break;

                case "payment_method.detached":
                    await handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod);
                    break;

                default:
                    console.log(`Unhandled event type ${event.type}`);
            }

            res.status(200).send({ received: true });
        } catch (error) {
            console.error("Stripe webhook error:", error);
            return next(createError(500, "Webhook handler failed"));
        }
    }
);

// Helper functions for webhook handling
const handleSubscriptionEvent = async (subscription: Stripe.Subscription) => {
    try {
        const customerId = subscription.customer as string;

        // Find user by Stripe customer ID
        const user = await User.findOne({ stripeCustomerId: customerId });
        if (!user) {
            console.error("User not found for customer:", customerId);
            return;
        }

        // Find or create subscription in database
        const existingSubscription = await Subscription.findOne({
            stripeSubscriptionId: subscription.id,
        });

        if (existingSubscription) {
            // Update existing subscription
            existingSubscription.status = subscription.status;
            existingSubscription.currentPeriodStart = new Date(((subscription as any).current_period_start as number) * 1000);
            existingSubscription.currentPeriodEnd = new Date(((subscription as any).current_period_end as number) * 1000);
            existingSubscription.cancelAtPeriodEnd = subscription.cancel_at_period_end;
            existingSubscription.trialStart = subscription.trial_start ? new Date(subscription.trial_start * 1000) : undefined;
            existingSubscription.trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined;
            await existingSubscription.save();
        } else {
            // Create new subscription
            await Subscription.create({
                userId: user._id,
                stripeSubscriptionId: subscription.id,
                stripeCustomerId: customerId,
                status: subscription.status,
                currentPeriodStart: new Date(((subscription as any).current_period_start as number) * 1000),
                currentPeriodEnd: new Date(((subscription as any).current_period_end as number) * 1000),
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
                trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : undefined,
                trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
                metadata: {
                    stripe: subscription,
                    createdAt: new Date(),
                },
            });
        }

        console.log(`Subscription ${subscription.id} handled for user ${user._id}`);
    } catch (error) {
        console.error("Error handling subscription event:", error);
    }
};

const handleInvoicePaid = async (invoice: Stripe.Invoice) => {
    try {
        const customerId = invoice.customer as string;

        // Find user by Stripe customer ID
        const user = await User.findOne({ stripeCustomerId: customerId });
        if (!user) {
            console.error("User not found for customer:", customerId);
            return;
        }

        // Create invoice record
        await Invoice.create({
            userId: user._id,
            stripeInvoiceId: invoice.id,
            amount: invoice.amount_paid ? invoice.amount_paid / 100 : 0,
            currency: invoice.currency,
            status: invoice.status,
            invoiceNumber: invoice.number,
            date: new Date(invoice.created * 1000),
            periodStart: new Date((invoice.period_start as number) * 1000),
            periodEnd: new Date((invoice.period_end as number) * 1000),
            pdfUrl: invoice.invoice_pdf,
        });

        console.log(`Invoice ${invoice.id} paid for user ${user._id}`);
    } catch (error) {
        console.error("Error handling invoice paid event:", error);
    }
};

const handleInvoicePaymentFailed = async (invoice: Stripe.Invoice) => {
    try {
        const customerId = invoice.customer as string;

        // Find user by Stripe customer ID
        const user = await User.findOne({ stripeCustomerId: customerId });
        if (!user) {
            console.error("User not found for customer:", customerId);
            return;
        }

        // Update subscription status
        await Subscription.findOneAndUpdate(
            { stripeCustomerId: customerId },
            { status: "past_due" }
        );

        // Create failed invoice record
        await Invoice.create({
            userId: user._id,
            stripeInvoiceId: invoice.id,
            amount: invoice.amount_due ? invoice.amount_due / 100 : 0,
            currency: invoice.currency,
            status: "failed",
            invoiceNumber: invoice.number,
            date: new Date(invoice.created * 1000),
            periodStart: new Date((invoice.period_start as number) * 1000),
            periodEnd: new Date((invoice.period_end as number) * 1000),
        });

        console.log(`Invoice ${invoice.id} payment failed for user ${user._id}`);
    } catch (error) {
        console.error("Error handling invoice payment failed event:", error);
    }
};

const handlePaymentMethodAttached = async (paymentMethod: Stripe.PaymentMethod) => {
    // Optional: Sync payment methods to database
    console.log(`Payment method ${paymentMethod.id} attached`);
};

const handlePaymentMethodDetached = async (paymentMethod: Stripe.PaymentMethod) => {
    try {
        // Remove from database
        await PaymentMethod.findOneAndDelete({
            stripePaymentMethodId: paymentMethod.id,
        });

        console.log(`Payment method ${paymentMethod.id} detached and removed`);
    } catch (error) {
        console.error("Error handling payment method detached event:", error);
    }
};

// Admin: Get all subscriptions
const handleAdminListSubscriptions = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 20;
            const status = req.query.status;

            const query: any = {};
            if (status) {
                query.status = status;
            }

            const subscriptions = await Subscription.find(query)
                .populate("userId", "firstName lastName email")
                .populate("plan")
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip((page - 1) * limit);

            const totalSubscriptions = await Subscription.countDocuments(query);

            return successResponse(res, {
                statusCode: 200,
                message: "All subscriptions retrieved successfully",
                payload: {
                    subscriptions,
                    pagination: {
                        totalSubscriptions,
                        totalPages: Math.ceil(totalSubscriptions / limit),
                        currentPage: page,
                    },
                },
            });
        } catch (error) {
            console.error("Admin list subscriptions error:", error);
            return next(createError(500, "Failed to retrieve subscriptions"));
        }
    }
);

// Admin: Get all invoices
const handleAdminListInvoices = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 20;
            const status = req.query.status;

            const query: any = {};
            if (status) {
                query.status = status;
            }

            const invoices = await Invoice.find(query)
                .populate("userId", "firstName lastName email")
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip((page - 1) * limit);

            const totalInvoices = await Invoice.countDocuments(query);

            return successResponse(res, {
                statusCode: 200,
                message: "All invoices retrieved successfully",
                payload: {
                    invoices,
                    pagination: {
                        totalInvoices,
                        totalPages: Math.ceil(totalInvoices / limit),
                        currentPage: page,
                    },
                },
            });
        } catch (error) {
            console.error("Admin list invoices error:", error);
            return next(createError(500, "Failed to retrieve invoices"));
        }
    }
);

// Admin: Update user subscription
const handleAdminUpdateSubscription = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { subscriptionId } = req.params;
            const updates = req.body;

            const subscription = await Subscription.findById(subscriptionId);
            if (!subscription) {
                return next(createError(404, "Subscription not found"));
            }

            // Apply updates (e.g., status, trial end, etc.)
            const allowedUpdates = ["status", "trialEnd", "cancelAtPeriodEnd"];
            allowedUpdates.forEach((field) => {
                if (updates[field] !== undefined) {
                    (subscription as any)[field] = updates[field];
                }
            });

            await subscription.save();

            // Log activity
            await UserActivity.create({
                userId: req.user!._id,
                activityType: "admin_subscription_updated",
                description: `Updated subscription ${subscriptionId}`,
                ipAddress: getClientIP(req),
                userAgent: req.get("User-Agent"),
                metadata: {
                    targetSubscriptionId: subscriptionId,
                    updates,
                },
                status: "success",
            });

            return successResponse(res, {
                statusCode: 200,
                message: "Subscription updated successfully",
                payload: { subscription },
            });
        } catch (error) {
            console.error("Admin update subscription error:", error);
            return next(createError(500, "Failed to update subscription"));
        }
    }
);

// Export all billing controller functions
export {
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
};