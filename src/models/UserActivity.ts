import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserActivity extends Document {
    userId: mongoose.Types.ObjectId;
    activityType: string;
    description: string;
    ipAddress?: string;
    userAgent?: string;
    location?: {
        country?: string;
        city?: string;
        region?: string;
        timezone?: string;
    };
    deviceInfo?: {
        browser?: string;
        os?: string;
        device?: string;
        platform?: string;
    };
    timestamp: Date;
    metadata?: any;
    status: 'success' | 'failure' | 'warning' | 'info';
    duration?: number; // in milliseconds
    resourceId?: mongoose.Types.ObjectId;
    resourceType?: string;
}

const UserActivitySchema: Schema<IUserActivity> = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true
    },
    activityType: {
        type: String,
        required: [true, 'Activity type is required'],
        enum: [
            'login',
            'logout',
            'password_change',
            'profile_update',
            'email_verification',
            'two_factor_setup',
            'email_verified',
            'info',
            'status',
            'admin_to_user_email',
            'admin_email_sent',
            'admin_email_received',
            'password_reset_request',
            'password_reset_success',
            'account_deletion_request',
            'preferences_update',
            'avatar_upload',
            'address_add',
            'address_update',
            'address_delete',
            'admin_user_updated',
            'admin_user_deleted',
            'admin_user_created',
            'session_created',
            'session_ended',
            'session_revoked',
            'notification_read',
            'email_verification_resent',
            'export_data',
            'api_call',
            'email_sent',
            'payment_made',
            'subscription_update',
            'role_change',
            'account_creation',  
            'registration',       
        ],
        index: true
    },
    description: {
        type: String,
        required: [true, 'Activity description is required'],
        trim: true
    },
    ipAddress: {
        type: String,
        trim: true
    },
    userAgent: {
        type: String,
        trim: true
    },
    location: {
        country: { type: String, trim: true },
        city: { type: String, trim: true },
        region: { type: String, trim: true },
        timezone: { type: String, trim: true }
    },
    deviceInfo: {
        browser: { type: String, trim: true },
        os: { type: String, trim: true },
        device: { type: String, trim: true },
        platform: { type: String, trim: true }
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: {}
    },
    status: {
        type: String,
        enum: ['success', 'failure', 'warning', 'info'],
        default: 'success',
        index: true
    },
    duration: {
        type: Number, // in milliseconds
        min: 0
    },
    resourceId: {
        type: Schema.Types.ObjectId,
        refPath: 'resourceType'
    },
    resourceType: {
        type: String,
        enum: ['User', 'Session', 'Notification', 'Payment', 'Subscription']
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Index for efficient querying
UserActivitySchema.index({ userId: 1, timestamp: -1 });
UserActivitySchema.index({ activityType: 1, timestamp: -1 });
UserActivitySchema.index({ status: 1, timestamp: -1 });
UserActivitySchema.index({ 'location.country': 1, timestamp: -1 });

// Virtual for formatted date
UserActivitySchema.virtual('formattedDate').get(function (this: IUserActivity) {
    return this.timestamp.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
});

// Virtual for user reference
UserActivitySchema.virtual('user', {
    ref: 'User',
    localField: 'userId',
    foreignField: '_id',
    justOne: true
});

// Static method to get user activities with pagination
UserActivitySchema.statics.getUserActivities = async function (
    userId: mongoose.Types.ObjectId,
    page: number = 1,
    limit: number = 10,
    filters: any = {}
) {
    const skip = (page - 1) * limit;

    const query = { userId, ...filters };

    const activities = await this.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email')
        .lean();

    const total = await this.countDocuments(query);

    return {
        activities,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalActivities: total,
            hasNextPage: page < Math.ceil(total / limit),
            hasPrevPage: page > 1
        }
    };
};

