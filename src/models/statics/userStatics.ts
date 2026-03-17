// models/statics/userStatics.ts
import { Schema, Types } from "mongoose";
import { IUserDoc, UserModel } from "../types/UserTypes";
import { IUser, UserStatus, UserRole } from "../interfaces/IUser";

export const applyUserStatics = (schema: Schema<IUserDoc>) => {
  // Search functionality
  schema.statics.searchUsers = function (
    query: string,
    options: {
      limit?: number;
      skip?: number;
      language?: string;
      fields?: string[];
      includeInactive?: boolean;
    } = {}
  ) {
    const {
      limit = 20,
      skip = 0,
      language = 'en',
      fields = ['username', 'email', 'firstName', 'lastName', 'displayName'],
      includeInactive = false
    } = options;

    const searchConditions = fields.map(field => ({
      [field]: { $regex: query, $options: 'i' }
    }));

    const baseFilter: any = {
      $or: searchConditions,
      isBanned: false,
      isDeleted: { $ne: true }
    };

    if (!includeInactive) {
      baseFilter.status = UserStatus.ACTIVE;
    }

    return this.find(baseFilter)
      .limit(limit)
      .skip(skip)
      .select('username email firstName lastName displayName avatar isOnline lastSeen role isVerified')
      .sort({ isOnline: -1, lastSeen: -1, isVerified: -1 });
  };

  // Find by email
  schema.statics.findByEmail = function (email: string, includeDeleted: boolean = false) {
    const filter: any = { email: email.toLowerCase().trim() };
    if (!includeDeleted) {
      filter.isDeleted = { $ne: true };
    }
    return this.findOne(filter);
  };

  // Find by username
  schema.statics.findByUsername = function (username: string, includeDeleted: boolean = false) {
    const filter: any = { username: username.toLowerCase().trim() };
    if (!includeDeleted) {
      filter.isDeleted = { $ne: true };
    }
    return this.findOne(filter);
  };

  // Find by phone
  schema.statics.findByPhone = function (phone: string, includeDeleted: boolean = false) {
    const filter: any = { phone };
    if (!includeDeleted) {
      filter.isDeleted = { $ne: true };
    }
    return this.findOne(filter);
  };

  // Analytics and stats
  schema.statics.getUserStats = function (dateRange?: { start: Date; end: Date }) {
    const matchStage: any = { isDeleted: { $ne: true } };

    if (dateRange) {
      matchStage.createdAt = { $gte: dateRange.start, $lte: dateRange.end };
    }

    return this.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: [{ $eq: ['$status', UserStatus.ACTIVE] }, 1, 0] } },
          onlineUsers: { $sum: { $cond: ['$isOnline', 1, 0] } },
          verifiedUsers: { $sum: { $cond: ['$isVerified', 1, 0] } },
          bannedUsers: { $sum: { $cond: ['$isBanned', 1, 0] } },
          premiumUsers: { $sum: { $cond: [{ $eq: ['$role', UserRole.PREMIUM] }, 1, 0] } },
          avgProfileCompletion: { $avg: '$profileCompletion' },
          avgLoginCount: { $avg: '$loginCount' }
        }
      },
      {
        $addFields: {
          activePercentage: { $multiply: [{ $divide: ['$activeUsers', '$totalUsers'] }, 100] },
          verificationRate: { $multiply: [{ $divide: ['$verifiedUsers', '$totalUsers'] }, 100] }
        }
      }
    ]);
  };

  // Get active users
  schema.statics.getActiveUsers = function (options: {
    limit?: number;
    skip?: number;
    sortBy?: string;
  } = {}) {
    const { limit = 50, skip = 0, sortBy = '-lastSeen' } = options;

    return this.find({
      status: UserStatus.ACTIVE,
      isBanned: false,
      isDeleted: { $ne: true },
      isOnline: true
    })
      .limit(limit)
      .skip(skip)
      .sort(sortBy)
      .select('username email firstName lastName displayName avatar isOnline lastSeen role')
      .populate('followers', 'username avatar')
      .populate('following', 'username avatar');
  };

  // Get top users
  schema.statics.getTopUsers = function (
    metric: 'followers' | 'connections' | 'activity',
    limit: number = 10
  ) {
    let sortField: any;

    switch (metric) {
      case 'followers':
        sortField = { followersCount: -1 };
        break;
      case 'connections':
        sortField = { totalConnections: -1 };
        break;
      case 'activity':
        sortField = { loginCount: -1, lastLoginAt: -1 };
        break;
      default:
        sortField = { createdAt: -1 };
    }

    return this.aggregate([
      {
        $match: {
          status: UserStatus.ACTIVE,
          isBanned: false,
          isDeleted: { $ne: true }
        }
      },
      {
        $addFields: {
          followersCount: { $size: { $ifNull: ['$followers', []] } },
          followingCount: { $size: { $ifNull: ['$following', []] } },
          friendsCount: { $size: { $ifNull: ['$friends', []] } },
          totalConnections: {
            $add: [
              { $size: { $ifNull: ['$followers', []] } },
              { $size: { $ifNull: ['$following', []] } },
              { $size: { $ifNull: ['$friends', []] } }
            ]
          }
        }
      },
      { $sort: sortField },
      { $limit: limit },
      {
        $project: {
          username: 1,
          displayName: 1,
          avatar: 1,
          isVerified: 1,
          role: 1,
          followersCount: 1,
          totalConnections: 1,
          loginCount: 1,
          lastLoginAt: 1
        }
      }
    ]);
  };

  // Bulk operations
  schema.statics.bulkUpdateStatus = function (userIds: Types.ObjectId[], status: UserStatus) {
    return this.updateMany(
      { _id: { $in: userIds }, isDeleted: { $ne: true } },
      {
        $set: {
          status,
          updatedAt: new Date()
        }
      }
    );
  };

  // Cleanup inactive users
  schema.statics.cleanupInactiveUsers = function (daysInactive: number = 365) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    return this.updateMany(
      {
        lastSeen: { $lt: cutoffDate },
        status: { $in: [UserStatus.INACTIVE, UserStatus.PENDING] },
        isDeleted: { $ne: true }
      },
      {
        $set: {
          isDeleted: true,
          status: UserStatus.DELETED,
          updatedAt: new Date()
        }
      }
    ).then((result: any) => result.modifiedCount);
  };

  // Security monitoring
  schema.statics.findSuspiciousLogins = function (timeWindow: number = 24) {
    const timeThreshold = new Date();
    timeThreshold.setHours(timeThreshold.getHours() - timeWindow);

    return this.aggregate([
      { $unwind: '$loginHistory' },
      {
        $match: {
          'loginHistory.timestamp': { $gte: timeThreshold },
          'loginHistory.success': false
        }
      },
      {
        $group: {
          _id: '$_id',
          username: { $first: '$username' },
          email: { $first: '$email' },
          failedAttempts: { $sum: 1 },
          distinctIPs: { $addToSet: '$loginHistory.ipAddress' },
          lastFailure: { $max: '$loginHistory.timestamp' }
        }
      },
      {
        $match: {
          $or: [
            { failedAttempts: { $gte: 5 } },
            { distinctIPs: { $size: { $gte: 3 } } }
          ]
        }
      },
      {
        $sort: { failedAttempts: -1, lastFailure: -1 }
      }
    ]);
  };

  // Find users with expired tokens
  schema.statics.findUsersWithExpiredTokens = function () {
    const now = new Date();
    return this.find({
      $or: [
        { resetPasswordExpires: { $lt: now } },
        { emailVerificationExpires: { $lt: now } },
        { phoneVerificationExpires: { $lt: now } }
      ],
      isDeleted: { $ne: true }
    }).select('username email resetPasswordExpires emailVerificationExpires phoneVerificationExpires');
  };

  // Admin user creation
  schema.statics.createAdminUser = async function (
    userData: Partial<IUser>,
    createdBy: Types.ObjectId
  ): Promise<IUserDoc> {
    const creator = await this.findById(createdBy);
    if (!creator || creator.getRoleLevel() < 4) {
      throw new Error('Insufficient permissions to create admin user');
    }

    const adminData: Partial<IUser> = {
      ...userData,
      role: UserRole.ADMIN,
      isVerified: true,
      emailVerified: true,
      status: UserStatus.ACTIVE,
      twoFactorAuth: {
        enabled: true,
        method: 'totp',
        recoveryCodesUsed: 0
      }
    };

    const adminUser = new this(adminData);
    await (adminUser as IUserDoc).addAuditLog('ADMIN_USER_CREATED', {
      createdBy: createdBy,
      role: adminData.role
    });

    return adminUser.save();
  };

  // Password reset stats
  schema.statics.getPasswordResetStats = function () {
    return this.aggregate([
      {
        $match: {
          resetPasswordExpires: { $exists: true },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          expiredTokens: {
            $sum: {
              $cond: [
                { $lt: ['$resetPasswordExpires', new Date()] },
                1,
                0
              ]
            }
          },
          validTokens: {
            $sum: {
              $cond: [
                { $gte: ['$resetPasswordExpires', new Date()] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);
  };

  // User growth metrics
  schema.statics.getUserGrowthMetrics = function (days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          newUsers: { $sum: 1 },
          verifiedUsers: {
            $sum: { $cond: ['$emailVerified', 1, 0] }
          },
          premiumUsers: {
            $sum: { $cond: [{ $eq: ['$role', UserRole.PREMIUM] }, 1, 0] }
          }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day'
            }
          },
          newUsers: 1,
          verifiedUsers: 1,
          premiumUsers: 1,
          verificationRate: {
            $multiply: [
              { $divide: ['$verifiedUsers', '$newUsers'] },
              100
            ]
          }
        }
      }
    ]);
  };

  // Find dormant users
  schema.statics.findDormantUsers = function (daysInactive: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    return this.find({
      lastSeen: { $lt: cutoffDate },
      status: UserStatus.ACTIVE,
      isDeleted: { $ne: true },
      isBanned: false
    })
      .select('username email firstName lastName lastSeen loginCount accountCreatedAt')
      .sort({ lastSeen: 1 })
      .limit(100);
  };

  // Engagement metrics
  schema.statics.getEngagementMetrics = function () {
    return this.aggregate([
      {
        $match: {
          status: UserStatus.ACTIVE,
          isDeleted: { $ne: true }
        }
      },
      {
        $addFields: {
          daysSinceLastLogin: {
            $divide: [
              { $subtract: [new Date(), '$lastSeen'] },
              1000 * 60 * 60 * 24
            ]
          },
          followersCount: { $size: { $ifNull: ['$followers', []] } },
          followingCount: { $size: { $ifNull: ['$following', []] } },
          friendsCount: { $size: { $ifNull: ['$friends', []] } }
        }
      },
      {
        $group: {
          _id: null,
          totalActiveUsers: { $sum: 1 },
          dailyActiveUsers: {
            $sum: {
              $cond: [{ $lte: ['$daysSinceLastLogin', 1] }, 1, 0]
            }
          },
          weeklyActiveUsers: {
            $sum: {
              $cond: [{ $lte: ['$daysSinceLastLogin', 7] }, 1, 0]
            }
          },
          monthlyActiveUsers: {
            $sum: {
              $cond: [{ $lte: ['$daysSinceLastLogin', 30] }, 1, 0]
            }
          },
          avgFollowers: { $avg: '$followersCount' },
          avgFollowing: { $avg: '$followingCount' },
          avgFriends: { $avg: '$friendsCount' },
          avgLoginCount: { $avg: '$loginCount' },
          highlyEngagedUsers: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ['$followersCount', 10] },
                    { $gte: ['$loginCount', 20] },
                    { $lte: ['$daysSinceLastLogin', 7] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);
  };
};