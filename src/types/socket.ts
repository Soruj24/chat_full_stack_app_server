import { Server, Socket } from "socket.io";

export interface UserData {
  username: string;
  userLanguage: string;
  language: string;
  socketId: string;
  rememberSession: boolean;
  joinedAt?: Date;
  sessionRestored?: boolean;
}

export interface ConnectedUsers {
  get(socketId: string): UserData | undefined;
  set(socketId: string, userData: UserData): void;
  delete(socketId: string): void;
  entries(): IterableIterator<[string, UserData]>;
  values(): IterableIterator<UserData>;
}

export interface JoinData {
  username: string;
  userLanguage: string;
  rememberSession?: boolean;
}

export interface RestoreSessionData {
  username: string;
  force?: boolean;
}

export interface AutoJoinData {
  force?: boolean;
  username?: string;
}

export interface ConnectionCheckResponse {
  connected: boolean;
  authenticated: boolean;
  username?: string;
  timestamp: string;
}

export interface JoinSuccessData {
  message: string;
  users: Array<{
    username: string;
    userLanguage: string;
  }>;
  groups: any[];
  onlineUsers: string[];
  userLanguages: Record<string, string>;
  rememberSession?: boolean;
  autoJoinEnabled?: boolean;
  autoJoined?: boolean;
  sessionRestored?: boolean;
}

export interface AuthErrorData {
  message: string;
  event: string;
  requireRejoin: boolean;
  autoJoinFailed: boolean;
}

export interface JoinErrorData {
  error: string;
  autoJoinAvailable: boolean;
}

export interface UserOnlineData {
  username: string;
  userLanguage?: string;
  autoJoined?: boolean;
  manuallyJoined?: boolean;
  sessionRestored?: boolean;
}

export interface UserOfflineData {
  username: string;
  reason?: string;
}

export interface MultipleSessionWarningData {
  message: string;
  newConnection?: boolean;
}

export interface AutoJoinSuccessData {
  username: string;
  userLanguage: string;
  message: string;
  autoJoined?: boolean;
}

export interface InitAuthHandlers {
  (io: Server, socket: Socket, connectedUsers: ConnectedUsers): void;
}

// Chat-specific types
export interface SendMessageData {
  to: string;
  message: string;
  type?: 'text' | 'voice' | 'image' | 'file';
}

export interface SendGroupMessageData {
  groupId: string;
  message: string;
  type?: 'text' | 'voice' | 'image' | 'file';
}

export interface FetchMessagesData {
  withUser: string;
  limit?: number;
  skip?: number;
}

export interface FetchGroupMessagesData {
  groupId: string;
  limit?: number;
  skip?: number;
}

export interface TypingData {
  to: string;
}

export interface GroupTypingData {
  groupId: string;
}

export interface MarkAsReadData {
  messageId: string;
}

export interface UserTypingData {
  username: string;
  typing: boolean;
}

export interface GroupTypingStartData {
  groupId: string;
  user: string;
}

export interface GroupTypingStopData {
  groupId: string;
  user: string;
}

export interface MessageResponse {
  success: boolean;
  message?: any;
  error?: string;
  messages?: any[];
}

export interface NewMessageData {
  _id?: string;
  from: string;
  to?: string;
  groupId?: string;
  message: string;
  type: 'text' | 'voice' | 'image' | 'file';
  timestamp: Date;
  readBy?: Array<{
    username: string;
    readAt: Date;
  }>;
  deliveredTo?: string[];
}

export interface NewGroupMessageData extends NewMessageData {
  groupId: string;
}

export interface InitChatHandlers {
  (io: Server, socket: Socket, connectedUsers: ConnectedUsers): void;
}