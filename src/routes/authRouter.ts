import { Router } from "express";
import {
  handleCreateUser,
  handleDeleteAccount,
  handleDisableTwoFactor,
  handleForgotPassword,
  handleGenerateBackupCodes,
  handleGetMe,
  handleGetSessions,
  handleLogIn,
  handleLogOut,
  handleSocialLogin,
  handleChangedPassword,
  handleProtected,
  handleRefreshToken,
  handleResetPassword,
  handleSendVerificationEmail,
  handleSetupTwoFactor,
  handleUpdateProfile,
  handleVerifyEmail,
  handleVerifyTwoFactor,
  handleResendVerificationEmail,
  handleCheckUsernameAvailability,
  handleCheckEmailAvailability,
  handleUpdateEmail,
  handleGetUserPreferences,
  handleUpdateUserPreferences,
  handleUploadAvatar,
  handleDeleteAvatar,
  handleGetAccountStatus,
  handleDeactivateAccount,
  handleReactivateAccount,
  handleGetSecurityLogs,
  handleClearSecurityLogs,
  handleGetAllUsers,
  handleGetUser,
  handleRevokeAllSessions,
  handleRevokeSession,
  handleUpdateUser,
  handleAdminCreateUser,
  handleDeleteUser,
  handleUpdateUserRole,
  handleSendEmailToUser,
  handleAdminToggleTwoFactor,
  handleAdminRevokeAllSessions,
} from "../controllers/authController";
import { isLoggedIn, isAdmin, isLoggedOut, authorize, hasPermission } from "../middleware/auth";
import { UserRole, Permission } from "../models/interfaces/IUser";
import { rateLimitConfig, validationRules } from "../validator/authValidator";
import { runValidation } from "../validator";
import upload from "../config/multer.config";

const authRouter = Router();

// ==================== PUBLIC ROUTES ====================
authRouter.post(
  "/login",
  isLoggedOut,
  rateLimitConfig.login,
  validationRules.login,
  runValidation,
  handleLogIn
);

authRouter.post(
  "/social-login",
  isLoggedOut,
  rateLimitConfig.login,
  handleSocialLogin
);

authRouter.post(
  "/register",
  isLoggedOut,
  rateLimitConfig.register,
  validationRules.registration,
  runValidation,
  handleCreateUser
);

authRouter.post(
  "/forgot-password",
  rateLimitConfig.passwordReset,
  validationRules.forgotPassword,
  runValidation,
  handleForgotPassword
);

authRouter.post(
  "/reset-password",
  rateLimitConfig.passwordReset,
  validationRules.resetPassword,
  runValidation,
  handleResetPassword
);

// Email verification routes
authRouter.post(
  "/verify-email",
  validationRules.emailVerification,
  runValidation,
  handleVerifyEmail
);

authRouter.post(
  "/resend-verification",
  validationRules.resendVerification,
  runValidation,
  handleResendVerificationEmail
);

authRouter.post("/refresh-token", handleRefreshToken);

// Account reactivation
authRouter.post(
  "/reactivate-account",
  isLoggedOut,
  validationRules.reactivateAccount,
  runValidation,
  handleReactivateAccount
);

// Availability checks
authRouter.get(
  "/check-username",
  validationRules.checkAvailability,
  runValidation,
  handleCheckUsernameAvailability
);

authRouter.get(
  "/check-email",
  validationRules.checkAvailability,
  runValidation,
  handleCheckEmailAvailability
);

// ==================== PROTECTED USER ROUTES ====================
authRouter.get("/me", isLoggedIn, rateLimitConfig.general, handleGetMe);

authRouter.put(
  "/profile",
  isLoggedIn,
  rateLimitConfig.general,
  validationRules.profileUpdate,
  runValidation,
  handleUpdateProfile
);

// User management routes
authRouter.get(
  "/users",
  isLoggedIn,
  hasPermission(Permission.USERS_VIEW),
  rateLimitConfig.general,
  validationRules.userList,
  runValidation,
  handleGetAllUsers
);

authRouter.get(
  "/user/:userId",
  isLoggedIn,
  hasPermission(Permission.USERS_VIEW),
  rateLimitConfig.general,
  validationRules.userLookup,
  runValidation,
  handleGetUser
);

authRouter.put(
  "/change-password/:userId",
  isLoggedIn,
  rateLimitConfig.sensitiveAction,
  validationRules.passwordChange,
  runValidation,
  handleChangedPassword as any
);

authRouter.post(
  "/send-verification-email",
  isLoggedIn,
  rateLimitConfig.general,
  handleSendVerificationEmail
);

// Email management
authRouter.put(
  "/update-email",
  isLoggedIn,
  rateLimitConfig.sensitiveAction,
  validationRules.updateEmail,
  runValidation,
  handleUpdateEmail
);

