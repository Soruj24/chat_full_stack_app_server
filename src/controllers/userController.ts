// import { Request, Response, NextFunction } from "express";
// import bcrypt from "bcryptjs";
// import jwt from "jsonwebtoken";
// import createError from "http-errors";
// import speakeasy from "speakeasy";
// import QRCode from "qrcode";
// import crypto from "crypto";

// // Config and utilities
// import { createJSONWebToken } from "../helper/jsonwebtoken";
// import { setAccessTokenCookie, setRefreshTokenCookie } from "../helper/cookie";
// import { successResponse } from "./responsControllers";
// import {
//   CreateUserBody,
//   IUser,
//   PasswordChangeBody,
//   UserParams,
//   AuthRequest,
// } from "../types";
// import { jwtAccessKey, jwtRefreshKey } from "../secret";
// import User from "../models/schemas/User";
// import Session from "../models/Session";
// import UserActivity from "../models/UserActivity";
// import { findUser } from "../services/userServices";

// import { AUTH_CONSTANTS } from "../Constants";
// import {
//   checkAccountLockout,
//   createSession,
//   generateAuthTokens,
//   getClientIP,
//   resetLoginAttempts,
//   sanitizeUser,
//   trackFailedLoginAttempt,
//   updateLoginHistory,
//   validateUserStatus,
//   verifyTwoFactorCode,
// } from "../utils";
// import { asyncHandler } from "./commonHandlers";
// import { generateSixDigitToken } from "../services/emailService";

// // Update the handleCreateUser function to ensure consistent token generation
// const handleCreateUser = asyncHandler(
//   async (
//     req: Request<{}, {}, CreateUserBody>,
//     res: Response,
//     next: NextFunction
//   ) => {
//     const {
//       username,
//       email,
//       password,
//       socketId,
//       userLanguage,
//       firstName,
//       lastName,
//     } = req.body;

//     // Check if user already exists
//     const existingUser = await User.findOne({
//       $or: [
//         { username: username.toLowerCase() },
//         { email: email.toLowerCase() },
//       ],
//     });

//     if (existingUser) {
//       let errorMessage = "User already exists";
//       if (existingUser.username === username.toLowerCase()) {
//         errorMessage = "Username already exists";
//       } else if (existingUser.email === email.toLowerCase()) {
//         errorMessage = "Email already exists";
//       }
//       return next(createError(400, errorMessage));
//     }

//     // Get user's IP address
//     const userIP = getClientIP(req);

//     // Generate consistent token (6-digit numeric for better UX)
//     const emailVerificationToken = generateSixDigitToken();
//     const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

//     const newUserData = {
//       username: username.toLowerCase(),
//       email: email.toLowerCase(),
//       socketId,
//       password,
//       userLanguage: userLanguage,
//       firstName,
//       lastName,
//       role: "user",
//       emailVerified: false,
//       emailVerificationToken,
//       emailVerificationExpires,
//       status: "pending",
//       registrationIP: userIP,
//       detectedCountry: (req.headers["cf-ipcountry"] as string) || undefined,
//       metadata: {
//         userAgent: req.get("User-Agent"),
//         ipAddress: userIP,
//         signupFlow: "standard",
//       },
//     };

//     const user = await User.create(newUserData);

//     // Log user creation activity
//     await UserActivity.create({
//       userId: user._id,
//       activityType: "account_creation",
//       description: "User account created successfully - Pending verification",
//       ipAddress: userIP,
//       userAgent: req.get("User-Agent"),
//       metadata: {
//         verificationToken: emailVerificationToken,
//       },
//       status: "success",
//     });

//     // Send verification email (non-blocking)
//     try {
//       await sendVerificationEmail(user);
//       console.log(
//         "Verification email sent with token:",
//         emailVerificationToken
//       ); // Debug log
//     } catch (error) {
//       console.error("Failed to send verification email:", error);
//       next(error);
//     }

//     return successResponse(res, {
//       statusCode: 201,
//       message:
//         "User created successfully. Please check your email for verification instructions.",
//       payload: {
//         user: sanitizeUser(user as unknown as IUser),
//         requiresVerification: true,
//       },
//     });
//   }
// );

// // Update the handleVerifyEmail function to be more flexible
// const handleVerifyEmail = asyncHandler(
//   async (
//     req: Request<{}, {}, { token: string; email: string }>,
//     res: Response,
//     next: NextFunction
//   ) => {
//     const { token, email } = req.body;

//     console.log("Verification attempt:", { email, token }); // Debug log

//     if (!token) {
//       return next(createError(400, "Verification token is required"));
//     }

//     if (!email) {
//       return next(createError(400, "Email is required"));
//     }

//     // Find user by email and token (be more flexible with token format)
//     const user = await User.findOne({
//       email: email.toLowerCase(),
//       emailVerificationToken: token,
//       emailVerificationExpires: { $gt: new Date() },
//     });

//     console.log("Found user for verification:", user ? "yes" : "no"); // Debug log

