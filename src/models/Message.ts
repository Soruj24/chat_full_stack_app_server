import mongoose, { Schema, Document } from 'mongoose';

export interface IReaction {
  userId: mongoose.Types.ObjectId;
  emoji: string;
}

export interface IMessage extends Document {
  sender: mongoose.Types.ObjectId;
  receiver?: mongoose.Types.ObjectId;
  chatId: mongoose.Types.ObjectId;
  text?: string;
  type: 'text' | 'image' | 'video' | 'file' | 'voice' | 'location' | 'contact';
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  duration?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  contact?: {
    name: string;
    phoneNumber: string;
    avatar?: string;
  };
  replyTo?: mongoose.Types.ObjectId;
  isForwarded?: boolean;
  status: 'sent' | 'delivered' | 'read';
  timestamp: Date;
  reactions: IReaction[];
}

const MessageSchema: Schema = new Schema({
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: Schema.Types.ObjectId, ref: 'User' },
  chatId: { type: Schema.Types.ObjectId, ref: 'Chat', required: true },
  text: { type: String },
  type: { type: String, enum: ['text', 'image', 'video', 'file', 'voice', 'location', 'contact'], default: 'text' },
  mediaUrl: { type: String },
  fileName: { type: String },
  fileSize: { type: String },
  duration: { type: String },
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
    address: { type: String }
  },
  contact: {
    name: { type: String },
    phoneNumber: { type: String },
    avatar: { type: String }
  },
  replyTo: { type: Schema.Types.ObjectId, ref: 'Message' },
  isForwarded: { type: Boolean, default: false },
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  timestamp: { type: Date, default: Date.now },
  reactions: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    emoji: { type: String }
  }]
});

export default mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);
