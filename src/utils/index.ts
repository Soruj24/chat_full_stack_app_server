import { Request } from "express";
import Session from "../models/Session";
import { IUser } from "../types";
import { createJSONWebToken } from "../helper/jsonwebtoken";
import { jwtAccessKey, jwtRefreshKey } from "../secret";
import { AUTH_CONSTANTS } from "../Constants";
import createError from "http-errors";
import User from "../models/schemas/User";
import speakeasy from "speakeasy";
import bcrypt from "bcryptjs";

export const getDeviceInfo = (req: Request): string => {
  const userAgent = req.headers["user-agent"] || "Unknown";

  if (/Mobile|Android|iPhone|iPad|iPod/i.test(userAgent)) {
    return "Mobile";
  } else if (/Tablet|iPad/i.test(userAgent)) {
    return "Tablet";
  } else {
    return "Desktop";
  }
};

export const getClientIP = (req: Request): string => {
  return (
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    "Unknown"
  );
};

export const validateUserStatus = (user: IUser): void => {
  if (user.isBanned) {
    throw createError(
      403,
      "Your account has been suspended. Please contact support."
    );
  }

  if ((user as any).status !== "active") {
    throw createError(
      403,
      "Your account is not active. Please contact support."
    );
  }
};

export const trackFailedLoginAttempt = async (user: IUser): Promise<void> => {
  const loginAttempts = ((user as any).loginAttempts || 0) + 1;
  const lockoutUntil =
    loginAttempts >= AUTH_CONSTANTS.MAX_LOGIN_ATTEMPTS
      ? new Date(Date.now() + AUTH_CONSTANTS.LOCKOUT_TIME)
      : null;

  await User.findByIdAndUpdate(user._id, {
    loginAttempts,
    lockoutUntil: lockoutUntil || undefined,
  });
};

export const resetLoginAttempts = async (user: IUser): Promise<void> => {
  await User.findByIdAndUpdate(user._id, {
    loginAttempts: 0,
    $unset: { lockoutUntil: 1 },
  });
};

export const checkAccountLockout = (user: IUser): void => {
  if (
    (user as any).lockoutUntil &&
    new Date((user as any).lockoutUntil) > new Date()
  ) {
    const timeLeft = Math.ceil(
      (new Date((user as any).lockoutUntil).getTime() - Date.now()) / 60000
    );
    throw createError(
      423,
      `Account temporarily locked. Try again in ${timeLeft} minutes.`
    );
  }
};

export const verifyTwoFactorCode = async (
  user: IUser,
  twoFactorCode: string
): Promise<{ isValid: boolean; isBackupCode: boolean }> => {
  if (!user.twoFactorAuth?.enabled || !(user.twoFactorAuth as any)?.secret) {
    return { isValid: false, isBackupCode: false };
  }

  // Verify TOTP code
  const isValidTOTP = speakeasy.totp.verify({
    secret: (user.twoFactorAuth as any).secret,
    encoding: "base32",
    token: twoFactorCode,
    window: 2,
  });

  if (isValidTOTP) {
    return { isValid: true, isBackupCode: false };
  }

  // Verify backup codes
  if ((user.twoFactorAuth as any)?.backupCodes) {
    for (let i = 0; i < (user.twoFactorAuth as any).backupCodes.length; i++) {
      const match = await bcrypt.compare(
        twoFactorCode,
        (user.twoFactorAuth as any).backupCodes[i]
      );
      if (match) {
        // Remove used backup code
        (user.twoFactorAuth as any).backupCodes.splice(i, 1);
        await User.findByIdAndUpdate(user._id, {
          twoFactorAuth: user.twoFactorAuth,
        });
        return { isValid: true, isBackupCode: true };
      }
    }
  }

  return { isValid: false, isBackupCode: false };
};

// Token generation
export const generateAuthTokens = (
  user: IUser
): { accessToken: string; refreshToken: string } => {
  if (!jwtAccessKey || !jwtRefreshKey) {
    throw new Error("JWT keys not configured");
  }
  const tokenPayload = {
    id: user._id.toString(),
    email: user.email,
    role: (user as any).role || "user",
    username: user.username,
  };

  const accessToken = createJSONWebToken(
    tokenPayload,
    jwtAccessKey,
    AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY
  );
  const refreshToken = createJSONWebToken(
    tokenPayload,
    jwtRefreshKey,
    AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY
  );

  return { accessToken, refreshToken };
};

// User sanitization
export const sanitizeUser = (user: IUser): Partial<IUser> => {
  const userObject = (user as any).toObject
    ? (user as any).toObject()
    : { ...user };
  delete (userObject as any).password;

  if (userObject.twoFactorAuth?.secret) {
    delete userObject.twoFactorAuth.secret;
  }

  return userObject;
};

// Update login history
export const updateLoginHistory = async (
  user: IUser,
  req: Request
): Promise<void> => {
  (user as any).lastLogin = new Date();
  (user as any).loginHistory = (user as any).loginHistory || [];

  (user as any).loginHistory.push({
    ipAddress: getClientIP(req),
    userAgent: req.get("User-Agent") || "Unknown",
    timestamp: new Date(),
    deviceInfo: getDeviceInfo(req),
  });

  // Keep only last 10 login entries
  if ((user as any).loginHistory.length > 10) {
    (user as any).loginHistory = (user as any).loginHistory.slice(-10);
  }

  await User.findByIdAndUpdate(user._id, {
    lastLogin: (user as any).lastLogin,
    loginHistory: (user as any).loginHistory,
  });
};

// Session Management
export const createSession = async (
  userId: string,
  tokens: { accessToken: string; refreshToken: string },
  req: Request
): Promise<any> => {
  const session = new Session({
    userId,
    ...tokens,
    userAgent: req.get("User-Agent") || "Unknown",
    ipAddress: getClientIP(req),
    deviceInfo: getDeviceInfo(req),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  await session.save();
  return session;
};

// Add this utility function to generate 6-character alphanumeric tokens
export const generateSixDigitToken = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};