//     if (!user) {
//       // Additional debug: check what tokens exist for this email
//       const userWithEmail = await User.findOne({ email: email.toLowerCase() });
//       if (userWithEmail) {
//         console.log("User exists but token mismatch:", {
//           storedToken: userWithEmail.emailVerificationToken,
//           providedToken: token,
//           tokenExpires: userWithEmail.emailVerificationExpires,
//           isExpired: userWithEmail.emailVerificationExpires
//             ? userWithEmail.emailVerificationExpires < new Date()
//             : false,
//         });
//       }

//       return next(createError(400, "Invalid or expired verification token"));
//     }

//     // Mark email as verified
//     (user as any).emailVerified = true;
//     (user as any).emailVerificationToken = undefined;
//     (user as any).emailVerificationExpires = undefined;
//     (user as any).emailVerifiedAt = new Date();
//     (user as any).status = "active"; // Update status to active
//     await user.save();

//     // Send welcome email
//     try {
//       await sendWelcomeEmail(user);
//     } catch (error) {
//       console.error("Failed to send welcome email:", error);
//     }

//     // Log verification activity
//     await UserActivity.create({
//       userId: user._id,
//       activityType: "email_verified",
//       description: "Email verified successfully",
//       ipAddress: getClientIP(req),
//       userAgent: req.get("User-Agent"),
//       status: "success",
//     });

//     console.log("Email verified successfully for user:", user.email); // Debug log

//     return successResponse(res, {
//       statusCode: 200,
//       message: "Email verified successfully",
//       payload: { user: sanitizeUser(user as unknown as IUser) },
//     });
//   }
// );

// const handleLogIn = asyncHandler(
//   async (
//     req: Request<
//       {},
//       {},
//       { email: string; password: string; twoFactorCode?: string }
//     >,
//     res: Response,
//     next: NextFunction
//   ) => {
//     const { email, password, twoFactorCode } = req.body;

//     // Find user
//     const user = await User.findOne({ email }).select("+password");
//     if (!user) {
//       return next(createError(401, "User not found with this Email."));
//     }

//     // Check account lockout
//     checkAccountLockout(user as unknown as IUser);

//     // Account status checks
//     try {
//       validateUserStatus(user as unknown as IUser);
//     } catch (error) {
//       return next(error);
//     }

//     // Password verification
//     const isPasswordValid = await bcrypt.compare(password, user.password || "");
//     if (!isPasswordValid) {
//       await trackFailedLoginAttempt(user as unknown as IUser);
//       return next(createError(401, "Invalid password"));
//     }

//     // Reset login attempts on successful password verification
//     await resetLoginAttempts(user as unknown as IUser);

//     // 2FA handling
//     if ((user as any).twoFactorAuth?.enabled) {
//       if (!twoFactorCode) {
//         return successResponse(res, {
//           statusCode: 206,
//           message: "Two-factor authentication required",
//           payload: {
//             requires2FA: true,
//             userId: user.id.toString(),
//           },
//         });
//       }

//       const { isValid, isBackupCode } = await verifyTwoFactorCode(
//         user as unknown as IUser,
//         twoFactorCode
//       );
//       if (!isValid) {
//         return next(
//           createError(
//             401,
//             `Invalid ${isBackupCode ? "backup code" : "authentication code"}`
//           )
//         );
//       }
//     }

//     // Generate tokens
//     const { accessToken, refreshToken } = generateAuthTokens(
//       user as unknown as IUser
//     );

//     // Create session
//     const session = await createSession(
//       user.id.toString(),
//       { accessToken, refreshToken },
//       req
//     );

//     // Update user login info
//     await updateLoginHistory(user as unknown as IUser, req);

//     // Set cookies
//     setAccessTokenCookie(res, accessToken);
//     setRefreshTokenCookie(res, refreshToken);

//     // Success response
//     return successResponse(res, {
//       statusCode: 200,
//       message: "Login successful",
//       payload: {
//         user: {
//           ...sanitizeUser(user as unknown as IUser),
//           accessToken,
//           refreshToken,
//         },
//         session: {
//           id: session.id.toString(),
//           expiresAt: session.expiresAt,
//         },
//       },
//     });
//   }
// );

// const handleRefreshToken = asyncHandler(
//   async (req: Request, res: Response, next: NextFunction) => {
//     const oldRefreshToken = req.cookies.refreshToken;

//     if (!oldRefreshToken) {
//       return next(createError(401, "Refresh token not found"));
//     }

//     if (!jwtRefreshKey) {
//       return next(createError(500, "JWT refresh key is not defined"));
//     }

//     try {
//       const decoded = jwt.verify(
//         oldRefreshToken,
//         jwtRefreshKey
//       ) as jwt.JwtPayload;
//       if (!decoded || !decoded.id) {
//         return next(createError(401, "Invalid refresh token"));
//       }

//       // Check if session exists and is valid
//       const session = await Session.findOne({
//         refreshToken: oldRefreshToken,
//         expiresAt: { $gt: new Date() },
//         revokedAt: { $exists: false },
//       });

//       if (!session) {
//         res.clearCookie("accessToken");
//         res.clearCookie("refreshToken");
//         return next(createError(401, "Session expired or invalid"));
//       }

