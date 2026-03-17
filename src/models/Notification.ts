import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INotification extends Document {
    userId: mongoose.Types.ObjectId;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success' | 'system';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: string;
    read: boolean;
    readAt?: Date;
    actionUrl?: string;
    actionLabel?: string;
    icon?: string;
    imageUrl?: string;
    metadata?: any;
    expiresAt?: Date;
    scheduledFor?: Date;
    sentAt: Date;
    createdBy?: mongoose.Types.ObjectId;
    tags: string[];
}

const NotificationSchema: Schema<INotification> = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true
    },
    title: {
        type: String,
        required: [true, 'Notification title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    message: {
        type: String,
        required: [true, 'Notification message is required'],
        trim: true,
        maxlength: [1000, 'Message cannot exceed 1000 characters']
    },
    type: {
        type: String,
        enum: ['info', 'warning', 'error', 'success', 'system'],
        default: 'info',
        index: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium',
        index: true
    },
    category: {
        type: String,
        required: [true, 'Notification category is required'],
        enum: [
            'security',
            'account',
            'billing',
            'system',
            'marketing',
            'social',
            'order',
            'shipping',
            'support',
            'update',
            'alert'
        ],
        index: true
    },
    read: {
        type: Boolean,
        default: false,
        index: true
    },
    readAt: {
        type: Date
    },
    actionUrl: {
        type: String,
        trim: true,
        validate: {
            validator: function (url: string) {
                if (!url) return true;
                // Allow relative URLs (starting with /) or absolute URLs
                return /^\/|^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/.test(url);
            },
            message: 'Invalid URL format'
        }
    },
    actionLabel: {
        type: String,
        trim: true,
        maxlength: [50, 'Action label cannot exceed 50 characters']
    },
    icon: {
        type: String,
        trim: true
    },
    imageUrl: {
        type: String,
        trim: true,
        validate: {
            validator: function (url: string) {
                if (!url) return true;
                return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/.test(url);
            },
            message: 'Invalid image URL format'
        }
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: {}
    },
    expiresAt: {
        type: Date,
        index: true,
        validate: {
            validator: function (date: Date) {
                if (!date) return true;
                return date > new Date();
            },
            message: 'Expiration date must be in the future'
        }
    },
    scheduledFor: {
        type: Date,
        index: true,
        validate: {
            validator: function (date: Date) {
                if (!date) return true;
                return date > new Date();
            },
            message: 'Scheduled date must be in the future'
        }
    },
    sentAt: {
        type: Date,
        default: Date.now
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for efficient querying
NotificationSchema.index({ userId: 1, read: 1, sentAt: -1 });
NotificationSchema.index({ category: 1, sentAt: -1 });
NotificationSchema.index({ type: 1, priority: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 } as any);
NotificationSchema.index({ scheduledFor: 1 });

// Virtual for notification status
NotificationSchema.virtual('status').get(function (this: INotification) {
    if (this.read) return 'read';
    if (this.expiresAt && this.expiresAt < new Date()) return 'expired';
    if (this.scheduledFor && this.scheduledFor > new Date()) return 'scheduled';
    return 'unread';
});

// Virtual for isExpired
NotificationSchema.virtual('isExpired').get(function (this: INotification) {
    return this.expiresAt && this.expiresAt < new Date();
});

// Virtual for isScheduled
NotificationSchema.virtual('isScheduled').get(function (this: INotification) {
    return this.scheduledFor && this.scheduledFor > new Date();
});

// Pre-save middleware to set sentAt for non-scheduled notifications
NotificationSchema.pre('save', function (this: INotification) {
    if (!this.scheduledFor || this.scheduledFor <= new Date()) {
        this.sentAt = new Date();
    }
});

// Static method to get user notifications with pagination
NotificationSchema.statics.getUserNotifications = async function (
    userId: mongoose.Types.ObjectId,
    page: number = 1,
    limit: number = 20,
    filters: any = {}
) {
    const skip = (page - 1) * limit;

    const query = {
        userId,
        ...filters,
        $and: [
            {
                $or: [
                    { expiresAt: { $exists: false } },
                    { expiresAt: { $gt: new Date() } }
                ]
            },
            {
                $or: [
                    { scheduledFor: { $exists: false } },
                    { scheduledFor: { $lte: new Date() } }
                ]
            }
        ]
    };

    const notifications = await this.find(query)
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'firstName lastName avatar')
        .lean();

    const total = await this.countDocuments(query);
    const unreadCount = await this.countDocuments({ ...query, read: false });

    return {
        notifications,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalNotifications: total,
            unreadCount,
            hasNextPage: page < Math.ceil(total / limit),
            hasPrevPage: page > 1
        }
    };
};

// Static method to mark notifications as read
NotificationSchema.statics.markAsRead = async function (
    notificationIds: mongoose.Types.ObjectId[],
    userId?: mongoose.Types.ObjectId
) {
    const updateData: any = { read: true, readAt: new Date() };
    const query: any = { _id: { $in: notificationIds } };

    if (userId) {
        query.userId = userId;
    }

    const result = await this.updateMany(query, updateData);
    return result;
};

// Static method to mark all user notifications as read
NotificationSchema.statics.markAllAsRead = async function (userId: mongoose.Types.ObjectId) {
    const result = await this.updateMany(
        { userId, read: false },
        { read: true, readAt: new Date() }
    );
    return result;
};

// Static method to create multiple notifications
NotificationSchema.statics.createMultiple = async function (
    notificationsData: Array<{
        userId: mongoose.Types.ObjectId;
        title: string;
        message: string;
        type?: string;
        priority?: string;
        category: string;
        actionUrl?: string;
        actionLabel?: string;
        icon?: string;
        imageUrl?: string;
        metadata?: any;
        expiresAt?: Date;
        scheduledFor?: Date;
        createdBy?: mongoose.Types.ObjectId;
        tags?: string[];
    }>
) {
    return await this.insertMany(notificationsData);
};

// Method to mark as read
NotificationSchema.methods.markAsRead = function () {
    this.read = true;
    this.readAt = new Date();
    return this.save();
};

// Pre-remove middleware to clean up related data
NotificationSchema.pre('deleteOne', { document: true }, async function () {
    // Clean up any related data if needed
});

const Notification: Model<INotification> = mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;