import { Router } from "express";
import {
  getOverviewStats,
  getRevenueData,
  getUserAnalytics,
  getRecentActivity,
  getTopProducts,
  getConversionData,
  exportAnalyticsData,
} from "../controllers/analyticsController";
import { isLoggedIn, isAdmin, hasPermission } from "../middleware/auth";
import { Permission } from "../models/interfaces/IUser";

const analyticsRouter = Router();

// Apply authentication and permission protection to all analytics routes
analyticsRouter.use(isLoggedIn);
analyticsRouter.use(hasPermission(Permission.ANALYTICS_VIEW));

/**
 * @route   GET /api/analytics/overview
 * @desc    Get overview statistics for the admin dashboard
 */
analyticsRouter.get("/overview", getOverviewStats);

/**
 * @route   GET /api/analytics/revenue
 * @desc    Get revenue data over time
 */
analyticsRouter.get("/revenue", getRevenueData);

/**
 * @route   GET /api/analytics/users
 * @desc    Get user analytics data
 */
analyticsRouter.get("/users", getUserAnalytics);

/**
 * @route   GET /api/analytics/top-products
 * @desc    Get top products analytics
 */
analyticsRouter.get("/top-products", getTopProducts);

/**
 * @route   GET /api/analytics/conversion
 * @desc    Get conversion analytics
 */
analyticsRouter.get("/conversion", getConversionData);

/**
 * @route   POST /api/analytics/export
 * @desc    Export analytics data
 */
analyticsRouter.post("/export", exportAnalyticsData);

/**
 * @route   GET /api/analytics/recent-activity
 * @desc    Get recent activities
 */
analyticsRouter.get("/recent-activity", getRecentActivity);

export default analyticsRouter;