//       // Create consistent payload for new tokens
//       const user = await User.findById(decoded.id);
//       if (!user) {
//         return next(createError(404, "User not found"));
//       }

//       const tokenPayload = {
//         id: user.id.toString(),
//         email: user.email,
//         role: user.role || "user",
//       };

//       // Generate new tokens with consistent payload
//       const accessToken = createJSONWebToken(
//         tokenPayload,
//         jwtAccessKey,
//         AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY
//       );
//       const refreshToken = createJSONWebToken(
//         tokenPayload,
//         jwtRefreshKey,
//         AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY
//       );

//       // Update session with new tokens
//       session.accessToken = accessToken;
//       session.refreshToken = refreshToken;
//       session.lastActiveAt = new Date();
//       session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
//       await session.save();

//       // Set cookies
//       setAccessTokenCookie(res, accessToken);
//       setRefreshTokenCookie(res, refreshToken);

//       return successResponse(res, {
//         statusCode: 200,
//         message: "Tokens refreshed successfully",
//         payload: {
//           accessToken,
//           refreshToken, // Include in response if needed for mobile/other clients
//         },
//       });
//     } catch (error) {
//       console.error("Refresh token error:", error);

//       // Clear invalid cookies
//       res.clearCookie("accessToken");
//       res.clearCookie("refreshToken");

//       return next(createError(401, "Invalid refresh token"));
//     }
//   }
// );

// const handleProtected = asyncHandler(
//   async (req: Request, res: Response, next: NextFunction) => {
//     const accessToken =
//       req.cookies.accessToken ||
//       req.headers.authorization?.replace("Bearer ", "");

//     if (!accessToken) {
//       return next(createError(401, "Access token not found"));
//     }

//     if (!jwtAccessKey) {
//       return next(createError(500, "JWT access key is not defined"));
//     }

//     const decoded = jwt.verify(accessToken, jwtAccessKey) as jwt.JwtPayload;
//     if (!decoded || !decoded.id) {
//       return next(createError(401, "Invalid access token"));
//     }

//     const user = await User.findById(decoded.id).select("-password");
//     if (!user) {
//       return next(createError(404, "User not found"));
//     }

//     // Check if user is banned
//     if (user.isBanned) {
//       return next(createError(403, "Your account has been suspended."));
//     }

//     return successResponse(res, {
//       statusCode: 200,
//       message: "Protected route accessed successfully",
//       payload: { user },
//     });
//   }
// );

// const handleLogOut = asyncHandler(
//   async (req: AuthRequest, res: Response, next: NextFunction) => {
//     const accessToken = req.cookies?.accessToken;
//     const userId = req.user?._id;

//     if (userId && accessToken) {
//       // Revoke current session
//       await Session.findOneAndUpdate(
//         { userId, accessToken },
//         { revokedAt: new Date(), revokedBy: userId }
//       );
//     }

//     res.clearCookie("accessToken");
//     res.clearCookie("refreshToken");

//     return successResponse(res, {
//       statusCode: 200,
//       message: "User logged out successfully",
//     });
//   }
// );

// const handleGetMe = asyncHandler(
//   async (req: AuthRequest, res: Response, next: NextFunction) => {
//     const user = req.user;
//     if (!user) {
//       return next(createError(404, "User not found"));
//     }

//     return successResponse(res, {
//       statusCode: 200,
//       message: "User retrieved successfully",
//       payload: { user: sanitizeUser(user) },
//     });
//   }
// );

// const handleChangedPassword = asyncHandler(
//   async (
//     req: Request<UserParams, {}, PasswordChangeBody>,
//     res: Response,
//     next: NextFunction
//   ) => {
//     const { oldPassword, newPassword } = req.body;
//     const { userId } = req.params;

//     if (!oldPassword || !newPassword) {
//       return next(createError(400, "Old and new passwords are required"));
//     }

//     // Find user with password field
//     const user = await findUser(userId);

//     console.log("User:", oldPassword, newPassword);

//     // Verify old password
//     const isMatch = await bcrypt.compare(oldPassword, user?.password || "");
//     console.log(isMatch);
//     if (!isMatch) {
//       return next(createError(401, "Old password is incorrect"));
//     }

//     // Check if new password is same as old password
//     const isSamePassword = await bcrypt.compare(
//       newPassword,
//       user.password || ""
//     );
//     if (isSamePassword) {
//       return next(
//         createError(400, "New password cannot be the same as the old password")
//       );
//     }

//     try {
//       // Simply set the new password - the pre-save middleware will automatically hash it
//       user.password = newPassword;
//       (user as any).passwordChangedAt = new Date();

//       // Save the user - password will be automatically hashed by the pre-save hook
//       await user.save();

//       // Revoke all sessions for security
//       await Session.updateMany(
//         { userId: userId },
//         {
//           revokedAt: new Date(),
//           revokedBy: userId,
//           revocationReason: "password_changed",
//         }
//       );

