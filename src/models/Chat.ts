import mongoose, { Schema, Document } from "mongoose";

export interface IChat extends Document {
  participants: string[]; // Array of User IDs
  type: "private" | "group";
  name?: string; // For group chats
  avatar?: string; // For group chats
  lastMessage?: string; // ID of the last message
  admin?: string; // ID of the admin for group chats
  pinnedMessages: mongoose.Types.ObjectId[];
  pinnedBy: mongoose.Types.ObjectId[];
  archivedBy: mongoose.Types.ObjectId[];
  mutedBy: mongoose.Types.ObjectId[];
  wallpaper?: string;
  themeColor?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema: Schema = new Schema(
  {
    participants: [
      { type: Schema.Types.ObjectId, ref: "User", required: true },
    ],
    type: { type: String, enum: ["private", "group"], default: "private" },
    name: { type: String },
    avatar: { type: String },
    lastMessage: { type: Schema.Types.ObjectId, ref: "Message" },
    admin: { type: Schema.Types.ObjectId, ref: "User" },
    pinnedMessages: [{ type: Schema.Types.ObjectId, ref: "Message" }],
    pinnedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    archivedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    mutedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    wallpaper: { type: String },
    themeColor: { type: String },
  },
  {
    timestamps: true,
  },
);

export default mongoose.models.Chat ||
  mongoose.model<IChat>("Chat", ChatSchema);
