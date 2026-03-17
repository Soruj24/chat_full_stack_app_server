import { Mongoose, Schema } from "mongoose";
import validator from "validator";
import { USER_CONSTANTS } from "../constants/UserConstants";
import { IUserDoc } from "../types/UserTypes";
import { UserStatus, UserRole, Gender, Permission } from "../interfaces/IUser";
import {
  loginHistorySchema,
  addressSchema,
  avatarSchema,
  twoFactorAuthSchema,
  preferencesSchema
} from "./subSchemas";
import { isStrongPassword, validateTimezone } from "../utils/UserUtils";

export const UserSchema = new Schema<IUserDoc>({
  // Core identification
  username: {
    type: String,
    required: [true, "Username is required"],
    unique: true,
    minlength: [USER_CONSTANTS.USERNAME.MIN_LENGTH, `Username must be at least ${USER_CONSTANTS.USERNAME.MIN_LENGTH} characters long`],
    maxlength: [USER_CONSTANTS.USERNAME.MAX_LENGTH, `Username cannot exceed ${USER_CONSTANTS.USERNAME.MAX_LENGTH} characters`],
    trim: true,
    lowercase: true,
    match: [/^[a-zA-Z0-9_.-]+$/, "Username can only contain alphanumeric characters, dots, hyphens, and underscores"],
    index: true,
    validate: {
      validator: function (this: any, username: string) {
        if (this && this.status === 'deleted') return true;
        return !USER_CONSTANTS.USERNAME.RESERVED.includes(username.toLowerCase() as any);
      },
      message: 'This username is reserved'
    }
  },

  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(this: any, value: string) {
        if (this && this.status === 'deleted') return true;
        return validator.isEmail(value);
      },
      message: 'Please provide a valid email address'
    },
    index: true
  },

  password: {
    type: String,
    minlength: [USER_CONSTANTS.PASSWORD.MIN_LENGTH, `Password must be at least ${USER_CONSTANTS.PASSWORD.MIN_LENGTH} characters long`],
    select: false,
    validate: {
      validator: isStrongPassword,
      message: 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
    }
  },

  // Profile information
  firstName: {
    type: String,
    trim: true,
    maxlength: [USER_CONSTANTS.LIMITS.NAME_MAX_LENGTH, `First name cannot exceed ${USER_CONSTANTS.LIMITS.NAME_MAX_LENGTH} characters`],
    match: [/^[a-zA-Z\s'-]+$/, "First name can only contain letters, spaces, apostrophes, and hyphens"]
  },

  lastName: {
    type: String,
    trim: true,
    maxlength: [USER_CONSTANTS.LIMITS.NAME_MAX_LENGTH, `Last name cannot exceed ${USER_CONSTANTS.LIMITS.NAME_MAX_LENGTH} characters`],
    match: [/^[a-zA-Z\s'-]+$/, "Last name can only contain letters, spaces, apostrophes, and hyphens"]
  },

  displayName: {
    type: String,
    trim: true,
    maxlength: [100, 'Display name cannot exceed 100 characters']
  },

  avatar: avatarSchema,

  phone: {
    type: String,
    validate: {
      validator: (phone: string) => validator.isMobilePhone(phone, 'any', { strictMode: false }),
      message: 'Please provide a valid phone number'
    }
  },

  phoneVerified: {
    type: Boolean,
    default: false
  },

  dateOfBirth: {
    type: Date,
    validate: {
      validator: function (dob: Date) {
        const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        return age >= 13 && age <= 120;
      },
      message: 'You must be at least 13 years old and not older than 120 years'
    }
  },

  gender: {
    type: String,
    enum: Object.values(Gender)
  },

  bio: {
    type: String,
    maxlength: [USER_CONSTANTS.LIMITS.BIO_MAX_LENGTH, `Bio cannot exceed ${USER_CONSTANTS.LIMITS.BIO_MAX_LENGTH} characters`],
    trim: true
  },

  website: {
    type: String,
    validate: {
      validator: (value: string) => validator.isURL(value),
      message: 'Please provide a valid website URL'
    }
  },

  socialLinks: {
    type: Map,
    of: String
  },

  // Status and permissions
  status: {
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.ACTIVE,
    index: true
  },

  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.USER,
    index: true
  },
  
  permissions: {
    type: [String],
    enum: Object.values(Permission),
    default: []
  },

  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  isOnline: {
    type: Boolean,
    default: false,
    index: true
  },

  isVerified: {
    type: Boolean,
    default: false,
    index: true
  },

  emailVerified: {
    type: Boolean,
    default: false
  },

  emailVerificationToken: {
    type: String,
    select: false,
    validate: {
      validator: function (v: string) {
        return v === undefined || (v.length === 6 && /^[A-Z0-9]{6}$/.test(v));
      },
      message: 'Verification token must be 6 alphanumeric characters'
    }
  },

  emailVerificationExpires: {
    type: Date,
    select: false
  },

  isBanned: {
    type: Boolean,
    default: false,
    index: true
  },

  isSuspended: {
    type: Boolean,
    default: false
  },

  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },

  // Social authentication
  googleId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  githubId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  facebookId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },

  // Connection info
  // socketId: {
  //   type: String,
  //   default: ""
  // },

  lastSeen: {
    type: Date,
    default: Date.now,
    index: true
  },

  lastLoginDevice: String,

  userLanguage: {
    type: String,
    required: true,
    enum: ["en", "bn", "hi", "ur", "ne", "si", "dz", "dv", "ps", "fa", "ar", "he",
      "tr", "th", "vi", "km", "lo", "my", "ms", "id", "tl", "zh", "ja", "ko",
      "mn", "de", "fr", "it", "es", "ca", "eu", "gl", "pt", "nl", "sv", "da",
      "no", "fi", "is", "et", "lv", "lt", "pl", "cs", "sk", "hu", "ro", "bg",
      "el", "sr", "hr", "bs", "mk", "sq", "sl", "mt", "uk", "be", "ru", "kk",
      "uz", "tg", "tk", "ky", "ka", "hy", "az", "so", "am", "ti", "sw", "rw",
      "rn", "mg", "zu", "xh", "st", "ss", "tn", "ny", "sn", "af", "yo", "ig",
      "ha", "ak", "wo", "bm", "dy", "ht", "fj", "sm", "to", "ch", "tpi", "bi",
      "mi", "kl", "fo", "ga", "gd", "cy", "lb", "fy", "gv", "kw", "co", "sc",
      "rm", "wa", "oc", "an", "ast", "ext", "lad", "mwl", "pap", "tzl", "vo"],
    default: 'en'
  },

  timezone: {
    type: String,
    required: true,
    default: 'UTC',
    validate: {
      validator: validateTimezone,
      message: 'Invalid timezone'
    }
  },

  registrationIP: {
    type: String,
    validate: {
      validator: (value: string) => validator.isIP(value),
      message: 'Invalid registration IP address'
    }
  },

  detectedCountry: {
    type: String,
    maxlength: 2,
    uppercase: true
  },

  currentIP: {
    type: String,
    validate: {
      validator: (value: string) => validator.isIP(value),
      message: 'Invalid current IP address'
    }
  },

  // Social connections
  followers: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  }],

  following: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  }],

  friends: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  }],

  blockedUsers: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  }],

  friendRequests: {
    sent: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    received: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }]
  },

  // Security and authentication
  loginHistory: [loginHistorySchema],

  twoFactorAuth: {
    type: twoFactorAuthSchema,
    default: () => ({
      enabled: false,
      method: 'totp',
      recoveryCodesUsed: 0
    })
  },

  resetPasswordToken: {
    type: String,
    select: false
  },

  resetPasswordExpires: Date,

  phoneVerificationToken: {
    type: String,
    select: false
  },

  phoneVerificationExpires: Date,

  passwordChangedAt: Date,

  loginAttempts: {
    type: Number,
    default: 0,
    select: false,
    min: 0,
    max: 10
  },

  lockoutUntil: Date,

  // Preferences and settings
  preferences: {
    type: Schema.Types.Mixed,
    default: {
      theme: "auto",
      language: "en",
      timezone: "UTC",
      notifications: {
        email: true,
        push: true,
        twoFactor: true,
        marketing: false,
        security: true,
        orderUpdates: true,
        priceAlerts: false,
        newsletter: false,
      },
    },
    },

    addresses: {
      type: [addressSchema],
      validate: {
        validator: function (addresses: any[]) {
          return addresses.length <= USER_CONSTANTS.LIMITS.MAX_ADDRESSES;
        },
        message: `Cannot have more than ${USER_CONSTANTS.LIMITS.MAX_ADDRESSES} addresses`
      }
    },

    // Analytics and tracking
    loginCount: {
      type: Number,
      default: 0
    },

    lastLoginAt: Date,

    accountCreatedAt: {
      type: Date,
      default: Date.now
    },

    metadata: {
      userAgent: String,
      referrer: String,
      campaign: String,
      source: String,
      medium: String,
      utmParameters: {
        type: Map,
        of: String
      },
      deviceFingerprint: String,
      initialCountry: String,
      signupFlow: String
    },

    // Additional features
    subscription: {
      plan: String,
      status: String,
      expiresAt: Date,
      features: [String]
    },

    apiKeys: [{
      key: {
        type: String,
        select: false
      },
      name: String,
      permissions: [String],
      lastUsed: Date,
      expiresAt: Date,
      isActive: {
        type: Boolean,
        default: true
      }
    }],

    sessions: [{
      sessionId: String,
      deviceInfo: String,
      ipAddress: String,
      createdAt: {
        type: Date,
        default: Date.now
      },
      lastActivity: {
        type: Date,
        default: Date.now
      },
      isActive: {
        type: Boolean,
        default: true
      }
    }],

    auditLog: [{
      action: String,
      details: Schema.Types.Mixed,
      ipAddress: String,
      userAgent: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  }, {
  timestamps: true,
  collection: 'users',
  toJSON: {
    virtuals: true,
    transform: function (doc: any, ret: any) {
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      delete ret.resetPasswordToken;
      delete ret.resetPasswordExpires;
      delete ret.emailVerificationToken;
      delete ret.emailVerificationExpires;
      delete ret.phoneVerificationToken;
      delete ret.phoneVerificationExpires;
      delete ret.loginAttempts;
      delete ret.lockoutUntil;

      // Clean up 2FA data
      if (ret.twoFactorAuth) {
        delete ret.twoFactorAuth.secret;
        delete ret.twoFactorAuth.backupCodes;
      }

      // Clean up API keys
      if (ret.apiKeys) {
        ret.apiKeys.forEach((key: any) => {
          delete key.key;
        });
      }

      ret.id = doc._id.toString();
      return ret;
    }
  },
  toObject: {
    virtuals: true
  }
});