//       // Log password change activity
//       await UserActivity.create({
//         userId: userId,
//         activityType: "password_changed",
//         description: "Password changed successfully",
//         ipAddress: getClientIP(req as unknown as Request),
//         userAgent: req.get("User-Agent"),
//         status: "success",
//       });

//       return successResponse(res, {
//         statusCode: 200,
//         message: "Password changed successfully",
//       });
//     } catch (error: any) {
//       // Handle validation errors from the User model
//       if (error.name === "ValidationError") {
//         const errors = Object.values(error.errors).map(
//           (err: any) => err.message
//         );
//         return next(createError(400, errors.join(", ")));
//       }
//       return next(error);
//     }
//   }
// );

// const handleForgotPassword = asyncHandler(
//   async (
//     req: Request<{}, {}, { email: string }>,
//     res: Response,
//     next: NextFunction
//   ) => {
//     const { email } = req.body;

//     if (!email) {
//       return next(createError(400, "Email is required"));
//     }

//     const user = await User.findOne({ email });
//     if (!user) {
//       // For security reasons, don't reveal if email exists
//       return successResponse(res, {
//         statusCode: 200,
//         message: "If the email exists, a password reset link has been sent",
//       });
//     }

//     // Generate reset token
//     const resetToken = createJSONWebToken(
//       { userId: user._id, type: "password_reset" },
//       jwtAccessKey,
//       AUTH_CONSTANTS.RESET_TOKEN_EXPIRY
//     );

//     // Store reset token in user document
//     (user as any).resetPasswordToken = resetToken;
//     (user as any).resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
//     await user.save();

//     // Send password reset email
//     try {
//       await sendPasswordResetEmail(user, resetToken);
//     } catch (error) {
//       console.error("Failed to send password reset email:", error);
//       return next(createError(500, "Failed to send password reset email"));
//     }

//     return successResponse(res, {
//       statusCode: 200,
//       message: "If the email exists, a password reset link has been sent",
//       payload: {
//         resetToken:
//           process.env.NODE_ENV === "development" ? resetToken : undefined,
//       },
//     });
//   }
// );

// const handleResetPassword = asyncHandler(
//   async (
//     req: Request<{}, {}, { token: string; newPassword: string }>,
//     res: Response,
//     next: NextFunction
//   ) => {
//     const { token, newPassword } = req.body;
//     console.log(token, newPassword);

//     if (!token || !newPassword) {
//       return next(createError(400, "Token and new password are required"));
//     }

//     // Verify token
//     let decoded: jwt.JwtPayload;
//     try {
//       decoded = jwt.verify(token, jwtAccessKey) as jwt.JwtPayload;
//     } catch (error) {
//       return next(createError(400, "Invalid or expired reset token"));
//     }

//     if (!decoded || decoded.type !== "password_reset") {
//       return next(createError(400, "Invalid or expired reset token"));
//     }

//     const user = await User.findOne({
//       _id: decoded.userId,
//       resetPasswordToken: token,
//       resetPasswordExpires: { $gt: new Date() },
//     });

//     if (!user) {
//       return next(createError(400, "Invalid or expired reset token"));
//     }

//     // Update password and clear reset token
//     (user as any).password = newPassword;
//     (user as any).resetPasswordToken = undefined;
//     (user as any).resetPasswordExpires = undefined;
//     (user as any).passwordChangedAt = new Date();
//     await user.save();

//     // Revoke all existing sessions
//     await Session.updateMany(
//       { userId: user._id },
//       { revokedAt: new Date(), revokedBy: user._id }
//     );

//     return successResponse(res, {
//       statusCode: 200,
//       message: "Password reset successfully",
//     });
//   }
// );

// const handleSendVerificationEmail = asyncHandler(
//   async (req: AuthRequest, res: Response, next: NextFunction) => {
//     const userId = req.user!._id;
//     const user = await User.findById(userId);

//     if (!user) {
//       return next(createError(404, "User not found"));
//     }

//     if (user.emailVerified) {
//       return next(createError(400, "Email is already verified"));
//     }

//     // Generate verification token
//     const verificationToken = generateSixDigitToken();

//     // Store verification token
//     (user as any).emailVerificationToken = verificationToken;
//     (user as any).emailVerificationExpires = new Date(Date.now() + 86400000); // 24 hours
//     await user.save();

//     // Send verification email
//     try {
//       await sendVerificationEmail(user);
//     } catch (error) {
//       console.error("Failed to send verification email:", error);
//       return next(createError(500, "Failed to send verification email"));
//     }

//     return successResponse(res, {
//       statusCode: 200,
//       message: "Verification email sent successfully",
//       payload: {
//         verificationToken:
//           process.env.NODE_ENV === "development"
//             ? verificationToken
//             : undefined,
//       },
//     });
//   }
// );

// const handleSetupTwoFactor = asyncHandler(
//   async (req: AuthRequest, res: Response, next: NextFunction) => {
//     const userId = req.user!._id;
//     const user = await User.findById(userId);
//     if (!user) {
//       return next(createError(404, "User not found"));
//     }

//     if ((user as any).twoFactorAuth?.enabled) {
//       return next(
//         createError(400, "Two-factor authentication is already enabled")
//       );
//     }

