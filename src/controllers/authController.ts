import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { UserRole } from "../models/interfaces/IUser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import createError from "http-errors";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import crypto from "crypto";
 
import { createJSONWebToken } from "../helper/jsonwebtoken";
import { setAccessTokenCookie, setRefreshTokenCookie } from "../helper/cookie";
import { successResponse } from "./responsControllers";
import {
  CreateUserBody,
  IUser,
  PasswordChangeBody,
  UserParams,
  AuthRequest,
  GetUsersQuery,
} from "../types";
import { jwtAccessKey, jwtRefreshKey } from "../secret";
import User from "../models/schemas/User";
import Session from "../models/Session";
import UserActivity from "../models/UserActivity";
import { findUser } from "../services/userServices";
import { notificationService } from "../services/notificationService";

import { AUTH_CONSTANTS } from "../Constants";
import {
  checkAccountLockout,
  createSession,
  generateAuthTokens,
  getClientIP,
  resetLoginAttempts,
  sanitizeUser,
  trackFailedLoginAttempt,
  updateLoginHistory,
  validateUserStatus,
  verifyTwoFactorCode,
} from "../utils";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  sendAdminToUserEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} from "../helper/email";
import cloudinary from "../config/cloudinary";
import { uploadToCloudinary } from "../utils/cloudinary";

// Update the handleCreateUser function to ensure consistent token generation
const handleCreateUser = asyncHandler(
  async (
    req: Request<{}, {}, CreateUserBody>,
    res: Response,
    next: NextFunction
  ) => {
    const {
      username,
      email,
      password,
      // socketId,
      userLanguage,
      firstName,
      lastName,
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() },
      ],
    });

    if (existingUser) {
      let errorMessage = "User already exists";
      if (existingUser.username === username.toLowerCase()) {
        errorMessage = "Username already exists";
      } else if (existingUser.email === email.toLowerCase()) {
        errorMessage = "Email already exists";
      }
      return next(createError(400, errorMessage));
    }

    // Get user's IP address
    const userIP = getClientIP(req);

    // Generate consistent token (6-digit numeric for better UX)
    const emailVerificationToken = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const emailVerificationExpires = new Date(Date.now() + 60 * 1000);

    const newUserData = {
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      // socketId,
      password,
      userLanguage: userLanguage,
      firstName,
      lastName,
      role: "user",
      emailVerified: false,
      emailVerificationToken,
      emailVerificationExpires,
      status: "pending",
      registrationIP: userIP,
      detectedCountry: (req.headers["cf-ipcountry"] as string) || undefined,
      metadata: {
        userAgent: req.get("User-Agent"),
        ipAddress: userIP,
        signupFlow: "standard",
      },
    };

    const user = await User.create(newUserData);

    // Log user creation activity
    await UserActivity.create({
      userId: user._id,
      activityType: "account_creation",
      description: "User account created successfully - Pending verification",
      ipAddress: userIP,
      userAgent: req.get("User-Agent"),
      metadata: {
        verificationToken: emailVerificationToken,
      },
      status: "success",
    });

    // Send verification email (non-blocking)
    try {
      const emailResult = await sendVerificationEmail(
        user.email!,
        user.firstName || user.username,
        emailVerificationToken
      );

      if (emailResult.success) {
        console.log(
          "✅ Verification email sent with token:",
          emailVerificationToken
        );
      } else {
        console.error("❌ Failed to send verification email:", emailResult.error);
        // We don't necessarily want to fail the whole registration if email fails, 
        // but we should at least not log it as success.
      }
    } catch (error) {
      console.error("Unexpected error in email sending flow:", error);
    }

    return successResponse(res, {
      statusCode: 201,
      message:
        "User created successfully. Please check your email for verification instructions.",
      payload: {
        user: sanitizeUser(user as unknown as IUser),
        requiresVerification: true,
      },
    });
  }
);

// Update the handleVerifyEmail function to be more flexible
const handleVerifyEmail = asyncHandler(
  async (
    req: Request<{}, {}, { token: string; email: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const { token, email } = req.body;

    console.log("Verification attempt:", { email, token }); // Debug log

    if (!token) {
      return next(createError(400, "Verification token is required"));
    }

    if (!email) {
      return next(createError(400, "Email is required"));
    }

    // Find user by email and token (be more flexible with token format)
    const user = await User.findOne({
      email: email.toLowerCase(),
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });

    console.log("Found user for verification:", user ? "yes" : "no"); // Debug log

    if (!user) {
      // Additional debug: check what tokens exist for this email
      const userWithEmail = await User.findOne({ email: email.toLowerCase() });
      if (userWithEmail) {
        console.log("User exists but token mismatch:", {
          storedToken: userWithEmail.emailVerificationToken,
          providedToken: token,
          tokenExpires: userWithEmail.emailVerificationExpires,
          isExpired: userWithEmail.emailVerificationExpires
            ? userWithEmail.emailVerificationExpires < new Date()
            : false,
        });
      }

      return next(createError(400, "Invalid or expired verification token"));
    }

    // Mark email as verified
    (user as any).emailVerified = true;
    (user as any).emailVerificationToken = undefined;
    (user as any).emailVerificationExpires = undefined;
    (user as any).emailVerifiedAt = new Date();
    (user as any).status = "active"; // Update status to active
    await user.save();

    // Send welcome email
    try {
      const emailResult = await sendWelcomeEmail(user.email!, user.firstName || user.username);
      if (emailResult.success) {
        console.log("✅ Welcome email sent to:", user.email);
      } else {
        console.error("❌ Failed to send welcome email:", emailResult.error);
      }
    } catch (error) {
      console.error("Unexpected error sending welcome email:", error);
    }

    // Log verification activity
    await UserActivity.create({
      userId: user._id,
      activityType: "email_verified",
      description: "Email verified successfully",
      ipAddress: getClientIP(req),
      userAgent: req.get("User-Agent"),
      status: "success",
    });

    console.log("Email verified successfully for user:", user.email); // Debug log

    return successResponse(res, {
      statusCode: 200,
      message: "Email verified successfully",
      payload: { user: sanitizeUser(user as unknown as IUser) },
    });
  }
);

const handleLogIn = asyncHandler(
  async (
    req: Request<
      {},
      {},
      { email: string; password: string; twoFactorCode?: string }
    >,
    res: Response,
    next: NextFunction
  ) => {
    const { email, password, twoFactorCode } = req.body;

    // Find user
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return next(createError(401, "User not found with this Email."));
    }

    // Check account lockout
    checkAccountLockout(user as unknown as IUser);

    // Account status checks
    try {
      validateUserStatus(user as unknown as IUser);
    } catch (error) {
      return next(error);
    }

    // Password verification
    const isPasswordValid = await bcrypt.compare(password, user.password || "");
    if (!isPasswordValid) {
      await trackFailedLoginAttempt(user as unknown as IUser);
      return next(createError(401, "Invalid password"));
    }

    // Reset login attempts on successful password verification
    await resetLoginAttempts(user as unknown as IUser);

    // 2FA handling
    if ((user as any).twoFactorAuth?.enabled) {
      if (!twoFactorCode) {
        return successResponse(res, {
          statusCode: 206,
          message: "Two-factor authentication required",
          payload: {
            requires2FA: true,
            userId: user.id.toString(),
          },
        });
      }

      const { isValid, isBackupCode } = await verifyTwoFactorCode(
        user as unknown as IUser,
        twoFactorCode
      );
      if (!isValid) {
        return next(
          createError(
            401,
            `Invalid ${isBackupCode ? "backup code" : "authentication code"}`
          )
        );
      }
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateAuthTokens(
      user as unknown as IUser
    );

    // Create session
    const session = await createSession(
      user.id.toString(),
      { accessToken, refreshToken },
      req
    );

    // Update user login info
    await updateLoginHistory(user as unknown as IUser, req);

    // Send login notification
    await notificationService.sendToUser(user._id as any, {
      title: "New Login Detected",
      message: `You successfully logged in from ${getClientIP(req)}`,
      type: "info",
      category: "security",
      priority: "low",
    });

    // Set cookies
    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken);

    // Success response
    return successResponse(res, {
      statusCode: 200,
      message: "Login successful",
      payload: {
        user: {
          ...sanitizeUser(user as unknown as IUser),
          accessToken,
          refreshToken,
        },
        session: {
          id: session.id.toString(),
          expiresAt: session.expiresAt,
        },
      },
    });
  }
);

