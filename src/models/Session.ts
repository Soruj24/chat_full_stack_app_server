import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISession {
    userId: Types.ObjectId;
    accessToken: string;
    refreshToken: string;
    userAgent: string;
    ipAddress: string;
    deviceInfo: string;
    lastActiveAt: Date;
    expiresAt: Date;
    revokedAt?: Date;
    revokedBy?: Types.ObjectId;
}

export interface ISessionDoc extends ISession, Document { }

const sessionSchema = new Schema<ISessionDoc>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        accessToken: {
            type: String,
            required: true,
            index: true,
        },
        refreshToken: {
            type: String,
            required: true,
            index: true,
        },
        userAgent: {
            type: String,
            required: true,
        },
        ipAddress: {
            type: String,
            required: true,
        },
        deviceInfo: {
            type: String,
            enum: ['Desktop', 'Mobile', 'Tablet'],
            required: true,
        },
        lastActiveAt: {
            type: Date,
            default: Date.now,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true,
        },
        revokedAt: {
            type: Date,
        },
        revokedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true,
    }
);

// Index for active sessions
sessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });

// Auto-delete expired sessions (optional, can be handled by TTL index)
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Session = mongoose.model<ISessionDoc>("Session", sessionSchema);
export default Session;