//     // Generate secret and backup codes
//     const secret = speakeasy.generateSecret({
//       name: `YourApp (${user.email})`,
//       issuer: "YourApp",
//       length: 20,
//     });

//     const backupCodes = Array.from({ length: 10 }, () =>
//       crypto.randomBytes(4).toString("hex").toUpperCase()
//     );

//     // Generate QR code URL
//     const otpauthUrl = secret.otpauth_url;

//     // Store secret and backup codes (hashed)
//     const hashedBackupCodes = await Promise.all(
//       backupCodes.map((code) => bcrypt.hash(code, 12))
//     );

//     (user as any).twoFactorAuth = {
//       secret: secret.base32,
//       backupCodes: hashedBackupCodes,
//       enabled: false,
//       setupAt: new Date(),
//     };
//     await user.save();

//     // Generate QR code as data URL
//     let qrCodeDataUrl = "";
//     if (otpauthUrl) {
//       qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
//     }

//     return successResponse(res, {
//       statusCode: 200,
//       message: "Two-factor authentication setup initiated",
//       payload: {
//         qrCodeUrl: qrCodeDataUrl,
//         secret:
//           process.env.NODE_ENV === "development" ? secret.base32 : undefined,
//         backupCodes:
//           process.env.NODE_ENV === "development" ? backupCodes : undefined,
//       },
//     });
//   }
// );

// const handleVerifyTwoFactor = asyncHandler(
//   async (
//     req: Request<{}, {}, { code: string }>,
//     res: Response,
//     next: NextFunction
//   ) => {
//     const { code } = req.body;
//     const userId = (req as AuthRequest).user!._id;

//     if (!code) {
//       return next(createError(400, "Verification code is required"));
//     }

//     const user = await User.findById(userId);
//     if (!user || !(user as any).twoFactorAuth?.secret) {
//       return next(createError(400, "Two-factor authentication not set up"));
//     }

//     // Verify the code
//     const isValid = speakeasy.totp.verify({
//       secret: (user as any).twoFactorAuth.secret,
//       encoding: "base32",
//       token: code,
//       window: 2,
//     });

//     let usedBackupCode = false;

//     if (!isValid && (user as any).twoFactorAuth.backupCodes) {
//       // Check backup codes
//       for (let i = 0; i < (user as any).twoFactorAuth.backupCodes.length; i++) {
//         const match = await bcrypt.compare(
//           code,
//           (user as any).twoFactorAuth.backupCodes[i]
//         );
//         if (match) {
//           usedBackupCode = true;
//           (user as any).twoFactorAuth.backupCodes.splice(i, 1);
//           break;
//         }
//       }
//     }

//     if (!isValid && !usedBackupCode) {
//       return next(createError(400, "Invalid verification code"));
//     }

//     // Enable 2FA
//     (user as any).twoFactorAuth.enabled = true;
//     (user as any).twoFactorAuth.enabledAt = new Date();
//     await user.save();

//     return successResponse(res, {
//       statusCode: 200,
//       message: "Two-factor authentication enabled successfully",
//       payload: {
//         backupCodesRemaining: (user as any).twoFactorAuth.backupCodes.length,
//         usedBackupCode,
//       },
//     });
//   }
// );

// const handleDisableTwoFactor = asyncHandler(
//   async (
//     req: Request<{}, {}, { password: string }>,
//     res: Response,
//     next: NextFunction
//   ) => {
//     const { password } = req.body;
//     const userId = (req as AuthRequest).user!._id;

//     if (!password) {
//       return next(
//         createError(
//           400,
//           "Password is required to disable two-factor authentication"
//         )
//       );
//     }

//     const user = await User.findById(userId).select("+password");
//     if (!user) {
//       return next(createError(404, "User not found"));
//     }

//     const isPasswordValid = await bcrypt.compare(password, user.password || "");
//     if (!isPasswordValid) {
//       return next(createError(401, "Invalid password"));
//     }

//     (user as any).twoFactorAuth = {
//       enabled: false,
//       secret: undefined,
//       backupCodes: [],
//     };
//     await user.save();

//     return successResponse(res, {
//       statusCode: 200,
//       message: "Two-factor authentication disabled successfully",
//     });
//   }
// );

// const handleGenerateBackupCodes = asyncHandler(
//   async (req: AuthRequest, res: Response, next: NextFunction) => {
//     const userId = req.user!._id;
//     const user = await User.findById(userId);

//     if (!user || !(user as any).twoFactorAuth?.enabled) {
//       return next(createError(400, "Two-factor authentication is not enabled"));
//     }

//     const backupCodes = Array.from({ length: 8 }, () =>
//       crypto.randomBytes(4).toString("hex").toUpperCase()
//     );

//     const hashedBackupCodes = await Promise.all(
//       backupCodes.map((code) => bcrypt.hash(code, 10))
//     );

//     (user as any).twoFactorAuth.backupCodes = hashedBackupCodes;
//     await user.save();