const handleRefreshToken = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const oldRefreshToken = req.cookies.refreshToken;

    if (!oldRefreshToken) {
      return next(createError(401, "Refresh token not found"));
    }

    if (!jwtRefreshKey) {
      return next(createError(500, "JWT refresh key is not defined"));
    }

    try {
      const decoded = jwt.verify(
        oldRefreshToken,
        jwtRefreshKey
      ) as jwt.JwtPayload;
      if (!decoded || !decoded.id) {
        return next(createError(401, "Invalid refresh token"));
      }

      // Check if session exists and is valid
      const session = await Session.findOne({
        refreshToken: oldRefreshToken,
        expiresAt: { $gt: new Date() },
        revokedAt: { $exists: false },
      });

      if (!session) {
        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");
        return next(createError(401, "Session expired or invalid"));
      }

      // Create consistent payload for new tokens
      const user = await User.findById(decoded.id);
      if (!user) {
        return next(createError(404, "User not found"));
      }

      const tokenPayload = {
        id: user.id.toString(),
        email: user.email,
        role: user.role || "user",
      };

      // Generate new tokens with consistent payload
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

      // Update session with new tokens
      session.accessToken = accessToken;
      session.refreshToken = refreshToken;
      session.lastActiveAt = new Date();
      session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await session.save();

      // Set cookies
      setAccessTokenCookie(res, accessToken);
      setRefreshTokenCookie(res, refreshToken);

      return successResponse(res, {
        statusCode: 200,
        message: "Tokens refreshed successfully",
        payload: {
          accessToken,
          refreshToken, // Include in response if needed for mobile/other clients
        },
      });
    } catch (error) {
      console.error("Refresh token error:", error);

      // Clear invalid cookies
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");

      return next(createError(401, "Invalid refresh token"));
    }
  }
);

const handleProtected = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const accessToken =
      req.cookies.accessToken ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!accessToken) {
      return next(createError(401, "Access token not found"));
    }

    if (!jwtAccessKey) {
      return next(createError(500, "JWT access key is not defined"));
    }

    const decoded = jwt.verify(accessToken, jwtAccessKey) as jwt.JwtPayload;
    if (!decoded || !decoded.id) {
      return next(createError(401, "Invalid access token"));
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return next(createError(404, "User not found"));
    }

    // Check if user is banned
    if (user.isBanned) {
      return next(createError(403, "Your account has been suspended."));
    }

    return successResponse(res, {
      statusCode: 200,
      message: "Protected route accessed successfully",
      payload: { user },
    });
  }
);

const handleLogOut = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const accessToken = req.cookies?.accessToken;
    const userId = req.user?._id;

    if (userId && accessToken) {
      // Revoke current session
      await Session.findOneAndUpdate(
        { userId, accessToken },
        { revokedAt: new Date(), revokedBy: userId }
      );
    }

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    return successResponse(res, {
      statusCode: 200,
      message: "User logged out successfully",
    });
  }
);

const handleSocialLogin = asyncHandler(
  async (
    req: Request<{}, {}, {
      provider: "google" | "github" | "facebook";
      providerId: string;
      email: string;
      firstName?: string;
      lastName?: string;
      avatar?: string;
      username?: string;
    }>,
    res: Response,
    next: NextFunction
  ) => {
    const {
      provider,
      providerId,
      email,
      firstName,
      lastName,
      avatar,
      username,
    } = req.body;

    // Check if user exists with this provider ID
    const providerQuery: any = {};
    providerQuery[`${provider}Id`] = providerId;
    
    let user = await User.findOne(providerQuery);

    if (!user) {
      // Check if user exists with this email
      user = await User.findOne({ email: email.toLowerCase() });

      if (user) {
        // Link provider to existing account
        (user as any)[`${provider}Id`] = providerId;
        if (avatar && !user.avatar?.url) {
          user.avatar = {
            url: avatar,
            publicId: `social_${provider}_${providerId}`,
            uploadedAt: new Date()
          };
        }
        await user.save();
      } else {
        // Create new user
        const baseUsername = username || email.split("@")[0];
        let finalUsername = baseUsername.toLowerCase().replace(/[^a-z0-9]/g, "");
        
        // Ensure username is unique
        const existingUsername = await User.findOne({ username: finalUsername });
        if (existingUsername) {
          finalUsername = `${finalUsername}${Math.floor(1000 + Math.random() * 9000)}`;
        }

        user = await User.create({
          username: finalUsername,
          email: email.toLowerCase(),
          firstName,
          lastName,
          displayName: firstName && lastName ? `${firstName} ${lastName}` : firstName || finalUsername,
          emailVerified: true, // Social emails are usually pre-verified
          status: "active",
          [`${provider}Id`]: providerId,
          avatar: avatar ? {
            url: avatar,
            publicId: `social_${provider}_${providerId}`,
            uploadedAt: new Date()
          } : undefined,
          registrationIP: getClientIP(req),
          metadata: {
            userAgent: req.get("User-Agent"),
            signupFlow: `social_${provider}`,
          },
        });
      }
    }

    // Standard login flow
    checkAccountLockout(user as unknown as IUser);
    validateUserStatus(user as unknown as IUser);
    await resetLoginAttempts(user as unknown as IUser);

    // Generate tokens
    const { accessToken, refreshToken } = generateAuthTokens(
      user as unknown as IUser
    );

    // Create session
    const session = await createSession(
      user.id.toString(),
      { accessToken, refreshToken },
      req
    );

    // Update login history
    await updateLoginHistory(user as unknown as IUser, req);

    // Set cookies
    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken);

    return successResponse(res, {
      statusCode: 200,
      message: "Login successful",
      payload: {
        user: {
          ...sanitizeUser(user as unknown as IUser),
          accessToken,
          refreshToken,
        },
        session: {
          id: session.id.toString(),
          expiresAt: session.expiresAt,
        },
      },
    });
  }
);

