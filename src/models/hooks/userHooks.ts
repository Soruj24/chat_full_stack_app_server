// models/hooks/userHooks.ts
import { Schema, CallbackError } from "mongoose";
import bcrypt from "bcryptjs";
import { IUserDoc } from "../types/UserTypes";
import { USER_CONSTANTS } from "../constants/UserConstants";
import { sanitizeUserAgent, getDeviceInfo } from "../utils/UserUtils";

export const applyUserHooks = (schema: Schema<IUserDoc>) => {
  // Pre-save middleware
  schema.pre<IUserDoc>("save", async function () {
    try {
      // Hash password if modified
      if (this.isModified("password") && this.password) {
        const salt = await bcrypt.genSalt(USER_CONSTANTS.PASSWORD.SALT_ROUNDS);
        this.password = await bcrypt.hash(this.password, salt);
        this.passwordChangedAt = new Date();
      }

      // Normalize username and email
      if (this.isModified("username")) {
        this.username = this.username.trim().toLowerCase();
      }

      if (this.isModified("email") && this.email) {
        this.email = this.email.toLowerCase().trim();
      }

      // Ensure only one default address
      if (this.isModified("addresses") && this.addresses && this.addresses.length > 0) {
        const defaultAddresses = this.addresses.filter(addr => addr.isDefault);
        if (defaultAddresses.length > 1) {
          const firstDefaultIndex = this.addresses.findIndex(addr => addr.isDefault);
          this.addresses.forEach((addr, index) => {
            addr.isDefault = index === firstDefaultIndex;
          });
        }
      }

      // Limit login history entries
      if (this.loginHistory && this.loginHistory.length > USER_CONSTANTS.LIMITS.MAX_LOGIN_HISTORY) {
        this.loginHistory = this.loginHistory
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, USER_CONSTANTS.LIMITS.MAX_LOGIN_HISTORY);
      }

      // Clean up expired sessions
      if (this.sessions) {
        const now = new Date();
        this.sessions = this.sessions.filter(session => {
          const sessionTimeout = this.preferences?.security?.sessionTimeout || 60;
          const expiryTime = new Date(session.lastActivity.getTime() + sessionTimeout * 60 * 1000);
          return session.isActive && expiryTime > now;
        });
      }
    } catch (error) {
      throw error;
    }
  });

  // Pre-find middleware
  schema.pre(['find', 'findOne', 'findOneAndUpdate'], function () {
    const filter = this.getFilter();
    if (!filter.hasOwnProperty('isDeleted')) {
      this.where({ isDeleted: { $ne: true } });
    }
  });

  // Post-save middleware for audit logging
  schema.post<IUserDoc>('save', async function (doc) {
    if (doc.isNew) {
      await doc.addAuditLog('USER_CREATED', {
        username: doc.username,
        email: doc.email,
        role: doc.role
      });
    }
  });
};