//     return successResponse(res, {
//       statusCode: 200,
//       message: "New backup codes generated successfully",
//       payload: {
//         backupCodes:
//           process.env.NODE_ENV === "development" ? backupCodes : undefined,
//       },
//     });
//   }
// );

// const handleGetSessions = asyncHandler(
//   async (req: AuthRequest, res: Response, next: NextFunction) => {
//     const userId = req.user!._id;

//     const sessions = await Session.find({
//       userId,
//       revokedAt: { $exists: false },
//     }).sort({ lastActiveAt: -1 });

//     return successResponse(res, {
//       statusCode: 200,
//       message: "Sessions retrieved successfully",
//       payload: { sessions },
//     });
//   }
// );

// const handleRevokeSession = asyncHandler(
//   async (
//     req: Request<{ sessionId: string }>,
//     res: Response,
//     next: NextFunction
//   ) => {
//     const { sessionId } = req.params;
//     const userId = (req as AuthRequest).user!._id;

//     const session = await Session.findOne({
//       _id: sessionId,
//       userId,
//       revokedAt: { $exists: false },
//     });

//     if (!session) {
//       return next(createError(404, "Session not found"));
//     }

//     session.revokedAt = new Date();
//     session.revokedBy = userId;
//     await session.save();

//     // If revoking current session, clear cookies
//     if (session.accessToken === req.cookies.accessToken) {
//       res.clearCookie("accessToken");
//       res.clearCookie("refreshToken");
//     }

//     return successResponse(res, {
//       statusCode: 200,
//       message: "Session revoked successfully",
//     });
//   }
// );

// const handleRevokeAllSessions = asyncHandler(
//   async (req: AuthRequest, res: Response, next: NextFunction) => {
//     const userId = req.user!._id;

//     await Session.updateMany(
//       {
//         userId,
//         revokedAt: { $exists: false },
//       },
//       {
//         revokedAt: new Date(),
//         revokedBy: userId,
//       }
//     );

//     res.clearCookie("accessToken");
//     res.clearCookie("refreshToken");

//     return successResponse(res, {
//       statusCode: 200,
//       message: "All sessions revoked successfully",
//     });
//   }
// );

// const handleDeleteAccount = asyncHandler(
//   async (
//     req: Request<{}, {}, { password: string }>,
//     res: Response,
//     next: NextFunction
//   ) => {
//     const { password } = req.body;
//     const userId = (req as AuthRequest).user!._id;

//     if (!password) {
//       return next(createError(400, "Password is required to delete account"));
//     }

//     const user = await User.findById(userId).select("+password");
//     if (!user) {
//       return next(createError(404, "User not found"));
//     }

//     const isPasswordValid = await bcrypt.compare(password, user.password || "");
//     if (!isPasswordValid) {
//       return next(createError(401, "Invalid password"));
//     }

//     // Soft delete
//     (user as any).deletedAt = new Date();
//     (user as any).status = "deleted";
//     (user as any).email = `deleted_${user._id}_${user.email}`;
//     (user as any).username = `deleted_${user._id}_${user.username}`;
//     await user.save();

//     // Revoke all sessions
//     await Session.updateMany(
//       { userId },
//       { revokedAt: new Date(), revokedBy: userId }
//     );

//     res.clearCookie("accessToken");
//     res.clearCookie("refreshToken");

//     return successResponse(res, {
//       statusCode: 200,
//       message: "Account deleted successfully",
//     });
//   }
// );

// const handleUpdateProfile = asyncHandler(
//   async (req: AuthRequest, res: Response, next: NextFunction) => {
//     const userId = req.user!._id;
//     const updates = req.body;

//     // Remove restricted fields
//     const restrictedFields = ["password", "email", "role", "isAdmin", "status"];
//     restrictedFields.forEach((field) => delete updates[field]);

//     const user = await User.findByIdAndUpdate(
//       userId,
//       { $set: updates },
//       { new: true, runValidators: true }
//     );

//     if (!user) {
//       return next(createError(404, "User not found"));
//     }

//     return successResponse(res, {
//       statusCode: 200,
//       message: "Profile updated successfully",
//       payload: { user: sanitizeUser(user as unknown as IUser) },
//     });
//   }
// );

// // NEW FUNCTIONS ADDED BELOW

// const handleResendVerificationEmail = asyncHandler(
//   async (
//     req: Request<{}, {}, { email: string }>,
//     res: Response,
//     next: NextFunction
//   ) => {
//     const { email } = req.body;

//     if (!email) {
//       return next(createError(400, "Email is required"));
//     }

//     const user = await User.findOne({ email: email.toLowerCase() });
//     if (!user) {
//       // For security reasons, don't reveal if email exists
//       return successResponse(res, {
//         statusCode: 200,
//         message: "If the email exists, a verification email has been sent",
//       });
//     }

//     if (user.emailVerified) {
//       return next(createError(400, "Email is already verified"));
//     }

//     // Generate new verification token
//     const verificationToken = generateSixDigitToken();
//     const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

//     // Update user with new token
//     (user as any).emailVerificationToken = verificationToken;
//     (user as any).emailVerificationExpires = emailVerificationExpires;
//     await user.save();

