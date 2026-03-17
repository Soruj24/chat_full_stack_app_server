// models/types/UserTypes.ts
import { Document, Model, Types } from "mongoose";
import { 
  IUser, 
  ILoginHistory, 
  ITwoFactorAuth, 
  IAddress, 
  IAvatar, 
  IPreferences,
  UserStatus, 
  UserRole, 
  Theme, 
  Gender, 
  AddressType, 
  ProfileVisibility 
} from "../interfaces/IUser";

export interface IUserDoc extends IUser, Document {
  // Authentication methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  updateLastSeen(): Promise<IUserDoc>;
  updateOnlineStatus(isOnline: boolean): Promise<IUserDoc>;

  // Security methods
  isAccountLocked(): boolean;
  incrementLoginAttempts(): Promise<IUserDoc>;
  resetLoginAttempts(): Promise<IUserDoc>;
  addLoginHistory(details: Partial<ILoginHistory>): Promise<IUserDoc>;
  createPasswordResetToken(): string;
  createEmailVerificationToken(): string;
  createPhoneVerificationToken(): string;

  // Profile methods
  getAge(): number | null;
  getFullName(): string;
  getDisplayName(): string;
  isProfileComplete(): boolean;
  updateProfile(updates: Partial<IUser>): Promise<IUserDoc>;

  // Social methods
  isFollowing(userId: Types.ObjectId): boolean;
  isBlocked(userId: Types.ObjectId): boolean;
  isFriend(userId: Types.ObjectId): boolean;
  canViewProfile(viewerId: Types.ObjectId): boolean;
  sendFriendRequest(targetUserId: Types.ObjectId): Promise<boolean>;
  acceptFriendRequest(fromUserId: Types.ObjectId): Promise<boolean>;
  blockUser(userIdToBlock: Types.ObjectId): Promise<boolean>;
  unblockUser(userIdToUnblock: Types.ObjectId): Promise<boolean>;

  // Session management
  createSession(deviceInfo: string, ipAddress: string): Promise<string>;
  invalidateSession(sessionId: string): Promise<boolean>;
  invalidateAllSessions(): Promise<boolean>;

  // Audit and logging
  addAuditLog(action: string, details: Record<string, any>, ipAddress?: string): Promise<void>;

  // Utility methods
  toSafeJSON(): Record<string, any>;
  hasPermission(permission: string): boolean;
  getRoleLevel(): number;
  isAdminUser(): boolean;

  // Subscription methods
  hasActiveSubscription(): boolean;
  hasFeature(feature: string): boolean;

  // Virtuals
  readonly fullName: string;
  readonly displayNameOrUsername: string;
  readonly isAccountActive: boolean;
  readonly accountAgeInDays: number;
  readonly lastActive: Date;
  readonly profileCompletion: number;
  readonly totalConnections: number;
  readonly isAdmin: boolean;
}

export interface UserModel extends Model<IUserDoc> {
  // Search and query methods
  searchUsers(query: string, options?: {
    limit?: number;
    skip?: number;
    language?: string;
    fields?: string[];
    includeInactive?: boolean;
  }): Promise<IUserDoc[]>;

  findByEmail(email: string, includeDeleted?: boolean): Promise<IUserDoc | null>;
  findByUsername(username: string, includeDeleted?: boolean): Promise<IUserDoc | null>;
  findByPhone(phone: string, includeDeleted?: boolean): Promise<IUserDoc | null>;

  // Analytics and reporting
  getUserStats(dateRange?: { start: Date; end: Date }): Promise<any[]>;
  getActiveUsers(options?: { limit?: number; skip?: number; sortBy?: string }): Promise<IUserDoc[]>;
  getTopUsers(metric: 'followers' | 'connections' | 'activity', limit?: number): Promise<IUserDoc[]>;

  // Bulk operations
  bulkUpdateStatus(userIds: Types.ObjectId[], status: UserStatus): Promise<any>;
  cleanupInactiveUsers(daysInactive: number): Promise<number>;

  // Security methods
  findSuspiciousLogins(timeWindow?: number): Promise<any[]>;
  findUsersWithExpiredTokens(): Promise<IUserDoc[]>;

  // Admin methods
  createAdminUser(userData: Partial<IUser>, createdBy: Types.ObjectId): Promise<IUserDoc>;
  
  // Additional static methods
  getPasswordResetStats(): Promise<any[]>;
  getUserGrowthMetrics(days?: number): Promise<any[]>;
  findDormantUsers(daysInactive?: number): Promise<IUserDoc[]>;
  getEngagementMetrics(): Promise<any[]>;
}