// Static method to get activity statistics
UserActivitySchema.statics.getActivityStats = async function (
    userId: mongoose.Types.ObjectId,
    days: number = 30
) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await this.aggregate([
        {
            $match: {
                userId: userId,
                timestamp: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: {
                    activityType: '$activityType',
                    status: '$status'
                },
                count: { $sum: 1 },
                lastActivity: { $max: '$timestamp' }
            }
        },
        {
            $group: {
                _id: '$_id.activityType',
                total: { $sum: '$count' },
                success: {
                    $sum: {
                        $cond: [{ $eq: ['$_id.status', 'success'] }, '$count', 0]
                    }
                },
                failure: {
                    $sum: {
                        $cond: [{ $eq: ['$_id.status', 'failure'] }, '$count', 0]
                    }
                },
                warning: {
                    $sum: {
                        $cond: [{ $eq: ['$_id.status', 'warning'] }, '$count', 0]
                    }
                },
                info: {
                    $sum: {
                        $cond: [{ $eq: ['$_id.status', 'info'] }, '$count', 0]
                    }
                },
                lastActivity: { $max: '$lastActivity' }
            }
        },
        {
            $project: {
                activityType: '$_id',
                total: 1,
                success: 1,
                failure: 1,
                warning: 1,
                info: 1,
                successRate: {
                    $round: [
                        {
                            $multiply: [
                                { $divide: ['$success', '$total'] },
                                100
                            ]
                        },
                        2
                    ]
                },
                lastActivity: 1
            }
        },
        { $sort: { total: -1 } }
    ]);

    return stats;
};

// Method to log activity
UserActivitySchema.statics.logActivity = async function (activityData: {
    userId: mongoose.Types.ObjectId;
    activityType: string;
    description: string;
    ipAddress?: string;
    userAgent?: string;
    location?: any;
    deviceInfo?: any;
    status?: 'success' | 'failure' | 'warning' | 'info';
    duration?: number;
    resourceId?: mongoose.Types.ObjectId;
    resourceType?: string;
    metadata?: any;
}) {
    return await this.create(activityData);
};

// Pre-save middleware to trim strings
UserActivitySchema.pre('save', async function () {
    if (this.ipAddress) this.ipAddress = this.ipAddress.trim();
    if (this.userAgent) this.userAgent = this.userAgent.trim();
    
    // Trim location fields
    if (this.location) {
        if (this.location.country) this.location.country = this.location.country.trim();
        if (this.location.city) this.location.city = this.location.city.trim();
        if (this.location.region) this.location.region = this.location.region.trim();
        if (this.location.timezone) this.location.timezone = this.location.timezone.trim();
    }
    
    // Trim device info fields
    if (this.deviceInfo) {
        if (this.deviceInfo.browser) this.deviceInfo.browser = this.deviceInfo.browser.trim();
        if (this.deviceInfo.os) this.deviceInfo.os = this.deviceInfo.os.trim();
        if (this.deviceInfo.device) this.deviceInfo.device = this.deviceInfo.device.trim();
        if (this.deviceInfo.platform) this.deviceInfo.platform = this.deviceInfo.platform.trim();
    }
});

// Pre-save middleware to ensure timestamp is set
UserActivitySchema.pre('save', function () {
    if (!this.timestamp) {
        this.timestamp = new Date();
    }
});

export interface IUserActivityModel extends Model<IUserActivity> {
    getUserActivities(
        userId: mongoose.Types.ObjectId,
        page?: number,
        limit?: number,
        filters?: any
    ): Promise<{
        activities: IUserActivity[];
        pagination: {
            currentPage: number;
            totalPages: number;
            totalActivities: number;
            hasNextPage: boolean;
            hasPrevPage: boolean;
        };
    }>;
    
    getActivityStats(
        userId: mongoose.Types.ObjectId,
        days?: number
    ): Promise<any[]>;
    
    logActivity(activityData: {
        userId: mongoose.Types.ObjectId;
        activityType: string;
        description: string;
        ipAddress?: string;
        userAgent?: string;
        location?: any;
        deviceInfo?: any;
        status?: 'success' | 'failure' | 'warning' | 'info';
        duration?: number;
        resourceId?: mongoose.Types.ObjectId;
        resourceType?: string;
        metadata?: any;
    }): Promise<IUserActivity>;
}

const UserActivity: IUserActivityModel = mongoose.model<IUserActivity, IUserActivityModel>('UserActivity', UserActivitySchema);

export default UserActivity;