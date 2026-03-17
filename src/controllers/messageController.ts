import { Request, Response, NextFunction } from "express";
import Message from "../models/Message";
import Chat from "../models/Chat";
import mongoose from "mongoose";
import { errorResponse, successResponse } from "./responsControllers";
import User from "../models/schemas/User";
import { io } from "../index";

export const createMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?._id;

    if (!userId) {
      errorResponse(res, { statusCode: 401, message: "Unauthorized" });
      return;
    }

    const { chatId, text, type, mediaUrl, fileName, fileSize, duration, location, contact, replyTo, isForwarded } = req.body;

    if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
      errorResponse(res, { statusCode: 400, message: "Invalid chatId" });
      return;
    }

    const message = await Message.create({
      chatId: new mongoose.Types.ObjectId(chatId),
      sender: new mongoose.Types.ObjectId(userId),
      text,
      type: type || 'text',
      mediaUrl,
      fileName,
      fileSize,
      duration,
      location,
      contact,
      replyTo: replyTo && mongoose.Types.ObjectId.isValid(replyTo) 
        ? new mongoose.Types.ObjectId(replyTo) 
        : undefined,
      isForwarded: !!isForwarded,
      timestamp: new Date(),
      status: 'sent'
    });

    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id
    });

    successResponse(res, {
      statusCode: 201,
      message: "Message created successfully",
      payload: message
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const deleteMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?._id;

        const message = await Message.findById(id);
        if (!message) {
            errorResponse(res, { statusCode: 404, message: "Message not found" });
            return;
        }

        if (message.sender.toString() !== userId.toString()) {
            errorResponse(res, { statusCode: 403, message: "Unauthorized" });
            return;
        }

        await Message.findByIdAndDelete(id);

        successResponse(res, {
            statusCode: 200,
            message: "Message deleted successfully"
        });
        return;
    } catch (error) {
        next(error);
    }
};

export const pinMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { chatId } = req.body;
        const userId = (req as any).user?._id;

        const chat = await Chat.findById(chatId);
        if (!chat) {
            errorResponse(res, { statusCode: 404, message: "Chat not found" });
            return;
        }

        const isPinned = chat.pinnedMessages.includes(new mongoose.Types.ObjectId(id));
        
        if (isPinned) {
            chat.pinnedMessages = chat.pinnedMessages.filter((mId: mongoose.Types.ObjectId) => mId.toString() !== id);
        } else {
            chat.pinnedMessages.push(new mongoose.Types.ObjectId(id));
        }

        await chat.save();

        successResponse(res, {
            statusCode: 200,
            message: isPinned ? "Message unpinned" : "Message pinned",
            payload: { isPinned: !isPinned }
        });
        return;
    } catch (error) {
        next(error);
    }
};

export const reactMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?._id;
    const { messageId, emoji } = req.body as { messageId?: string; emoji?: string };

    if (!userId) {
      errorResponse(res, { statusCode: 401, message: "Unauthorized" });
      return;
    }
    if (!messageId || !mongoose.Types.ObjectId.isValid(messageId) || !emoji) {
      errorResponse(res, { statusCode: 400, message: "Invalid payload" });
      return;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      errorResponse(res, { statusCode: 404, message: "Message not found" });
      return;
    }

    // Toggle reaction for this user/emoji
    const existingIndex = message.reactions.findIndex(
      (r: { emoji: string; userId?: mongoose.Types.ObjectId }) =>
        r.emoji === emoji && r.userId?.toString() === userId.toString()
    );
    if (existingIndex > -1) {
      message.reactions.splice(existingIndex, 1);
    } else {
      message.reactions.push({
        userId: new mongoose.Types.ObjectId(userId),
        emoji
      } as any);
    }
    await message.save();

    // Broadcast via socket to the chat room
    io.to(message.chatId.toString()).emit("message_reaction", {
      messageId: message._id.toString(),
      reactions: message.reactions.map((r: { emoji: string; userId?: mongoose.Types.ObjectId }) => ({ emoji: r.emoji, userId: r.userId?.toString() })),
      userId: userId.toString()
    });

    successResponse(res, {
      statusCode: 200,
      message: "Reaction updated",
      payload: {
        messageId: message._id.toString(),
        reactions: message.reactions
      }
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const starMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?._id;
    const { id } = req.params;

    if (!userId) {
      errorResponse(res, { statusCode: 401, message: "Unauthorized" });
      return;
    }
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      errorResponse(res, { statusCode: 400, message: "Invalid message id" });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      errorResponse(res, { statusCode: 404, message: "User not found" });
      return;
    }

    const hasStarred =
      Array.isArray((user as any).starredMessages) &&
      (user as any).starredMessages.some((m: any) => m.toString() === id);

    if (hasStarred) {
      await User.findByIdAndUpdate(userId, {
        $pull: { starredMessages: new mongoose.Types.ObjectId(id) }
      });
    } else {
      await User.findByIdAndUpdate(userId, {
        $addToSet: { starredMessages: new mongoose.Types.ObjectId(id) }
      });
    }

    successResponse(res, {
      statusCode: 200,
      message: hasStarred ? "Message unstarred" : "Message starred",
      payload: { isStarred: !hasStarred }
    });
    return;
  } catch (error) {
    next(error);
  }
};