// Add indexes for performance
UserSchema.index({ username: 'text', email: 'text', firstName: 'text', lastName: 'text', displayName: 'text' });
UserSchema.index({ email: 1 }, { unique: true, sparse: true });
UserSchema.index({ status: 1, isActive: 1, isBanned: 1 });
UserSchema.index({ isOnline: 1, lastSeen: -1 });
UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ createdAt: 1, status: 1 });
UserSchema.index({ 'preferences.language': 1 });
UserSchema.index({ 'preferences.timezone': 1 });
UserSchema.index({ followers: 1 });
UserSchema.index({ following: 1 });
UserSchema.index({ friends: 1 });
UserSchema.index({ detectedCountry: 1, registrationIP: 1 });
UserSchema.index({ 'loginHistory.timestamp': -1 });
UserSchema.index({ 'subscription.status': 1, 'subscription.expiresAt': 1 });
UserSchema.index({ 'sessions.isActive': 1, 'sessions.lastActivity': -1 });

// TTL indexes for automatic cleanup
UserSchema.index({ resetPasswordExpires: 1 }, { expireAfterSeconds: 0 });
UserSchema.index({ emailVerificationExpires: 1 }, { expireAfterSeconds: 0 });
UserSchema.index({ phoneVerificationExpires: 1 }, { expireAfterSeconds: 0 });
UserSchema.index({ lockoutUntil: 1 }, { expireAfterSeconds: 0 });