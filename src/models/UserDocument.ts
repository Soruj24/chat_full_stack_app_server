import mongoose, { Schema, Document } from "mongoose";

export interface IUserDocument extends Document {
  userId: mongoose.Types.ObjectId;
  fileName: string;
  fileType: string;
  fileUrl: string;
  publicId: string;
  fileSize: number;
  textContent: string;
  summary?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const UserDocumentSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    textContent: {
      type: String,
      required: true,
    },
    summary: {
      type: String,
    },
    metadata: {
      type: Object,
    },
  },
  {
    timestamps: true,
  }
);

// Add index for searching text content
UserDocumentSchema.index({ textContent: "text", fileName: "text" });

export const UserDocument = mongoose.model<IUserDocument>(
  "UserDocument",
  UserDocumentSchema
);