//     // Send verification email
//     try {
//       await sendVerificationEmail(user);
//     } catch (error) {
//       console.error("Failed to send verification email:", error);
//       return next(createError(500, "Failed to send verification email"));
//     }

//     return successResponse(res, {
//       statusCode: 200,
//       message: "Verification email sent successfully",
//       payload: {
//         verificationToken:
//           process.env.NODE_ENV === "development"
//             ? verificationToken
//             : undefined,
//       },
//     });
//   }
// );

// const handleCheckUsernameAvailability = asyncHandler(
//   async (
//     req: Request<{}, {}, {}, { username: string }>,
//     res: Response,
//     next: NextFunction
//   ) => {
//     const { username } = req.query;

//     if (!username) {
//       return next(createError(400, "Username is required"));
//     }

//     const existingUser = await User.findOne({
//       username: username.toLowerCase(),
//     });

//     return successResponse(res, {
//       statusCode: 200,
//       message: "Username availability checked successfully",
//       payload: {
//         available: !existingUser,
//         username: username,
//       },
//     });
//   }
// );

// const handleCheckEmailAvailability = asyncHandler(
//   async (
//     req: Request<{}, {}, {}, { email: string }>,
//     res: Response,
//     next: NextFunction
//   ) => {
//     const { email } = req.query;

//     if (!email) {
//       return next(createError(400, "Email is required"));
//     }

//     const existingUser = await User.findOne({
//       email: email.toLowerCase(),
//     });

//     return successResponse(res, {
//       statusCode: 200,
//       message: "Email availability checked successfully",
//       payload: {
//         available: !existingUser,
//         email: email,
//       },
//     });
//   }
// );

// const handleUpdateEmail = asyncHandler(
//   async (
//     req: Request<{}, {}, { newEmail: string; password: string }>,
//     res: Response,
//     next: NextFunction
//   ) => {
//     const { newEmail, password } = req.body;
//     const userId = (req as AuthRequest).user!._id;

//     if (!newEmail || !password) {
//       return next(createError(400, "New email and password are required"));
//     }

//     const user = await User.findById(userId).select("+password");
//     if (!user) {
//       return next(createError(404, "User not found"));
//     }

//     // Verify password
//     const isPasswordValid = await bcrypt.compare(password, user.password || "");
//     if (!isPasswordValid) {
//       return next(createError(401, "Invalid password"));
//     }

//     // Check if new email is already taken
//     const existingUser = await User.findOne({ email: newEmail.toLowerCase() });
//     if (existingUser) {
//       return next(createError(400, "Email is already taken"));
//     }

//     // Generate verification token for new email
//     const verificationToken = generateSixDigitToken();
//     const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

//     // Update user with new email (unverified)
//     (user as any).email = newEmail.toLowerCase();
//     (user as any).emailVerified = false;
//     (user as any).emailVerificationToken = verificationToken;
//     (user as any).emailVerificationExpires = emailVerificationExpires;
//     await user.save();

//     // Send verification email to new address
//     try {
//       await sendVerificationEmail(user);
//     } catch (error) {
//       console.error("Failed to send verification email:", error);
//       return next(createError(500, "Failed to send verification email"));
//     }

//     return successResponse(res, {
//       statusCode: 200,
//       message:
//         "Email updated successfully. Please verify your new email address.",
//       payload: {
//         email: newEmail,
//         emailVerified: false,
//         verificationToken:
//           process.env.NODE_ENV === "development"
//             ? verificationToken
//             : undefined,
//       },
//     });
//   }
// );

// const handleGetUserPreferences = asyncHandler(
//   async (req: AuthRequest, res: Response, next: NextFunction) => {
//     const userId = req.user!._id;
//     const user = await User.findById(userId);

//     if (!user) {
//       return next(createError(404, "User not found"));
//     }

//     return successResponse(res, {
//       statusCode: 200,
//       message: "User preferences retrieved successfully",
//       payload: {
//         preferences: (user as any).preferences || {},
//       },
//     });
//   }
// );

// const handleUpdateUserPreferences = asyncHandler(
//   async (req: AuthRequest, res: Response, next: NextFunction) => {
//     const userId = req.user!._id;
//     const { preferences } = req.body;

//     if (!preferences || typeof preferences !== "object") {
//       return next(createError(400, "Preferences object is required"));
//     }

//     const user = await User.findById(userId);
//     if (!user) {
//       return next(createError(404, "User not found"));
//     }

//     // Merge existing preferences with new ones
//     (user as any).preferences = {
//       ...((user as any).preferences || {}),
//       ...preferences,
//     };

//     await user.save();

//     return successResponse(res, {
//       statusCode: 200,
//       message: "User preferences updated successfully",
//       payload: {
//         preferences: (user as any).preferences,
//       },
//     });
//   }
// );

// const handleGetAccountStatus = asyncHandler(
//   async (req: AuthRequest, res: Response, next: NextFunction) => {
//     const userId = req.user!._id;
//     const user = await User.findById(userId);

//     if (!user) {
//       return next(createError(404, "User not found"));
//     }

