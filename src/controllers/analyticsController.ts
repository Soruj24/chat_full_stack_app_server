import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
 
import Invoice from "../models/Invoice";
import UserActivity from "../models/UserActivity";
import createError from "http-errors";
import mongoose from "mongoose";
import User from "../models/schemas/User";
import { SupportTicket } from "../models/SupportTicket";
import { successResponse } from "./responsControllers";

/**
 * @desc    Get overview statistics for the admin dashboard
 * @route   GET /api/analytics/overview
 * @access  Private/Admin
 */
export const getOverviewStats = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = (req.query.period as string) || "30days";
      const endDate = new Date();
      const startDate = new Date();

      if (period === "7days") {
        startDate.setDate(endDate.getDate() - 7);
      } else if (period === "30days") {
        startDate.setDate(endDate.getDate() - 30);
      } else if (period === "90days") {
        startDate.setDate(endDate.getDate() - 90);
      } else if (period === "year") {
        startDate.setFullYear(endDate.getFullYear() - 1);
      }

      // Get ticket stats
      const ticketStats = await SupportTicket.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],
            open: [{ $match: { status: "open" } }, { $count: "count" }],
            inProgress: [
              { $match: { status: "in-progress" } },
              { $count: "count" },
            ],
            resolved: [{ $match: { status: "resolved" } }, { $count: "count" }],
          },
        },
      ]);

      const totalTickets = ticketStats[0].total[0]?.count || 0;
      const openTickets = ticketStats[0].open[0]?.count || 0;
      const inProgressTickets = ticketStats[0].inProgress[0]?.count || 0;
      const activeTickets = openTickets + inProgressTickets;

      // Get user stats using the static method defined in User model (if it exists)
      // Otherwise calculate here
      const userStats = await User.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],
            active: [{ $match: { status: "active" } }, { $count: "count" }],
            new: [
              { $match: { createdAt: { $gte: startDate } } },
              { $count: "count" },
            ],
          },
        },
      ]);

      const totalUsers = userStats[0].total[0]?.count || 0;
      const activeUsers = userStats[0].active[0]?.count || 0;
      const newUsers = userStats[0].new[0]?.count || 0;

      // Calculate revenue
      const revenueStats = await Invoice.aggregate([
        {
          $match: {
            status: "paid",
            paidAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]);

      const totalRevenue = revenueStats[0]?.totalRevenue || 0;
      const totalSales = revenueStats[0]?.count || 0;

      // Get previous period stats for growth calculation
      const prevStartDate = new Date(startDate);
      if (period === "7days") prevStartDate.setDate(startDate.getDate() - 7);
      else if (period === "30days") prevStartDate.setDate(startDate.getDate() - 30);
      else if (period === "90days") prevStartDate.setDate(startDate.getDate() - 90);
      else if (period === "year") prevStartDate.setFullYear(startDate.getFullYear() - 1);

      const prevRevenueStats = await Invoice.aggregate([
        {
          $match: {
            status: "paid",
            paidAt: { $gte: prevStartDate, $lt: startDate },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amount" },
          },
        },
      ]);

      const prevRevenue = prevRevenueStats[0]?.totalRevenue || 0;
      const revenueGrowth = prevRevenue === 0 ? 100 : ((totalRevenue - prevRevenue) / prevRevenue) * 100;

      return successResponse(res, {
        statusCode: 200,
        message: "Overview statistics retrieved successfully",
        payload: {
          totalUsers,
          activeUsers,
          newUsers,
          totalRevenue,
          totalSales,
          revenueGrowth: Math.round(revenueGrowth * 10) / 10,
          totalTickets,
          activeTickets,
          openTickets,
          inProgressTickets,
          period,
        },
      });
    } catch (error) {
      console.error("Get overview stats error:", error);
      return next(createError(500, "Failed to retrieve overview statistics"));
    }
  }
);

/**
 * @desc    Get revenue data over time for charts
 * @route   GET /api/analytics/revenue
 * @access  Private/Admin
 */