const handleGetMe = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return next(createError(404, "User not found"));
    }

    return successResponse(res, {
      statusCode: 200,
      message: "User retrieved successfully",
      payload: { user: sanitizeUser(user) },
    });
  }
);

const handleGetAllUsers = asyncHandler(
  async (
    req: Request<{}, {}, {}, GetUsersQuery>,
    res: Response,
    next: NextFunction
  ) => {
    const search = req.query.search || "";
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const role = (req.query as GetUsersQuery & { role?: string }).role;
    const status = (req.query as GetUsersQuery & { status?: string }).status;
    const isBanned = (req.query as GetUsersQuery & { isBanned?: string })
      .isBanned;

    const searchRegExp = new RegExp(".*" + search + ".*", "i");

    const filter: any = {
      role: { $nin: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
      $or: [
        { firstName: { $regex: searchRegExp } },
        { lastName: { $regex: searchRegExp } },
        { email: { $regex: searchRegExp } },
        { username: { $regex: searchRegExp } },
      ],
    };

    // Add additional filters
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (isBanned !== undefined) filter.isBanned = isBanned === "true";

    const users = await User.find(filter, { password: 0, __v: 0 })
      .limit(limit)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await User.countDocuments(filter);
    if (!users || users?.length === 0) {
      return next(createError(404, "No users found"));
    }

    return successResponse(res, {
      statusCode: 200,
      message: "Users were returned successfully",
      payload: {
        users: users.map((user) => sanitizeUser(user as unknown as IUser)),
        totalUsers: count,
        pagination: {
          totalPage: Math.ceil(count / limit),
          currentPage: page,
          previousPage: page - 1 > 0 ? page - 1 : null,
          nextPage: page + 1 <= Math.ceil(count / limit) ? page + 1 : null,
        },
      },
    });
  }
);

const handleGetUser = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId).select(
        "-password -twoFactorSecret -refreshToken -resetPasswordToken"
      );

      if (!user) {
        return next(createError(404, "User not found"));
      }

      return successResponse(res, {
        statusCode: 200,
        message: "User retrieved successfully",
        payload: { user },
      });
    } catch (error) {
      return next(createError(500, "Failed to retrieve user"));
    }
  }
);
const handleChangedPassword = asyncHandler(
  async (
    req: Request<UserParams, {}, PasswordChangeBody>,
    res: Response,
    next: NextFunction
  ) => {
    const { oldPassword, newPassword } = req.body;
    const { userId } = req.params;

    if (!oldPassword || !newPassword) {
      return next(createError(400, "Old and new passwords are required"));
    }

    // Find user with password field
    const user = await findUser(userId);

    console.log("User:", oldPassword, newPassword);

    // Verify old password
    const isMatch = await bcrypt.compare(oldPassword, user?.password || "");
    console.log(isMatch);
    if (!isMatch) {
      return next(createError(401, "Old password is incorrect"));
    }

    // Check if new password is same as old password
    const isSamePassword = await bcrypt.compare(
      newPassword,
      user.password || ""
    );
    if (isSamePassword) {
      return next(
        createError(400, "New password cannot be the same as the old password")
      );
    }

    try {
      // Simply set the new password - the pre-save middleware will automatically hash it
      user.password = newPassword;
      (user as any).passwordChangedAt = new Date();

      // Save the user - password will be automatically hashed by the pre-save hook
      await user.save();

      // Revoke all sessions for security
      await Session.updateMany(
        { userId: userId },
        {
          revokedAt: new Date(),
          revokedBy: userId,
          revocationReason: "password_changed",
        }
      );

      // Log password change activity
      await UserActivity.create({
        userId: userId,
        activityType: "password_changed",
        description: "Password changed successfully",
        ipAddress: getClientIP(req as unknown as Request),
        userAgent: req.get("User-Agent"),
        status: "success",
      });

      return successResponse(res, {
        statusCode: 200,
        message: "Password changed successfully",
      });
    } catch (error: any) {
      // Handle validation errors from the User model
      if (error.name === "ValidationError") {
        const errors = Object.values(error.errors).map(
          (err: any) => err.message
        );
        return next(createError(400, errors.join(", ")));
      }
      return next(error);
    }
  }
);

