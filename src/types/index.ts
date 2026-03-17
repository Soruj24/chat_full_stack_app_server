import { Request } from 'express';
import mongoose, { Types } from "mongoose";


export type UserAction = "LOGIN" | "LOGOUT" | "UPDATE_PROFILE" | "ORDER_PLACED";

export interface IUser {
  _id: Types.ObjectId;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions?: string[];
  email: string;
  password: string;
  phone?: string;
  avatar?: string;
  image?: string;
  isBanned?: boolean;
  emailVerifiedAt?: Date;
  twoFactorAuth?: {
    enabled: boolean;
    enabledAt?: Date;
  };
  address?: {
    type: string;
    location?: {
      country: string;
      city: string;
    };
  };
  preferences?: {
    language: string;
    currency: string;
    theme: string;
  };
  isOnline: boolean;
  isModified: boolean;
  lastSeen: Date;
  socketId?: string;
  contacts: Types.ObjectId[];
  blockedUsers: Types.ObjectId[];
  activityLog: ActivityLogEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessage {
  _id: Types.ObjectId;
  sender: Types.ObjectId;
  content?: string;
  type: 'text' | 'voice';
  messageType: 'text' | 'image' | 'voice' | 'file';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  conversation: Types.ObjectId;
  readBy: Array<{
    user: Types.ObjectId;
    readAt: Date;
  }>;
  isEdited: boolean;
  editedAt?: Date;
  replyTo?: Types.ObjectId | null;  // ✅ allow null safely
  reactions: Array<{
    user: Types.ObjectId;
    emoji: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConversation {
  _id: Types.ObjectId;
  type: 'private' | 'group';
  participants: Types.ObjectId[];
  name?: string;
  description?: string;
  avatar?: string;
  admin?: Types.ObjectId[];
  lastMessage?: Types.ObjectId;
  lastMessageAt: Date;
  unreadCount: Map<string, number>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
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
export interface AuthRequest extends Request {
  user?: IUser;
}

export interface DecodedToken {
  userId: string;
  iat: number;
  exp: number;
}

export interface ActivityLogEntry {
  action: UserAction;
  description: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

export interface INotification {
  user: mongoose.Schema.Types.ObjectId;
  type: 'order_update' | 'price_drop' | 'stock_alert' | 'promotion';
  title: string;
  message: string;
  data?: mongoose.Schema.Types.Mixed; // Additional data related to the notification
  isRead?: boolean;
  sentAt?: Date;
}


export interface IAnalyticsEvent {
  user?: mongoose.Schema.Types.ObjectId; // Optional, can be null for anonymous events
  sessionId?: string; // Unique session identifier
  eventType: 'page_view' | 'product_view' | 'add_to_cart' | 'checkout_start' | 'purchase';
  data?: mongoose.Schema.Types.Mixed; // Additional data related to the event
  deviceInfo?: {
    type: String;
    os: String;
    browser: String;
    isMobile: Boolean;
  };
  location?: {
    ip: String;
    country: String;
    city: String;
  };
  timestamp?: Date; // Default to current date if not provided
}


export interface UserParams {
  id: string;
  userId: string;
  email?: string;
  password: string
}

export interface UpdateUserBody {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  location?: {
    country?: string;
    city?: string;
  };
  preferences?: {
    language?: string;
    currency?: string;
    theme?: string;
  };
  role?: string;
  permissions?: string[];
  status?: string;
  isActive?: boolean;
  isBanned?: boolean;
}

export interface GetUsersQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  filter?: {
    [key: string]: any; // Flexible filter criteria
  };
}
export interface PasswordChangeBody {
  oldPassword: string;
  newPassword: string;
}


export interface TwoFactorAuth {
  backupCodes: string[];
}


export interface CategoryTreeNode {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  parent?: string;
  level: number;
  sortOrder: number;
  isActive: boolean;
  children: CategoryTreeNode[] | undefined
}
export interface SocialUserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface SocialLoginBody {
  provider: "google" | "github" | "facebook";
  providerId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  username?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  name: string;
}

export interface SavedItem {
  id: string;
  productId: string;
  addedAt: Date;
}

export interface Cart {
  userId: string;
  items: CartItem[];
  savedItems: SavedItem[];
  couponCode?: string;
  discountPercentage?: number;
}

export interface Coupon {
  code: string;
  discountPercentage: number;
  validUntil: Date;
}

export interface ShippingOption {
  id: string;
  name: string;
  cost: number;
  estimatedDays: number;
}

export interface TaxRate {
  state: string;
  rate: number;
}

export interface CreateUserBody {
  username: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  userLanguage: string;
  password: string;
  socketId: string;
  gender: string;
  dateOfBirth?: string;
  addresses?: any[];
  preferences?: any;
}

export interface SocialUserInfo {
  id: string;
  email: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  name?: string;
}

