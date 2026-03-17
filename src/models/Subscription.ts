import mongoose, { Document, Schema, Types } from 'mongoose';
import { ISubscriptionPlan } from '../types/billing.types';

// Combine the subscription plan fields with Mongoose Document, omitting the conflicting `id` field
export type SubscriptionDocument = Document &
  Omit<ISubscriptionPlan, 'id'> & {
    _id: Types.ObjectId;
    trialStart?: Date;
    trialEnd?: Date;
    billingCycleAnchor?: Date;
    id: Types.ObjectId; // ensure Document's `id` matches ObjectId
    userId: Types.ObjectId;
    planId: Types.ObjectId;
    // Subscription period fields
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    // Status and cancellation fields used in virtuals/methods
    status: string;
    cancelAtPeriodEnd?: boolean;
    canceledAt?: Date;
    reactivatedAt?: Date;
    reactivatedBy?: Types.ObjectId;
    // User who cancelled the subscription
    canceledBy?: Types.ObjectId;
    // Cancellation reason (added to match schema)
    cancellationReason?: string;
    // Timestamps
    createdAt: Date;
    updatedAt: Date;
    // Instance method to cancel subscription
    cancel: (reason: string, userId: string) => void; // Add the cancel method
  };

const subscriptionSchema = new Schema<SubscriptionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: [true, 'Plan ID is required'],
    },
    stripeSubscriptionId: {
      type: String,
      required: [true, 'Stripe subscription ID is required'],
      unique: true,
      trim: true,
    },
    stripeCustomerId: {
      type: String,
      required: [true, 'Stripe customer ID is required'],
      trim: true,
    },
    status: {
      type: String,
      required: [true, 'Subscription status is required'],
      enum: [
        'active',
        'canceled',
        'past_due',
        'trialing',
        'incomplete',
        'incomplete_expired',
        'unpaid',
        'paused',
      ],
      default: 'active',
    },
    currentPeriodStart: {
      type: Date,
      required: [true, 'Current period start date is required'],
    },
    currentPeriodEnd: {
      type: Date,
      required: [true, 'Current period end date is required'],
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    canceledAt: {
      type: Date,
    },
    trialStart: {
      type: Date,
    },
    trialEnd: {
      type: Date,
    },
    billingCycleAnchor: {
      type: Date,
    },
    quantity: {
      type: Number,
      default: 1,
      min: [1, 'Quantity must be at least 1'],
    },
    latestInvoiceId: {
      type: String,
      trim: true,
    },
    defaultPaymentMethodId: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    canceledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    reactivatedAt: {
      type: Date,
    },
    reactivatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    // Removed conflicting fields:
    // plan: { type: Schema.Types.ObjectId, ref: 'Plan' }, // REMOVED - use planId instead
    // daysRemaining: { type: Number }, // REMOVED - using virtual instead
    // isActiveSubscription: { type: Boolean }, // REMOVED - using virtual instead
    // isTrialing: { type: Boolean }, // REMOVED - using virtual instead
    // isPastDue: { type: Boolean }, // REMOVED - using virtual instead
    // isCanceled: { type: Boolean }, // REMOVED - using virtual instead
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret._id;
        delete ret.__v;
        delete ret.createdAt;
        delete ret.updatedAt;
        delete ret.metadata;
        delete ret.stripeSubscriptionId;
        delete ret.stripeCustomerId;
        delete ret.canceledBy;
        delete ret.reactivatedBy;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Virtual for subscription duration in days
subscriptionSchema.virtual('durationDays').get(function (this: SubscriptionDocument) {
  return Math.ceil(
    (this.currentPeriodEnd.getTime() - this.currentPeriodStart.getTime()) /
    (1000 * 60 * 60 * 24)
  );
});

// Virtual for days remaining
subscriptionSchema.virtual('daysRemaining').get(function (this: SubscriptionDocument) {
  const now = new Date();
  if (now > this.currentPeriodEnd) return 0;
  return Math.ceil(
    (this.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
});

// Virtual for isTrialing
subscriptionSchema.virtual('isTrialing').get(function (this: SubscriptionDocument) {
  return this.status === 'trialing';
});

// Virtual for isActive
subscriptionSchema.virtual('isActiveSubscription').get(function (this: SubscriptionDocument) {
  return this.status === 'active' || this.status === 'trialing';
});

// Virtual for isPastDue
subscriptionSchema.virtual('isPastDue').get(function (this: SubscriptionDocument) {
  return this.status === 'past_due';
});

// Virtual for isCanceled
subscriptionSchema.virtual('isCanceled').get(function (this: SubscriptionDocument) {
  return this.status === 'canceled';
});

// Virtual for plan (populated)
subscriptionSchema.virtual('plan', {
  ref: 'SubscriptionPlan',
  localField: 'planId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for user (populated)
subscriptionSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

// Indexes
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ stripeSubscriptionId: 1 }, { unique: true });
subscriptionSchema.index({ stripeCustomerId: 1 });
subscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });
subscriptionSchema.index({ cancelAtPeriodEnd: 1, currentPeriodEnd: 1 });
subscriptionSchema.index({ createdAt: -1 });

// Middleware to handle subscription status changes
subscriptionSchema.pre('save', function (next) {
  const now = new Date();

  // If subscription is being canceled, set canceledAt
  if (this.isModified('status') && this.status === 'canceled' && !this.canceledAt) {
    this.canceledAt = now;
  }

  // If subscription is being reactivated, set reactivatedAt
  if (
    this.isModified('status') &&
    (this.status === 'active' || this.status === 'trialing') &&
    this.reactivatedAt === undefined
  ) {
    this.reactivatedAt = now;
  }

  next();
});

// Static method to find active subscription for user
subscriptionSchema.statics.findActiveByUserId = function (userId: string) {
  return this.findOne({
    userId,
    status: { $in: ['active', 'trialing'] },
  });
};

// Static method to find subscriptions expiring soon
subscriptionSchema.statics.findExpiringSoon = function (days: number = 7) {
  const date = new Date();
  date.setDate(date.getDate() + days);

  return this.find({
    status: { $in: ['active', 'trialing'] },
    currentPeriodEnd: { $lte: date },
  });
};

// Instance method to check if subscription is expired
subscriptionSchema.methods.isExpired = function () {
  return new Date() > this.currentPeriodEnd;
};

// Instance method to cancel subscription
subscriptionSchema.methods.cancel = function (reason?: string, canceledBy?: Types.ObjectId) {
  this.status = 'canceled';
  this.cancelAtPeriodEnd = true;
  this.canceledAt = new Date();
  if (reason) this.cancellationReason = reason;
  if (canceledBy) this.canceledBy = canceledBy;
  return this.save();
};

// Instance method to reactivate subscription
subscriptionSchema.methods.reactivate = function (reactivatedBy?: Types.ObjectId) {
  this.status = 'active';
  this.cancelAtPeriodEnd = false;
  this.reactivatedAt = new Date();
  if (reactivatedBy) this.reactivatedBy = reactivatedBy;
  return this.save();
};

// Define the model
const Subscription = mongoose.model<SubscriptionDocument>(
  'Subscription',
  subscriptionSchema
) as mongoose.Model<SubscriptionDocument> & {
  findActiveByUserId: (userId: string) => Promise<SubscriptionDocument | null>;
  findExpiringSoon: (days?: number) => Promise<SubscriptionDocument[]>;
};

export default Subscription;