const handleForgotPassword = asyncHandler(
  async (
    req: Request<{}, {}, { email: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const { email } = req.body;

    if (!email) {
      return next(createError(400, "Email is required"));
    }

    const user = await User.findOne({ email });
    if (!user) {
      // For security reasons, don't reveal if email exists
      return successResponse(res, {
        statusCode: 200,
        message: "If the email exists, a password reset link has been sent",
      });
    }

    // Generate reset token
    const resetToken = createJSONWebToken(
      { userId: user._id, type: "password_reset" },
      jwtAccessKey,
      AUTH_CONSTANTS.RESET_TOKEN_EXPIRY
    );

    // Store reset token in user document
    (user as any).resetPasswordToken = resetToken;
    (user as any).resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    // Send password reset email
    try {
      const emailResult = await sendPasswordResetEmail(
        user.email!,
        user.firstName || user.username,
        resetToken
      );
      if (emailResult.success) {
        console.log("✅ Password reset email sent to:", user.email);
      } else {
        console.error("❌ Failed to send password reset email:", emailResult.error);
        // For security reasons, we might still want to return a success message to the client
        // to prevent email enumeration, but we should log the error internally.
      }
    } catch (error) {
      console.error("Unexpected error sending password reset email:", error);
    }

    return successResponse(res, {
      statusCode: 200,
      message: "If the email exists, a password reset link has been sent",
      payload: {
        resetToken:
          process.env.NODE_ENV === "development" ? resetToken : undefined,
      },
    });
  }
);

const handleResetPassword = asyncHandler(
  async (
    req: Request<{}, {}, { token: string; newPassword: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const { token, newPassword } = req.body;
    console.log(token, newPassword);

    if (!token || !newPassword) {
      return next(createError(400, "Token and new password are required"));
    }

    // Verify token
    let decoded: jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, jwtAccessKey) as jwt.JwtPayload;
    } catch (error) {
      return next(createError(400, "Invalid or expired reset token"));
    }

    if (!decoded || decoded.type !== "password_reset") {
      return next(createError(400, "Invalid or expired reset token"));
    }

    const user = await User.findOne({
      _id: decoded.userId,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return next(createError(400, "Invalid or expired reset token"));
    }

    // Update password and clear reset token
    (user as any).password = newPassword;
    (user as any).resetPasswordToken = undefined;
    (user as any).resetPasswordExpires = undefined;
    (user as any).passwordChangedAt = new Date();
    await user.save();

    // Revoke all existing sessions
    await Session.updateMany(
      { userId: user._id },
      { revokedAt: new Date(), revokedBy: user._id }
    );

    return successResponse(res, {
      statusCode: 200,
      message: "Password reset successfully",
    });
  }
);

const handleSendVerificationEmail = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id;
    const user = await User.findById(userId);

    if (!user) {
      return next(createError(404, "User not found"));
    }

    if (user.emailVerified) {
      return next(createError(400, "Email is already verified"));
    }

    // Generate verification token
    const verificationToken = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    // Store verification token
    (user as any).emailVerificationToken = verificationToken;
    (user as any).emailVerificationExpires = new Date(Date.now() + 60 * 1000);
    await user.save();

    // Send verification email
    try {
      const emailResult = await sendVerificationEmail(
        user.email!,
        user.firstName || user.username,
        verificationToken
      );
      if (emailResult.success) {
        console.log("✅ Verification email resent to:", user.email);
      } else {
        console.error("❌ Failed to resend verification email:", emailResult.error);
        return next(createError(500, `Failed to send verification email: ${emailResult.error}`));
      }
    } catch (error) {
      console.error("Unexpected error resending verification email:", error);
      return next(createError(500, "Unexpected error in email flow"));
    }

    return successResponse(res, {
      statusCode: 200,
      message: "Verification email sent successfully",
      payload: {
        verificationToken:
          process.env.NODE_ENV === "development"
            ? verificationToken
            : undefined,
      },
    });
  }
);

const handleSetupTwoFactor = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id;
    const user = await User.findById(userId);
    if (!user) {
      return next(createError(404, "User not found"));
    }

    if ((user as any).twoFactorAuth?.enabled) {
      return next(
        createError(400, "Two-factor authentication is already enabled")
      );
    }

    // Generate secret and backup codes
    const secret = speakeasy.generateSecret({
      name: `YourApp (${user.email})`,
      issuer: "YourApp",
      length: 20,
    });

    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString("hex").toUpperCase()
    );

    // Generate QR code URL
    const otpauthUrl = secret.otpauth_url;

    // Store secret and backup codes (hashed)
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, 12))
    );

    (user as any).twoFactorAuth = {
      secret: secret.base32,
      backupCodes: hashedBackupCodes,
      enabled: false,
      setupAt: new Date(),
    };
    await user.save();

    // Generate QR code as data URL
    let qrCodeDataUrl = "";
    if (otpauthUrl) {
      qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    }

    return successResponse(res, {
      statusCode: 200,
      message: "Two-factor authentication setup initiated",
      payload: {
        qrCodeUrl: qrCodeDataUrl,
        secret:
          process.env.NODE_ENV === "development" ? secret.base32 : undefined,
        backupCodes:
          process.env.NODE_ENV === "development" ? backupCodes : undefined,
      },
    });
  }
);

const handleVerifyTwoFactor = asyncHandler(
  async (
    req: Request<{}, {}, { code: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const { code } = req.body;
    const userId = (req as AuthRequest).user!._id;

    if (!code) {
      return next(createError(400, "Verification code is required"));
    }

    const user = await User.findById(userId);
    if (!user || !(user as any).twoFactorAuth?.secret) {
      return next(createError(400, "Two-factor authentication not set up"));
    }

    // Verify the code
    const isValid = speakeasy.totp.verify({
      secret: (user as any).twoFactorAuth.secret,
      encoding: "base32",
      token: code,
      window: 2,
    });

    let usedBackupCode = false;

    if (!isValid && (user as any).twoFactorAuth.backupCodes) {
      // Check backup codes
      for (let i = 0; i < (user as any).twoFactorAuth.backupCodes.length; i++) {
        const match = await bcrypt.compare(
          code,
          (user as any).twoFactorAuth.backupCodes[i]
        );
        if (match) {
          usedBackupCode = true;
          (user as any).twoFactorAuth.backupCodes.splice(i, 1);
          break;
        }
      }
    }

    if (!isValid && !usedBackupCode) {
      return next(createError(400, "Invalid verification code"));
    }

    // Enable 2FA
    (user as any).twoFactorAuth.enabled = true;
    (user as any).twoFactorAuth.enabledAt = new Date();
    await user.save();

    return successResponse(res, {
      statusCode: 200,
      message: "Two-factor authentication enabled successfully",
      payload: {
        backupCodesRemaining: (user as any).twoFactorAuth.backupCodes.length,
        usedBackupCode,
      },
    });
  }
);

const handleDisableTwoFactor = asyncHandler(
  async (
    req: Request<{}, {}, { password: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const { password } = req.body;
    const userId = (req as AuthRequest).user!._id;

    if (!password) {
      return next(
        createError(
          400,
          "Password is required to disable two-factor authentication"
        )
      );
    }

    const user = await User.findById(userId).select("+password");
    if (!user) {
      return next(createError(404, "User not found"));
    }

    const isPasswordValid = await bcrypt.compare(password, user.password || "");
    if (!isPasswordValid) {
      return next(createError(401, "Invalid password"));
    }

    (user as any).twoFactorAuth = {
      enabled: false,
      secret: undefined,
      backupCodes: [],
    };
    await user.save();

    return successResponse(res, {
      statusCode: 200,
      message: "Two-factor authentication disabled successfully",
    });
  }
);

const handleGenerateBackupCodes = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id;
    const user = await User.findById(userId);

    if (!user || !(user as any).twoFactorAuth?.enabled) {
      return next(createError(400, "Two-factor authentication is not enabled"));
    }

    const backupCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString("hex").toUpperCase()
    );

    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, 10))
    );

    (user as any).twoFactorAuth.backupCodes = hashedBackupCodes;
    await user.save();

    return successResponse(res, {
      statusCode: 200,
      message: "New backup codes generated successfully",
      payload: {
        backupCodes:
          process.env.NODE_ENV === "development" ? backupCodes : undefined,
      },
    });
  }
);

const handleGetSessions = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id;

    const sessions = await Session.find({
      userId,
      revokedAt: { $exists: false },
    }).sort({ lastActiveAt: -1 });

    return successResponse(res, {
      statusCode: 200,
      message: "Sessions retrieved successfully",
      payload: { sessions },
    });
  }
);