export const getRevenueData = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = (req.query.period as string) || "30days";
      const endDate = new Date();
      const startDate = new Date();

      let groupByFormat = "%Y-%m-%d";
      if (period === "7days" || period === "30days") {
        startDate.setDate(endDate.getDate() - (period === "7days" ? 7 : 30));
        groupByFormat = "%Y-%m-%d";
      } else if (period === "90days") {
        startDate.setDate(endDate.getDate() - 90);
        groupByFormat = "%Y-%U"; // Weekly
      } else if (period === "year") {
        startDate.setFullYear(endDate.getFullYear() - 1);
        groupByFormat = "%Y-%m"; // Monthly
      }

      const revenueData = await Invoice.aggregate([
        {
          $match: {
            status: "paid",
            paidAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: groupByFormat, date: "$paidAt" } },
            revenue: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return successResponse(res, {
        statusCode: 200,
        message: "Revenue data retrieved successfully",
        payload: revenueData.map(item => ({
          date: item._id,
          revenue: item.revenue,
        })),
      });
    } catch (error) {
      console.error("Get revenue data error:", error);
      return next(createError(500, "Failed to retrieve revenue data"));
    }
  }
);

/**
 * @desc    Get user analytics data
 * @route   GET /api/analytics/users
 * @access  Private/Admin
 */
export const getUserAnalytics = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = (req.query.period as string) || "30days";
      
      // Basic implementation for demographics and behavior
      // In a real app, you would aggregate this from user logs/profiles
      const demographics = {
        ageGroups: [
          { group: "18-24", users: 150, percentage: 15, growth: 5 },
          { group: "25-34", users: 450, percentage: 45, growth: 12 },
          { group: "35-44", users: 250, percentage: 25, growth: -2 },
          { group: "45+", users: 150, percentage: 15, growth: 3 },
        ],
        regions: [
          { region: "North America", users: 400, growth: 8, percentage: 40 },
          { region: "Europe", users: 300, growth: 5, percentage: 30 },
          { region: "Asia", users: 200, growth: 15, percentage: 20 },
          { region: "Other", users: 100, growth: 2, percentage: 10 },
        ],
        devices: [
          { device: "Desktop", users: 600, percentage: 60, avgSessionDuration: "12m" },
          { device: "Mobile", users: 350, percentage: 35, avgSessionDuration: "8m" },
          { device: "Tablet", users: 50, percentage: 5, avgSessionDuration: "10m" },
        ],
      };

      const behavior = {
        pageViews: 15000,
        avgSessionDuration: "10m 30s",
        bounceRate: 35.5,
        returningUsers: 65,
        newUsers: 35,
        pagesPerSession: 4.5,
        sessionsPerUser: 2.1,
        avgTimeOnPage: "2m 15s",
        topPages: [
          { page: "/dashboard", views: 5000, uniqueVisitors: 1200 },
          { page: "/profile", views: 3000, uniqueVisitors: 900 },
          { page: "/settings", views: 2000, uniqueVisitors: 800 },
        ],
      };

      const acquisition = {
        sources: [
          { source: "Direct", users: 400, percentage: 40, conversionRate: 5.2 },
          { source: "Google", users: 300, percentage: 30, conversionRate: 4.8 },
          { source: "Social Media", users: 200, percentage: 20, conversionRate: 3.5 },
          { source: "Referral", users: 100, percentage: 10, conversionRate: 6.1 },
        ],
        campaigns: [
          { campaign: "Summer Sale", users: 500, conversionRate: 7.2, revenue: 5000 },
          { campaign: "New Feature", users: 300, conversionRate: 4.5, revenue: 2000 },
        ],
      };

      return successResponse(res, {
        statusCode: 200,
        message: "User analytics retrieved successfully",
        payload: {
          demographics,
          behavior,
          acquisition,
        },
      });
    } catch (error) {
      console.error("Get user analytics error:", error);
      return next(createError(500, "Failed to retrieve user analytics data"));
    }
  }
);

/**
 * @desc    Get top products analytics
 * @route   GET /api/analytics/top-products
 * @access  Private/Admin
 */