//     const accountStatus = {
//       emailVerified: user.emailVerified,
//       twoFactorEnabled: !!(user as any).twoFactorAuth?.enabled,
//       isBanned: user.isBanned,
//       status: (user as any).status || "active",
//       lastLogin: (user as any).lastLogin,
//       createdAt: (user as any).createdAt,
//       passwordChangedAt: (user as any).passwordChangedAt,
//     };

//     return successResponse(res, {
//       statusCode: 200,
//       message: "Account status retrieved successfully",
//       payload: accountStatus,
//     });
//   }
// );

// const handleDeactivateAccount = asyncHandler(
//   async (
//     req: Request<{}, {}, { password: string }>,
//     res: Response,
//     next: NextFunction
//   ) => {
//     const { password } = req.body;
//     const userId = (req as AuthRequest).user!._id;

//     if (!password) {
//       return next(
//         createError(400, "Password is required to deactivate account")
//       );
//     }

//     const user = await User.findById(userId).select("+password");
//     if (!user) {
//       return next(createError(404, "User not found"));
//     }

//     const isPasswordValid = await bcrypt.compare(password, user.password || "");
//     if (!isPasswordValid) {
//       return next(createError(401, "Invalid password"));
//     }

//     // Deactivate account (soft delete)
//     (user as any).status = "deactivated";
//     (user as any).deactivatedAt = new Date();
//     await user.save();

//     // Revoke all sessions
//     await Session.updateMany(
//       { userId },
//       { revokedAt: new Date(), revokedBy: userId }
//     );

//     res.clearCookie("accessToken");
//     res.clearCookie("refreshToken");

//     return successResponse(res, {
//       statusCode: 200,
//       message: "Account deactivated successfully",
//     });
//   }
// );

// const handleReactivateAccount = asyncHandler(
//   async (
//     req: Request<{}, {}, { email: string }>,
//     res: Response,
//     next: NextFunction
//   ) => {
//     const { email } = req.body;

//     if (!email) {
//       return next(createError(400, "Email is required"));
//     }

//     const user = await User.findOne({
//       email: email.toLowerCase(),
//       // status: { $ne: UserStatus.ACTIVE }
//     });

//     if (!user) {
//       return next(
//         createError(404, "No deactivated account found with this email")
//       );
//     }

//     // Reactivate account
//     (user as any).status = "active";
//     (user as any).deactivatedAt = undefined;
//     await user.save();

//     return successResponse(res, {
//       statusCode: 200,
//       message: "Account reactivated successfully. You can now log in.",
//     });
//   }
// );

// const handleGetSecurityLogs = asyncHandler(
//   async (req: AuthRequest, res: Response, next: NextFunction) => {
//     const userId = req.user!._id;
//     const page = Number(req.query.page) || 1;
//     const limit = Number(req.query.limit) || 20;

//     const activities = await UserActivity.find({ userId })
//       .sort({ timestamp: -1 })
//       .limit(limit)
//       .skip((page - 1) * limit);

//     const totalActivities = await UserActivity.countDocuments({ userId });

//     return successResponse(res, {
//       statusCode: 200,
//       message: "Security logs retrieved successfully",
//       payload: {
//         activities,
//         pagination: {
//           totalActivities,
//           totalPages: Math.ceil(totalActivities / limit),
//           currentPage: page,
//           previousPage: page - 1 > 0 ? page - 1 : null,
//           nextPage:
//             page + 1 <= Math.ceil(totalActivities / limit) ? page + 1 : null,
//         },
//       },
//     });
//   }
// );

// const handleClearSecurityLogs = asyncHandler(
//   async (req: AuthRequest, res: Response, next: NextFunction) => {
//     const userId = req.user!._id;

//     const result = await UserActivity.deleteMany({ userId });

//     return successResponse(res, {
//       statusCode: 200,
//       message: "Security logs cleared successfully",
//       payload: {
//         deletedCount: result.deletedCount,
//       },
//     });
//   }
// );

// // Export all functions
// export {
//   handleCreateUser,
//   handleLogIn,
//   handleLogOut,
//   handleRefreshToken,
//   handleProtected,
//   handleGetMe,
//   handleChangedPassword,
//   handleForgotPassword,
//   handleResetPassword,
//   handleSendVerificationEmail,
//   handleVerifyEmail,
//   handleSetupTwoFactor,
//   handleVerifyTwoFactor,
//   handleDisableTwoFactor,
//   handleGenerateBackupCodes,
//   handleGetSessions,
//   handleRevokeSession,
//   handleRevokeAllSessions,
//   handleDeleteAccount,
//   handleUpdateProfile,

//   // New functions
//   handleResendVerificationEmail,
//   handleCheckUsernameAvailability,
//   handleCheckEmailAvailability,
//   handleUpdateEmail,
//   handleGetUserPreferences,
//   handleUpdateUserPreferences,
//   handleGetAccountStatus,
//   handleDeactivateAccount,
//   handleReactivateAccount,
//   handleGetSecurityLogs,
//   handleClearSecurityLogs,
// };