const handleRevokeSession = asyncHandler(
  async (
    req: Request<{ sessionId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const { sessionId } = req.params;
    const userId = (req as AuthRequest).user!._id;

    const session = await Session.findOne({
      _id: sessionId,
      userId,
      revokedAt: { $exists: false },
    });

    if (!session) {
      return next(createError(404, "Session not found"));
    }

    session.revokedAt = new Date();
    session.revokedBy = userId;
    await session.save();

    // If revoking current session, clear cookies
    if (session.accessToken === req.cookies.accessToken) {
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");
    }

    return successResponse(res, {
      statusCode: 200,
      message: "Session revoked successfully",
    });
  }
);

const handleRevokeAllSessions = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id;

    await Session.updateMany(
      {
        userId,
        revokedAt: { $exists: false },
      },
      {
        revokedAt: new Date(),
        revokedBy: userId,
      }
    );

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    return successResponse(res, {
      statusCode: 200,
      message: "All sessions revoked successfully",
    });
  }
);

const handleDeleteAccount = asyncHandler(
  async (
    req: Request<{}, {}, { password: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const { password } = req.body;
    const userId = (req as AuthRequest).user!._id;

    if (!password) {
      return next(createError(400, "Password is required to delete account"));
    }

    const user = await User.findById(userId).select("+password");
    if (!user) {
      return next(createError(404, "User not found"));
    }

    const isPasswordValid = await bcrypt.compare(password, user.password || "");
    if (!isPasswordValid) {
      return next(createError(401, "Invalid password"));
    }

    // Soft delete
    (user as any).deletedAt = new Date();
    (user as any).status = "deleted";
    (user as any).email = `deleted_${user._id}_${user.email}`;
    (user as any).username = `deleted_${user._id}_${user.username}`;
    await user.save();

    // Revoke all sessions
    await Session.updateMany(
      { userId },
      { revokedAt: new Date(), revokedBy: userId }
    );

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    return successResponse(res, {
      statusCode: 200,
      message: "Account deleted successfully",
    });
  }
);

const handleUpdateProfile = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id;
    const updates = req.body;

    // Remove restricted fields
    const restrictedFields = ["password", "email", "role", "isAdmin", "status", "permissions"];
    restrictedFields.forEach((field) => delete updates[field]);

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!user) {
      return next(createError(404, "User not found"));
    }

    return successResponse(res, {
      statusCode: 200,
      message: "Profile updated successfully",
      payload: { user: sanitizeUser(user as unknown as IUser) },
    });
  }
);

/**
 * @desc    Upload user avatar
 * @route   POST /api/auth/profile/avatar
 * @access  Private
 */
const handleUploadAvatar = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.file) {
      throw createError(400, "No file uploaded");
    }

    const userId = req.user!._id;

    try {
      // 1. Upload to Cloudinary
      const result: any = await uploadToCloudinary(req.file.buffer, "avatars");

      // 2. Update user in database
      const user = await User.findById(userId);
      if (!user) {
        throw createError(404, "User not found");
      }

      // 3. Delete old avatar if exists
      if (user.avatar && user.avatar.publicId) {
        try {
          await cloudinary.uploader.destroy(user.avatar.publicId);

        } catch (error) {
          console.error("Failed to delete old avatar:", error);
        }
      }

      // 4. Set new avatar
      user.avatar = {
        url: result.secure_url,
        publicId: result.public_id,
      };

      await user.save();

      successResponse(res, {
        statusCode: 200,
        message: "Avatar uploaded successfully",
        payload: {
          avatar: user.avatar,
        },
      });
    } catch (error) {
      console.error("Avatar upload error:", error);
      throw createError(500, "Failed to upload avatar");
    }
  }
);

/**
 * @desc    Delete user avatar
 * @route   DELETE /api/auth/profile/avatar
 * @access  Private
 */
const handleDeleteAvatar = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id;

    const user = await User.findById(userId);
    if (!user) {
      throw createError(404, "User not found");
    }

    if (!user.avatar || !user.avatar.publicId) {
      throw createError(400, "No avatar to delete");
    }

    try {
      // 1. Delete from Cloudinary
      await cloudinary.uploader.destroy(user.avatar.publicId);

      // 2. Remove from database
      user.avatar = undefined;
      await user.save();

      successResponse(res, {
        statusCode: 200,
        message: "Avatar deleted successfully",
      });
    } catch (error) {
      console.error("Avatar deletion error:", error);
      throw createError(500, "Failed to delete avatar");
    }
  }
);

