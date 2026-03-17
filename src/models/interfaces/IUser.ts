import { Types } from "mongoose";

export enum UserStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  PENDING = "pending",
  SUSPENDED = "suspended",
  DELETED = "deleted",
}

export enum UserRole {
  USER = "user",
  MODERATOR = "moderator",
  ADMIN = "admin",
  SUPER_ADMIN = "super_admin",
  PREMIUM = "premium",
}

export enum Theme {
  LIGHT = "light",
  DARK = "dark",
  AUTO = "auto",
}

export enum Gender {
  MALE = "male",
  FEMALE = "female",
  OTHER = "other",
  PREFER_NOT_TO_SAY = "prefer-not-to-say",
}

export enum AddressType {
  HOME = "home",
  WORK = "work",
  BILLING = "billing",
  SHIPPING = "shipping",
  OTHER = "other",
}

export enum Permission {
  // User Management
  USERS_VIEW = "users:view",
  USERS_CREATE = "users:create",
  USERS_EDIT = "users:edit",
  USERS_DELETE = "users:delete",
  
  // Role Management
  ROLES_VIEW = "roles:view",
  ROLES_EDIT = "roles:edit",
  
  // Content Management
  CONTENT_VIEW = "content:view",
  CONTENT_CREATE = "content:create",
  CONTENT_EDIT = "content:edit",
  CONTENT_DELETE = "content:delete",
  
  // System Management
  SYSTEM_VIEW = "system:view",
  SYSTEM_SETTINGS = "system:settings",
  ANALYTICS_VIEW = "analytics:view",
  TICKETS_VIEW = "tickets:view",
  TICKETS_EDIT = "tickets:edit",
  BILLING_VIEW = "billing:view",
  BILLING_EDIT = "billing:edit",
}

export enum ProfileVisibility {
  PUBLIC = "public",
  FRIENDS = "friends",
  PRIVATE = "private",
}

export interface ILoginHistory {
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  deviceInfo: string;
  location?: string;
  loginMethod?: "password" | "2fa" | "social" | "magic-link";
  success: boolean;
  failureReason?: string;
}

export interface ITwoFactorAuth {
  enabled: boolean;
  secret?: string;
  backupCodes?: string[];
  enabledAt?: Date;
  lastUsed?: Date;
  // method: "totp" | "sms" | "email";
  recoveryCodesUsed?: number;
}

export interface IAddress {
  type: AddressType;
  street: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  isDefault: boolean;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  verified?: boolean;
}

export interface IAvatar {
  url: string;
  publicId: string;
  thumbnailUrl?: string;
  originalName?: string;
  size?: number;
  mimeType?: string;
  uploadedAt?: Date;
}

export interface INotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  marketing: boolean;
  security: boolean;
  social: boolean;
  system: boolean;
}

export interface IPrivacySettings {
  profileVisibility: ProfileVisibility;
  showEmail: boolean;
  showPhone: boolean;
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  allowFriendRequests: boolean;
  allowDirectMessages: boolean;
  searchable: boolean;
}

export interface ISecuritySettings {
  requireTwoFactorForPasswordChange: boolean;
  requireTwoFactorForEmailChange: boolean;
  sessionTimeout: number;
  allowMultipleSessions: boolean;
  ipWhitelist?: string[];
  suspiciousActivityAlerts: boolean;
}

export interface IPreferences {
  notifications: INotificationPreferences;
  privacy: IPrivacySettings;
  security: ISecuritySettings;
  language: string;
  currency: string;
  timezone: string;
  theme: Theme;
  dateFormat: string;
  timeFormat: "12" | "24";
}

export interface IMetadata {
  userAgent?: string;
  referrer?: string;
  campaign?: string;
  source?: string;
  medium?: string;
  utmParameters?: Record<string, string>;
  deviceFingerprint?: string;
  initialCountry?: string;
  signupFlow?: string;
}

export interface IUser {
  // Core identification
  username: string;
  email?: string;
  password?: string;

  // Profile information
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: IAvatar;
  phone?: string;
  phoneVerified?: boolean;
  dateOfBirth?: Date;
  gender?: Gender;
  bio?: string;
  website?: string;
  socialLinks?: Record<string, string>;

  // Status and permissions
  status: UserStatus;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  isOnline: boolean;
  isVerified: boolean;
  emailVerified: boolean;
  isBanned: boolean;
  isSuspended: boolean;
  isDeleted: boolean;

  // Social authentication
  googleId?: string;
  githubId?: string;
  facebookId?: string;

  // Connection and activity
  socketId?: string;
  lastSeen: Date;
  lastLoginDevice?: string;
  userLanguage: string;

  // Geographic and session info
  timezone: string;
  registrationIP?: string;
  detectedCountry?: string;
  currentIP?: string;

  // Social connections
  followers: Types.ObjectId[];
  following: Types.ObjectId[];
  friends: Types.ObjectId[];
  blockedUsers: Types.ObjectId[];
  friendRequests?: {
    sent: Types.ObjectId[];
    received: Types.ObjectId[];
  };

  // Security and authentication
  loginHistory: ILoginHistory[];
  // twoFactorAuth: ITwoFactorAuth;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  phoneVerificationToken?: string;
  phoneVerificationExpires?: Date;
  passwordChangedAt?: Date;
  loginAttempts: number;
  lockoutUntil?: Date;

  // Preferences and settings
  preferences: IPreferences;
  addresses: IAddress[];

  // Analytics and tracking
  loginCount: number;
  lastLoginAt?: Date;
  accountCreatedAt: Date;
  metadata: IMetadata;

  // Additional features
  subscription?: {
    plan: string;
    status: string;
    expiresAt?: Date;
    features: string[];
  };

  apiKeys?: Array<{
    key: string;
    name: string;
    permissions: string[];
    lastUsed?: Date;
    expiresAt?: Date;
    isActive: boolean;
  }>;

  sessions?: Array<{
    sessionId: string;
    deviceInfo: string;
    ipAddress: string;
    createdAt: Date;
    lastActivity: Date;
    isActive: boolean;
  }>;

  // Audit trail
  auditLog?: Array<{
    action: string;
    details: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    timestamp: Date;
  }>;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