// ==================== 2FA ROUTES ====================
authRouter.post(
  "/setup-2fa",
  isLoggedIn,
  rateLimitConfig.twoFactor,
  validationRules.twoFactorSetup,
  runValidation,
  handleSetupTwoFactor
);

authRouter.post(
  "/verify-2fa",
  isLoggedIn,
  rateLimitConfig.twoFactor,
  validationRules.twoFactorVerify,
  runValidation,
  handleVerifyTwoFactor
);

authRouter.post(
  "/disable-2fa",
  isLoggedIn,
  rateLimitConfig.twoFactor,
  validationRules.twoFactorDisable,
  runValidation,
  handleDisableTwoFactor
);

authRouter.post(
  "/generate-backup-codes",
  isLoggedIn,
  rateLimitConfig.twoFactor,
  handleGenerateBackupCodes
);

// ==================== SESSION MANAGEMENT ====================
authRouter.get(
  "/sessions",
  isLoggedIn,
  rateLimitConfig.general,
  handleGetSessions
);

authRouter.delete(
  "/sessions",
  isLoggedIn,
  rateLimitConfig.general,
  handleRevokeAllSessions
);

authRouter.delete(
  "/sessions/:sessionId",
  isLoggedIn,
  rateLimitConfig.general,
  handleRevokeSession
);

// ==================== ACCOUNT MANAGEMENT ====================
authRouter.get(
  "/account/status",
  isLoggedIn,
  rateLimitConfig.general,
  handleGetAccountStatus
);

authRouter.get(
  "/account/preferences",
  isLoggedIn,
  rateLimitConfig.general,
  handleGetUserPreferences
);

authRouter.put(
  "/account/preferences",
  isLoggedIn,
  rateLimitConfig.general,
  validationRules.preferencesUpdate,
  runValidation,
  handleUpdateUserPreferences
);

authRouter.post(
  "/profile/avatar",
  isLoggedIn,
  upload.single("avatar"),
  handleUploadAvatar
);

authRouter.delete(
  "/profile/avatar",
  isLoggedIn,
  handleDeleteAvatar
);

authRouter.post(
  "/account/deactivate",
  isLoggedIn,
  rateLimitConfig.sensitiveAction,
  validationRules.deactivateAccount,
  runValidation,
  handleDeactivateAccount
);

authRouter.delete(
  "/account",
  isLoggedIn,
  rateLimitConfig.general,
  validationRules.deleteAccount,
  runValidation,
  handleDeleteAccount
);

// ==================== SECURITY & ACTIVITY ====================
authRouter.get(
  "/security/logs",
  isLoggedIn,
  rateLimitConfig.general,
  validationRules.securityLogs,
  runValidation,
  handleGetSecurityLogs
);
authRouter.delete(
  "/users/:userId",
  isLoggedIn,
  hasPermission(Permission.USERS_DELETE),
  rateLimitConfig.sensitiveAction,
  validationRules.deleteUser,
  runValidation,
  handleDeleteUser
);
authRouter.delete(
  "/security/logs",
  isLoggedIn,
  rateLimitConfig.general,
  handleClearSecurityLogs
);

// ==================== ADMIN USER MANAGEMENT ROUTES ====================


authRouter.patch(
  "/users/:userId/role",
  isLoggedIn,
  hasPermission(Permission.ROLES_EDIT),
  rateLimitConfig.sensitiveAction,
  validationRules.updateUserRole, // যোগ করুন
  runValidation,
  handleUpdateUserRole
);

authRouter.post(
  "/users/:userId/send-email",
  isLoggedIn,
  hasPermission(Permission.USERS_EDIT),
  rateLimitConfig.general,
  validationRules.sendUserEmail, 
  runValidation,
  handleSendEmailToUser
);

authRouter.put(
  "/users/:userId",
  isLoggedIn,
  hasPermission(Permission.USERS_EDIT),
  rateLimitConfig.general,
  validationRules.adminUpdateUser,  
  runValidation,
  handleUpdateUser
);

authRouter.post(
  "/admin/create-user",
  isLoggedIn,
  hasPermission(Permission.USERS_CREATE),
  rateLimitConfig.general,
  validationRules.adminCreateUser,
  runValidation,
  handleAdminCreateUser
);

authRouter.patch(
  "/users/:userId/toggle-2fa",
  isLoggedIn,
  hasPermission(Permission.USERS_EDIT),
  rateLimitConfig.sensitiveAction,
  handleAdminToggleTwoFactor
);

authRouter.delete(
  "/users/:userId/sessions",
  isLoggedIn,
  hasPermission(Permission.USERS_EDIT),
  rateLimitConfig.sensitiveAction,
  handleAdminRevokeAllSessions
);
// ==================== MISCELLANEOUS ====================
authRouter.post("/logout", isLoggedIn, handleLogOut);

authRouter.get("/protected", isLoggedIn, handleProtected);

authRouter.get("/health", rateLimitConfig.general, (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: "Authentication Service",
  });
});

export default authRouter;