const handleResendVerificationEmail = asyncHandler(
  async (
    req: Request<{}, {}, { email: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const { email } = req.body;

    if (!email) {
      return next(createError(400, "Email is required"));
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // For security reasons, don't reveal if email exists
      return successResponse(res, {
        statusCode: 200,
        message: "If the email exists, a verification email has been sent",
      });
    }

    if (user.emailVerified) {
      return next(createError(400, "Email is already verified"));
    }

    // Generate new verification token
    const verificationToken = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const emailVerificationExpires = new Date(Date.now() + 60 * 1000);

    // Update user with new token
    (user as any).emailVerificationToken = verificationToken;
    (user as any).emailVerificationExpires = emailVerificationExpires;
    await user.save();

    // Send verification email
    try {
      await sendVerificationEmail(
        user.email!,
        user.firstName || user.username,
        verificationToken
      );
    } catch (error) {
      console.error("Failed to send verification email:", error);
      return next(createError(500, "Failed to send verification email"));
    }

    return successResponse(res, {
      statusCode: 200,
      message: "Verification email sent successfully",
      payload: {
        verificationToken:
          process.env.NODE_ENV === "development"
            ? verificationToken
            : undefined,
      },
    });
  }
);

const handleCheckUsernameAvailability = asyncHandler(
  async (
    req: Request<{}, {}, {}, { username: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const { username } = req.query;

    if (!username) {
      return next(createError(400, "Username is required"));
    }

    const existingUser = await User.findOne({
      username: username.toLowerCase(),
    });

    return successResponse(res, {
      statusCode: 200,
      message: "Username availability checked successfully",
      payload: {
        available: !existingUser,
        username: username,
      },
    });
  }
);

const handleCheckEmailAvailability = asyncHandler(
  async (
    req: Request<{}, {}, {}, { email: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const { email } = req.query;

    if (!email) {
      return next(createError(400, "Email is required"));
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    });

    return successResponse(res, {
      statusCode: 200,
      message: "Email availability checked successfully",
      payload: {
        available: !existingUser,
        email: email,
      },
    });
  }
);

const handleUpdateEmail = asyncHandler(
  async (
    req: Request<{}, {}, { newEmail: string; password: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const { newEmail, password } = req.body;
    const userId = (req as AuthRequest).user!._id;

    if (!newEmail || !password) {
      return next(createError(400, "New email and password are required"));
    }

    const user = await User.findById(userId).select("+password");
    if (!user) {
      return next(createError(404, "User not found"));
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password || "");
    if (!isPasswordValid) {
      return next(createError(401, "Invalid password"));
    }

    // Check if new email is already taken
    const existingUser = await User.findOne({ email: newEmail.toLowerCase() });
    if (existingUser) {
      return next(createError(400, "Email is already taken"));
    }

    // Generate verification token for new email
    const verificationToken = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const emailVerificationExpires = new Date(Date.now() + 60 * 1000);

    // Update user with new email (unverified)
    (user as any).email = newEmail.toLowerCase();
    (user as any).emailVerified = false;
    (user as any).emailVerificationToken = verificationToken;
    (user as any).emailVerificationExpires = emailVerificationExpires;
    await user.save();

    // Send verification email to new address
    try {
      const emailResult = await sendVerificationEmail(
        user.email!,
        user.firstName || user.username,
        verificationToken
      );
      if (emailResult.success) {
        console.log("✅ Verification email sent to new address:", user.email);
      } else {
        console.error("❌ Failed to send verification email to new address:", emailResult.error);
        // We still return success for the update, but inform about the email failure
        return successResponse(res, {
          statusCode: 200,
          message: "Email updated successfully, but we failed to send the verification email. Please try resending it from your profile.",
          payload: {
            email: newEmail,
            emailVerified: false,
          }
        });
      }
    } catch (error) {
      console.error("Unexpected error sending verification email for email update:", error);
    }

    return successResponse(res, {
      statusCode: 200,
      message:
        "Email updated successfully. Please verify your new email address.",
      payload: {
        email: newEmail,
        emailVerified: false,
        verificationToken:
          process.env.NODE_ENV === "development"
            ? verificationToken
            : undefined,
      },
    });
  }
);

const handleGetUserPreferences = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id;
    const user = await User.findById(userId);

    if (!user) {
      return next(createError(404, "User not found"));
    }

    return successResponse(res, {
      statusCode: 200,
      message: "User preferences retrieved successfully",
      payload: {
        preferences: (user as any).preferences || {},
      },
    });
  }
);

const handleUpdateUserPreferences = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id;
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== "object") {
      return next(createError(400, "Preferences object is required"));
    }

    const user = await User.findById(userId);
    if (!user) {
      return next(createError(404, "User not found"));
    }

    // Merge existing preferences with new ones
    (user as any).preferences = {
      ...((user as any).preferences || {}),
      ...preferences,
    };

    await user.save();

    return successResponse(res, {
      statusCode: 200,
      message: "User preferences updated successfully",
      payload: {
        preferences: (user as any).preferences,
      },
    });
  }
);

const handleGetAccountStatus = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id;
    const user = await User.findById(userId);

    if (!user) {
      return next(createError(404, "User not found"));
    }

    const accountStatus = {
      emailVerified: user.emailVerified,
      twoFactorEnabled: !!(user as any).twoFactorAuth?.enabled,
      isBanned: user.isBanned,
      status: (user as any).status || "active",
      lastLogin: (user as any).lastLogin,
      createdAt: (user as any).createdAt,
      passwordChangedAt: (user as any).passwordChangedAt,
    };

    return successResponse(res, {
      statusCode: 200,
      message: "Account status retrieved successfully",
      payload: accountStatus,
    });
  }
);

const handleDeactivateAccount = asyncHandler(
  async (
    req: Request<{}, {}, { password: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const { password } = req.body;
    const userId = (req as AuthRequest).user!._id;

    if (!password) {
      return next(
        createError(400, "Password is required to deactivate account")
      );
    }

    const user = await User.findById(userId).select("+password");
    if (!user) {
      return next(createError(404, "User not found"));
    }

    const isPasswordValid = await bcrypt.compare(password, user.password || "");
    if (!isPasswordValid) {
      return next(createError(401, "Invalid password"));
    }

    // Deactivate account (soft delete)
    (user as any).status = "deactivated";
    (user as any).deactivatedAt = new Date();
    await user.save();

    // Revoke all sessions
    await Session.updateMany(
      { userId },
      { revokedAt: new Date(), revokedBy: userId }
    );

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    return successResponse(res, {
      statusCode: 200,
      message: "Account deactivated successfully",
    });
  }
);

const handleReactivateAccount = asyncHandler(
  async (
    req: Request<{}, {}, { email: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const { email } = req.body;

    if (!email) {
      return next(createError(400, "Email is required"));
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      // status: { $ne: UserStatus.ACTIVE }
    });

    if (!user) {
      return next(
        createError(404, "No deactivated account found with this email")
      );
    }

    // Reactivate account
    (user as any).status = "active";
    (user as any).deactivatedAt = undefined;
    await user.save();

    return successResponse(res, {
      statusCode: 200,
      message: "Account reactivated successfully. You can now log in.",
    });
  }
);

const handleGetSecurityLogs = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const activities = await UserActivity.find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const totalActivities = await UserActivity.countDocuments({ userId });

    return successResponse(res, {
      statusCode: 200,
      message: "Security logs retrieved successfully",
      payload: {
        activities,
        pagination: {
          totalActivities,
          totalPages: Math.ceil(totalActivities / limit),
          currentPage: page,
          previousPage: page - 1 > 0 ? page - 1 : null,
          nextPage:
            page + 1 <= Math.ceil(totalActivities / limit) ? page + 1 : null,
        },
      },
    });
  }
);

const handleClearSecurityLogs = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id;

    const result = await UserActivity.deleteMany({ userId });

    return successResponse(res, {
      statusCode: 200,
      message: "Security logs cleared successfully",
      payload: {
        deletedCount: result.deletedCount,
      },
    });
  }
);

const handleDeleteUser = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const adminId = req.user!._id;
      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return next(createError(404, "User not found"));
      }

      // Check if user is already deleted
      if (user.status === 'deleted') {
        return next(createError(400, "User is already deleted"));
      }

      // Prevent deleting yourself
      if (userId === adminId.toString()) {
        return next(createError(400, "You cannot delete your own account"));
      }

      // Prevent deleting super admin
      if (user.role === 'super_admin') {
        return next(createError(403, "Cannot delete super admin account"));
      }

      // Soft delete the user
      (user as any).deletedAt = new Date();
      (user as any).status = 'deleted';
      
      // Update email and username to free them up, but only if not already prefixed
      const prefix = `deleted_${user._id}_`;
      if (user.email && !user.email.startsWith(prefix)) {
        (user as any).email = `${prefix}${user.email}`;
      }
      if (!user.username.startsWith(prefix)) {
        (user as any).username = `${prefix}${user.username}`;
      }
      
      (user as any).deletedBy = adminId;
      await user.save();

      // Revoke all sessions for the deleted user
      await Session.updateMany(
        { userId },
        {
          revokedAt: new Date(),
          revokedBy: adminId,
          revocationReason: 'account_deleted_by_admin'
        }
      );

      // Log the deletion activity
      await UserActivity.create({
        userId: adminId,
        activityType: 'admin_user_deleted',
        description: `Deleted user: ${user.email} (${user._id})`,
        ipAddress: getClientIP(req as unknown as Request),
        userAgent: req.get("User-Agent"),
        metadata: {
          deletedUserId: userId,
          deletedUserEmail: user.email,
          deletedUserName: `${user.firstName} ${user.lastName}`,
          action: 'soft_delete'
        },
        status: "success",
      });

      return successResponse(res, {
        statusCode: 200,
        message: "User deleted successfully",
      });
    } catch (error) {
      console.log(error);
      return next(createError(500, "Failed to delete user"));
    }
  }
);

