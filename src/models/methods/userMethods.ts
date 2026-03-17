// models/methods/userMethods.ts
import { Schema, Types } from "mongoose";
import bcrypt from "bcryptjs";
import { IUserDoc } from "../types/UserTypes";
import { ILoginHistory, UserStatus, UserRole, ProfileVisibility, Permission } from "../interfaces/IUser";
import { USER_CONSTANTS } from "../constants/UserConstants";
import { generateSecureToken, hashToken, sanitizeUserAgent, getDeviceInfo, calculateAge } from "../utils/UserUtils";

export const applyUserMethods = (schema: Schema<IUserDoc>) => {
  // Authentication methods
  schema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
  };

  schema.methods.updateLastSeen = async function (): Promise<IUserDoc> {
    this.lastSeen = new Date();
    this.isOnline = true;
    return this.save();
  };

  // schema.methods.updateOnlineStatus = async function (isOnline: boolean): Promise<IUserDoc> {
  //   this.isOnline = isOnline;
  //   if (!isOnline) {
  //     this.lastSeen = new Date();
  //     this.socketId = '';
  //   }
  //   return this.save();
  // };

  // Security methods
  schema.methods.isAccountLocked = function (): boolean {
    return !!(this.lockoutUntil && this.lockoutUntil > new Date());
  };

  schema.methods.incrementLoginAttempts = async function (): Promise<IUserDoc> {
    this.loginAttempts = (this.loginAttempts || 0) + 1;

    if (this.loginAttempts >= USER_CONSTANTS.LOCKOUT.MAX_ATTEMPTS) {
      const delayMinutes = USER_CONSTANTS.LOCKOUT.PROGRESSIVE_DELAYS[
        Math.min(this.loginAttempts - USER_CONSTANTS.LOCKOUT.MAX_ATTEMPTS,
          USER_CONSTANTS.LOCKOUT.PROGRESSIVE_DELAYS.length - 1)
      ];
      this.lockoutUntil = new Date(Date.now() + delayMinutes * 60 * 1000);

      await this.addAuditLog('ACCOUNT_LOCKED', {
        attempts: this.loginAttempts,
        lockoutDuration: delayMinutes
      });
    }

    return this.save();
  };

  schema.methods.resetLoginAttempts = async function (): Promise<IUserDoc> {
    this.loginAttempts = 0;
    this.lockoutUntil = undefined;
    return this.save();
  };

  schema.methods.addLoginHistory = async function (details: Partial<ILoginHistory>): Promise<IUserDoc> {
    if (!this.loginHistory) {
      this.loginHistory = [];
    }

    const loginEntry: ILoginHistory = {
      ipAddress: details.ipAddress || '0.0.0.0',
      userAgent: sanitizeUserAgent(details.userAgent || ''),
      timestamp: new Date(),
      deviceInfo: details.deviceInfo || getDeviceInfo(details.userAgent || ''),
      location: details.location,
      loginMethod: details.loginMethod || 'password',
      success: details.success !== false,
      failureReason: details.failureReason
    };

    this.loginHistory.unshift(loginEntry);

    if (this.loginHistory.length > USER_CONSTANTS.LIMITS.MAX_LOGIN_HISTORY) {
      this.loginHistory = this.loginHistory.slice(0, USER_CONSTANTS.LIMITS.MAX_LOGIN_HISTORY);
    }

    if (loginEntry.success) {
      this.loginCount = (this.loginCount || 0) + 1;
      this.lastLoginAt = new Date();
      this.currentIP = loginEntry.ipAddress;
    }

    return this.save();
  };

  schema.methods.createPasswordResetToken = function (): string {
    const resetToken = generateSecureToken();
    this.resetPasswordToken = hashToken(resetToken);
    this.resetPasswordExpires = new Date(Date.now() + USER_CONSTANTS.PASSWORD.RESET_TOKEN_EXPIRY);
    return resetToken;
  };

  schema.methods.createEmailVerificationToken = function (): string {
    const verificationToken = generateSecureToken();
    this.emailVerificationToken = hashToken(verificationToken);
    this.emailVerificationExpires = new Date(Date.now() + USER_CONSTANTS.VERIFICATION.EMAIL_TOKEN_EXPIRY);
    return verificationToken;
  };

  schema.methods.createPhoneVerificationToken = function (): string {
    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    this.phoneVerificationToken = hashToken(verificationToken);
    this.phoneVerificationExpires = new Date(Date.now() + USER_CONSTANTS.VERIFICATION.PHONE_TOKEN_EXPIRY);
    return verificationToken;
  };

  // Profile methods
  schema.methods.getAge = function (): number | null {
    if (!this.dateOfBirth) return null;
    return calculateAge(this.dateOfBirth);
  };

  schema.methods.getFullName = function (): string {
    return this.fullName;
  };

  schema.methods.getDisplayName = function (): string {
    return this.displayNameOrUsername;
  };

  schema.methods.isProfileComplete = function (): boolean {
    return this.profileCompletion >= 60;
  };

  schema.methods.updateProfile = async function (updates: any): Promise<IUserDoc> {
    const allowedUpdates = [
      'firstName', 'lastName', 'displayName', 'bio', 'website', 'dateOfBirth',
      'gender', 'phone', 'socialLinks', 'preferences'
    ];

    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        (this as any)[key] = updates[key];
      }
    });

    await this.addAuditLog('PROFILE_UPDATED', { updatedFields: Object.keys(updates) });
    return this.save();
  };

  // Social methods
  schema.methods.isFollowing = function (userId: Types.ObjectId): boolean {
    return this.following ? this.following.some((id: Types.ObjectId) => id.equals(userId)) : false;
  };

  schema.methods.isBlocked = function (userId: Types.ObjectId): boolean {
    return this.blockedUsers ? this.blockedUsers.some((id: Types.ObjectId) => id.equals(userId)) : false;
  };

  schema.methods.isFriend = function (userId: Types.ObjectId): boolean {
    return this.friends ? this.friends.some((id: Types.ObjectId) => id.equals(userId)) : false;
  };

  schema.methods.canViewProfile = function (viewerId: Types.ObjectId): boolean {
    if (this.isBlocked(viewerId)) return false;

    const privacy = this.preferences?.privacy;
    if (!privacy) return true;

    switch (privacy.profileVisibility) {
      case ProfileVisibility.PUBLIC:
        return true;
      case ProfileVisibility.FRIENDS:
        return this.isFriend(viewerId);
      case ProfileVisibility.PRIVATE:
        return this._id.equals(viewerId);
      default:
        return true;
    }
  };

  schema.methods.sendFriendRequest = async function (targetUserId: Types.ObjectId): Promise<boolean> {
    if (this.isBlocked(targetUserId) || this.isFriend(targetUserId)) {
      return false;
    }

    const targetUser = await (this.constructor as any).findById(targetUserId);
    if (!targetUser || !targetUser.preferences?.privacy?.allowFriendRequests) {
      return false;
    }

    // Add to sent requests
    if (!this.friendRequests) this.friendRequests = { sent: [], received: [] };
    if (!this.friendRequests.sent.some((id: Types.ObjectId) => id.equals(targetUserId))) {
      this.friendRequests.sent.push(targetUserId);
    }

    // Add to target user's received requests
    if (!targetUser.friendRequests) targetUser.friendRequests = { sent: [], received: [] };
    if (!targetUser.friendRequests.received.some((id: Types.ObjectId) => id.equals(this._id))) {
      targetUser.friendRequests.received.push(this._id);
    }

    await Promise.all([this.save(), targetUser.save()]);

    await this.addAuditLog('FRIEND_REQUEST_SENT', { targetUserId });
    return true;
  };

  schema.methods.acceptFriendRequest = async function (fromUserId: Types.ObjectId): Promise<boolean> {
    if (!this.friendRequests?.received.some((id: Types.ObjectId) => id.equals(fromUserId))) {
      return false;
    }

    const fromUser = await (this.constructor as any).findById(fromUserId);
    if (!fromUser) return false;

    // Add to friends lists
    if (!this.friends.some((id: Types.ObjectId) => id.equals(fromUserId))) {
      this.friends.push(fromUserId);
    }
    if (!fromUser.friends.some((id: Types.ObjectId) => id.equals(this._id))) {
      fromUser.friends.push(this._id);
    }

    // Remove from friend requests
    this.friendRequests.received = this.friendRequests.received.filter((id: Types.ObjectId) => !id.equals(fromUserId));
    fromUser.friendRequests.sent = fromUser.friendRequests.sent.filter((id: Types.ObjectId) => !id.equals(this._id));

    await Promise.all([this.save(), fromUser.save()]);

    await this.addAuditLog('FRIEND_REQUEST_ACCEPTED', { fromUserId });
    return true;
  };

  schema.methods.blockUser = async function (userIdToBlock: Types.ObjectId): Promise<boolean> {
    if (this.isBlocked(userIdToBlock)) return false;

    this.blockedUsers.push(userIdToBlock);

    // Remove from friends and followers
    this.friends = this.friends.filter((id: Types.ObjectId) => !id.equals(userIdToBlock));
    this.following = this.following.filter((id: Types.ObjectId) => !id.equals(userIdToBlock));
    this.followers = this.followers.filter((id: Types.ObjectId) => !id.equals(userIdToBlock));

    await this.addAuditLog('USER_BLOCKED', { blockedUserId: userIdToBlock });
    return this.save().then(() => true);
  };

  schema.methods.unblockUser = async function (userIdToUnblock: Types.ObjectId): Promise<boolean> {
    if (!this.isBlocked(userIdToUnblock)) return false;

    this.blockedUsers = this.blockedUsers.filter((id: Types.ObjectId) => !id.equals(userIdToUnblock));

    await this.addAuditLog('USER_UNBLOCKED', { unblockedUserId: userIdToUnblock });
    return this.save().then(() => true);
  };

  // Session management
  schema.methods.createSession = async function (deviceInfo: string, ipAddress: string): Promise<string> {
    const sessionId = generateSecureToken();

    if (!this.sessions) this.sessions = [];

    this.sessions.push({
      sessionId,
      deviceInfo: sanitizeUserAgent(deviceInfo),
      ipAddress,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true
    });

    await this.save();
    return sessionId;
  };

  schema.methods.invalidateSession = async function (sessionId: string): Promise<boolean> {
    if (!this.sessions) return false;

    const session = this.sessions.find((s: any) => s.sessionId === sessionId);
    if (session) {
      session.isActive = false;
      await this.save();
      return true;
    }
    return false;
  };

  schema.methods.invalidateAllSessions = async function (): Promise<boolean> {
    if (this.sessions) {
      this.sessions.forEach((session: any) => {
        session.isActive = false;
      });
      await this.save();
    }
    return true;
  };

  // Audit and logging
  schema.methods.addAuditLog = async function (
    action: string,
    details: Record<string, any>,
    ipAddress?: string
  ): Promise<void> {
    if (!this.auditLog) this.auditLog = [];

    this.auditLog.unshift({
      action,
      details,
      ipAddress,
      userAgent: details.userAgent,
      timestamp: new Date()
    });

    // Keep only last 100 audit entries
    if (this.auditLog.length > 100) {
      this.auditLog = this.auditLog.slice(0, 100);
    }
  };

  // Utility methods
  schema.methods.toSafeJSON = function (): Record<string, any> {
    const obj = this.toJSON();

    // Additional sensitive field cleanup
    delete obj.auditLog;
    delete obj.sessions;
    if (obj.metadata) {
      delete obj.metadata.deviceFingerprint;
    }

    return obj;
  };

  schema.methods.hasPermission = function (permission: string): boolean {
    // Super Admin always has all permissions
    if (this.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Check explicit user permissions
    if (this.permissions && this.permissions.includes(permission as Permission)) {
      return true;
    }

    // Role-based default permissions
    const rolePermissions: Record<string, string[]> = {
      [UserRole.ADMIN]: [
        Permission.USERS_VIEW,
        Permission.USERS_CREATE,
        Permission.USERS_EDIT,
        Permission.USERS_DELETE,
        Permission.ROLES_VIEW,
        Permission.ROLES_EDIT,
        Permission.CONTENT_VIEW,
        Permission.CONTENT_CREATE,
        Permission.CONTENT_EDIT,
        Permission.CONTENT_DELETE,
        Permission.SYSTEM_VIEW,
        Permission.SYSTEM_SETTINGS,
        Permission.ANALYTICS_VIEW,
        Permission.TICKETS_VIEW,
        Permission.TICKETS_EDIT,
        Permission.BILLING_VIEW,
        Permission.BILLING_EDIT,
      ],
      [UserRole.MODERATOR]: [
        Permission.USERS_VIEW,
        Permission.CONTENT_VIEW,
        Permission.CONTENT_CREATE,
        Permission.CONTENT_EDIT,
        Permission.TICKETS_VIEW,
        Permission.TICKETS_EDIT,
      ],
      [UserRole.PREMIUM]: [
        Permission.CONTENT_VIEW,
        Permission.CONTENT_CREATE,
        Permission.CONTENT_EDIT,
      ],
      [UserRole.USER]: [
        Permission.CONTENT_VIEW
      ]
    };

    const permissions = rolePermissions[this.role as UserRole] || [];
    return permissions.includes(permission);
  };

  schema.methods.hasAllPermissions = function (permissions: string[]): boolean {
    return permissions.every(p => this.hasPermission(p));
  };

  schema.methods.hasAnyPermission = function (permissions: string[]): boolean {
    return permissions.some(p => this.hasPermission(p));
  };

  schema.methods.getAllPermissions = function (): Permission[] {
    // Super Admin always has all permissions
    if (this.role === UserRole.SUPER_ADMIN) {
      return Object.values(Permission) as Permission[];
    }

    const explicitPermissions = (this.permissions || []) as Permission[];
    
    const rolePermissionsMap: Record<string, Permission[]> = {
      [UserRole.ADMIN]: [
        Permission.USERS_VIEW,
        Permission.USERS_CREATE,
        Permission.USERS_EDIT,
        Permission.USERS_DELETE,
        Permission.ROLES_VIEW,
        Permission.ROLES_EDIT,
        Permission.CONTENT_VIEW,
        Permission.CONTENT_CREATE,
        Permission.CONTENT_EDIT,
        Permission.CONTENT_DELETE,
        Permission.SYSTEM_VIEW,
        Permission.SYSTEM_SETTINGS,
        Permission.ANALYTICS_VIEW,
        Permission.TICKETS_VIEW,
        Permission.TICKETS_EDIT,
        Permission.BILLING_VIEW,
        Permission.BILLING_EDIT,
      ],
      [UserRole.MODERATOR]: [
        Permission.USERS_VIEW,
        Permission.CONTENT_VIEW,
        Permission.CONTENT_CREATE,
        Permission.CONTENT_EDIT,
        Permission.TICKETS_VIEW,
        Permission.TICKETS_EDIT,
      ],
      [UserRole.PREMIUM]: [
        Permission.CONTENT_VIEW,
        Permission.CONTENT_CREATE,
        Permission.CONTENT_EDIT,
      ],
      [UserRole.USER]: [
        Permission.CONTENT_VIEW
      ]
    };

    const defaultPermissions = rolePermissionsMap[this.role as UserRole] || [];
    
    // Combine and remove duplicates
    return Array.from(new Set([...explicitPermissions, ...defaultPermissions]));
  };

  schema.methods.getRoleLevel = function (): number {
    const roleLevels: Record<string, number> = {
      [UserRole.USER]: 1,
      [UserRole.PREMIUM]: 2,
      [UserRole.MODERATOR]: 3,
      [UserRole.ADMIN]: 4,
      [UserRole.SUPER_ADMIN]: 5
    };

    return roleLevels[this.role as UserRole] || 0;
  };

  // Renamed method to avoid conflict with virtual property
  schema.methods.isAdminUser = function (): boolean {
    return this.role === UserRole.ADMIN || this.role === UserRole.SUPER_ADMIN;
  };

  // Subscription methods
  schema.methods.hasActiveSubscription = function (): boolean {
    return !!(this.subscription &&
      this.subscription.status === 'active' &&
      (!this.subscription.expiresAt || this.subscription.expiresAt > new Date()));
  };

  schema.methods.hasFeature = function (feature: string): boolean {
    if (this.role === UserRole.PREMIUM || this.role === UserRole.ADMIN || this.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    return !!(this.subscription &&
      this.subscription.features &&
      this.subscription.features.includes(feature));
  };
};