import mongoose, { Document, Schema } from 'mongoose'; 

// Define the shape of the data stored in a payment method
export interface PaymentMethodData {
  stripePaymentMethodId: string;
  type: 'card' | 'bank_account' | 'paypal';
  brand?: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault?: boolean;
  fingerprint?: string;
  country?: string;
  funding?: 'credit' | 'debit' | 'prepaid' | 'unknown';
  network?: string;
  metadata?: Record<string, any>;
  isActive?: boolean;
  deletedAt?: Date | null;
}

export interface PaymentMethodDocument extends PaymentMethodData, Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const paymentMethodSchema = new Schema<PaymentMethodDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    stripePaymentMethodId: {
      type: String,
      required: [true, 'Stripe payment method ID is required'],
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'Payment method type is required'],
      enum: ['card', 'bank_account', 'paypal'],
      default: 'card',
    },
    brand: {
      type: String,
      trim: true,
    },
    last4: {
      type: String,
      required: function(this: any) {
        // Use get() to retrieve the string value of the 'type' field
        return this.get('type') === 'card';
      },
      minlength: [4, 'Last 4 digits must be exactly 4 characters'],
      maxlength: [4, 'Last 4 digits must be exactly 4 characters'],
      trim: true,
    },
    expiryMonth: {
      type: Number,
      min: [1, 'Month must be between 1 and 12'],
      max: [12, 'Month must be between 1 and 12'],
      validate: {
        validator: Number.isInteger,
        message: 'Month must be an integer',
      },
    },
    expiryYear: {
      type: Number,
      min: [new Date().getFullYear(), 'Year cannot be in the past'],
      max: [new Date().getFullYear() + 20, 'Year cannot be more than 20 years in the future'],
      validate: {
        validator: Number.isInteger,
        message: 'Year must be an integer',
      },
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    fingerprint: {
      type: String,
      sparse: true,
      unique: true,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    funding: {
      type: String,
      enum: ['credit', 'debit', 'prepaid', 'unknown'],
      default: 'unknown',
    },
    network: {
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
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function(doc, ret) {
        delete ret._id;
        delete ret.__v;
        delete ret.createdAt;
        delete ret.updatedAt;
        delete ret.metadata;
        delete ret.stripePaymentMethodId;
        delete ret.fingerprint;
        delete ret.deletedAt;
        delete ret.isActive;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: function(doc, ret) {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Virtual for formatted card/bank info
paymentMethodSchema.virtual('formattedInfo').get(function(this: PaymentMethodDocument) {
  if (this.type === 'card') {
    return `${this.brand || 'Card'} ****${this.last4}`;
  } else if (this.type === 'bank_account') {
    return `Bank Account ****${this.last4}`;
  } else if (this.type === 'paypal') {
    return 'PayPal';
  }
  return 'Payment Method';
});

// Virtual for expiry date formatted
paymentMethodSchema.virtual('expiryDate').get(function(this: PaymentMethodDocument) {
  if (this.expiryMonth && this.expiryYear) {
    return `${this.expiryMonth.toString().padStart(2, '0')}/${this.expiryYear.toString().slice(-2)}`;
  }
  return null;
});

// Virtual to check if payment method is expired
paymentMethodSchema.virtual('isExpired').get(function(this: PaymentMethodDocument) {
  if (!this.expiryMonth || !this.expiryYear) return false;
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed
  
  return (
    this.expiryYear < currentYear ||
    (this.expiryYear === currentYear && this.expiryMonth < currentMonth)
  );
});

// Virtual for user (populated)
paymentMethodSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

// Indexes
paymentMethodSchema.index({ userId: 1, isDefault: 1 });
paymentMethodSchema.index({ stripePaymentMethodId: 1 }, { unique: true });
paymentMethodSchema.index({ userId: 1, type: 1 });
paymentMethodSchema.index({ fingerprint: 1 }, { unique: true, sparse: true });
paymentMethodSchema.index({ isActive: 1 });
paymentMethodSchema.index({ deletedAt: 1 }, { sparse: true });
paymentMethodSchema.index({ createdAt: -1 });

// Pre-save middleware to ensure only one default payment method per user
paymentMethodSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    try {
      // Remove default status from other payment methods for this user
      await mongoose.model('PaymentMethod').updateMany(
        {
          userId: this.userId,
          _id: { $ne: this._id },
          isDefault: true,
        },
        { $set: { isDefault: false } }
      );
    } catch (error: any) {
      return next(error);
    }
  }
  next();
});

// Pre-save middleware to validate expiry date
paymentMethodSchema.pre('save', function(next) {
  if (this.expiryMonth && this.expiryYear) {
    const now = new Date();
    const expiryDate = new Date(this.expiryYear, this.expiryMonth - 1, 1);
    
    if (expiryDate < now) {
      const error = new mongoose.Error.ValidationError(this as any);
      // expiryMonth error
      error.errors.expiryMonth = new mongoose.Error.ValidatorError('Card has expired');
      (error.errors.expiryMonth as any).type = 'expired';
      (error.errors.expiryMonth as any).path = 'expiryMonth';
      (error.errors.expiryMonth as any).value = this.expiryMonth;
      // expiryYear error
      error.errors.expiryYear = new mongoose.Error.ValidatorError('Card has expired');
      (error.errors.expiryYear as any).type = 'expired';
      (error.errors.expiryYear as any).path = 'expiryYear';
      (error.errors.expiryYear as any).value = this.expiryYear;
      return next(error);
    }
  }
  next();
});

// Static method to find default payment method for user
paymentMethodSchema.statics.findDefaultByUserId = function(userId: string) {
  return this.findOne({
    userId,
    isDefault: true,
    isActive: true,
    deletedAt: null,
  });
};

// Static method to find all active payment methods for user
paymentMethodSchema.statics.findActiveByUserId = function(userId: string) {
  return this.find({
    userId,
    isActive: true,
    deletedAt: null,
  }).sort({ isDefault: -1, createdAt: -1 });
};

// Instance method to soft delete payment method
paymentMethodSchema.methods.softDelete = function() {
  this.isActive = false;
  this.deletedAt = new Date();
  return this.save();
};

// Instance method to restore payment method
paymentMethodSchema.methods.restore = function() {
  this.isActive = true;
  this.deletedAt = null;
  return this.save();
};

const PaymentMethod = mongoose.model<PaymentMethodDocument>(
  'PaymentMethod',
  paymentMethodSchema
);

export default PaymentMethod;