const handleUpdateUserRole = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      const adminId = req.user!._id;

      // Validate role
      const validRoles = ['user', 'admin', 'moderator', 'super_admin'];
      if (!validRoles.includes(role)) {
        return next(createError(400, "Invalid role specified"));
      }

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return next(createError(404, "User not found"));
      }

      // Prevent changing your own role
      if (userId === adminId.toString()) {
        return next(createError(400, "You cannot change your own role"));
      }

      // Only super admin can assign super_admin role
      if (role === 'super_admin' && req.user!.role !== 'super_admin') {
        return next(createError(403, "Only super admin can assign super_admin role"));
      }

      // Prevent downgrading super admin
      if (user.role === 'super_admin' && req.user!.role !== 'super_admin') {
        return next(createError(403, "Only super admin can modify other super admins"));
      }

      // Update user role
      const oldRole = user.role;
      user.role = role;
      await user.save();

      // Log the role change activity
      await UserActivity.create(
        {
          userId: adminId,
          activityType: 'admin_role_changed',
          description: `Changed role for ${user.email} from ${oldRole} to ${role}`,
          ipAddress: getClientIP(req as unknown as Request),
          userAgent: req.get("User-Agent"),
          metadata: {
            targetUserId: userId as string,
            targetUserEmail: user.email,
            oldRole,
            newRole: role
          },
          status: "success",
        },
        {
          userId: new mongoose.Types.ObjectId(userId as string),
          activityType: 'role_changed',
          description: `Your role was changed from ${oldRole} to ${role} by administrator`,
          ipAddress: getClientIP(req as unknown as Request),
          userAgent: req.get("User-Agent"),
          metadata: {
            changedBy: adminId,
            changedByName: `${req.user!.firstName} ${req.user!.lastName}`,
            oldRole,
            newRole: role
          },
          status: "info",
        }
      );

      return successResponse(res, {
        statusCode: 200,
        message: "User role updated successfully",
        payload: {
          user: sanitizeUser(user as unknown as IUser),
          roleChange: {
            oldRole,
            newRole: role
          }
        },
      });
    } catch (error) {
      return next(createError(500, "Failed to update user role"));
    }
  }
);

const handleSendEmailToUser = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { subject, message } = req.body;
      const adminId = req.user!._id;
      const adminName = `${req.user!.firstName} ${req.user!.lastName}`;
      const adminEmail = req.user!.email;

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return next(createError(404, "User not found"));
      }

      // Send actual email
      const emailResult = await sendAdminToUserEmail(
        adminName,
        adminEmail!,
        user.email!,
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email!,
        subject,
        message
      );

      if (!emailResult.success) {
        console.error("❌ Admin email failed to send:", emailResult.error);
        return next(createError(500, "Failed to send email: " + emailResult.error));
      }

      console.log("✅ Admin email sent successfully to:", user.email);

      // Log the email sending activity
      await UserActivity.create(
        {
          userId: adminId,
          activityType: 'admin_email_sent',
          description: `Sent email to ${user.email}`,
          ipAddress: getClientIP(req as unknown as Request),
          userAgent: req.get("User-Agent"),
          metadata: {
            targetUserId: userId as string,
            targetUserEmail: user.email,
            subject,
            messagePreview: message.substring(0, 100) + '...',
            messageId: emailResult.messageId
          },
          status: "success",
        },
        {
          userId: new mongoose.Types.ObjectId(userId as string),
          activityType: 'admin_email_received',
          description: `Received email from administrator`,
          ipAddress: getClientIP(req as unknown as Request),
          userAgent: req.get("User-Agent"),
          metadata: {
            sentBy: adminId,
            sentByName: adminName,
            sentByEmail: adminEmail,
            subject,
            messagePreview: message.substring(0, 100) + '...',
            messageId: emailResult.messageId
          },
          status: "info",
        }
      );

      return successResponse(res, {
        statusCode: 200,
        message: "Email sent successfully",
        payload: {
          sentTo: user.email,
          subject,
          messageId: emailResult.messageId,
          timestamp: new Date().toISOString()
        },
      });
    } catch (error: any) {
      console.error("Send email error:", error);
      return next(createError(500, "Failed to send email: " + error.message));
    }
  }
);
const handleUpdateUser = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const updates = req.body;
      const adminId = req.user!._id;

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return next(createError(404, "User not found"));
      }

      // Prevent updating yourself through admin endpoint
      if (userId === adminId.toString()) {
        return next(createError(400, "Use profile update endpoint for your own account"));
      }

      // Restrict modifying super admins
      if (user.role === 'super_admin' && req.user!.role !== 'super_admin') {
        return next(createError(403, "Only super admin can modify other super admins"));
      }

      // Restrict assigning super_admin role
      if (updates.role === 'super_admin' && req.user!.role !== 'super_admin') {
        return next(createError(403, "Only super admin can assign super_admin role"));
      }

      // Store original values for logging
      const originalValues = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        isBanned: user.isBanned,
        status: (user as any).status
      };

      // Apply updates
      const allowedUpdates = [
        'firstName', 'lastName', 'email', 'username',
        'role', 'permissions', 'isActive', 'isBanned', 'status'
      ];

      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          (user as any)[field] = updates[field];
        }
      });

      // If email is being changed, mark as unverified
      if (updates.email && updates.email !== originalValues.email) {
        user.emailVerified = false;
        // Generate verification token for new email
        const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
        (user as any).emailVerificationToken = verificationToken;
        (user as any).emailVerificationExpires = new Date(Date.now() + 60 * 1000);

        // TODO: Send verification email to new address
      }

      await user.save();

      // Log the update activity
      const changes = [];
      for (const [key, value] of Object.entries(updates)) {
        if (value !== originalValues[key as keyof typeof originalValues]) {
          changes.push({
            field: key,
            oldValue: originalValues[key as keyof typeof originalValues],
            newValue: value
          });
        }
      }

      if (changes.length > 0) {
        await UserActivity.create({
          userId: adminId,
          activityType: 'admin_user_updated',
          description: `Updated user: ${user.email}`,
          ipAddress: getClientIP(req as unknown as Request),
          userAgent: req.get("User-Agent"),
          metadata: {
            targetUserId: userId,
            targetUserEmail: user.email,
            changes
          },
          status: "success",
        });
      }

      return successResponse(res, {
        statusCode: 200,
        message: "User updated successfully",
        payload: {
          user: sanitizeUser(user as unknown as IUser),
          changes: changes.length > 0 ? changes : undefined
        },
      });
    } catch (error) {
      console.error("Update user error:", error);
      return next(createError(500, "Failed to update user"));
    }
  }
);