export const getTopProducts = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Mock data for products
      const products = [
        {
          id: "1",
          name: "Premium Subscription",
          sku: "SUB-PREM",
          category: "Subscriptions",
          sales: 150,
          revenue: 1500,
          unitsSold: 150,
          growth: 15,
          conversionRate: 8.5,
          stock: 999,
          avgRating: 4.8,
          reviews: 45,
        },
        {
          id: "2",
          name: "Basic Plan",
          sku: "SUB-BASIC",
          category: "Subscriptions",
          sales: 300,
          revenue: 900,
          unitsSold: 300,
          growth: 10,
          conversionRate: 12.2,
          stock: 999,
          avgRating: 4.5,
          reviews: 120,
        },
      ];

      return successResponse(res, {
        statusCode: 200,
        message: "Top products retrieved successfully",
        payload: {
          products,
          categories: [
            { category: "Subscriptions", revenue: 2400, products: 2, growth: 12 },
          ],
        },
      });
    } catch (error) {
      console.error("Get top products error:", error);
      return next(createError(500, "Failed to retrieve top products data"));
    }
  }
);

/**
 * @desc    Get conversion analytics
 * @route   GET /api/analytics/conversion
 * @access  Private/Admin
 */
export const getConversionData = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      return successResponse(res, {
        statusCode: 200,
        message: "Conversion data retrieved successfully",
        payload: {
          funnel: [
            { stage: "Visitors", count: 10000, percentage: 100 },
            { stage: "Signups", count: 2000, percentage: 20 },
            { stage: "Active Users", count: 1500, percentage: 15 },
            { stage: "Paid Users", count: 300, percentage: 3 },
          ],
          rates: {
            signupRate: 20,
            activationRate: 75,
            churnRate: 5,
            retentionRate: 95,
          },
        },
      });
    } catch (error) {
      console.error("Get conversion data error:", error);
      return next(createError(500, "Failed to retrieve conversion data"));
    }
  }
);

/**
 * @desc    Export analytics data
 * @route   POST /api/analytics/export
 * @access  Private/Admin
 */
export const exportAnalyticsData = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, format } = req.body;
      
      let data = "";
      let fileName = `analytics-export-${type}-${Date.now()}`;

      if (type === "users") {
        const users = await User.find().select("username email role status createdAt").limit(100);
        if (format === "csv") {
          data = "Username,Email,Role,Status,Created At\n";
          users.forEach(user => {
            data += `${user.username},${user.email},${user.role},${user.status},${user.createdAt}\n`;
          });
          fileName += ".csv";
          res.setHeader("Content-Type", "text/csv");
        } else {
          data = JSON.stringify(users, null, 2);
          fileName += ".json";
          res.setHeader("Content-Type", "application/json");
        }
      } else if (type === "revenue") {
        const invoices = await Invoice.find({ status: "paid" }).populate("userId", "username email").limit(100);
        if (format === "csv") {
          data = "Invoice ID,Amount,Customer,Date\n";
          invoices.forEach((inv: any) => {
            const customerName = inv.userId ? (inv.userId as any).username : "N/A";
            data += `${inv._id},${inv.amount},${customerName},${inv.paidAt}\n`;
          });
          fileName += ".csv";
          res.setHeader("Content-Type", "text/csv");
        } else {
          data = JSON.stringify(invoices, null, 2);
          fileName += ".json";
          res.setHeader("Content-Type", "application/json");
        }
      } else {
        // Default mock data
        data = "Date,Metric,Value\n2024-01-01,Users,100\n2024-01-02,Users,110";
        fileName += ".csv";
        res.setHeader("Content-Type", "text/csv");
      }

      res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
      return res.status(200).send(data);
    } catch (error) {
      console.error("Export analytics error:", error);
      return next(createError(500, "Failed to export analytics data"));
    }
  }
);

/**
 * @desc    Get recent activities for the dashboard
 * @route   GET /api/analytics/recent-activity
 * @access  Private/Admin
 */
export const getRecentActivity = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      const activities = await UserActivity.find()
        .populate("userId", "name email avatar")
        .sort({ timestamp: -1 })
        .limit(limit);

      return successResponse(res, {
        statusCode: 200,
        message: "Recent activities retrieved successfully",
        payload: activities,
      });
    } catch (error) {
      console.error("Get recent activity error:", error);
      return next(createError(500, "Failed to retrieve recent activities"));
    }
  }
);
