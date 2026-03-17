export interface ISubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  isPopular?: boolean;
  isActive?: boolean;
  storageLimit?: number;
  apiCallLimit?: number;
  teamMemberLimit?: number;
  stripePriceId?: string;
  stripeProductId?: string;
  trialPeriodDays?: number;
  sortOrder?: number;
  metadata?: Record<string, any>;
  createdBy?: string;
}

export interface IInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded' | 'draft' | 'open' | 'void' | 'uncollectible';
  pdfUrl?: string;
  paymentMethod?: string;
  description?: string;
  periodStart?: string;
  periodEnd?: string;
  dueDate?: string;
  paidAt?: string;
  hostedInvoiceUrl?: string;
  invoicePdf?: string;
  total?: number;
  subtotal?: number;
  tax?: number;
  discount?: number;
  amountDue?: number;
  amountPaid?: number;
  amountRemaining?: number;
  billingReason?: string;
  metadata?: Record<string, any>;
  isFinalized?: boolean;
  finalizedAt?: string;
  emailSent?: boolean;
  emailSentAt?: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'paypal';
  brand?: string;
  last4: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  created: string;
  fingerprint?: string;
  country?: string;
  funding?: 'credit' | 'debit' | 'prepaid' | 'unknown';
  network?: string;
  metadata?: Record<string, any>;
  isActive?: boolean;
  deletedAt?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  stripeSubscriptionId: string;
  current_period_end: string;
  current_period_start: string;
  stripeCustomerId: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete' | 'incomplete_expired' | 'unpaid' | 'paused';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string;
  trialStart?: string;
  trialEnd?: string;
  billingCycleAnchor?: string;
  quantity?: number;
  latestInvoiceId?: string;
  defaultPaymentMethodId?: string;
  metadata?: Record<string, any>;
  isActive?: boolean;
  canceledBy?: string;
  cancellationReason?: string;
  reactivatedAt?: string;
  reactivatedBy?: string;
}

export interface IBillingInfo {
  currentPlan: ISubscriptionPlan;
  nextBillingDate: string;
  billingCycle: string;
  paymentMethod: string;
  storageUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  subscriptionStatus: 'active' | 'canceled' | 'past_due' | 'trialing' | 'inactive';
}

export interface CreateSubscriptionRequest {
  planId: string;
  paymentMethodId?: string;
  couponCode?: string;
}

export interface UpdateSubscriptionRequest {
  planId: string;
}

export interface AddPaymentMethodRequest {
  paymentMethodId: string;
  type: string;
  isDefault?: boolean;
}

export interface UsageStats {
  subscription: {
    planName: string;
    startDate: string;
    endDate: string;
    daysRemaining: number;
  };
  storage: {
    used: number;
    limit: number;
    percentage: number;
  };
  apiCalls: {
    used: number;
    limit: number;
    percentage: number;
  };
  [key: string]: any;
}