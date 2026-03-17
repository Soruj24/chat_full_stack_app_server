// models/schemas/subSchemas.ts
import { Schema } from "mongoose";
import validator from "validator";
import { 
  ILoginHistory, 
  ITwoFactorAuth, 
  IAddress, 
  IAvatar, 
  IPreferences 
} from "../interfaces/IUser";
import { AddressType, ProfileVisibility, Theme } from "../interfaces/IUser";
import { USER_CONSTANTS } from "../constants/UserConstants";

export const loginHistorySchema = new Schema<ILoginHistory>({
  ipAddress: {
    type: String,
    required: true,
    validate: {
      validator: (value: string) => validator.isIP(value),
      message: 'Invalid IP address'
    }
  },
  userAgent: {
    type: String,
    maxlength: 500
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  deviceInfo: String,
  location: String,
  loginMethod: {
    type: String,
    enum: ['password', '2fa', 'social', 'magic-link'],
    default: 'password'
  },
  success: {
    type: Boolean,
    default: true
  },
  failureReason: String
}, { _id: false });

export const addressSchema = new Schema<IAddress>({
  type: {
    type: String,
    enum: Object.values(AddressType),
    default: AddressType.HOME
  },
  street: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'Street address cannot exceed 200 characters']
  },
  city: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'City name cannot exceed 100 characters']
  },
  state: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'State name cannot exceed 100 characters']
  },
  country: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Country name cannot exceed 100 characters']
  },
  zipCode: {
    type: String,
    required: true,
    trim: true,
    maxlength: [20, 'ZIP code cannot exceed 20 characters']
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  verified: {
    type: Boolean,
    default: false
  }
}, { _id: false });

export const avatarSchema = new Schema<IAvatar>({
  url: {
    type: String,
    required: true,
    validate: {
      validator: (value: string) => validator.isURL(value),
      message: 'Invalid avatar URL'
    }
  },
  publicId: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String,
    validate: {
      validator: (value: string) => validator.isURL(value),
      message: 'Invalid thumbnail URL'
    }
  },
  originalName: String,
  size: Number,
  mimeType: String,
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

export const twoFactorAuthSchema = new Schema<ITwoFactorAuth>({
  enabled: {
    type: Boolean,
    default: false
  },
  secret: {
    type: String,
    select: false
  },
  backupCodes: [{
    type: String,
    select: false,
  }],
  enabledAt: Date,
  lastUsed: Date,
  method: {
    type: String,
    enum: ['totp', 'sms', 'email'],
    default: 'totp'
  },
  recoveryCodesUsed: {
    type: Number,
    default: 0
  }
}, { _id: false });

export const preferencesSchema = new Schema<IPreferences>({
  notifications: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    push: { type: Boolean, default: true },
    marketing: { type: Boolean, default: false },
    security: { type: Boolean, default: true },
    social: { type: Boolean, default: true },
    system: { type: Boolean, default: true }
  },
  privacy: {
    profileVisibility: {
      type: String,
      enum: Object.values(ProfileVisibility),
      default: ProfileVisibility.PUBLIC
    },
    showEmail: { type: Boolean, default: false },
    showPhone: { type: Boolean, default: false },
    showOnlineStatus: { type: Boolean, default: true },
    showLastSeen: { type: Boolean, default: true },
    allowFriendRequests: { type: Boolean, default: true },
    allowDirectMessages: { type: Boolean, default: true },
    searchable: { type: Boolean, default: true }
  },
  security: {
    requireTwoFactorForPasswordChange: { type: Boolean, default: false },
    requireTwoFactorForEmailChange: { type: Boolean, default: false },
    sessionTimeout: { type: Number, default: 60 },
    allowMultipleSessions: { type: Boolean, default: true },
    ipWhitelist: [String],
    suspiciousActivityAlerts: { type: Boolean, default: true }
  },
  language: { type: String, default: 'en' },
  currency: { type: String, default: 'USD' },
  timezone: { type: String, default: 'UTC' },
  theme: {
    type: String,
    enum: Object.values(Theme),
    default: Theme.AUTO
  },
  dateFormat: { type: String, default: 'YYYY-MM-DD' },
  timeFormat: {
    type: String,
    enum: ['12', '24'],
    default: '24'
  }
}, { _id: false });