const handleAdminCreateUser = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const {
        username,
        email,
        password,
        firstName,
        lastName,
        role = 'user',
        permissions = []
      } = req.body;

      const adminId = req.user!._id;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { username: username?.toLowerCase() },
          { email: email.toLowerCase() },
        ],
      });

      if (existingUser) {
        let errorMessage = "User already exists";
        if (existingUser.username === username?.toLowerCase()) {
          errorMessage = "Username already exists";
        } else if (existingUser.email === email.toLowerCase()) {
          errorMessage = "Email already exists";
        }
        return next(createError(400, errorMessage));
      }

      // Validate role assignment permissions
      if (role === 'super_admin' && req.user!.role !== 'super_admin') {
        return next(createError(403, "Only super admin can create super admin accounts"));
      }

      // Generate email verification token
      const emailVerificationToken = Math.floor(100000 + Math.random() * 900000).toString();
      const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const newUserData = {
        username: username?.toLowerCase() || email.split('@')[0],
        email: email.toLowerCase(),
        password,
        firstName,
        lastName,
        role,
        permissions,
        emailVerified: false,
        emailVerificationToken,
        emailVerificationExpires,
        status: "active",
        registrationIP: getClientIP(req as unknown as Request),
        createdBy: adminId,
        metadata: {
          userAgent: req.get("User-Agent"),
          ipAddress: getClientIP(req as unknown as Request),
          signupFlow: "admin_created",
          createdByAdmin: adminId
        },
      };

      const user = await User.create(newUserData);

      // Log user creation activity
      await UserActivity.create({
        userId: adminId,
        activityType: 'admin_user_created',
        description: `Created new user: ${user.email} with role: ${role}`,
        ipAddress: getClientIP(req as unknown as Request),
        userAgent: req.get("User-Agent"),
        metadata: {
          createdUserId: user._id,
          createdUserEmail: user.email,
          role,
          createdByName: `${req.user!.firstName} ${req.user!.lastName}`
        },
        status: "success",
      });

      // TODO: Send welcome email with verification link
      console.log(`Admin created user: ${user.email} with verification token: ${emailVerificationToken}`);

      return successResponse(res, {
        statusCode: 201,
        message: "User created successfully",
        payload: {
          user: sanitizeUser(user as unknown as IUser),
          verificationToken: process.env.NODE_ENV === 'development' ? emailVerificationToken : undefined
        },
      });
    } catch (error) {
      console.error("Admin create user error:", error);
      return next(createError(500, "Failed to create user"));
    }
  }
);

const handleAdminToggleTwoFactor = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const adminId = req.user!._id;

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return next(createError(404, "User not found"));
      }

      // Prevent toggling your own 2FA through admin endpoint
      if (userId === adminId.toString()) {
        return next(
          createError(400, "Use security settings for your own account")
        );
      }

      const isCurrentlyEnabled = !!(user as any).twoFactorAuth?.enabled;
      const newStatus = !isCurrentlyEnabled;

      // If disabling, clear 2FA data
      if (!newStatus) {
        (user as any).twoFactorAuth = {
          enabled: false,
          secret: undefined,
          backupCodes: [],
          enabledAt: undefined,
        };
      } else {
        // Only allow admins to DISABLE 2FA for security reasons
        return next(
          createError(
            400,
            "Admins can only disable 2FA for users. Users must set up 2FA themselves."
          )
        );
      }

      await user.save();

      // Log the activity
      await UserActivity.create({
        userId: adminId,
        activityType: "admin_2fa_toggled",
        description: `Disabled 2FA for user: ${user.email}`,
        ipAddress: getClientIP(req as unknown as Request),
        userAgent: req.get("User-Agent"),
        metadata: {
          targetUserId: userId,
          targetUserEmail: user.email,
          action: "disabled",
        },
        status: "success",
      });

      return successResponse(res, {
        statusCode: 200,
        message: `Two-factor authentication disabled for ${user.email}`,
        payload: {
          twoFactorEnabled: (user as any).twoFactorAuth?.enabled,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

const handleAdminRevokeAllSessions = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const adminId = req.user!._id;

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return next(createError(404, "User not found"));
      }

      // Revoke all sessions
      await Session.updateMany(
        { userId, revokedAt: { $exists: false } },
        {
          revokedAt: new Date(),
          revokedBy: adminId,
          revocationReason: "revoked_by_admin",
        }
      );

      // Log activity
      await UserActivity.create({
        userId: adminId,
        activityType: "admin_sessions_revoked",
        description: `Revoked all sessions for user: ${user.email}`,
        ipAddress: getClientIP(req as unknown as Request),
        userAgent: req.get("User-Agent"),
        metadata: {
          targetUserId: userId,
          targetUserEmail: user.email,
        },
        status: "success",
      });

      return successResponse(res, {
        statusCode: 200,
        message: `All sessions revoked for ${user.email}`,
      });
    } catch (error) {
      return next(error);
    }
  }
);

// Export all functions
export {
  handleAdminRevokeAllSessions,
  handleAdminToggleTwoFactor,
  handleDeleteUser,
  handleUpdateUserRole,
  handleSendEmailToUser,
  handleUpdateUser,
  handleAdminCreateUser,
  handleCreateUser,
  handleGetUser,
  handleGetAllUsers,
  handleLogIn,
  handleLogOut,
  handleSocialLogin,
  handleRefreshToken,
  handleProtected,
  handleGetMe,
  handleChangedPassword,
  handleForgotPassword,
  handleResetPassword,
  handleSendVerificationEmail,
  handleVerifyEmail,
  handleSetupTwoFactor,
  handleVerifyTwoFactor,
  handleDisableTwoFactor,
  handleGenerateBackupCodes,
  handleGetSessions,
  handleRevokeSession,
  handleRevokeAllSessions,
  handleDeleteAccount,
  handleUpdateProfile,

  // New functions
  handleResendVerificationEmail,
  handleCheckUsernameAvailability,
  handleCheckEmailAvailability,
  handleUpdateEmail,
  handleGetUserPreferences,
  handleUpdateUserPreferences,
  handleGetAccountStatus,
  handleUploadAvatar,
  handleDeleteAvatar,
  handleDeactivateAccount,
  handleReactivateAccount,
  handleGetSecurityLogs,
  handleClearSecurityLogs,
};
