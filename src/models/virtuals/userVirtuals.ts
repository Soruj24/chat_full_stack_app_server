// models/virtuals/userVirtuals.ts
import { Schema } from "mongoose";
import { IUserDoc } from "../types/UserTypes";
import { UserStatus, UserRole } from "../interfaces/IUser";

export const applyUserVirtuals = (schema: Schema<IUserDoc>) => {
  schema.virtual('fullName').get(function (this: IUserDoc) {
    const firstName = this.firstName || '';
    const lastName = this.lastName || '';
    return `${firstName} ${lastName}`.trim() || this.username;
  });

  schema.virtual('displayNameOrUsername').get(function (this: IUserDoc) {
    return this.displayName || this.fullName || this.username;
  });

  schema.virtual('isAccountActive').get(function (this: IUserDoc) {
    return this.status === UserStatus.ACTIVE &&
      this.isActive &&
      !this.isBanned &&
      !this.isSuspended &&
      !this.isDeleted;
  });

  schema.virtual('accountAgeInDays').get(function (this: IUserDoc) {
    const createdAt = this.accountCreatedAt || this.createdAt || new Date();
    return Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  });

  schema.virtual('lastActive').get(function (this: IUserDoc) {
    return this.lastSeen || this.updatedAt || new Date();
  });

  schema.virtual('profileCompletion').get(function (this: IUserDoc) {
    let completion = 0;
    const totalFields = 8;

    if (this.username) completion += 12.5;
    if (this.email && this.emailVerified) completion += 12.5;
    if (this.firstName) completion += 12.5;
    if (this.lastName) completion += 12.5;
    if (this.avatar && this.avatar.url) completion += 12.5;
    if (this.bio) completion += 12.5;
    if (this.dateOfBirth) completion += 12.5;
    if (this.phone && this.phoneVerified) completion += 12.5;

    return Math.min(completion, 100);
  });

  schema.virtual('totalConnections').get(function (this: IUserDoc) {
    const followersCount = this.followers ? this.followers.length : 0;
    const followingCount = this.following ? this.following.length : 0;
    const friendsCount = this.friends ? this.friends.length : 0;

    return followersCount + followingCount + friendsCount;
  });

  schema.virtual('isAdmin').get(function (this: IUserDoc) {
    return this.role === UserRole.ADMIN || this.role === UserRole.SUPER_ADMIN;
  });
};